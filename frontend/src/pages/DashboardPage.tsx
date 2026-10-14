import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AuthApiError, fetchDashboard } from "../auth/api";
import { useAuth } from "../auth/AuthContext";

export function DashboardPage() {
  const { user, refresh } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchDashboard()
      .then((result) => {
        if (active) setMessage(result.message);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (caught instanceof AuthApiError && caught.status === 401) {
          void refresh();
        } else if (caught instanceof AuthApiError && caught.status === 403) {
          setForbidden(true);
        } else {
          setError("Dashboard data is temporarily unavailable.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (forbidden) return <Navigate to="/unauthorized" replace />;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#527b64]">Overview</p>
      <h1 className="mt-2 text-3xl font-semibold text-[#1d2b27]">Dashboard</h1>
      <section className="mt-8 border-y border-[#d6e0d8] py-7">
        <p className="text-sm text-[#66746b]">Signed in as</p>
        <h2 className="mt-1 text-2xl font-semibold text-[#213b2e]">{user?.name}</h2>
        <p className="mt-2 text-sm text-[#596a60]">{formatRoles(user?.roles ?? [])}</p>
        {message && <p className="mt-6 text-sm text-[#53655b]">{message}</p>}
        {!message && !error && <p className="mt-6 text-sm text-[#758278]">Loading your dashboard...</p>}
        {error && <p className="mt-6 text-sm text-[#8a4935]" role="alert">{error}</p>}
      </section>
      <p className="mt-6 max-w-xl text-sm leading-6 text-[#69776e]">
        Your account access is determined by the permissions assigned to your role.
      </p>
    </div>
  );
}

function formatRoles(roles: string[]): string {
  return roles.map((role) => role.replaceAll("_", " ")).join(" · ");
}