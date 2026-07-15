import type { AppSettings, Message } from '@/types'
import { parseMessage } from '@/schemas'
import { contextWindow } from '../../../shared/context-window'

export { contextWindow }

// ponytail: chars/4 heuristic, same as the context donut — real tokenizers not worth the dep
export function estimateTokens(messages: Message[]): number {
  return messages.reduce((sum, m) => sum + Math.ceil((m.content?.length ?? 0) / 4), 0)
}

/** Compact once the conversation crosses this share of the model's window. */
export const COMPACTION_THRESHOLD = 0.9

/** Share of the window the kept (un-summarized) tail may occupy. */
const KEEP_BUDGET = 0.25

/** Always keep at least this many recent messages verbatim. */
const MIN_KEEP = 4

export function needsCompaction(messages: Message[], model: string): boolean {
  return estimateTokens(messages) >= contextWindow(model) * COMPACTION_THRESHOLD
}

/**
 * Split history into [older → summarized] and [recent → kept verbatim].
 * Keeps the most recent messages up to KEEP_BUDGET of the window (min MIN_KEEP).
 */
export function splitForCompaction(messages: Message[], model: string): { older: Message[]; recent: Message[] } {
  const budget = contextWindow(model) * KEEP_BUDGET
  let tokens = 0
  let i = messages.length
  while (i > 0) {
    const t = Math.ceil((messages[i - 1].content?.length ?? 0) / 4)
    if (tokens + t > budget && messages.length - i >= MIN_KEEP) break
    tokens += t
    i--
  }
  return { older: messages.slice(0, i), recent: messages.slice(i) }
}

const SUMMARIZE_INSTRUCTION =
  'Compact the conversation below into a brief that a model can use as its only memory of it. ' +
  'Preserve every fact, decision, constraint, file path, code identifier, error, and unresolved task. ' +
  'Terse bullet points; no commentary; no information not present in the conversation.'

async function summarize(older: Message[], settings: AppSettings, model: string): Promise<string> {
  const transcript = older
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n\n')

  const baseUrl = settings.apiBaseUrl.replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SUMMARIZE_INSTRUCTION },
        { role: 'user', content: transcript },
      ],
      stream: false,
    }),
  })
  if (!response.ok) throw new Error(`Summarization failed: HTTP ${response.status}`)
  const json = await response.json()
  const summary = json.choices?.[0]?.message?.content
  if (!summary) throw new Error('Summarization returned no content')
  return summary
}

/**
 * Replace the older part of a session's history with a single summary message,
 * both in the DB and in the returned array. Throws if summarization fails —
 * callers should fall back to sending the uncompacted history.
 */
export async function compactConversation(
  sessionId: string,
  messages: Message[],
  settings: AppSettings,
  model: string,
): Promise<{ messages: Message[]; compacted: number }> {
  const { older, recent } = splitForCompaction(messages, model)
  if (older.length === 0) return { messages, compacted: 0 }

  const summary = await summarize(older, settings, model)
  const el = window.electron

  const content = `Context compacted — summary of ${older.length} earlier messages:\n\n${summary}`
  const raw = await el.db.addMessage(sessionId, 'system', content)
  let summaryMsg: Message
  if (raw) {
    summaryMsg = parseMessage(raw)
    // Backdate so it sorts before the kept messages on reload
    await el.db.updateMessage(summaryMsg.id, { created_at: older[0].createdAt })
    summaryMsg = { ...summaryMsg, createdAt: older[0].createdAt }
  } else {
    summaryMsg = { id: crypto.randomUUID(), sessionId, role: 'system', content, createdAt: older[0].createdAt }
  }
  for (const m of older) await el.db.deleteMessage(m.id)

  return { messages: [summaryMsg, ...recent], compacted: older.length }
}
