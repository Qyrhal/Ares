import { useEffect, useRef, useState, useCallback } from 'react'
import { RotateCcw, ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'

/* eslint-disable @typescript-eslint/no-explicit-any */
type ElectronWebView = HTMLWebViewElement & {
  canGoBack(): boolean
  canGoForward(): boolean
  getURL(): string
  goBack(): void
  goForward(): void
  reload(): void
  loadURL(url: string): void
}

function asElecWv(el: HTMLWebViewElement | null): ElectronWebView | null {
  return el as unknown as ElectronWebView | null
}

export function PreviewPanel(): React.ReactElement | null {
  const { previewOpen, previewUrl, togglePreview } = useAppStore()
  const webviewRef = useRef<HTMLWebViewElement>(null)
  const [currentUrl, setCurrentUrl] = useState(previewUrl ?? '')
  const [isLoading, setIsLoading] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [urlInput, setUrlInput] = useState(previewUrl ?? '')

  useEffect(() => {
    if (previewUrl) {
      setCurrentUrl(previewUrl)
      setUrlInput(previewUrl)
    }
  }, [previewUrl])

  const handleNav = useCallback(() => {
    const wv = asElecWv(webviewRef.current)
    if (!wv) return
    setCanGoBack(wv.canGoBack())
    setCanGoForward(wv.canGoForward())
    setCurrentUrl(wv.getURL())
    setUrlInput(wv.getURL())
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const onDidNavigate = () => handleNav()
    const onDidNavigateInPage = () => handleNav()
    const onStartLoading = () => setIsLoading(true)
    const onStopLoading = () => { setIsLoading(false); handleNav() }

    wv.addEventListener('did-navigate', onDidNavigate)
    wv.addEventListener('did-navigate-in-page', onDidNavigateInPage)
    wv.addEventListener('did-start-loading', onStartLoading)
    wv.addEventListener('did-stop-loading', onStopLoading)

    return () => {
      wv.removeEventListener('did-navigate', onDidNavigate)
      wv.removeEventListener('did-navigate-in-page', onDidNavigateInPage)
      wv.removeEventListener('did-start-loading', onStartLoading)
      wv.removeEventListener('did-stop-loading', onStopLoading)
    }
  }, [handleNav])

  if (!previewOpen || !previewUrl) return null

  const handleBack = () => { asElecWv(webviewRef.current)?.goBack() }
  const handleForward = () => { asElecWv(webviewRef.current)?.goForward() }
  const handleRefresh = () => { asElecWv(webviewRef.current)?.reload() }
  const handleUrlSubmit = () => {
    const wv = asElecWv(webviewRef.current)
    if (!wv || !urlInput.trim()) return
    let url = urlInput.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    wv.loadURL(url)
  }
  const handleOpenExternal = () => {
    if (currentUrl) (window as any).electron.shell.openExternal(currentUrl)
  }

  return (
    <div className="flex flex-col h-full border-l border-border bg-background">
      {/* Navigation bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card shrink-0">
        <button
          onClick={handleBack}
          disabled={!canGoBack}
          className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
          title="Back"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={handleForward}
          disabled={!canGoForward}
          className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
          title="Forward"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleRefresh}
          className="p-1 rounded hover:bg-accent"
          title="Refresh"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit() }}
          className="flex-1 text-xs font-mono bg-muted border border-border rounded px-2 py-1 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Enter URL..."
        />

        <button
          onClick={handleOpenExternal}
          className="p-1 rounded hover:bg-accent"
          title="Open in external browser"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
        <button
          onClick={togglePreview}
          className="p-1 rounded hover:bg-accent"
          title="Close preview"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Loading bar */}
      {isLoading && (
        <div className="h-0.5 bg-muted overflow-hidden shrink-0">
          <div className="h-full bg-primary animate-pulse w-full" />
        </div>
      )}

      {/* Webview */}
      <div className="flex-1 relative overflow-hidden">
        <webview
          ref={webviewRef}
          src={previewUrl}
          className="w-full h-full"
          partition="persist:preview"
          style={{ border: 'none' }}
        />
      </div>
    </div>
  )
}
