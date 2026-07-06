# PR 3: Agent System Deepening — Implementation Spec

## PR 3 Architecture Overview

The existing agent system has:
- `Session.parentId` and `Session.agentStatus` fields on every session
- `pi:agent-spawned`, `pi:agent-status`, `pi:session-complete` IPC events from main→renderer
- `spawnAgent` / `spawnAgents` tools in the Pi SDK layer (`pi.ts`)
- `AgentTree`, `AgentDashboard`, `SpawnAgentDialog`, `AgentQuestionCard` components
- An `agents` activity view in `App.tsx` that shows `AgentTree` sidebar + `ChatView`

PR 3 extends this to handle AI-initiated spawning, live progress, termination, queuing, timeouts, model overrides, cost tracking, and collapsible results. The core insight: **every agent = a native `Session`** with `parentId`. There is no separate agent entity.

---

### Feature 3.1 — Spawn agent from AI message

**What:** Detect when an assistant message's content or tool call implies a sub-agent should be spawned, then auto-create a child session and run it.

**How:** Parse finished assistant messages for spawn patterns. In `App.tsx`'s `handleSend` flow, after an assistant message completes and `onDone` fires, run a lightweight detection pass:

```
src/renderer/src/hooks/useAgentSpawn.ts   [NEW]
src/main/pi.ts                             [MODIFY]
src/renderer/src/App.tsx                   [MODIFY]
```

**`src/renderer/src/hooks/useAgentSpawn.ts`** (new)
- `detectSpawnIntent(content: string): { task: string; title: string } | null`
  - Regex patterns: `"spawn an agent to"`, `"create a sub-agent for"`, `"delegate the task of"`
  - Returns `null` when no spawn intent detected
- `useAgentSpawn()` — a hook that takes `(sessionId, lastAssistantMessage)` and returns `{ pendingSpawn, confirmSpawn, cancelSpawn }`
  - On detection, sets a `pendingSpawn` state with the suggested task/title
  - The `confirmSpawn` callback calls through to the existing SpawnAgentDialog's logic path

**`src/main/pi.ts`** — In the `spawnAgent` tool handler (lines ~329-365):
- After the sub-agent prompt completes and returns accumulated text, also send a `pi:agent-result` event containing the session ID and accumulated text. This lets the parent thread show result inline.
- Add `win.webContents.send('pi:agent-result', childDb.id, accumulated)` after `updateSession(childDb.id, { agent_status: 'done' })` line (~357).

**`src/renderer/src/App.tsx`** — In the `handleSend` `onDone` callback (~line 411-422):
- After the assistant message is saved and `store.setLoading(false)` is called, check `detectSpawnIntent(fullText)`.
- If detected, show a confirmation in the UI (via the `pendingQuestion` pattern — reuse the `AgentQuestionCard` with a yes/no question).
- On user confirmation, call `el.db.createSession(title, model, parentId)` → `addMessage(childId, 'user', task)` as `spawnAgent` does in `pi.ts`.

**Storage changes:** None needed — reuses existing `parentId`, `createSession`, `addMessage`.

**IPC changes:**
- `pi:agent-result` (new event, main→renderer): `(sessionId: string, resultText: string)` — carries the finished sub-agent output so the parent thread can display it inline.

**Preload changes:**
- `src/preload/index.ts`: Add `onAgentResult` listener for `pi:agent-result`
- `src/renderer/src/globals.d.ts`: Add `onAgentResult` to `pi` interface

**Store state:** None new.

**Test coverage:**
- `src/renderer/src/__tests__/useAgentSpawn.test.ts` — Test detectSpawnIntent with positive/negative cases.

---

### Feature 3.2 — Agent creation from chat context (right-click or button)

**What:** Add a "Delegate to new agent" option on assistant messages. Context menu on messages in the thread.

**How:** Add a context menu to `MessageItem` for assistant messages. Add a "Delegate" button that opens `SpawnAgentDialog` pre-filled with the message content.

```
src/renderer/src/components/MessageItem.tsx    [MODIFY]
src/renderer/src/components/ChatView.tsx       [MODIFY]
src/renderer/src/components/ContextMenu.tsx    [NEW — or reuse shadcn context-menu]
```

**`src/renderer/src/components/MessageItem.tsx`**:
- Add a right-click handler on assistant message bubbles
- Show a dropdown/context-menu with "Delegate to new agent" option
- Call `onDelegate(message.content)` prop — bubbled up to `ChatView` → `App.tsx`
- Alternatively, a small button (robot icon) appears on hover in the message footer

**`src/renderer/src/components/ChatView.tsx`**:
- Add `onDelegate?: (text: string) => void` prop
- Pass it to `MessageItem`
- Wire to existing `SpawnAgentDialog` modal

**`src/renderer/src/App.tsx`**:
- When delegate is triggered, pre-fill `SpawnAgentDialog` with the message content as the task

**UI component:** Use the existing shadcn `context-menu` components (already in deps). If not available, import from `@/components/ui/context-menu.tsx`.

**Store state:** None.

