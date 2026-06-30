import type { PlatformAdapter } from '../../domain/platform-adapter.port'
import type { Platform } from '../../domain/comment.entity'

export type AdapterRegistry = Map<Platform, PlatformAdapter>

export class PlatformNotSupportedError extends Error {
  constructor(platform: string) {
    super(`No adapter registered for platform: ${platform}`)
    this.name = 'PlatformNotSupportedError'
  }
}

export function getAdapter(registry: AdapterRegistry, platform: Platform): PlatformAdapter {
  const adapter = registry.get(platform)
  if (!adapter) throw new PlatformNotSupportedError(platform)
  return adapter
}
