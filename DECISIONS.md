# Architecture Decision Records

Decisions made during design, with alternatives considered and rationale.

## Business Assumptions

This section documents the core business assumptions that influenced the technical architecture and design decisions.

### BA-001: Platform API rate limits are a real constraint

**Assumption:** Social media platforms enforce rate limits on their APIs, and the system must operate within these constraints to avoid being blocked or throttled.

**Implications:**
- Cache-first strategy is necessary to reduce API calls
- On-demand sync is preferred to continuous polling
- The system should be resilient to temporary platform failures

### BA-002: Comment freshness is important but not critical

**Assumption:** Users want reasonably fresh comment data (within minutes) but don't need real-time updates. A 5-minute delay is acceptable for most use cases.

**Implications:**
- TTL-based cache invalidation is appropriate
- Manual sync endpoint is needed for cases where immediate freshness is required
- Background sync jobs are not necessary for the initial implementation

### BA-003: System resilience is more important than perfect consistency

**Assumption:** When platform APIs fail or return errors, it's better to serve stale comment data than to fail the entire request. Users prefer seeing slightly outdated comments over seeing an error page.

**Implications:**
- Degraded mode operation with sync status indicators
- Cache is served even when sync fails
- Clear communication of data freshness through headers

### BA-004: Scalability is a consideration from the start

**Assumption:** The system should be designed to handle growth in terms of users, posts, and comment volume. Architecture decisions should not become bottlenecks as the system scales.

**Implications:**
- Database indexing on frequently queried fields (post_id)
- Efficient upsert operations to handle comment updates
- Connection pooling and proper resource management

### BA-005: Development and testing should be easy

**Assumption:** The system should be easy to develop and test locally without requiring access to real social media platform credentials or accounts.

**Implications:**
- Stub adapter for development and testing
- Docker-based database setup
- Clear separation between real and test environments

---

## ADR-001: Comment fetch strategy — cache-first with on-demand sync

**Decision:** Comments are served from the local database (cache). When the cache is empty or stale, a sync against the platform API is triggered on-demand before returning results.

**Alternatives considered:**
- **Always live** — every request hits the platform API directly. Simplest logic, but exposes us to platform rate limits and latency on every read. Not viable at scale.
- **Background sync only** — a scheduled job syncs comments periodically regardless of reads. Freshness is unpredictable and infrastructure is heavier (requires a job runner).

**Why cache-first:** Balances freshness with resilience. Users get fast responses from the DB most of the time; the platform is only called when needed. Rate-limit pressure is proportional to actual usage, not a fixed schedule.

---

## ADR-002: Comment threading depth — two levels in API, unlimited in schema

**Decision:** The REST API exposes two levels of threading (top-level comments + direct replies). The database schema uses a `parent_id` self-reference with no depth constraint, allowing deeper threading to be exposed later without a migration.

**Alternatives considered:**
- **Two levels only (schema + API)** — simplest, but requires a breaking schema migration if deeper threading is ever needed.
- **Arbitrary depth (schema + API)** — fully recursive responses add complexity to both serialization and client consumption now, for a requirement that doesn't exist yet.

**Why C:** YAGNI at the API layer, but no technical debt at the schema layer. The incremental cost of the unlimited `parent_id` is near zero; the cost of adding it retroactively would be a non-trivial migration.

---

## ADR-003: Cache staleness strategy — TTL with optional manual sync

**Decision:** Comments are considered stale after a configurable TTL (default 5 minutes). A stale cache triggers an automatic re-sync before the response is returned. Additionally, a `POST /posts/:postId/comments/sync` endpoint allows callers to force a sync at any time.

**Alternatives considered:**
- **TTL only** — no manual override; callers must wait for the TTL to expire even when they know new comments exist (e.g. after publishing a reply).
- **Manual sync only** — no automatic expiry; cache can grow arbitrarily stale if callers forget to sync.
- **TTL + `Cache-Control: no-cache` header** — more REST-idiomatic than a dedicated endpoint, but less discoverable and harder to call from simple HTTP clients or schedulers.

**Why TTL + explicit sync endpoint:** TTL covers the common case automatically. The explicit endpoint is useful immediately after posting a reply (to confirm the reply appears) and gives integrators a predictable lever without coupling them to HTTP header semantics.

---

## ADR-004: Platform adapter coverage — one real adapter + one stub

**Decision:** The initial implementation includes one fully-wired adapter (Twitter/X) that makes real HTTP calls to the platform API, plus a `StubAdapter` that returns fixture data and is clearly marked as a development/demo placeholder.