**Test coverage:**
- `src/renderer/src/__tests__/context-menu.test.tsx` — Already exists, update for "Delegate" option
- `src/renderer/src/__tests__/message-item.test.tsx` — Test context menu on assistant messages

---

### Feature 3.3 — Agent output display in thread

**What:** When a spawned agent completes, show its result inline in the parent thread as a collapsible message.

**How:** Listen for `pi:agent-result` events in `App.tsx`, display the result as a nested message within the parent thread.

```
src/main/pi.ts                                [MODIFY add pi:agent-result event]
src/preload/index.ts                          [MODIFY add listener]
src/renderer/src/globals.d.ts                 [MODIFY add type]
src/renderer/src/App.tsx                      [MODIFY handle agent-result]
src/renderer/src/components/MessageItem.tsx   [MODIFY render agent-result messages]
src/renderer/src/types/index.ts              [MODIFY add AgentResult message subtype]
```

**`src/renderer/src/types/index.ts`**:
- Add `AgentResultMessage` interface or extend `Message`:
  ```ts
  export interface AgentResultMessage extends Message {
    role: 'assistant'
    isAgentResult: true
    agentSessionId: string
    agentTitle: string
    agentSummary: string
    agentCollapsed?: boolean
  }
  ```
- Or add optional fields on `Message`: `isAgentResult?: boolean`, `agentSessionId?: string`, `agentTitle?: string`

**`src/renderer/src/App.tsx`**:
- In the bootstrap `useEffect` listener block (~line 144-161), add:
  ```ts
  const offAgentResult = el.pi.onAgentResult((sessionId, resultText, agentSessionId) => {
    // When the parent session is the active one, inject a result message
    if (sessionId !== useAppStore.getState().activeTabId) return
    const agentSess = useAppStore.getState().sessions.find(s => s.id === agentSessionId)
    const resultMsg: Message = {
      id: uuidv4(),
      sessionId,
      role: 'assistant',
      content: resultText,
      isAgentResult: true,
      agentSessionId,
      agentTitle: agentSess?.title ?? 'Sub-agent',
      createdAt: Date.now(),
    }
    useAppStore.getState().appendMessage(resultMsg)
  })
  ```

**`src/renderer/src/components/MessageItem.tsx`**:
- When `message.isAgentResult` is true, render a collapsible block:
  - Header: robot icon + agent title + collapse chevron
  - Expanded content: markdown-rendered result text
  - Link to open the agent session tab on click

**IPC/preload:** Add `onAgentResult` to `pi` bridge in `src/preload/index.ts`.

**Store state:** None new (reuses `appendMessage`).

**Test coverage:**
- `src/renderer/src/__tests__/message-item.test.tsx` — Test agent result rendering and collapse behavior
- `src/renderer/src/__tests__/agent-result-flow.test.ts` — Test full flow from IPC event to rendered message

---

### Feature 3.4 — Agent live progress streaming

**What:** Show sub-agent status updates in real-time in the parent thread (tokens received, status changes, progress indicators).

**How:** The `pi:agent-status` event already propagates status changes. Add a `pi:agent-delta` event that streams the accumulating text from child sessions to the parent UI.

```
src/main/pi.ts                                [MODIFY — agent delta streaming]
src/preload/index.ts                          [MODIFY]
src/renderer/src/globals.d.ts                 [MODIFY]
src/renderer/src/App.tsx                      [MODIFY — show progress in parent]
src/renderer/src/components/AgentProgressCard.tsx  [NEW]
```

**`src/main/pi.ts`**:
- Inside the `spawnAgent` tool's `childPiSession.subscribe()` handler (~line 345-349), also send `pi:agent-delta` events to the **parent** session:
  ```ts
  if (!win.isDestroyed()) {
    win.webContents.send('pi:agent-delta', sessionId, childDb.id, accumulated, 'running')
  }
  ```
- On completion, send `pi:agent-delta(sessionId, childDb.id, finalText, 'done')`.
- On error, send `pi:agent-delta(sessionId, childDb.id, errMsg, 'error')`.

**`src/renderer/src/components/AgentProgressCard.tsx`** (new):
- Receives `{ sessionId, agentSessionId, title, status, progressText }`
- Renders as a thin progress row at the bottom of the parent chat:
  - Animated spinner/sparkle when status='running'
  - Progress text (first 80 chars of accumulating output)
  - Small "Open" button that navigates to the child session

**`src/renderer/src/App.tsx`**:
- Maintain a `Map<string, AgentProgress>` in React state for active agent deltas
- Listen for `pi:agent-delta` events; upsert into the map
- Pass the active deltas (filtered to current session) to `ChatView` → renders `AgentProgressCard`s between messages and input bar
- When agent status becomes 'done' or 'error', remove from deltas after 5s delay

**Store state:** No new zustand state — use local React state in App.tsx (agent deltas are transient).

**Test coverage:**
- `src/renderer/src/__tests__/agent-progress-card.test.tsx` — Tests rendering progress states

---

### Feature 3.5 — Agent termination from UI

