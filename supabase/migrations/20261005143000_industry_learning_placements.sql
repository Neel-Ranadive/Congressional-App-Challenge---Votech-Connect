BEGIN;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'resident', 'teacher', 'industry_partner', 'admin'));

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid())
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

CREATE TABLE public.partner_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_name text NOT NULL CHECK (char_length(btrim(organization_name)) BETWEEN 2 AND 120),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 4 AND 120),
  trade_category text NOT NULL CHECK (char_length(btrim(trade_category)) BETWEEN 2 AND 80),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 20 AND 1200),
  learning_goals text NOT NULL CHECK (char_length(btrim(learning_goals)) BETWEEN 10 AND 600),
  supervision_plan text NOT NULL CHECK (char_length(btrim(supervision_plan)) BETWEEN 10 AND 600),
  location text NOT NULL CHECK (char_length(btrim(location)) BETWEEN 2 AND 100),
  compensation_status text NOT NULL CHECK (
    compensation_status IN ('paid', 'unpaid_educational', 'to_be_determined')
  ),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'closed')
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.placement_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.partner_opportunities(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, student_id)
);

ALTER TABLE public.partner_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_interests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.partner_opportunities TO authenticated;
GRANT UPDATE (status) ON public.partner_opportunities TO authenticated;
GRANT SELECT, INSERT ON public.placement_interests TO authenticated;
GRANT UPDATE (status, teacher_id) ON public.placement_interests TO authenticated;

CREATE POLICY partner_opportunities_read_approved_or_owned
ON public.partner_opportunities
FOR SELECT
TO authenticated
USING (
  status = 'approved'
  OR partner_id = (SELECT auth.uid())
  OR (SELECT public.current_app_role()) IN ('teacher', 'admin')
);

CREATE POLICY partner_opportunities_insert_pending
ON public.partner_opportunities
FOR INSERT
TO authenticated
WITH CHECK (
  partner_id = (SELECT auth.uid())
  AND (SELECT public.current_app_role()) = 'industry_partner'
  AND status = 'pending'
);

CREATE POLICY partner_opportunities_partner_close
ON public.partner_opportunities
FOR UPDATE
TO authenticated
USING (
  partner_id = (SELECT auth.uid())
  AND (SELECT public.current_app_role()) = 'industry_partner'
  AND status IN ('pending', 'approved')
)
WITH CHECK (
  partner_id = (SELECT auth.uid())
  AND (SELECT public.current_app_role()) = 'industry_partner'
  AND status = 'closed'
);

CREATE POLICY partner_opportunities_teacher_review
ON public.partner_opportunities
FOR UPDATE
TO authenticated
USING (
  (SELECT public.current_app_role()) IN ('teacher', 'admin')
  AND status = 'pending'
)
WITH CHECK (
  (SELECT public.current_app_role()) IN ('teacher', 'admin')
  AND status IN ('approved', 'rejected')
);

CREATE POLICY placement_interests_student_read_own
ON public.placement_interests
FOR SELECT
TO authenticated
USING (
  student_id = (SELECT auth.uid())
  OR (SELECT public.current_app_role()) IN ('teacher', 'admin')
);

CREATE POLICY placement_interests_student_request
ON public.placement_interests
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = (SELECT auth.uid())
  AND status = 'pending'
  AND teacher_id IS NULL
  AND (SELECT public.current_app_role()) = 'student'
  AND EXISTS (
    SELECT 1
    FROM public.partner_opportunities AS opportunity
    WHERE opportunity.id = opportunity_id
      AND opportunity.status = 'approved'
  )
);

CREATE POLICY placement_interests_teacher_review
ON public.placement_interests
FOR UPDATE
TO authenticated
USING (
  (SELECT public.current_app_role()) IN ('teacher', 'admin')
  AND status = 'pending'
)
WITH CHECK (
  (SELECT public.current_app_role()) IN ('teacher', 'admin')
  AND status IN ('approved', 'rejected')
  AND teacher_id = (SELECT auth.uid())
);

CREATE OR REPLACE FUNCTION public.partner_approved_interest_counts()
RETURNS TABLE (opportunity_id uuid, approved_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT interest.opportunity_id, count(*)
  FROM public.placement_interests AS interest
  JOIN public.partner_opportunities AS opportunity
    ON opportunity.id = interest.opportunity_id
  WHERE opportunity.partner_id = (SELECT auth.uid())
    AND interest.status = 'approved'
    AND (SELECT public.current_app_role()) = 'industry_partner'
  GROUP BY interest.opportunity_id
$$;

REVOKE ALL ON FUNCTION public.partner_approved_interest_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_approved_interest_counts() TO authenticated;

COMMIT;
