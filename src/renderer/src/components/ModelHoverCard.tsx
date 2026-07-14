import React from 'react'
import { Cpu, Database, Zap, Globe } from 'lucide-react'

interface ModelInfo {
  name: string
  provider: string
  contextWindow: string
  capabilities: string[]
  category: string
}

/**
 * Static model registry for common models.
 * This is a lightweight lookup — no API call needed for hover previews.
 * Extend this array as new models are added to the ecosystem.
 */
const MODEL_REGISTRY: Record<string, ModelInfo> = {
  'gpt-4o': { name: 'GPT-4o', provider: 'OpenAI', contextWindow: '128K', capabilities: ['chat', 'code', 'vision'], category: 'Flagship' },
  'gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'OpenAI', contextWindow: '128K', capabilities: ['chat', 'code', 'vision'], category: 'Fast' },
  'gpt-4.1': { name: 'GPT-4.1', provider: 'OpenAI', contextWindow: '1M', capabilities: ['chat', 'code', 'vision'], category: 'Long context' },
  'gpt-4.1-mini': { name: 'GPT-4.1 Mini', provider: 'OpenAI', contextWindow: '1M', capabilities: ['chat', 'code', 'vision'], category: 'Long context' },
  'gpt-4.1-nano': { name: 'GPT-4.1 Nano', provider: 'OpenAI', contextWindow: '1M', capabilities: ['chat', 'code'], category: 'Lightweight' },
  'o3': { name: 'o3', provider: 'OpenAI', contextWindow: '200K', capabilities: ['reasoning', 'chat', 'code'], category: 'Reasoning' },
  'o4-mini': { name: 'o4-mini', provider: 'OpenAI', contextWindow: '200K', capabilities: ['reasoning', 'chat', 'code'], category: 'Reasoning' },
  'claude-sonnet-4-20250514': { name: 'Claude Sonnet 4', provider: 'Anthropic', contextWindow: '200K', capabilities: ['chat', 'code', 'vision'], category: 'Flagship' },
  'claude-sonnet-4.5-20250624': { name: 'Claude Sonnet 4.5', provider: 'Anthropic', contextWindow: '200K', capabilities: ['chat', 'code', 'vision'], category: 'Flagship' },
  'claude-haiku-4-20250514': { name: 'Claude Haiku 4', provider: 'Anthropic', contextWindow: '200K', capabilities: ['chat', 'code', 'vision'], category: 'Fast' },
  'claude-opus-5-20260715': { name: 'Claude Opus 5', provider: 'Anthropic', contextWindow: '200K', capabilities: ['chat', 'code', 'vision', 'reasoning'], category: 'Flagship' },
  'claude-opus-4-20260402': { name: 'Claude Opus 4', provider: 'Anthropic', contextWindow: '200K', capabilities: ['chat', 'code', 'vision', 'reasoning'], category: 'Flagship' },
  'gemini-2.5-pro': { name: 'Gemini 2.5 Pro', provider: 'Google', contextWindow: '1M', capabilities: ['chat', 'code', 'vision', 'reasoning'], category: 'Flagship' },
  'gemini-2.5-flash': { name: 'Gemini 2.5 Flash', provider: 'Google', contextWindow: '1M', capabilities: ['chat', 'code', 'vision'], category: 'Fast' },
  'deepseek-v4': { name: 'DeepSeek V4', provider: 'DeepSeek', contextWindow: '128K', capabilities: ['chat', 'code', 'reasoning'], category: 'Flagship' },
  'deepseek-v4-flash': { name: 'DeepSeek V4 Flash', provider: 'DeepSeek', contextWindow: '128K', capabilities: ['chat', 'code'], category: 'Fast' },
  'sonar-pro': { name: 'Sonar Pro', provider: 'Perplexity', contextWindow: '200K', capabilities: ['chat', 'search', 'code'], category: 'Search' },
  'groq-llama-4': { name: 'Llama 4', provider: 'Groq', contextWindow: '128K', capabilities: ['chat', 'code'], category: 'Fast' },
  'grok-4.5': { name: 'Grok 4.5', provider: 'xAI', contextWindow: '256K', capabilities: ['chat', 'code', 'vision', 'reasoning'], category: 'Flagship' },
}

function getModelInfo(modelId: string): ModelInfo | null {
  // Exact match
  if (MODEL_REGISTRY[modelId]) return MODEL_REGISTRY[modelId]
  // Partial match — try common prefixes
  const lower = modelId.toLowerCase()
  for (const [key, info] of Object.entries(MODEL_REGISTRY)) {
    if (lower.startsWith(key) || lower.includes(key)) return info
  }
  return null
}

interface ModelHoverCardProps {
  modelId: string
  children: React.ReactNode
}

/**
 * Shows a rich tooltip with model information on hover.
 * Wraps children (typically a model name/icon) and shows a dropdown
 * card with provider, context window, capabilities.
 */
export function ModelHoverCard({ modelId, children }: ModelHoverCardProps): React.ReactElement {
  const [show, setShow] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>()
  const info = getModelInfo(modelId)
  const displayName = info?.name ?? modelId

  const handleMouseOver = React.useCallback(() => {
    timerRef.current = setTimeout(() => setShow(true), 400)
  }, [])

  const handleMouseOut = React.useCallback(() => {
    clearTimeout(timerRef.current)
    setShow(false)
  }, [])

  return (
    <span
      className="relative inline-flex"
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
    >
      {children}

      {show && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2">
          <div className="min-w-[200px] rounded-lg border border-border bg-card py-2.5 px-3 shadow-xl">
            {/* Model name + provider */}
            <div className="flex items-center gap-2">
              <Cpu className="size-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground">{displayName}</span>
              {info && (
                <span className="ml-auto text-[10px] text-muted-foreground">{info.provider}</span>
              )}
            </div>

            {info ? (
              <div className="mt-2 space-y-1.5">
                {/* Context window */}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Database className="size-3" />
                  <span>{info.contextWindow} context</span>
                </div>

                {/* Category */}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Zap className="size-3" />
                  <span>{info.category}</span>
                </div>

                {/* Capabilities */}
                <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                  <Globe className="size-3 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {info.capabilities.map((cap) => (
                      <span
                        key={cap}
                        data-testid="model-capability"
                        className="inline-block rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-foreground/80"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Model ID: {modelId}
              </p>
            )}
          </div>
          {/* Arrow */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 border-b border-r border-border bg-card" />
        </div>
      )}
    </span>
  )
}
