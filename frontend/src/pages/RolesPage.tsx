import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AuthApiError, fetchRoleMatrix, type RoleMatrixEntry } from "../auth/api";

export function RolesPage() {
  const [roles, setRoles] = useState<RoleMatrixEntry[]>([]);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchRoleMatrix()
      .then((result) => {
        if (active) setRoles(result.roles);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (caught instanceof AuthApiError && caught.status === 401) {
          setError("Your session has expired. Sign in again to continue.");
        } else if (caught instanceof AuthApiError && caught.status === 403) {
          setForbidden(true);
        } else {
          setError("Roles and permissions are temporarily unavailable.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (forbidden) return <Navigate to="/unauthorized" replace />;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#527b64]">Access control</p>
      <h1 className="mt-2 text-3xl font-semibold text-[#1d2b27]">Roles & permissions</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#64736a]">
        Read-only view of the permissions attached to each role. Access to this page is enforced by the API.
      </p>

      {error && <p className="mt-6 text-sm text-[#8a4935]" role="alert">{error}</p>}
      {roles.length === 0 && !error && <p className="mt-7 text-sm text-[#64736a]">Loading role permissions...</p>}

      <div className="mt-7 divide-y divide-[#dce5df] border-y border-[#dce5df]">
        {roles.map((role) => (
          <section className="grid gap-3 py-5 md:grid-cols-[220px_1fr]" key={role.name}>
            <div>
              <h2 className="text-sm font-semibold text-[#2d4738]">{role.name.replaceAll("_", " ")}</h2>
              <p className="mt-1 text-sm leading-5 text-[#728077]">{role.description}</p>
            </div>
            <ul className="flex flex-wrap gap-2" aria-label={`${role.name} permissions`}>
              {role.permissions.map((permission) => (
                <li className="rounded border border-[#d6e0d8] bg-white px-2.5 py-1.5 font-mono text-xs text-[#365b46]" key={permission}>
                  {permission}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}