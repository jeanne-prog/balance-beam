
-- Invitations table: admins pre-assign roles before users sign in
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  UNIQUE(email)
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage invitations
CREATE POLICY "Admins can select invitations"
  ON public.invitations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert invitations"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update invitations"
  ON public.invitations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invitations"
  ON public.invitations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Update handle_new_user_role to check invitations first
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_count int;
  invited_role app_role;
BEGIN
  -- Check if there's a pending invitation for this email
  SELECT role INTO invited_role
  FROM public.invitations
  WHERE email = NEW.email AND used_at IS NULL
  LIMIT 1;

  IF invited_role IS NOT NULL THEN
    -- Use the pre-assigned role from invitation
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, invited_role);
    -- Mark invitation as used
    UPDATE public.invitations SET used_at = now() WHERE email = NEW.email AND used_at IS NULL;
  ELSE
    -- Default: first user = admin, rest = viewer
    SELECT COUNT(*) INTO user_count FROM public.user_roles;
    IF user_count = 0 THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
