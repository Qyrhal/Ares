import React, { useEffect, useRef, useState } from 'react'
import { SparklesIcon } from '@animateicons/react/lucide'
import { Message } from '@/types'
import { MessageItem } from './MessageItem'
import { ScrollArea } from '@/components/ui/scroll-area'

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
  'Flummoxing', 'Fluttering', 'Forging', 'Forming', 'Frolicking', 'Frosting',
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
}

export function ChatView({ messages, sessionTitle, isLoading }: ChatViewProps): React.ReactElement {
  const bottomRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [verbIdx, setVerbIdx] = useState(() => Math.floor(Math.random() * SHIMMER_VERBS.length))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (!isLoading) return
    const interval = setInterval(() => {
      setVerbIdx((prev) => (prev + 1) % SHIMMER_VERBS.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [isLoading])

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-8">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
          <SparklesIcon className="size-8 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{sessionTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Start a conversation. Ask questions, write code, analyze files, or brainstorm ideas.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full max-w-sm mt-2">
          {SUGGESTIONS.map((s) => (
            <div
              key={s}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground cursor-default hover:border-primary/30 hover:bg-accent transition-colors"
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1" viewportRef={viewportRef}>
      <div className="py-4">
         {messages.filter((m) => !m.isStreaming).map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex gap-3 px-4 py-3">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted border border-border text-muted-foreground">
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10" cy="10" r="8" />
                <rect x="5" y="5" width="10" height="10" rx="1" transform="rotate(45 10 10)" />
              </svg>
            </div>
            <div className="flex items-center">
              <span className="shimmer shimmer-duration-1500 text-sm">
                {SHIMMER_VERBS[verbIdx]}…
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}

const SUGGESTIONS = [
  'Explain this code',
  'Write a function',
  'Debug an error',
  'Review my PR'
]
