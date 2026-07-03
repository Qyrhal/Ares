import React from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
          <p className="text-xs font-medium text-destructive">Component error</p>
          <pre className="max-w-full overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
