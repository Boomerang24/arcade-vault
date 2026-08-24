"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
export type User = { id: string; email: string; name: string };
export type ScoreEntry = { game: string; score: number; name: string };
type OAuthProvider = "google" | "github";
type AuthContextValue = {
  user: User | null;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error: string | null }>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  saveScore: (entry: ScoreEntry) => Promise<void>;
};
function toUser(supabaseUser: SupabaseUser | null): User | null {
  if (!supabaseUser || !supabaseUser.email) return null;
  return {
    id: supabaseUser.id,
    email: supabaseUser.email,
    name:
      supabaseUser.user_metadata?.display_name ??
      supabaseUser.email.split("@")[0],
  };
}
const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signInWithOAuth: async () => {},
  logout: async () => {},
  resetPassword: async () => ({ error: null }),
  saveScore: async () => {},
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(toUser(data.user));
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toUser(session?.user ?? null));
    });
    return () => subscription.unsubscribe();
  }, []);
  const login = async (email: string, password: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
  };
  const signUp = async (email: string, password: string, name: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    return { error: error?.message ?? null };
  };
  const signInWithOAuth = async (provider: OAuthProvider) => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };
  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  };
  const resetPassword = async (email: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer-password`,
    });
    return { error: error?.message ?? null };
  };
  const saveScore = async (entry: ScoreEntry) => {
    const supabase = createClient();
    const { error } = await supabase.from("scores").insert({
      game_id: entry.game,
      name: entry.name,
      score: entry.score,
      user_id: user?.id ?? null,
    });
    if (error) throw error;
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signUp,
        signInWithOAuth,
        logout,
        resetPassword,
        saveScore,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
