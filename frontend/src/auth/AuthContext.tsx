import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AuthApiError, fetchCurrentUser, login as loginRequest, logout as logoutRequest } from "./api";
import type { AuthStatus, AuthenticatedUser } from "./types";

interface AuthContextValue {
  user: AuthenticatedUser | null;
  status: AuthStatus;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refresh = async () => {
    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
      setStatus("authenticated");
    } catch (error) {
      setUser(null);
      setStatus(error instanceof AuthApiError && error.status === 401 ? "unauthenticated" : "error");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const signIn = async (email: string, password: string) => {
    const signedInUser = await loginRequest(email, password);
    setUser(signedInUser);
    setStatus("authenticated");
  };

  const signOut = async () => {
    await logoutRequest();
    setUser(null);
    setStatus("unauthenticated");
  };

  return (
    <AuthContext.Provider value={{ user, status, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}