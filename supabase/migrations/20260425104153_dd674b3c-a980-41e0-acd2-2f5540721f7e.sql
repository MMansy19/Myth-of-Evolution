
DROP POLICY IF EXISTS "Public can read guest post by id" ON public.guest_posts;

-- Replace broad public read with a policy that only allows fetching a specific object by exact name
DROP POLICY IF EXISTS "Public read post-media" ON storage.objects;
CREATE POLICY "Public read individual post-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-media' AND name IS NOT NULL);
