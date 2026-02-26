import { useState, useEffect, useCallback } from "react";

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

    const applySession = async (session: Session | null) => {
      const user = session?.user ?? null;
      let role: Role | null = null;

      if (user) {
        role = await fetchRole(user.id);
      }

      if (!mounted) return;
      setState({ user, session, role, loading: false });
    };

    // Subscribe first so we never miss SIGNED_IN after OAuth redirect.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    // Hydrate initial state.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      void applySession(session);
    });

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
