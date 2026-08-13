"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
export type User = { name: string };
export type ScoreEntry = { game: string; score: number; name: string };
type AuthContextValue = {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  saveScore: (entry: ScoreEntry) => Promise<void>;
};
const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: () => {},
  logout: () => {},
  saveScore: async () => {},
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    // Reads localStorage post-hydration only, to keep server/client markup identical.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(JSON.parse(localStorage.getItem("av_user") || "null"));
    } catch {
      setUser(null);
    }
  }, []);
  const login = (u: User) => {
    setUser(u);
    localStorage.setItem("av_user", JSON.stringify(u));
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem("av_user");
  };
  const saveScore = async (entry: ScoreEntry) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("scores")
      .insert({ game_id: entry.game, name: entry.name, score: entry.score });
    if (error) throw error;
  };
  return (
    <AuthContext.Provider value={{ user, login, logout, saveScore }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
