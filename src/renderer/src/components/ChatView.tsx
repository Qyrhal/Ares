import React, { useEffect, useRef, useState, useMemo } from 'react'
import { Loader2, ArrowDown } from 'lucide-react'
import { Message, Todo } from '@/types'
import { MessageItem } from './MessageItem'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TodoPanel } from './TodoPanel'
import { cn } from '@/lib/utils'

const SHIMMER_VERBS = [
  'Accomplishing', 'Actioning', 'Actualizing', 'Architecting', 'Baking', 'Beaming', 'Beboppin\'',
  'Befuddling', 'Billowing', 'Blanching', 'Bloviating', 'Boogieing', 'Boondoggling', 'Booping',
  'Bootstrapping', 'Brewing', 'Burrowing', 'Calculating', 'Canoodling', 'Caramelizing',
  'Cascading', 'Catapulting', 'Cerebrating', 'Channeling', 'Choreographing', 'Churning',
  'Clauding', 'Coalescing', 'Cogitating', 'Combobulating', 'Composing', 'Computing',
  'Concocting', 'Considering', 'Contemplating', 'Cooking', 'Crafting', 'Creating',
  'Crunching', 'Crystallizing', 'Cultivating', 'Deciphering', 'Deliberating', 'Determining',
  'Dilly-dallying', 'Discombobulating', 'Doing', 'Doodling', 'Drizzling', 'Ebbing',
  'Effecting', 'Elucidating', 'Embellishing', 'Enchanting', 'Envisioning', 'Evaporating',
  'Fermenting', 'Fiddle-faddling', 'Finagling', 'Flambeing', 'Flibbertigibbeting', 'Flowing',
  'Flummoxing', 'Fluttering', 'Forging', 'Forming', 'Frosting',
  'Gallivanting', 'Galloping', 'Garnishing', 'Generating', 'Germinating', 'Gitifying',
  'Grooving', 'Gusting', 'Harmonizing', 'Hashing', 'Hatching', 'Herding', 'Honking',
  'Hullaballooing', 'Hyperspacing', 'Ideating', 'Imagining', 'Improvising', 'Incubating',
  'Inferring', 'Infusing', 'Ionizing', 'Jitterbugging', 'Julienning', 'Kneading',
  'Leavening', 'Levitating', 'Lollygagging', 'Manifesting', 'Marinating', 'Meandering',
  'Metamorphosing', 'Misting', 'Moonwalking', 'Moseying', 'Mulling', 'Mustering', 'Musing',
  'Nebulizing', 'Nesting', 'Newspapering', 'Noodling', 'Nucleating', 'Orbiting',
  'Orchestrating', 'Osmosing', 'Perambulating', 'Percolating', 'Perusing', 'Philosophising',
  'Photosynthesizing', 'Pollinating', 'Pondering', 'Pontificating', 'Pouncing',
  'Precipitating', 'Prestidigitating', 'Processing', 'Proofing', 'Propagating', 'Puttering',
  'Puzzling', 'Quantumizing', 'Razzle-dazzling', 'Razzmatazzing', 'Recombobulating',
  'Reticulating', 'Roosting', 'Ruminating', 'Sauteing', 'Scampering', 'Schlepping',
  'Scurrying', 'Seasoning', 'Shenaniganing', 'Shimmying', 'Simmering', 'Skedaddling',
  'Sketching', 'Slithering', 'Smooshing', 'Sock-hopping', 'Spelunking', 'Spinning',
  'Sprouting', 'Stewing', 'Sublimating', 'Swirling', 'Swooping', 'Symbioting',
  'Synthesizing', 'Tempering', 'Thinking', 'Thundering', 'Tinkering', 'Tomfoolering',
  'Topsy-turvying', 'Transfiguring', 'Transmuting', 'Twisting', 'Undulating', 'Unfurling',
  'Unravelling', 'Vibing', 'Waddling', 'Wandering', 'Warping', 'Whatchamacalliting',
  'Whirlpooling', 'Whirring', 'Whisking', 'Wibbling', 'Working', 'Wrangling', 'Zesting',
  'Zigzagging',
]

interface ChatViewProps {
  messages: Message[]
  sessionTitle: string
  isLoading: boolean
  onSuggestion?: (text: string) => void
  todos?: Todo[]
  onReply?: (message: Message) => void
  onEdit?: (id: string, content: string) => void
  onDelete?: (message: Message) => void
  onReact?: (id: string, reactions: { up: boolean | null }) => void
}