**What:** Add a kill/stop button on running agents in the sidebar tree and agent dashboard.

```
src/renderer/src/components/AgentTree.tsx       [MODIFY]
src/renderer/src/components/AgentDashboard.tsx  [MODIFY]
src/renderer/src/App.tsx                        [MODIFY]
```

**`src/renderer/src/components/AgentTree.tsx`**:
- In `TreeNodeView`, when `session.agentStatus === 'running'`, show a small X/stop button on hover (or always visible)
- Add `onTerminateAgent: (id: string) => void` prop
- Pass termination handler down from App

**`src/renderer/src/components/AgentDashboard.tsx`**:
- In `AgentCard`, when `status === 'running'`, show a stop button
- Add `onTerminate: (id: string) => void` prop

**`src/renderer/src/App.tsx`**:
- Add `handleTerminateAgent(id)` callback:
  ```ts
  const handleTerminateAgent = useCallback((id: string) => {
    el.pi.abort(id)
    el.db.updateSession(id, { agent_status: 'error' })
    store.updateSession(id, { agentStatus: 'error' })
  }, [])
  ```
- Wire through to AgentTree and AgentDashboard

**Store/IPC:** Reuses existing `pi:abort` and `updateSession`. No new IPC.

**Test coverage:**
- `src/renderer/src/__tests__/agent-tree.test.tsx` — Test terminate button appears only on running agents
- `src/renderer/src/__tests__/agent-dashboard.test.tsx` — Test terminate button on running cards

---

### Feature 3.6 — Agent queue with priority

**What:** Queue for spawning multiple agents with priority ordering. When spawn requests exceed concurrency limit, queue them and run in priority order.

```
src/main/pi.ts                                [MODIFY — add queue logic]
src/renderer/src/hooks/useAgentQueue.ts       [NEW]
src/renderer/src/components/AgentTree.tsx     [MODIFY — show queue]
```

**`src/main/pi.ts`**:
- Add a queue module within pi.ts:
  ```ts
  interface QueuedAgent {
    id: string
    sessionId: string
    task: string
    title: string
    model: string
    priority: number  // lower = higher (1=high, 5=low)
    timeout: number   // ms
    createdAt: number
    status: 'queued' | 'running' | 'done' | 'error'
  }
  const agentQueue: QueuedAgent[] = []
  const MAX_CONCURRENT = 3  // configurable
  let runningCount = 0
  ```
- Modify the `spawnAgent` and `spawnAgents` tool handlers to enqueue instead of running immediately
- Add `processQueue()` function that dequeues up to `MAX_CONCURRENT` items sorted by priority
- Send `pi:agent-queue-update` IPC events whenever the queue changes
- Add a `setAgentQueueConfig` IPC handler for max concurrency and default timeout

**`src/renderer/src/hooks/useAgentQueue.ts`** (new):
- React hook that listens for `pi:agent-queue-update` events
- Returns `{ queued: QueuedAgent[], running: QueuedAgent[], maxConcurrency: number }`

**`src/renderer/src/components/AgentTree.tsx`**:
- Show a "Queued" section above or below the tree showing queued agents with their priority
- Show queue position indicator

**IPC changes:**
- `pi:agent-queue-update` (main→renderer): `{ queued: QueuedAgent[], running: number, maxConcurrency: number }`

**Preload changes:**
- Add `onAgentQueueUpdate` to `pi` bridge

**Store state:** No new zustand state (UI-local via React state).

**Test coverage:**
- `src/main/__tests__/pi-queue.test.ts` — Test queue ordering, priority, max concurrency, timeout

---

### Feature 3.7 — Agent timeout configuration

**What:** Configurable max duration per agent session. When an agent exceeds its timeout, auto-terminate it.

```
src/main/pi.ts                                [MODIFY]
src/renderer/src/components/SpawnAgentDialog.tsx  [MODIFY]
src/renderer/src/types/index.ts              [MODIFY]
```

**`src/main/pi.ts`**:
- Each agent session gets a timeout timer when it starts running
- If the `childPiSession.prompt(task)` doesn't complete within `timeout` ms, call `childPiSession.abort()` and send error status
- Default timeout: 5 minutes (300_000 ms), configurable via `setAgentQueueConfig` IPC
- For the queue, each queued item carries its timeout

**`src/main/index.ts`**:
- Add IPC handler `agent:setQueueConfig` accepting `{ maxConcurrency: number, defaultTimeoutMs: number }`
- Add IPC handler `agent:getQueueConfig` returning current config

**`src/renderer/src/components/SpawnAgentDialog.tsx`**:
- Add a "Timeout" field (number input, minutes) to the dialog
- Add "Priority" field (dropdown: High/Medium/Low)

**`src/renderer/src/types/index.ts`**:
- Extend Session: add `agentTimeout?: number`, `agentPriority?: number`

**Store state:** Add `agentTimeout` and `agentPriority` to the `Session` interface and the `updateSession` path.

**Test coverage:**
- `src/main/__tests__/pi-timeout.test.ts` — Test that agent is aborted when timeout elapses

