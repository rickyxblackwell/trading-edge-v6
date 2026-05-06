"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { UserCircle } from "lucide-react"
import type { TabId } from "./lib/types"
import StrategyTab from "./components/tabs/Strategy"
import ChecklistTab from "./components/tabs/Checklist"
import LogTab from "./components/tabs/Log"
import StatsTab from "./components/tabs/Stats"
import CoachTab from "./components/tabs/Coach"
import TradeModal from "./components/TradeModal"

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: "strategy",
    label: "Strategy",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: "checklist",
    label: "Checklist",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    id: "log",
    label: "Journal",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="10" y2="14" />
        <line x1="8" y1="18" x2="10" y2="18" />
      </svg>
    ),
  },
  {
    id: "coach",
    label: "Coach",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
      </svg>
    ),
  },
]

const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
  strategy: StrategyTab,
  checklist: ChecklistTab,
  log: LogTab,
  coach: CoachTab,
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("log")
  const [journalView, setJournalView] = useState<"log" | "stats">("log")
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const isOnSettings = pathname === "/settings"

  const ActiveComponent = TAB_COMPONENTS[activeTab]

  return (
    <>
      {/* Ambient background orbs */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* App shell */}
      <div className="relative z-10 flex h-dvh">

        {/* Sidebar (desktop) / bottom bar (mobile) */}
        <nav className="tab-bar">
          {/* Logo — desktop only */}
          <div className="hidden lg:flex items-center gap-2 px-5 mb-6 pt-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />
            <span className="mono text-xs font-semibold tracking-widest" style={{ color: "var(--text)" }}>
              TRADING EDGE
            </span>
          </div>

          {/* Tab buttons + Account (mobile row, desktop column) */}
          <div className="flex lg:flex-col w-full h-full lg:h-auto items-stretch lg:items-stretch lg:justify-start lg:px-3 lg:gap-0.5">
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`tab-btn-v5 flex-1 lg:flex-none flex flex-col lg:flex-row items-center lg:items-center gap-0.5 lg:gap-2.5 py-2 lg:px-3 lg:py-2.5 rounded-xl min-h-[44px] justify-center lg:justify-start lg:w-full${isActive ? " tab-btn-active" : ""}`}
                  style={{
                    color: isActive ? "var(--accent)" : "var(--text2)",
                    background: isActive ? "var(--accent3)" : "transparent",
                    border: isActive ? "1px solid var(--border-accent)" : "1px solid transparent",
                  }}
                  aria-label={tab.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.icon}
                  <span
                    className="label-upper lg:normal-case lg:tracking-normal lg:font-medium lg:text-sm"
                    style={{ color: isActive ? "var(--accent)" : "var(--text2)" }}
                  >
                    {tab.label}
                  </span>
                </button>
              )
            })}

            {/* Account button — mobile (visible in bottom bar row) */}
            <button
              onClick={() => router.push("/settings")}
              className="tab-btn-v5 flex-1 lg:hidden flex flex-col items-center gap-0.5 py-2 min-h-[44px] justify-center"
              style={{ color: isOnSettings ? "var(--accent)" : "var(--text2)" }}
              aria-label="Account"
            >
              <UserCircle size={20} />
              <span
                className="label-upper"
                style={{ color: isOnSettings ? "var(--accent)" : "var(--text2)" }}
              >
                Account
              </span>
            </button>
          </div>

          {/* Account button — desktop sidebar bottom */}
          <div
            className="hidden lg:block mt-auto pt-3 px-3 pb-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <button
              onClick={() => router.push("/settings")}
              className={`tab-btn-v5 flex flex-row items-center gap-2.5 px-3 py-2.5 rounded-xl w-full${isOnSettings ? " tab-btn-active" : ""}`}
              style={{
                color: isOnSettings ? "var(--accent)" : "var(--text2)",
                background: isOnSettings ? "var(--accent3)" : "transparent",
                border: isOnSettings ? "1px solid var(--border-accent)" : "1px solid transparent",
              }}
              aria-label="Account settings"
            >
              <UserCircle size={20} />
              <span className="lg:normal-case lg:tracking-normal lg:font-medium lg:text-sm">
                Account
              </span>
            </button>
          </div>
        </nav>

        {/* Main scrollable content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{
            paddingBottom: "calc(64px + env(safe-area-inset-bottom))",
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          <div className="content-wrap py-4 fade-up" key={activeTab}>
            {activeTab === "log" ? (
              <>
                <div className="flex justify-center px-4 pb-4">
                  <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    {(["log", "stats"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setJournalView(v)}
                        className="px-6 py-1.5 mono text-xs capitalize transition-colors duration-150"
                        style={{
                          background: journalView === v ? "var(--accent3)" : "transparent",
                          color: journalView === v ? "var(--accent)" : "var(--text3)",
                          borderRight: v === "log" ? "1px solid var(--border)" : "none",
                        }}
                      >
                        {v === "log" ? "Journal" : "Stats"}
                      </button>
                    ))}
                  </div>
                </div>
                {journalView === "log" ? <LogTab /> : <StatsTab />}
              </>
            ) : (
              <ActiveComponent />
            )}
          </div>
        </main>
      </div>

      {/* Global FAB — log trade from any tab */}
      <button
        onClick={() => setTradeModalOpen(true)}
        aria-label="Log trade"
        className="fab-btn"
        style={{
          position: "fixed",
          right: 20,
          bottom: `calc(72px + env(safe-area-inset-bottom))`,
          zIndex: 55,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent), #0ea5e9)",
          boxShadow: "0 4px 20px rgba(56,189,248,0.45), 0 0 0 1px rgba(56,189,248,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          transition: "transform 0.18s ease, box-shadow 0.18s ease",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Global trade entry modal */}
      <TradeModal open={tradeModalOpen} onClose={() => setTradeModalOpen(false)} />
    </>
  )
}