export function ChatView({ messages, sessionTitle, isLoading, onSuggestion, todos, onReply, onEdit, onDelete, onReact }: ChatViewProps): React.ReactElement {
  const bottomRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [verbIdx, setVerbIdx] = useState(() => Math.floor(Math.random() * SHIMMER_VERBS.length))
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const streamStartRef = useRef<number | null>(null)

  // Auto-scroll when new messages arrive (if user is at bottom)
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, isAtBottom])

  useEffect(() => {
    if (!isLoading) return
    const interval = setInterval(() => {
      setVerbIdx((prev) => (prev + 1) % SHIMMER_VERBS.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [isLoading])

  // Track scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    scrollContainerRef.current = viewport

    const handleScroll = (): void => {
      const threshold = 100
      const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < threshold
      setIsAtBottom(atBottom)
      setShowScrollButton(!atBottom && isLoading)
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [isLoading])

  // Track streaming start time for tokens/second calculation
  useEffect(() => {
    if (isLoading && streamStartRef.current === null) {
      streamStartRef.current = Date.now()
    }
    if (!isLoading) {
      streamStartRef.current = null
    }
  }, [isLoading])

  // Find the streaming message for token counting
  const streamingMessage = useMemo(() => messages.find((m) => m.isStreaming), [messages])
  const charCount = streamingMessage?.content?.length ?? 0
  const elapsed = streamStartRef.current ? (Date.now() - streamStartRef.current) / 1000 : 0
  const tokensPerSec = elapsed > 0 ? Math.round((charCount / 4) / elapsed) : 0

  const scrollToBottom = (): void => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsAtBottom(true)
    setShowScrollButton(false)
  }

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        {todos !== undefined && <TodoPanel todos={todos} />}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-8">
          <svg viewBox="0 0 64 64" className="size-20" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="32" cy="32" r="29" stroke="#ef4444" strokeWidth="2" strokeOpacity="0.9" />
            <rect x="13" y="13" width="38" height="38" rx="4" stroke="#ef4444" strokeWidth="2.2" />
            <rect x="18.5" y="18.5" width="27" height="27" rx="3" stroke="#ef4444" strokeWidth="2.2" transform="rotate(45 32 32)" />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{sessionTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Start a conversation or try one of these capabilities:
            </p>
          </div>

          {/* Capability cards */}
          <div className="grid grid-cols-2 gap-2 w-full max-w-md mt-2">
            {CAPABILITIES.map((cap) => (
              <button
                key={cap.label}
                onClick={() => onSuggestion?.(cap.prompt)}
                className="surface-card group rounded-lg border border-border bg-card p-3 text-left transition-all hover:border-primary/30 hover:bg-accent hover:shadow-md"
              >
                <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {cap.label}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                  {cap.description}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground/50 font-mono">
                  {cap.badge}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {todos !== undefined && <TodoPanel todos={todos} />}
    <ScrollArea className="flex-1" viewportRef={viewportRef}>
      <div className="py-4">
         {messages.filter((m) => !m.isStreaming).map((msg) => (
          <MessageItem key={msg.id} message={msg} onReply={onReply} onEdit={onEdit} onDelete={onDelete} onReact={onReact} />
        ))}
        {isLoading && (
          <div className="px-4 py-2">
            <Marker role="status">
              <MarkerIcon>
                <Loader2 className="size-3 animate-spin" />
              </MarkerIcon>
              <MarkerContent>
                <span className="shimmer shimmer-color-primary shimmer-duration-1500 text-sm text-muted-foreground">
                  {SHIMMER_VERBS[verbIdx]}…
                </span>
              </MarkerContent>
              {charCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <span>{Math.round(charCount / 4)} tok</span>
                  {tokensPerSec > 0 && <span>· {tokensPerSec} tok/s</span>}
                </span>
              )}
            </Marker>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>

      {/* Scroll-to-bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="surface-overlay absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors z-20 animate-bounce"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="size-3.5" />
          <span>New messages</span>
        </button>
      )}
    </div>
  )
}

interface Capability {
  label: string
  description: string
  prompt: string
  badge: string
}

const CAPABILITIES: Capability[] = [
  { label: 'Sub-agents', description: 'Spawn child agents for parallel research, coding, or analysis', prompt: 'Spawn 3 sub-agents. Give agent-1 the task of researching the latest React 19 features, agent-2 the task of comparing Next.js App Router vs Pages Router, and agent-3 the task of listing best practices for TypeScript 5.5. Give me a consolidated report.', badge: 'spawnAgent / spawnAgents' },
  { label: 'Web Search', description: 'Look up current docs, APIs, news, or anything online', prompt: 'Search the web for the latest Electron v33 features and API changes.', badge: 'webSearch' },
  { label: 'Plan Mode', description: 'Create a tracked checklist before starting complex work', prompt: 'Plan the implementation of a real-time collaborative code editor. Break it down into phases with specific deliverables.', badge: 'setTodos' },
  { label: 'Ask Questions', description: 'Interactive forms with multiple-choice or free-text input', prompt: 'Ask me 3 questions to determine the best tech stack for my new project.', badge: 'askUser' },
  { label: 'Code Analysis', description: 'Read, write, edit, grep, and analyze codebases', prompt: 'Analyze the current workspace and tell me about its structure, languages, and key files.', badge: 'read / grep / bash' },
  { label: 'File Operations', description: 'Create, edit, rename, delete files and folders', prompt: 'Create a well-structured React component library starter with Storybook and Vitest configured.', badge: 'write / edit / rename' },
  { label: 'Git Integration', description: 'Status, stage, commit, push, pull, branches, diff, log', prompt: 'Show me the git log and tell me what branch we are on and if there are any uncommitted changes.', badge: 'git status / log / diff' },
  { label: 'Terminal', description: 'Run commands, install packages, build projects', prompt: 'Check the Node.js version, npm version, and list the top-level dependencies in package.json.', badge: 'bash in terminal' },
]