---

### Feature 3.8 — Per-agent model override

**What:** Each spawned agent can use a different model than its parent.

**How:** Pass model override through `createSession` and the Pi SDK session creation.

```
src/main/pi.ts                                [MODIFY]
src/renderer/src/components/SpawnAgentDialog.tsx  [MODIFY]
src/renderer/src/types/index.ts              [MODIFY (already has Session.model)]
src/renderer/src/App.tsx                      [MODIFY]
```

**`src/main/pi.ts`**:
- The `spawnAgent` tool already receives `model` from the parent's `settingsKey`. Modify the tool to accept an optional `model` parameter in its arguments:
  ```ts
  parameters: {
    ...
    model: { type: 'string', description: 'Model ID override (optional)' }
  }
  ```
- When creating the child Pi session, use the override model if provided, else the parent's model
- The `getOrCreate` function already handles model registry from `settingsKey` — pass the overridden model ID
- For the model-override path, register the overridden model in the model registry

**`src/renderer/src/components/SpawnAgentDialog.tsx`**:
- Add a "Model" field: text input or dropdown (reuse model picker logic from `InputBar`)
- Defaults to the parent session's model

**`src/renderer/src/App.tsx`**:
- When spawning from the dialog, pass the model override to `createSession`
- Store model override in `updateSession(session.id, { model: overrideModel })`

**No type changes needed:** `Session.model` already exists.

**Test coverage:**
- `src/main/__tests__/pi-model-override.test.ts` — Test child session uses model override correctly

---

### Feature 3.9 — Agent cost/token tracking

**What:** Accumulate token usage per agent tree. Track input tokens, output tokens, and estimated cost for each agent and roll up to parent.

```
src/main/pi.ts                                [MODIFY]
src/renderer/src/store/useAppStore.ts         [MODIFY]
src/renderer/src/types/index.ts              [MODIFY]
src/renderer/src/components/AgentTree.tsx     [MODIFY]
src/renderer/src/components/AgentDashboard.tsx [MODIFY]
```

**`src/renderer/src/types/index.ts`**:
- Add to `Session`:
  ```ts
  tokenUsage?: {
    inputTokens: number
    outputTokens: number
    totalCost: number
  }
  ```

**`src/main/db.ts`**:
- Add `token_usage` field to `DbSession` (nullable JSON string)

**`src/main/pi.ts`**:
- The Pi SDK events (from `@earendil-works/pi-coding-agent`) likely expose token usage on the `agent_end` event. Check if `event.metrics` or `event.usage` exists on `agent_end`.
- If available, capture `usage.inputTokens` and `usage.outputTokens` on the `agent_end` event handler (~line 565-570)
- Store token usage on the session via `updateSession(sessionId, { token_usage: JSON.stringify({ inputTokens, outputTokens, totalCost }) })`
- Send `pi:token-usage` IPC event with the usage data so the renderer can display it in real-time

**`src/renderer/src/store/useAppStore.ts`**:
- Add `updateSessionTokenUsage: (id: string, usage: TokenUsage) => void`

**`src/renderer/src/App.tsx`**:
- Listen for `pi:token-usage` events and update store

**`src/renderer/src/components/AgentTree.tsx`**:
- Show token count next to message count in tree nodes
- Show estimated cost on hover or in a tooltip

**`src/renderer/src/components/AgentDashboard.tsx`**:
- Show total cost column in the dashboard

**IPC changes:**
- `pi:token-usage` (main→renderer): `(sessionId: string, usage: { inputTokens: number; outputTokens: number; totalCost: number })`

**Preload changes:**
- Add `onTokenUsage` listener

**Test coverage:**
- `src/renderer/src/__tests__/store.test.ts` — Test token usage update on sessions

---

### Feature 3.10 — Sub-agent result collapse/expand

**What:** Collapsible message showing sub-agent output, with expand/collapse persistence per session.

**How:** Already partially handled by Feature 3.3. This adds persistence (expand state saved in DB) and a cleaner UI.

```
src/renderer/src/components/MessageItem.tsx           [MODIFY]
src/renderer/src/components/AgentResultBlock.tsx      [NEW]
src/renderer/src/types/index.ts                       [MODIFY]
src/main/db.ts                                         [MODIFY]
```

**`src/renderer/src/components/AgentResultBlock.tsx`** (new):
- Separate component for rendering agent result messages
- Props: `{ message: Message, onToggleCollapse: () => void }`
- Styled similar to `ThinkingBlock` and `ToolCallBlock` — consistent collapsible pattern
- Header: agent icon + title + token usage badge + collapse icon
- Body: markdown content
- Footer: "Open session" button, "Re-run" button

**`src/renderer/src/components/MessageItem.tsx`**:
- When `message.isAgentResult`, render `AgentResultBlock` instead of standard assistant rendering

**`src/renderer/src/types/index.ts`**:
- Add `agentCollapsed?: boolean` to Message (for persistence)

