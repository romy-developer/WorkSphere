import { useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { hasPermission } from "../auth/permissions";
import { useAuth } from "../auth/AuthContext";

export function ProtectedLayout() {
  const { user, status, signOut } = useAuth();
  const location = useLocation();
  const [signOutError, setSignOutError] = useState("");

  if (status === "loading") return <FullPageStatus label="Restoring your session" />;
  if (status === "error") return <SessionExpired />;
  if (status === "unauthenticated" || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const handleSignOut = async () => {
    setSignOutError("");
    try {
      await signOut();
    } catch {
      setSignOutError("Sign out could not be completed. Check your connection and retry.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f6f3] text-[#1d2b27] md:grid md:grid-cols-[250px_1fr]">
      <aside className="flex min-h-full flex-col border-b border-[#dce5df] bg-[#fbfcfa] px-5 py-6 md:border-b-0 md:border-r">
        <a className="flex items-center gap-3 font-semibold" href="/dashboard">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-[#285b49] text-sm text-white">W</span>
          <span className="text-lg">WorkSphere</span>
        </a>
        <p className="mb-3 mt-10 text-xs font-semibold uppercase tracking-[0.12em] text-[#78857e]">
          Workspace
        </p>
        <nav aria-label="Main navigation" className="grid gap-1">
          <NavLink to="/dashboard" className={navLinkClass}>
            Dashboard
          </NavLink>
          {hasPermission(user, "roles.manage") && (
            <NavLink to="/roles" className={navLinkClass}>
              Roles & permissions
            </NavLink>
          )}
        </nav>
        <div className="mt-auto border-t border-[#dce5df] pt-5">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="mt-1 truncate text-xs text-[#78857e]">{user.email}</p>
          <p className="mt-3 text-xs text-[#53655c]">{formatRoles(user.roles)}</p>
          <button
            className="mt-4 w-full rounded-md border border-[#cad6ce] px-3 py-2 text-left text-sm font-medium hover:bg-[#eef3ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285b49]"
            onClick={() => void handleSignOut()}
            type="button"
          >
            Sign out
          </button>
          {signOutError && <p className="mt-2 text-xs leading-5 text-[#8a4935]" role="alert">{signOutError}</p>}
        </div>
      </aside>
      <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}

export function ProtectedRoute({ permission }: { permission?: string }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <FullPageStatus label="Restoring your session" />;
  if (status === "error") return <SessionExpired />;
  if (status !== "authenticated" || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (permission && !hasPermission(user, permission)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}

export function FullPageStatus({ label }: { label: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f6f3] px-6 text-[#44564d]" role="status">
      <p>{label}...</p>
    </main>
  );
}

function SessionExpired() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f6f3] px-6">
      <section className="w-full max-w-md rounded-lg border border-[#dce5df] bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-[#9b563e]">Session unavailable</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in again</h1>
        <p className="mt-3 text-sm leading-6 text-[#637168]">
          WorkSphere could not restore your session. Please sign in again.
        </p>
        <a className="mt-6 inline-flex rounded-md bg-[#285b49] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#214a3b]" href="/login">
          Go to sign in
        </a>
      </section>
    </main>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
    isActive ? "bg-[#e6efe9] text-[#214d3b]" : "text-[#53655c] hover:bg-[#f0f4f1]",
  ].join(" ");
}

function formatRoles(roles: string[]): string {
  return roles.map((role) => role.replaceAll("_", " ")).join(" · ");
}