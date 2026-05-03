
ALTER TABLE public.guest_posts
  ADD COLUMN IF NOT EXISTS ai_refs JSONB;
