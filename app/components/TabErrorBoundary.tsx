"use client"

import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  tabName: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class TabErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(`[TabErrorBoundary:${this.props.tabName}]`, error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <TabErrorFallback
          tabName={this.props.tabName}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      )
    }
    return this.props.children
  }
}

function TabErrorFallback({ tabName, onRetry }: { tabName: string; onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16 px-6"
      style={{ color: "var(--text2)" }}
    >
      <p className="mono text-sm" style={{ color: "var(--text2)" }}>
        {tabName} tab encountered an error
      </p>
      <button
        onClick={onRetry}
        className="mono text-xs px-4 py-2 rounded-lg"
        style={{
          minHeight: 44,
          border: "1px solid var(--border-accent)",
          color: "var(--accent)",
          background: "var(--accent3)",
          transition: "background 0.2s ease",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(56,189,248,0.20)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--accent3)")}
      >
        Retry
      </button>
    </div>
  )
}