**`src/main/db.ts`**:
- No changes needed — `content` already stores the result text. Collapse state is UI-only, not persisted (stored in local React state).

**Store state:** Collapse state kept in local React state, not zustand.

**Test coverage:**
- `src/renderer/src/__tests__/agent-result-block.test.tsx` — Test collapse/expand toggle

---

# PR 4: Token Economy & Performance — Implementation Spec

## PR 4 Architecture Overview

Token tracking requires capturing usage metrics from the Pi SDK streaming events and propagating them through the IPC bridge into the React store. There is currently no token tracking in the app. The Pi SDK's `agent_end` event (in `handlePiSend`) is the place to capture final usage data. For live tokens-per-second, we count characters from `text_delta` events and compute rate over a sliding window.

Cost estimation uses a pricing table keyed by model name. Context-window size is already roughly handled in `InputBar.tsx` via `contextWindow()`.

---

### Feature 4.1 — Tokens per second live display

**What:** During streaming, show live tokens/sec in the ChatView header or status bar.

```
src/renderer/src/components/ChatView.tsx       [MODIFY]
src/renderer/src/hooks/useTokenRate.ts         [NEW]
```

**`src/renderer/src/hooks/useTokenRate.ts`** (new):
- Maintains a sliding window buffer of character counts and their timestamps
- `updateRate(charCount: number)` — called on each delta event with the new total length
- Returns `{ tokensPerSecond: number }` — estimated as `(charCount / 4) / elapsedSeconds`
- Smooths over a 3-second sliding window

**`src/renderer/src/components/ChatView.tsx`**:
- Add a small live TPS badge in the header bar (next to session title)
- Accept `isLoading` (already done) and compute TPS via `useTokenRate`
- Only visible when `isLoading === true`

**Store state:** None — local hook state.

**Test coverage:**
- `src/renderer/src/__tests__/useTokenRate.test.ts` — Test rate calculation with mock delta timestamps

---

### Feature 4.2 — Total tokens per message

**What:** After streaming completes, show total tokens used for that message.

```
src/renderer/src/components/MessageItem.tsx   [MODIFY]
src/renderer/src/types/index.ts              [MODIFY]
src/main/db.ts                                [MODIFY]
src/main/pi.ts                                [MODIFY]
```

**`src/renderer/src/types/index.ts`**:
- Add to `Message`:
  ```ts
  tokenUsage?: {
    inputTokens?: number
    outputTokens?: number
    totalCost?: number
  }
  ```

**`src/main/db.ts`**:
- Add `token_usage` to `DbMessage` as nullable JSON string

**`src/main/pi.ts`**:
- In `handlePiSend`, when `agent_end` arrives (~line 565-570), capture any usage event data
- If the Pi SDK events include token usage (check on `event.metrics`), destructure and store it
- Store via `updateMessage(msgId, { token_usage: JSON.stringify({ ... }) })` (need to get the message ID — the assistant message ID is obtained from the `addMessage` call in the renderer)
- Simpler approach: send `pi:token-usage` to renderer and let it attach to the message

**`src/renderer/src/components/MessageItem.tsx`**:
- After an assistant message (not streaming), show a small token badge in the message footer:
  ```
  [~X tokens]  [$0.00XX]
  ```
- Display only `outputTokens` for the message

**`src/renderer/src/App.tsx`**:
- In the `onDone` callback, after saving the assistant message, attach token usage from the last `pi:token-usage` event

**Test coverage:**
- `src/renderer/src/__tests__/message-item.test.tsx` — Test token badge rendering

---

### Feature 4.3 — Session token accumulator

**What:** Running total of tokens across all messages in a session, stored on the session object.

```
src/renderer/src/store/useAppStore.ts         [MODIFY]
src/renderer/src/types/index.ts              [MODIFY]
src/main/db.ts                                [MODIFY]
src/main/pi.ts                                [MODIFY]
```

**`src/renderer/src/types/index.ts`**:
- Already added `tokenUsage` to `Session` in PR3 Feature 9. Ensure it includes `totalSessionTokens: number`.

**`src/renderer/src/store/useAppStore.ts`**:
- Add action: `accumulateTokenUsage(sessionId: string, usage: { input: number; output: number }): void`
  - Looks up the session, reads current `tokenUsage`, sums, and writes back
- Call this whenever a message completes with token data

**`src/main/db.ts`**:
- Ensure `updateSession` can patch `token_usage` (JSON string field)

**`src/main/pi.ts`**:
- Cumulatively update session token counts on each `agent_end`

**No new IPC needed.**

**Test coverage:**
- `src/renderer/src/__tests__/store.test.ts` — Test `accumulateTokenUsage`

---

### Feature 4.4 — Estimated cost display

**What:** Cost calculation based on model pricing. Display estimated cost per message and per session.

```
src/renderer/src/lib/pricing.ts              [NEW]
src/renderer/src/components/MessageItem.tsx   [MODIFY]
src/renderer/src/components/ChatView.tsx      [MODIFY]
```

