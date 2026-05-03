
-- Fix search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Tighten guest_posts insert policy with basic validation
DROP POLICY "Anyone can submit guest post" ON public.guest_posts;
CREATE POLICY "Anyone can submit valid guest post" ON public.guest_posts
FOR INSERT WITH CHECK (
  char_length(title) BETWEEN 3 AND 200
  AND char_length(content) BETWEEN 20 AND 10000
  AND char_length(guest_name) BETWEEN 2 AND 100
  AND guest_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND status = 'pending'
);
