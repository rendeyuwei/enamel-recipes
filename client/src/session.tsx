import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "./api";

type Status = "loading" | "in" | "out";

type SessionValue = {
  status: Status;
  markIn: () => void;
  markOut: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  useEffect(() => {
    let live = true;
    api<{ authenticated: boolean }>("/session")
      .then((body) => {
        if (live) setStatus(body.authenticated ? "in" : "out");
      })
      .catch(() => {
        if (live) setStatus("out");
      });
    return () => {
      live = false;
    };
  }, []);
  const value = { status, markIn: () => setStatus("in"), markOut: () => setStatus("out") };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider missing");
  return value;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (session.status === "loading") {
    return (
      <main>
        <p className="tally">正在确认登录…</p>
      </main>
    );
  }
  if (session.status === "out") {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return children;
}
