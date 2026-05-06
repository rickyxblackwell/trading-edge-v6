-- Phase 2: Supabase Persistence
-- Tables: trades, coaching_entries
-- RLS: enabled with users_own_* policies (USING + WITH CHECK)
-- Reference: .planning/phases/02-supabase-persistence/02-RESEARCH.md (Code Examples → Full RLS Migration SQL)

-- ============================================================
-- trades table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trades (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  time        TEXT NOT NULL,
  instrument  TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  session     TEXT NOT NULL,
  contracts   INTEGER NOT NULL DEFAULT 1,
  pnl         NUMERIC NOT NULL DEFAULT 0,
  rmult       NUMERIC NOT NULL DEFAULT 0,
  outcome     TEXT NOT NULL DEFAULT 'breakeven' CHECK (outcome IN ('win', 'loss', 'breakeven')),
  confluences TEXT[] NOT NULL DEFAULT '{}',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_trades"
  ON public.trades
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS trades_user_id_idx ON public.trades USING btree (user_id);

-- ============================================================
-- coaching_entries table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coaching_entries (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp       TEXT NOT NULL,
  trade_count     INTEGER NOT NULL DEFAULT 0,
  title           TEXT NOT NULL DEFAULT '',
  full_content    TEXT NOT NULL DEFAULT '',
  archived        BOOLEAN NOT NULL DEFAULT FALSE,
  mode            TEXT NOT NULL DEFAULT 'analyze',
  market_snapshot TEXT NOT NULL DEFAULT '',
  patterns        TEXT NOT NULL DEFAULT '',
  process         TEXT NOT NULL DEFAULT '',
  risk            TEXT NOT NULL DEFAULT '',
  priority        TEXT NOT NULL DEFAULT '',
  momentum        TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.coaching_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_coaching"
  ON public.coaching_entries
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS coaching_entries_user_id_idx ON public.coaching_entries USING btree (user_id);
