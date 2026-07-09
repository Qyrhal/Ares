// Pure, framework-free helpers for agent orchestration (auto-answering sub-agent
// questions, and the shared "team notes" board). No electron/db imports so these
// are directly unit-testable without mocking Electron.

export interface OrchestrationQuestion {
  question: string
  header: string
  options?: string[]
  multiSelect?: boolean
}

export function buildAutoAnswerMessages(
  parentTask: string,
  childTitle: string,
  questions: OrchestrationQuestion[]
): { system: string; user: string } {
  const questionsText = questions
    .map((q, i) => {
      const opts = q.options && q.options.length > 0 ? ` (options: ${q.options.join(', ')})` : ''
      return `${i + 1}. [${q.header}] ${q.question}${opts}`
    })
    .join('\n')

  const system = `You are the orchestrating agent overseeing a sub-agent named "${childTitle}". Your original task was: "${parentTask}". The sub-agent needs your input to continue its work — answer on the user's behalf using your knowledge of the task and project. Respond with ONLY a JSON object mapping each question's header to your answer string, e.g. {"Header1": "answer", "Header2": "answer"}. Pick from the given options when options are provided.`

  return { system, user: questionsText }
}

export function parseAutoAnswerResponse(
  raw: string,
  questions: { header: string }[]
): Record<string, string> {
  let parsed: Record<string, unknown> = {}
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const candidate = fenced ? fenced[1] : raw
  const jsonMatch = candidate.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0])
      if (obj && typeof obj === 'object') parsed = obj
    } catch {
      // fall through to per-question fallback below
    }
  }

  const answers: Record<string, string> = {}
  for (const q of questions) {
    const value = parsed[q.header]
    answers[q.header] = typeof value === 'string' && value.trim().length > 0
      ? value
      : raw.trim().slice(0, 200) || 'No answer provided.'
  }
  return answers
}

export interface SessionRef {
  id: string
  parent_id?: string | null
}

// Walks the parent_id chain to find the ultimate ancestor ("team root").
// Cycle-safe: a session already visited breaks the walk instead of looping forever.
export function findRootSessionId(sessions: SessionRef[], sessionId: string): string {
  const byId = new Map(sessions.map((s) => [s.id, s]))
  let current = byId.get(sessionId)
  const seen = new Set<string>()
  while (current?.parent_id && !seen.has(current.id)) {
    seen.add(current.id)
    const parent = byId.get(current.parent_id)
    if (!parent) break
    current = parent
  }
  return current?.id ?? sessionId
}

export interface TeamNoteRef {
  from_title: string
  note: string
}

export function formatTeamNotes(notes: TeamNoteRef[]): string {
  if (notes.length === 0) return ''
  return notes.map((n) => `[${n.from_title}] ${n.note}`).join('\n')
}

// Prepends accumulated team notes to a sub-agent's task briefing, if any exist.
export function briefWithTeamNotes(task: string, notes: TeamNoteRef[]): string {
  const formatted = formatTeamNotes(notes)
  return formatted ? `Team notes so far:\n${formatted}\n\n---\n\n${task}` : task
}
