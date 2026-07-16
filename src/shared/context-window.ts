/**
 * Rough context window per model family. Single source of truth —
 * used by the renderer (context donut, chat-mode compaction) and the
 * main process (Pi model registration, which drives the SDK's own
 * auto-compaction threshold).
 */
export function contextWindow(model: string): number {
  // Accept both plain model ids and "providerId::modelId" refs
  const ref = model ?? ''
  const sep = ref.indexOf('::')
  const m = (sep === -1 ? ref : ref.slice(sep + 2)).toLowerCase()
  if (m.includes('claude')) return 200000
  if (m.includes('gpt-4.1') || m.includes('gpt-4o')) return 128000
  if (m.includes('gpt-4')) return 8192
  if (m.includes('gpt-3.5')) return 16385
  if (m.includes('deepseek')) return 64000
  return 128000
}
