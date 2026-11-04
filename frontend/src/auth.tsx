import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, setApiToken, setUnauthorizedHandler, TOKEN_KEY, User } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { storage } from "@/src/utils/storage";

type AuthCtx = {
  user: User | null;
  ready: boolean;
  signIn: (username: string, password: string, register?: boolean) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<User | null>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const signOut = useCallback(async () => {
    setApiToken(null);
    await storage.secureRemove(TOKEN_KEY);
    queryClient.clear();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
    });
    (async () => {
      const t = await storage.secureGet<string | null>(TOKEN_KEY, null);
      if (t) {
        setApiToken(t);
        await refresh();
      }
      setReady(true);
    })();
  }, [refresh, signOut]);

  const signIn = useCallback(async (username: string, password: string, register = false) => {
    const res = await api<{ token: string; user: User }>(register ? "/auth/register" : "/auth/login", {
      method: "POST",
      body: { username, password },
    });
    setApiToken(res.token);
    await storage.secureSet(TOKEN_KEY, res.token);
    queryClient.clear();
    setUser(res.user);
    return res.user;
  }, []);

  return <Ctx.Provider value={{ user, ready, signIn, signOut, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
