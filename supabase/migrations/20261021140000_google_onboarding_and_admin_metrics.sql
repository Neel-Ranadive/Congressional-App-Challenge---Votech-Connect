BEGIN;

GRANT SELECT ON TABLE public.profiles TO authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own_profile_votech
ON public.profiles;

CREATE POLICY profiles_select_own_profile_votech
ON public.profiles
FOR SELECT
TO authenticated
USING (id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_role text := lower(btrim(coalesce(NEW.raw_user_meta_data ->> 'role', '')));
  requested_name text := btrim(coalesce(NEW.raw_user_meta_data ->> 'full_name', ''));
  requested_trade text := nullif(btrim(coalesce(NEW.raw_user_meta_data ->> 'trade_area', '')), '');
BEGIN
  IF coalesce(NEW.raw_app_meta_data ->> 'provider', '') = 'google' THEN
    RETURN NEW;
  END IF;

  IF requested_role NOT IN ('student', 'resident') THEN
    RAISE EXCEPTION 'Public signup supports student and resident accounts only';
  END IF;

  IF requested_name = '' OR char_length(requested_name) > 120 THEN
    RAISE EXCEPTION 'A valid full name is required';
  END IF;

  IF requested_role = 'student'
    AND lower(coalesce(NEW.email, '')) !~ '^[^@]+@mcvts[.]org$'
  THEN
    RAISE EXCEPTION 'Student accounts must use an @mcvts.org email address';
  END IF;

  IF requested_role = 'student' AND requested_trade IS NULL THEN
    RAISE EXCEPTION 'Student accounts require a trade area';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, trade_area, email)
  VALUES (
    NEW.id,
    requested_name,
    requested_role,
    CASE WHEN requested_role = 'student' THEN requested_trade ELSE NULL END,
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_google_profile_setup(
  p_full_name text,
  p_role text,
  p_trade_area text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  current_email text;
  current_provider text;
  cleaned_name text := btrim(coalesce(p_full_name, ''));
  cleaned_trade text := nullif(btrim(coalesce(p_trade_area, '')), '');
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to complete profile setup';
  END IF;

  SELECT u.email, u.raw_app_meta_data ->> 'provider'
  INTO current_email, current_provider
  FROM auth.users AS u
  WHERE u.id = current_user_id;

  IF current_provider IS DISTINCT FROM 'google' THEN
    RAISE EXCEPTION 'Profile setup is only available to Google-authenticated users';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('student', 'resident') THEN
    RAISE EXCEPTION 'Choose a student or resident account';
  END IF;

  IF cleaned_name = '' OR char_length(cleaned_name) > 120 THEN
    RAISE EXCEPTION 'Enter a valid full name';
  END IF;

  IF p_role = 'student'
    AND lower(coalesce(current_email, '')) !~ '^[^@]+@mcvts[.]org$'
  THEN
    RAISE EXCEPTION 'Student accounts must use an @mcvts.org email address';
  END IF;

  IF p_role = 'student' AND (cleaned_trade IS NULL OR char_length(cleaned_trade) > 120) THEN
    RAISE EXCEPTION 'Enter a valid trade area';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = current_user_id) THEN
    RAISE EXCEPTION 'A profile already exists for this account';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, trade_area, email)
  VALUES (
    current_user_id,
    cleaned_name,
    p_role,
    CASE WHEN p_role = 'student' THEN cleaned_trade ELSE NULL END,
    current_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_google_profile_setup(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_google_profile_setup(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics()
RETURNS TABLE (
  students bigint,
  residents bigint,
  teachers bigint,
  industry_partners bigint,
  admins bigint,
  pending_projects bigint,
  pending_hours bigint,
  pending_placements bigint,
  pending_placement_interests bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Administrator access is required';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.profiles WHERE role = 'student'),
    (SELECT count(*) FROM public.profiles WHERE role = 'resident'),
    (SELECT count(*) FROM public.profiles WHERE role = 'teacher'),
    (SELECT count(*) FROM public.profiles WHERE role = 'industry_partner'),
    (SELECT count(*) FROM public.profiles WHERE role = 'admin'),
    (SELECT count(*) FROM public.projects WHERE status = 'pending'),
    (SELECT count(*) FROM public.field_hours WHERE status = 'pending'),
    (SELECT count(*) FROM public.partner_opportunities WHERE status = 'pending'),
    (SELECT count(*) FROM public.placement_interests WHERE status = 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_metrics() TO authenticated;

COMMIT;
