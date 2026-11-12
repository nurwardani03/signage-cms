import { useState } from "react";
import {
  Monitor,
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Radio,
} from "lucide-react";

const API_URL = "http://localhost:5000";

export default function Login({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Login failed.");
      }

      if (!result.token || !result.admin) {
        throw new Error("Invalid login response from server.");
      }

      onLogin({
        token: result.token,
        admin: result.admin,
        remember,
      });
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to the server. Please check your backend."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111113] p-4 text-white md:p-8">
      <div className="grid min-h-[680px] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-2xl border border-[#393044] bg-[#18181b] shadow-2xl shadow-purple-950/20 lg:grid-cols-2">
        {/* LEFT PANEL */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#21172f] via-[#191923] to-[#111113] p-12 lg:flex">
          <div className="absolute -left-24 -top-32 h-96 w-96 rounded-full bg-purple-600/20 blur-[100px]" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-700/20 blur-[100px]" />

          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-600">
              <Monitor size={23} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wide">SignageCMS</h1>
              <p className="text-xs text-zinc-400">
                Digital Display Management
              </p>
            </div>
          </div>

          <div className="relative z-10 max-w-lg">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-2 text-xs text-purple-300">
              <Radio size={14} />
              Smart Digital Signage Platform
            </div>

            <h2 className="text-4xl font-bold leading-tight">
              Manage your
              <span className="block text-purple-400">
                digital display network.
              </span>
            </h2>

            <p className="mt-5 max-w-md text-sm leading-7 text-zinc-400">
              Monitor connected devices, manage digital content,
              and control your company's display network from
              one centralized platform.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-3">
              {[
                "Device Monitoring",
                "Content Management",
                "Real-time Updates",
                "Centralized Control",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs text-zinc-300"
                >
                  <ShieldCheck size={15} className="text-purple-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-xs text-zinc-500">
            © 2026 SignageCMS. All rights reserved.
          </p>
        </section>

        {/* RIGHT PANEL */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-600">
                  <Monitor size={23} />
                </div>
                <div>
                  <h1 className="text-xl font-bold">SignageCMS</h1>
                  <p className="text-xs text-zinc-400">
                    Digital Display Management
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <p className="mb-3 text-sm font-medium text-purple-400">
                ADMINISTRATOR ACCESS
              </p>
              <h2 className="text-3xl font-bold tracking-tight">
                Welcome back
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Sign in to manage your digital signage network.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Email Address
                </label>
                <div className="flex items-center gap-3 rounded-xl border border-[#393943] bg-[#111113] px-4 transition focus-within:border-purple-500">
                  <Mail size={18} className="text-zinc-500" />
                  <input
                    type="email"
                    required
                    placeholder="admin@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Password
                </label>
                <div className="flex items-center gap-3 rounded-xl border border-[#393943] bg-[#111113] px-4 transition focus-within:border-purple-500">
                  <LockKeyhole size={18} className="text-zinc-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-zinc-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-zinc-400">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="accent-purple-500"
                  />
                  Remember me
                </label>

                <button
                  type="button"
                  className="text-purple-400 hover:text-purple-300"
                  onClick={() =>
                    alert("Password reset is not available yet.")
                  }
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3.5 text-sm font-semibold transition hover:bg-purple-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In"}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-center gap-2 border-t border-white/5 pt-6 text-xs text-zinc-500">
              <ShieldCheck size={15} className="text-green-500" />
              Secure administrator portal
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}