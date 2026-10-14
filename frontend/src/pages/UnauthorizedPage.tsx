import { Link } from "react-router-dom";

export function UnauthorizedPage() {
  return (
    <section className="mx-auto mt-12 max-w-xl border-y border-[#d6e0d8] py-8">
      <p className="text-sm font-semibold text-[#a0563e]">403 · Access denied</p>
      <h1 className="mt-2 text-2xl font-semibold text-[#21332a]">You don’t have permission to view this page.</h1>
      <p className="mt-3 text-sm leading-6 text-[#67756c]">
        Your assigned role does not include the permission required for this resource.
      </p>
      <Link className="mt-6 inline-flex rounded-md bg-[#285b49] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#214a3b]" to="/dashboard">
        Return to dashboard
      </Link>
    </section>
  );
}