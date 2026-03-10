
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Only allow the very first user (admin bootstrap); reject everyone else
    SELECT COUNT(*) INTO user_count FROM public.user_roles;
    IF user_count = 0 THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    ELSE
      -- No invitation found → do NOT create a role.
      -- Without a role, RLS policies will block all data access.
      RAISE EXCEPTION 'Access denied: no invitation found for %', NEW.email;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