**Alternatives considered:**
- **Two real adapters** — demonstrates multi-platform support with real code, but doubles the API credential surface, doubles the adapter-specific edge cases to handle, and risks scope creep for a take-home task.
- **All stubs** — keeps scope tight but doesn't demonstrate that the adapter interface actually works end-to-end against a real external API.

**Why one real + one stub:** The Twitter adapter proves the abstraction is real and the interface is workable. The stub proves the pattern extends to new platforms with minimal effort — which is the core claim of the adapter pattern. Adding a second real adapter would be additive work without additional architectural signal.

---

## ADR-005: Platform error handling — serve stale cache with degraded status

**Decision:** When a platform API call fails during sync, the API returns whatever data exists in the local cache along with a `sync_status: "failed"` field in the response. If the cache is empty, an empty comment list is returned with the same degraded indicator.

**Alternatives considered:**
- **Hard fail with 502/503** — communicates the problem clearly but breaks the caller's flow even when usable (if stale) data exists. Poor UX for a read operation where partial data is better than nothing.
- **Hybrid (stale→serve, empty→fail)** — more precise but introduces two different failure modes callers must handle; complicates client error handling for minimal benefit.

**Why always serve cache:** A comment feed is a read-mostly, best-effort surface. Stale comments are useful; an error response is not. The `sync_status` field gives callers all the information they need to decide whether to retry, without forcing them to handle an exception path for every failed background sync.

---

## ADR-006: Testing strategy — integration + E2E only, no unit tests

**Decision:** The test suite consists of integration tests (repository layer against real PostgreSQL) and E2E tests (full HTTP stack with `StubAdapter`). No unit tests for use cases or domain logic.

**Alternatives considered:**
- **Unit + integration + E2E** — maximum coverage but high maintenance overhead; use case logic is thin enough that unit tests would largely duplicate E2E coverage.
- **Unit tests only** — fast but don't catch DB query bugs or HTTP wiring issues.

**Why integration + E2E only:** Use cases are orchestration — they have little logic of their own beyond calling repo and adapter. Testing them in isolation adds noise without meaningful signal. Integration tests catch real DB behaviour; E2E tests catch the full request/response contract. Together they cover what matters.

---

## ADR-007: No mocks in tests — real dependencies or fakes only

**Decision:** Tests never mock internal dependencies — repositories, adapters, and application services are either real or fakes (genuine implementations of the same interface with deterministic behaviour). Third-party external HTTP services (e.g. Twitter API) are the exception: they are intercepted with `nock` because testing against real external APIs in CI is impractical (rate limits, credentials, flakiness).

- Integration tests hit a real PostgreSQL instance (Docker).
- E2E tests use `StubAdapter` — a genuine `ICommentPlatformAdapter` implementation, not a mock.
- Twitter adapter tests use `nock` to intercept outbound HTTP — acceptable because Twitter is a third-party boundary we don't control.

**Why no mocks for internal dependencies:** Mocks encode assumptions about how internal code behaves rather than testing how it actually behaves. A mocked repo or adapter can pass while the real integration fails. Fakes and real dependencies keep tests honest.

**Why mocks are acceptable for third-party services:** External APIs introduce non-determinism (network, rate limits, auth) that makes tests unreliable in CI. Intercepting them at the HTTP boundary is a pragmatic trade-off — we trust the adapter code, not the external service's availability.

---

## ADR-008: Single Twitter account per deployment

**Decision:** The Twitter adapter is configured with one set of OAuth 1.0a credentials per deployment (via environment variables). All publish and reply operations are performed as that single account. There is no per-user credential storage or OAuth flow.

**Alternatives considered:**
- **Per-user OAuth flow** — each end-user connects their own Twitter account via OAuth 2.0 Authorization Code + PKCE. More powerful, but requires an auth callback endpoint, token storage per user, and token refresh logic — significant scope for an initial implementation.
- **API key per tenant** — credentials passed in the request header. Flexible, but introduces credential management complexity and security surface.

**Why single account:** The current scope assumes a single operator managing their own social media presence — one person or team, one set of credentials. This is the common case for a scheduling tool at early stage.

**Future extension:** The adapter interface (`PlatformAdapter`) is intentionally stateless with respect to credentials — it receives no user context. To support per-user accounts, `buildTwitterAdapter` would accept user-scoped tokens instead of reading from global config, and the container would build adapters per-request rather than once at startup. No interface changes required.
