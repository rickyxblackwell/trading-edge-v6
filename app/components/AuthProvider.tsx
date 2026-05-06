"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { User, SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { Trade, CoachingEntry } from "@/app/lib/types"
import { tradeToRow, coachingEntryToRow } from "@/app/lib/supabaseSerializers"

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
})

export function useAuthContext() {
  return useContext(AuthContext)
}

// ============================================================
// V5 → Supabase migration (D-05 silent, D-06 metadata flag, D-07 idempotent upsert, D-08 four keys, D-09 single-user)
// Idempotency: if any upsert errors, function returns early WITHOUT setting v5_migrated.
// Next login re-runs the full migration; upsert with conflict resolution on "id" handles already-migrated rows safely.
// ============================================================
async function runV5Migration(user: User, supabase: SupabaseClient): Promise<void> {
  if (user.user_metadata?.v5_migrated === true) return

  let trades: Trade[] = []
  let coaching: CoachingEntry[] = []
  let patternSummary = ""
  let strategyText = ""
  try {
    const rawTrades = localStorage.getItem("edge_v5_trades")
    const rawCoaching = localStorage.getItem("edge_v5_coaching_history")
    patternSummary = localStorage.getItem("edge_v5_pattern_summary") ?? ""
    strategyText = localStorage.getItem("edge_v5_strategy_text") ?? ""
    trades = rawTrades ? (JSON.parse(rawTrades) as Trade[]) : []
    coaching = rawCoaching ? (JSON.parse(rawCoaching) as CoachingEntry[]) : []
  } catch {
    // localStorage unavailable or JSON malformed — abort migration; flag stays unset for retry
    return
  }

  if (trades.length > 0) {
    const { error } = await supabase
      .from("trades")
      .upsert(
        trades.map((t) => tradeToRow(t, user.id)),
        { onConflict: "id" }
      )
    if (error) return // abort — flag NOT set → retry on next login (D-07, Pitfall 5)
  }

  if (coaching.length > 0) {
    const { error } = await supabase
      .from("coaching_entries")
      .upsert(
        coaching.map((e) => coachingEntryToRow(e, user.id)),
        { onConflict: "id" }
      )
    if (error) return // abort — flag NOT set → retry on next login
  }

  // Only set flag after BOTH upserts succeed (D-07, Pitfall 5)
  await supabase.auth.updateUser({
    data: {
      pattern_summary: patternSummary,
      strategy_text: strategyText,
      v5_migrated: true,
    },
  })
}

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser: User | null
}) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setUser(initialUser)

    // If the SSR-loaded initialUser exists and has not yet migrated, run migration immediately
    // (covers the "user lands on a page already authenticated" path — onAuthStateChange does NOT fire SIGNED_IN for an existing session)
    if (initialUser && initialUser.user_metadata?.v5_migrated !== true) {
      void runV5Migration(initialUser, supabase)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === "SIGNED_OUT") {
        router.push("/login")
      }
      if (event === "SIGNED_IN" && session?.user) {
        // Background migration — D-05 (no await, no toast, silent)
        void runV5Migration(session.user, supabase)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUser])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}