**`src/renderer/src/lib/pricing.ts`** (new):
```ts
export interface ModelPrice {
  input: number   // per 1M tokens
  output: number  // per 1M tokens
  contextWindow: number
}

const PRICING: Record<string, ModelPrice> = {
  'gpt-4o': { input: 2.5, output: 10, contextWindow: 128000 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, contextWindow: 128000 },
  'gpt-4.1': { input: 2, output: 8, contextWindow: 128000 },
  'claude-sonnet-4-20250514': { input: 3, output: 15, contextWindow: 200000 },
  'claude-haiku-3-5': { input: 0.8, output: 4, contextWindow: 200000 },
  'deepseek-chat': { input: 0.5, output: 2, contextWindow: 64000 },
  'deepseek-reasoner': { input: 0.5, output: 2, contextWindow: 64000 },
  // default: fallback
}
const DEFAULT_PRICE: ModelPrice = { input: 1, output: 4, contextWindow: 128000 }

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? DEFAULT_PRICE
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

export function formatCost(cost: number): string {
  if (cost < 0.001) return '<$0.001'
  return `$${cost.toFixed(4)}`
}

export function getContextWindow(model: string): number {
  return (PRICING[model] ?? DEFAULT_PRICE).contextWindow
}
```

**`src/renderer/src/components/MessageItem.tsx`**:
- Use `estimateCost()` and `formatCost()` to show cost badge on messages with token data

**Test coverage:**
- `src/renderer/src/__tests__/pricing.test.ts` — Test cost calculations for different models

---

### Feature 4.5 — Response time (latency) display

**What:** Show how long each assistant response took (wall-clock time from send to done).

```
src/renderer/src/App.tsx                      [MODIFY]
src/renderer/src/components/MessageItem.tsx   [MODIFY]
src/renderer/src/types/index.ts              [MODIFY]
src/main/db.ts                                [MODIFY]
```

**`src/renderer/src/App.tsx`**:
- In `handleSend`, record start time: `const startTime = Date.now()`
- In the `onDone` callback, compute `const latencyMs = Date.now() - startTime`
- Store it on the message:
  ```ts
  el.db.addMessage(sess.id, 'assistant', fullText, { thinking, latencyMs })
  ```
  (Need to add `latencyMs` to `addMessage` opts)

**`src/renderer/src/types/index.ts`**:
- Add to `Message`: `latencyMs?: number`

**`src/main/db.ts`**:
- Add `latency_ms` field to `DbMessage`

**`src/renderer/src/components/MessageItem.tsx`**:
- Display `latencyMs` as small text in message footer: `"2.3s"`

**Test coverage:**
- `src/renderer/src/__tests__/store.test.ts` — Test latency field round-trip

---

### Feature 4.6 — Model context window display

**What:** Show the model's max context limit in the status bar and settings.

```
src/renderer/src/components/StatusBar.tsx     [MODIFY]
src/renderer/src/lib/pricing.ts              [ALREADY has getContextWindow]
```

**`src/renderer/src/components/StatusBar.tsx`**:
- Add a context window indicator: `"128K ctx"` next to the model name
- Import `getContextWindow` from `@/lib/pricing`

**`src/renderer/src/components/InputBar.tsx`**:
- Already has `contextWindow()` and `ContextDonut` — but use the centralized `getContextWindow()` from `pricing.ts` instead of the inline function

**Test coverage:**
- `src/renderer/src/__tests__/status-bar.test.tsx` — Test context window display

---

### Feature 4.7 — Remaining context tokens

**What:** Show (context limit - session tokens) in the status bar. Already partially done in `InputBar` but needs to be elevated.

```
src/renderer/src/components/StatusBar.tsx     [MODIFY]
src/renderer/src/lib/pricing.ts              [ALREADY has getContextWindow]
```

**`src/renderer/src/components/StatusBar.tsx`**:
- Add token usage indicator: `"2.4K / 128K tokens"` or `"125.6K remaining"`
- Needs access to the current session's accumulated token count
- Accept `sessionTokenUsage?: { inputTokens: number; outputTokens: number }` prop

**`src/renderer/src/components/App.tsx`**:
- Pass `activeSession?.tokenUsage` to `StatusBar`

**Store state:** Already on `Session.tokenUsage`.

**Test coverage:**
- Existing status bar tests

---

### Feature 4.8 — Token usage breakdown

**What:** Input vs output token counts for each message, shown inline.

```
src/renderer/src/components/MessageItem.tsx   [MODIFY]
src/renderer/src/types/index.ts              [ALREADY extended above]
```

**`src/renderer/src/components/MessageItem.tsx`**:
- For assistant messages with `message.tokenUsage`, show a breakdown:
  ```
  ↑X in · ↓Y out · ~Z total · $0.00XX
  ```
- For tool messages, show approximate input/output from `toolInput`/`toolOutput` length
- Use a popover or tooltip on hover for the full breakdown

**`src/renderer/src/components/AgentResultBlock.tsx`**:
- Show token breakdown for agent results

**Test coverage:**
- `src/renderer/src/__tests__/message-item.test.tsx` — Test token breakdown display

