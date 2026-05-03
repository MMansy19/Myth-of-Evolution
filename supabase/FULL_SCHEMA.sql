-- =====================================================================
--  FULL SCHEMA  —  paste this in Supabase → SQL Editor → Run
--  This consolidates all migrations into one idempotent script.
-- =====================================================================

-- ─── ENUMS ───────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.post_category AS ENUM ('critique', 'evolution_basics', 'genetics', 'creation_marvels');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.guest_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── TABLES ──────────────────────────────────────────────────────────

-- Profiles (one per auth user)
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Admin invites (by email)
CREATE TABLE IF NOT EXISTS public.admin_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- Posts
CREATE TABLE IF NOT EXISTS public.posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  category        post_category NOT NULL,
  author_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name     TEXT,
  cover_image_url TEXT,
  views_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Guest posts (user-submitted, need moderation)
CREATE TABLE IF NOT EXISTS public.guest_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  category        post_category NOT NULL,
  guest_name      TEXT NOT NULL,
  guest_email     TEXT NOT NULL,
  status          guest_status NOT NULL DEFAULT 'pending',
  reviewed_by     UUID REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  ai_report       TEXT,
  ai_verdict      TEXT,
  ai_reviewed_at  TIMESTAMPTZ,
  ai_refs         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.guest_posts ENABLE ROW LEVEL SECURITY;

-- ─── HELPER FUNCTIONS ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner','moderator')
  )
$$;

-- Secure RPC: anyone (including anon) can increment post views
CREATE OR REPLACE FUNCTION public.increment_post_views(_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.posts SET views_count = views_count + 1 WHERE id = _post_id;
END;
$$;
REVOKE ALL ON FUNCTION public.increment_post_views(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_post_views(uuid) TO anon, authenticated;

-- ─── TRIGGERS ────────────────────────────────────────────────────────

-- Auto-create profile + assign role on first sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count    INT;
  invite_exists BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email,'@',1)
    )
  );

  SELECT COUNT(*) INTO user_count FROM auth.users;

  IF user_count = 1 THEN
    -- First ever user → owner
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.admin_invites
      WHERE lower(email) = lower(NEW.email) AND used = false
    ) INTO invite_exists;

    IF invite_exists THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'moderator');
      UPDATE public.admin_invites SET used = true WHERE lower(email) = lower(NEW.email);
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on posts
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS posts_touch ON public.posts;
CREATE TRIGGER posts_touch
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── RLS POLICIES ────────────────────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles
DROP POLICY IF EXISTS "Roles viewable by everyone" ON public.user_roles;
CREATE POLICY "Roles viewable by everyone" ON public.user_roles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner inserts roles" ON public.user_roles;
CREATE POLICY "Owner inserts roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Owner deletes roles" ON public.user_roles;
CREATE POLICY "Owner deletes roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'owner'));

-- admin_invites
DROP POLICY IF EXISTS "Owner views invites" ON public.admin_invites;
CREATE POLICY "Owner views invites" ON public.admin_invites FOR SELECT USING (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Owner inserts invites" ON public.admin_invites;
CREATE POLICY "Owner inserts invites" ON public.admin_invites FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Owner deletes invites" ON public.admin_invites;
CREATE POLICY "Owner deletes invites" ON public.admin_invites FOR DELETE USING (public.has_role(auth.uid(), 'owner'));

-- posts
DROP POLICY IF EXISTS "Posts viewable by everyone" ON public.posts;
CREATE POLICY "Posts viewable by everyone" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff insert posts" ON public.posts;
CREATE POLICY "Staff insert posts" ON public.posts FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update posts" ON public.posts;
CREATE POLICY "Staff update posts" ON public.posts FOR UPDATE USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff delete posts" ON public.posts;
CREATE POLICY "Staff delete posts" ON public.posts FOR DELETE USING (public.is_staff(auth.uid()));

-- guest_posts
DROP POLICY IF EXISTS "Anyone can submit guest post" ON public.guest_posts;
DROP POLICY IF EXISTS "Anyone can submit valid guest post" ON public.guest_posts;
CREATE POLICY "Anyone can submit valid guest post" ON public.guest_posts
FOR INSERT WITH CHECK (
  char_length(title) BETWEEN 3 AND 200
  AND char_length(content) BETWEEN 20 AND 10000
  AND char_length(guest_name) BETWEEN 2 AND 100
  AND guest_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND status = 'pending'
);

DROP POLICY IF EXISTS "Staff view guest posts" ON public.guest_posts;
CREATE POLICY "Staff view guest posts" ON public.guest_posts FOR SELECT USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update guest posts" ON public.guest_posts;
CREATE POLICY "Staff update guest posts" ON public.guest_posts FOR UPDATE USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff delete guest posts" ON public.guest_posts;
CREATE POLICY "Staff delete guest posts" ON public.guest_posts FOR DELETE USING (public.is_staff(auth.uid()));

-- ─── STORAGE ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media', 'post-media', true, 26214400,
  ARRAY['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = 26214400;

DROP POLICY IF EXISTS "Public read post-media" ON storage.objects;
DROP POLICY IF EXISTS "Public read individual post-media" ON storage.objects;
CREATE POLICY "Public read individual post-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-media' AND name IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can upload post-media" ON storage.objects;
CREATE POLICY "Anyone can upload post-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'post-media');

-- =====================================================================
--  DONE. Your database is fully set up.
-- =====================================================================
