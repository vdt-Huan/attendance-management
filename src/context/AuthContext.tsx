import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";
import { signInWithPassword, signOutEverywhere } from "../services/auth";
import type { AuthState } from "../types/auth";
import { AuthContext, BOOTING_STATE, MISSING_ENV_STATE, loadProfileFor } from "./authState";
import type { AuthContextValue } from "./authState";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    isSupabaseConfigured() ? BOOTING_STATE : MISSING_ENV_STATE,
  );
  const [signingOut, setSigningOut] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Khôi phục session + 1 listener duy nhất. Cleanup khi unmount để tránh
  // nhiều listener khi StrictMode mount lại.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let alive = true;
    const client = getSupabaseClient();

    client.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!alive) return;
        if (error) {
          setState({ status: "signed-out", user: null, profile: null, error: null });
          return;
        }
        const session: Session | null = data.session;
        if (!session?.user) {
          setState({ status: "signed-out", user: null, profile: null, error: null });
          return;
        }
        setState({ status: "loading-profile", user: session.user, profile: null, error: null });
        const next = await loadProfileFor(session.user);
        if (alive) setState(next);
      })
      .catch(() => {
        if (alive) {
          setState({
            status: "error",
            user: null,
            profile: null,
            error: "Không khôi phục được phiên đăng nhập. Kiểm tra mạng rồi tải lại trang.",
          });
        }
      });

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === "SIGNED_OUT" || !session?.user) {
        if (event === "SIGNED_OUT") setState({ status: "signed-out", user: null, profile: null, error: null });
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setState((prev) => {
          if (prev.user?.id === session.user.id && (prev.status === "ready" || prev.status === "missing-profile")) {
            return event === "USER_UPDATED" ? { ...prev, user: session.user } : prev;
          }
          void loadProfileFor(session.user).then((next) => {
            // Bỏ qua kết quả cũ nếu user đã đổi trong lúc chờ.
            setState((cur) => (cur.user?.id === next.user?.id || next.user === null ? next : cur));
          });
          return { status: "loading-profile", user: session.user, profile: null, error: null };
        });
      }
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [reloadKey]);

  const signIn = useCallback(async (email: string, password: string) => {
    // signInWithPassword chỉ resolve khi Supabase xác nhận thành công —
    // caller không hiện "thành công" trước lúc này.
    const user = await signInWithPassword({ email, password });
    const next = await loadProfileFor(user);
    setState(next);
  }, []);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      const res = await signOutEverywhere();
      if (!res.ok) throw new Error(res.message);
      setState({ status: "signed-out", user: null, profile: null, error: null });
    } finally {
      setSigningOut(false);
    }
  }, []);

  const reloadProfile = useCallback(() => setReloadKey((k) => k + 1), []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signOut, reloadProfile, signingOut }),
    [state, signIn, signOut, reloadProfile, signingOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
