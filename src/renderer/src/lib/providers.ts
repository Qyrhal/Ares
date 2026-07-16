import type { AppSettings, ProviderConfig } from '@/types'

/**
 * Model references are stored as "providerId::modelId" so a session remembers
 * which provider its model belongs to. Plain model ids (no "::") resolve to
 * the first provider — which also keeps every pre-multi-provider session
 * working unchanged. "::" because model ids themselves may contain "/".
 */
export function splitModelRef(ref: string): { providerId: string | null; modelId: string } {
  const i = (ref ?? '').indexOf('::')
  if (i === -1) return { providerId: null, modelId: ref ?? '' }
  return { providerId: ref.slice(0, i), modelId: ref.slice(i + 2) }
}

export function makeModelRef(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`
}

/** The model id without the provider prefix — what users should see. */
export function displayModel(ref: string): string {
  return splitModelRef(ref).modelId
}

/** Providers list with the legacy single-endpoint fields as a fallback entry. */
export function effectiveProviders(settings: Pick<AppSettings, 'providers' | 'apiBaseUrl' | 'apiKey'>): ProviderConfig[] {
  const providers = settings.providers ?? []
  if (providers.length > 0) return providers
  if ((settings.apiBaseUrl ?? '').trim()) {
    return [{ id: 'default', label: 'Default', baseUrl: settings.apiBaseUrl, apiKey: settings.apiKey ?? '' }]
  }
  return []
}

export function hasProvider(settings: Pick<AppSettings, 'providers' | 'apiBaseUrl' | 'apiKey'>): boolean {
  return effectiveProviders(settings).length > 0
}

export interface ResolvedProvider {
  baseUrl: string
  apiKey: string
  modelId: string
  providerId: string | null
}

/** Resolve a model ref to the endpoint it should be sent to. */
export function resolveProvider(modelRef: string, settings: AppSettings): ResolvedProvider {
  const { providerId, modelId } = splitModelRef(modelRef)
  const providers = effectiveProviders(settings)
  const provider = (providerId ? providers.find((p) => p.id === providerId) : undefined) ?? providers[0]
  if (provider) {
    return { baseUrl: provider.baseUrl, apiKey: provider.apiKey, modelId, providerId: provider.id }
  }
  return { baseUrl: '', apiKey: '', modelId, providerId: null }
}