---

### Feature 4.9 — API call timing

**What:** Latency breakdown for each API call — time to first token (TTFT) and total response time.

```
src/main/pi.ts                                [MODIFY]
src/renderer/src/App.tsx                      [MODIFY]
src/renderer/src/components/MessageItem.tsx   [MODIFY]
src/renderer/src/types/index.ts              [MODIFY]
```

**`src/main/pi.ts`**:
- In `handlePiSend`, record `const sendTime = Date.now()` before `session.prompt(message)`
- On first `text_delta` event, compute `ttftMs = Date.now() - sendTime`
- On `agent_end`, send `pi:api-timing` event with `{ ttftMs, totalMs: Date.now() - sendTime }`

**`src/renderer/src/types/index.ts`**:
- Add to `Message`: `ttftMs?: number`

**`src/renderer/src/App.tsx`**:
- Listen for `pi:api-timing` event and attach to the streaming message

**`src/renderer/src/components/MessageItem.tsx`**:
- Show TTFT in message footer tooltip: `"TTFT: 1.2s"`

**IPC changes:**
- `pi:api-timing` (main→renderer): `(reqId: string, timing: { ttftMs: number; totalMs: number })`

**Preload changes:**
- Add `onApiTiming` listener

**Test coverage:**
- `src/main/__tests__/pi-timing.test.ts` — Test TTFT tracking

---

### Feature 4.10 — Token usage graph (sparkline)

**What:** Simple sparkline showing token usage over the course of a session.

```
src/renderer/src/components/SparklineChart.tsx  [NEW]
src/renderer/src/components/ChatView.tsx        [MODIFY]
src/renderer/src/store/useAppStore.ts           [MODIFY]
```

**`src/renderer/src/components/SparklineChart.tsx`** (new):
- Pure SVG sparkline component
- Props: `{ data: number[]; width?: number; height?: number; color?: string }`
- Renders a minimal inline SVG path scaled to fit
- No labels, no axes — just the line

**`src/renderer/src/store/useAppStore.ts`**:
- Add state: `tokenHistory: Record<string, number[]>` — mapping sessionId → array of cumulative token counts per message
- Add action: `appendTokenHistory(sessionId: string, count: number)`
- This is populated from `pi:token-usage` events

**`src/renderer/src/components/ChatView.tsx`**:
- In the session header, show a small sparkline (width: 120px, height: 24px) if there are token data points
- Also show in the agent dashboard session cards

**`src/renderer/src/components/AgentDashboard.tsx`**:
- Show sparkline on agent cards

**Test coverage:**
- `src/renderer/src/__tests__/sparkline-chart.test.tsx` — Test SVG rendering with sample data

---

# File Manifest Summary

## New files

| File | PR | Purpose |
|---|---|---|
| `src/renderer/src/hooks/useAgentSpawn.ts` | 3.1 | Detect AI spawn intent in messages |
| `src/renderer/src/components/AgentProgressCard.tsx` | 3.4 | Live progress card for running sub-agents |
| `src/renderer/src/hooks/useAgentQueue.ts` | 3.6 | React hook for agent queue state |
| `src/renderer/src/components/AgentResultBlock.tsx` | 3.10 | Collapsible agent result message block |
| `src/renderer/src/hooks/useTokenRate.ts` | 4.1 | Sliding-window tokens-per-second calculator |
| `src/renderer/src/lib/pricing.ts` | 4.4 | Model pricing table + cost estimation |
| `src/renderer/src/components/SparklineChart.tsx` | 4.10 | SVG sparkline component |

## Modified files

| File | PR | Changes |
|---|---|---|
| `src/renderer/src/types/index.ts` | PR3, PR4 | `Message.isAgentResult`, `Message.agentSessionId`, `Message.tokenUsage`, `Message.latencyMs`, `Message.ttftMs`, `Session.tokenUsage`, `Session.agentTimeout`, `Session.agentPriority` |
| `src/renderer/src/schemas.ts` | PR3, PR4 | Parse new fields from raw DB types |
| `src/main/db.ts` | PR3, PR4 | `DbSession.token_usage`, `DbMessage.token_usage`, `DbMessage.latency_ms` |
| `src/main/pi.ts` | PR3, PR4 | Queue logic, timeout, model override, token capture, `pi:agent-result`, `pi:agent-delta`, `pi:token-usage`, `pi:api-timing` events |
| `src/main/index.ts` | PR3 | IPC: `agent:setQueueConfig`, `agent:getQueueConfig` |
| `src/preload/index.ts` | PR3, PR4 | Add `onAgentResult`, `onAgentDelta`, `onAgentQueueUpdate`, `onTokenUsage`, `onApiTiming` listeners |
| `src/renderer/src/globals.d.ts` | PR3, PR4 | Type declarations for new IPC listeners |
| `src/renderer/src/App.tsx` | PR3, PR4 | Agent spawn detection, agent-result display, agent progress streaming, terminate handler, token accumulation, latency tracking, api-timing wiring |
| `src/renderer/src/store/useAppStore.ts` | PR3, PR4 | `accumulateTokenUsage`, `appendTokenHistory`, `updateSessionTokenUsage` |
| `src/renderer/src/components/MessageItem.tsx` | 3.2, 3.3, 3.10, 4.2, 4.5, 4.8 | Delegate button, agent-result rendering, token badge, latency display, cost display |
| `src/renderer/src/components/ChatView.tsx` | 3.4, 4.1, 4.10 | Agent progress cards, TPS badge, sparkline |
| `src/renderer/src/components/AgentTree.tsx` | 3.5, 3.6, 3.9 | Terminate button, queue display, token costs |
| `src/renderer/src/components/AgentDashboard.tsx` | 3.5, 3.9, 4.10 | Terminate button, cost display, sparkline |
| `src/renderer/src/components/SpawnAgentDialog.tsx` | 3.7, 3.8 | Timeout field, priority field, model override |
| `src/renderer/src/components/StatusBar.tsx` | 4.6, 4.7 | Context window display, remaining tokens indicator |
| `src/renderer/src/components/InputBar.tsx` | 4.6 | Refactor `contextWindow()` to use centralized `pricing.ts` |

