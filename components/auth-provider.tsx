"use client";

import { createContext, useContext } from "react";

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
  return (
    <AuthContext.Provider value={{ user: null, login: () => {}, logout: () => {}, saveScore: () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
