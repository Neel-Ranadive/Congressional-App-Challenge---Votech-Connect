BEGIN;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'resident', 'teacher', 'industry_partner', 'admin'));

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

COMMIT;
