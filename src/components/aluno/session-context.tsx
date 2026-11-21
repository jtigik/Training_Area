"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionUser } from "@/lib/api";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/** Signed-in user inside the student area (always set below <StudentShell>). */
export function useSessionUser(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSessionUser must be used inside <SessionProvider>");
  return user;
}
