
ALTER TABLE public.guest_posts
  ADD COLUMN IF NOT EXISTS ai_report TEXT,
  ADD COLUMN IF NOT EXISTS ai_verdict TEXT,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMPTZ;

-- Allow guests to view their own pending submission's AI report by id (read-only)
CREATE POLICY "Public can read guest post by id"
ON public.guest_posts FOR SELECT
USING (true);

-- Storage bucket for post media (images & videos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media','post-media', true, 26214400,
  ARRAY['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 26214400;

CREATE POLICY "Public read post-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-media');

CREATE POLICY "Anyone can upload post-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'post-media');
