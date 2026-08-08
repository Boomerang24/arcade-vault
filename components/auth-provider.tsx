"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type User = { name: string };
export type ScoreEntry = { game: string; score: number; name: string; at: number };

type AuthContextValue = {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  saveScore: (entry: Omit<ScoreEntry, "at">) => void;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: () => {},
  logout: () => {},
  saveScore: () => {},
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

  const saveScore = (entry: Omit<ScoreEntry, "at">) => {
    try {
      const all = JSON.parse(localStorage.getItem("av_scores") || "[]");
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem("av_scores", JSON.stringify(all));
    } catch {
      // ignore
    }
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
