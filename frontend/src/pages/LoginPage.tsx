import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthApiError } from "../auth/api";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { signIn, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const from = getReturnPath(location.state) ?? "/dashboard";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (caught) {
      if (caught instanceof AuthApiError && caught.status === 400) {
        setError("Enter a valid email address and password.");
      } else if (caught instanceof AuthApiError && caught.status === 429) {
        setError("Too many attempts. Wait a few minutes before trying again.");
      } else if (caught instanceof AuthApiError && caught.status === 401) {
        setError("Invalid email or password.");
      } else {
        setError("Sign-in is temporarily unavailable. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "authenticated") return <Navigate to="/dashboard" replace />;
  if (status === "loading") {
    return <main className="grid min-h-screen place-items-center text-[#53655c]">Checking your session...</main>;
  }

  return (
    <main className="min-h-screen bg-[#edf3ee] lg:grid lg:grid-cols-[minmax(360px,0.9fr)_1.1fr]">
      <section className="flex min-h-[34vh] flex-col justify-between bg-[#214d3b] px-7 py-8 text-white sm:px-12 lg:min-h-screen lg:px-16 lg:py-12">
        <a className="flex items-center gap-3 text-lg font-semibold" href="/login">
          <span className="grid h-10 w-10 place-items-center rounded-md border border-white/25 bg-white/10">W</span>
          WorkSphere
        </a>
        <div className="max-w-xl py-10 lg:py-0">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#b8d6c3]">People operations</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">A clearer view of your workday.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-[#d2e1d7]">
            Sign in to your secure WorkSphere workspace.
          </p>
        </div>
        <p className="hidden text-xs text-[#b8d6c3] lg:block">Secure access · WorkSphere HRMS</p>
      </section>

      <section className="grid min-h-[66vh] place-items-center px-5 py-12 sm:px-10 lg:min-h-screen">
        <div className="w-full max-w-md">
          <p className="text-sm font-semibold text-[#47745b]">Welcome back</p>
          <h2 className="mt-2 text-3xl font-semibold text-[#1d2b27]">Sign in</h2>
          <p className="mt-2 text-sm text-[#64736a]">Use your WorkSphere account credentials.</p>

          <form className="mt-8 grid gap-5" onSubmit={(event) => void submit(event)}>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-[#30423a]" htmlFor="email">Work email</label>
              <input
                autoComplete="username"
                className="h-12 rounded-md border border-[#bdcbc1] bg-white px-3.5 text-base outline-none focus:border-[#397356] focus:ring-2 focus:ring-[#397356]/20"
                id="email"
                maxLength={320}
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-[#30423a]" htmlFor="password">Password</label>
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-sm font-medium text-[#37694f] underline-offset-4 hover:underline"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                autoComplete="current-password"
                className="h-12 rounded-md border border-[#bdcbc1] bg-white px-3.5 text-base outline-none focus:border-[#397356] focus:ring-2 focus:ring-[#397356]/20"
                id="password"
                maxLength={128}
                minLength={1}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
            </div>

            {error && (
              <p className="rounded-md border border-[#e8c9bd] bg-[#fff5f1] px-3.5 py-3 text-sm text-[#873e2c]" role="alert">
                {error}
              </p>
            )}

            <button
              className="mt-1 h-12 rounded-md bg-[#285b49] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#214a3b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285b49] disabled:cursor-wait disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="mt-8 border-t border-[#d6e0d8] pt-5 text-xs leading-5 text-[#728077]">
            Access is protected by your organization’s account and assigned permissions.
          </p>
        </div>
      </section>
    </main>
  );
}

function getReturnPath(state: unknown): string | undefined {
  if (typeof state !== "object" || state === null || !("from" in state)) return undefined;
  const from = state.from;
  if (typeof from !== "object" || from === null || !("pathname" in from)) return undefined;
  return typeof from.pathname === "string" ? from.pathname : undefined;
}