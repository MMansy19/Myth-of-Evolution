
-- 1. App role enum
CREATE TYPE public.app_role AS ENUM ('owner', 'moderator', 'user');

-- 2. Post category enum
CREATE TYPE public.post_category AS ENUM ('critique', 'evolution_basics', 'genetics', 'creation_marvels');

-- 3. Guest post status enum
CREATE TYPE public.guest_status AS ENUM ('pending', 'approved', 'rejected');

-- 4. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 6. has_role function (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 7. Helper: is owner or moderator
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner','moderator')
  )
$$;

-- 8. Posts table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category post_category NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 9. Guest posts (need moderation)
CREATE TABLE public.guest_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category post_category NOT NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  status guest_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.guest_posts ENABLE ROW LEVEL SECURITY;

-- 10. Admin invites (by email)
CREATE TABLE public.admin_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- Profiles: anyone can read; user updates own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles: anyone reads (needed to know who is staff); only owner manages
CREATE POLICY "Roles viewable by everyone" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Owner inserts roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner deletes roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'owner'));

-- posts: public read; staff insert/update/delete
CREATE POLICY "Posts viewable by everyone" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Staff insert posts" ON public.posts FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update posts" ON public.posts FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete posts" ON public.posts FOR DELETE USING (public.is_staff(auth.uid()));

-- guest_posts: anyone (even anon) can submit; only staff read & update
CREATE POLICY "Anyone can submit guest post" ON public.guest_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff view guest posts" ON public.guest_posts FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff update guest posts" ON public.guest_posts FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete guest posts" ON public.guest_posts FOR DELETE USING (public.is_staff(auth.uid()));

-- admin_invites: owner only
CREATE POLICY "Owner views invites" ON public.admin_invites FOR SELECT USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner inserts invites" ON public.admin_invites FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owner deletes invites" ON public.admin_invites FOR DELETE USING (public.has_role(auth.uid(), 'owner'));

-- ============ TRIGGERS ============

-- Auto-create profile + assign owner to first user, moderator if invited, else user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
  invite_exists BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1))
  );

  SELECT COUNT(*) INTO user_count FROM auth.users;

  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.admin_invites WHERE lower(email) = lower(NEW.email) AND used = false)
      INTO invite_exists;
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

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger for posts
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER posts_touch BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
