import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Role } from "@/types";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: Role | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    loading: true,
  });

  const initialised = useRef(false);

  const fetchRole = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    return (data?.role as Role) ?? null;
  }, []);

  useEffect(() => {
    let mounted = true;

    // 1. Get existing session first
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const user = session?.user ?? null;
      let role: Role | null = null;
      if (user) {
        role = await fetchRole(user.id);
      }
      if (!mounted) return;
      initialised.current = true;
      setState({ user, session, role, loading: false });
    });

    // 2. Listen for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        // Skip events until initial session check completes
        if (!initialised.current) return;

        const user = session?.user ?? null;
        let role: Role | null = null;
        if (user) {
          role = await fetchRole(user.id);
        }
        if (!mounted) return;
        setState({ user, session, role, loading: false });
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchRole]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { ...state, signOut };
}