## New test files

| Test file | PR | Tests |
|---|---|---|
| `src/renderer/src/__tests__/useAgentSpawn.test.ts` | 3.1 | Spawn intent detection |
| `src/renderer/src/__tests__/agent-progress-card.test.tsx` | 3.4 | Agent progress states |
| `src/renderer/src/__tests__/agent-result-block.test.tsx` | 3.10 | Collapse/expand |
| `src/renderer/src/__tests__/useTokenRate.test.ts` | 4.1 | TPS calculation |
| `src/renderer/src/__tests__/pricing.test.ts` | 4.4 | Cost estimation |
| `src/renderer/src/__tests__/sparkline-chart.test.tsx` | 4.10 | Sparkline rendering |
| `src/main/__tests__/pi-queue.test.ts` | 3.6 | Queue ordering, priority |
| `src/main/__tests__/pi-timeout.test.ts` | 3.7 | Agent timeout |
| `src/main/__tests__/pi-model-override.test.ts` | 3.8 | Model override |
| `src/main/__tests__/pi-timing.test.ts` | 4.9 | TTFT tracking |

## Modified test files

| Test file | Changes |
|---|---|
| `src/renderer/src/__tests__/agent-tree.test.tsx` | Add terminate button tests, queue section tests |
| `src/renderer/src/__tests__/store.test.ts` | Add token accumulation tests |
| `src/renderer/src/__tests__/spawn-agent-dialog.test.tsx` | Add timeout/priority/model fields |
| `src/renderer/src/__tests__/message-item.test.tsx` | Add token badge, latency, delegate button tests |

---

# IPC Contract Summary

### New main→renderer events

| Event | Payload | When | PR |
|---|---|---|---|
| `pi:agent-result` | `(parentSessionId, resultText, agentSessionId)` | Sub-agent completes | 3.3 |
| `pi:agent-delta` | `(parentSessionId, agentSessionId, progressText, status)` | Sub-agent progress | 3.4 |
| `pi:agent-queue-update` | `{ queued, running, maxConcurrency }` | Queue changes | 3.6 |
| `pi:token-usage` | `(sessionId, { inputTokens, outputTokens, totalCost })` | Message/agent completes | 3.9, 4.3 |
| `pi:api-timing` | `(reqId, { ttftMs, totalMs })` | First token received | 4.9 |

### New renderer→main IPC handlers

| Channel | Payload | Returns | PR |
|---|---|---|---|
| `agent:setQueueConfig` | `{ maxConcurrency, defaultTimeoutMs }` | `void` | 3.6 |
| `agent:getQueueConfig` | (none) | `{ maxConcurrency, defaultTimeoutMs }` | 3.6 |

---

# Data Flow Summary

```
User sends message
  → handleSend in App.tsx
    → sendMessage via useAI hook
      → pi:send IPC to main process
        → handlePiSend in pi.ts
          → getOrCreate Pi session
          → session.prompt()
            → main thread receives delta/done events
              → pi:delta → renderer streams text
              → pi:done → renderer saves message
              → pi:tool-start/end → renderer shows tool calls
              → pi:agent-status → renderer updates tree
              → pi:agent-result (new) → renderer shows inline
              → pi:token-usage (new) → renderer updates costs
              → pi:api-timing (new) → renderer shows latency
```

---

# Migration / Compatibility

- All new fields on `Session` and `Message` are **optional** — existing DB entries without them work fine
- The new IPC events are fire-and-forget; if the renderer hasn't registered a listener yet, they're silently dropped
- The queue system is **opt-in**: `spawnAgent`/`spawnAgents` tools in pi.ts will be refactored to use the queue, but the old direct-execution path remains as a fallback
- Model pricing table in `pricing.ts` is extensible — add entries for new models without changing code
- Existing `useAI.ts` hook is **unchanged** — all token/latency tracking is in `App.tsx` on top of the existing callbacks
