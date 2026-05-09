-- Add user_prompt column to coaching_entries so the user's typed message
-- (or canonical mode prompt) persists across devices, not just localStorage.

ALTER TABLE public.coaching_entries
  ADD COLUMN IF NOT EXISTS user_prompt TEXT;
