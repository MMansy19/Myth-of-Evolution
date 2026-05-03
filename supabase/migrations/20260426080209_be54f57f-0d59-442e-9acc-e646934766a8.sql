
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Secure RPC: anyone (including anon) can increment views, but cannot touch other columns
CREATE OR REPLACE FUNCTION public.increment_post_views(_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts SET views_count = views_count + 1 WHERE id = _post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_post_views(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_post_views(uuid) TO anon, authenticated;
