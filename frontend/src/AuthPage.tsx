import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "./api";

type AuthPageProps = {
  mode: "login" | "register";
  onAuthenticated: () => Promise<void>;
};

export default function AuthPage({ mode, onAuthenticated }: AuthPageProps) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(isRegister ? { full_name: fullName, email, password } : { email, password }),
      });
      await onAuthenticated();
      navigate("/dashboard", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to authenticate right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-5 py-12">
      <section
        className="w-full max-w-md rounded border border-neutral-200 bg-white p-6 sm:p-8"
        aria-labelledby="auth-title"
      >
        <Link className="text-sm text-neutral-600 underline underline-offset-4" to="/p/hamza-oubahim">
          ← View portfolio
        </Link>
        <p className="mt-8 text-sm text-neutral-500">Portfolio studio</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight" id="auth-title">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 leading-6 text-neutral-600">
          {isRegister
            ? "Set up your private workspace and build a portfolio you can share."
            : "Sign in to update your portfolio and prepare your CV."}
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          {isRegister && (
            <label className="block space-y-1 text-sm">
              Full name
              <input
                className="w-full rounded border border-neutral-300 px-3 py-2"
                autoComplete="name"
                maxLength={150}
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </label>
          )}
          <label className="block space-y-1 text-sm">
            Email
            <input
              className="w-full rounded border border-neutral-300 px-3 py-2"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            Password
            <input
              className="w-full rounded border border-neutral-300 px-3 py-2"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={8}
              maxLength={72}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <small className="block text-neutral-500">Use at least 8 characters.</small>
          </label>
          {error && (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <button
            className="w-full rounded bg-black px-4 py-2.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
            disabled={busy}
            type="submit"
          >
            {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <p className="mt-5 text-sm text-neutral-600">
          {isRegister ? "Already have an account?" : "New here?"}{" "}
          <Link className="text-black underline underline-offset-4" to={isRegister ? "/login" : "/register"}>
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
