import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
  ShieldCheck,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Camera,
  Bot,
  BarChart3,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../lib/api";

const FEATURES = [
  { icon: Camera, text: "Real-time YOLOv8 PPE detection on every site photo" },
  { icon: Bot, text: "RAG-powered AI Assistant grounded in your own data" },
  { icon: BarChart3, text: "Live compliance analytics and audit-ready reports" },
];

function BackgroundGlow() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-24 -left-24 w-[26rem] h-[26rem] bg-red-500/20 rounded-full blur-3xl animate-blob" />
      <div className="absolute top-1/3 -right-20 w-[24rem] h-[24rem] bg-blue-500/15 rounded-full blur-3xl animate-blob animation-delay-2000" />
      <div className="absolute -bottom-24 left-1/4 w-[22rem] h-[22rem] bg-purple-500/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          // Dark dots: the pattern was white, which is invisible on the
          // light theme.
          backgroundImage: "radial-gradient(circle, #0f172a 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />
    </div>
  );
}

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    try {
      setLoading(true);

      // Was hardcoded to http://127.0.0.1:8000, which only resolves when the
      // browser is on the same machine as the backend — opening the app from
      // a phone or another PC made every login fail while the rest of the
      // app (which uses API_BASE) kept working.
      const res = await axios.post(`${API_BASE}/auth/login`, {
        username: username.trim(),
        password,
      });

      const { access_token, username: uname, role } = res.data;

      login({ token: access_token, username: uname, role });

      const redirectTo = location.state?.from?.pathname || "/";

      navigate(redirectTo, { replace: true });
    } catch (err) {
      // Every failure used to surface as "check your credentials", including
      // failures that have nothing to do with credentials: a backend that
      // isn't running, a CORS rejection or a 500 all arrive with no
      // err.response, so correct details got reported back as wrong ones.
      // That's the "valid credentials rejected" symptom. Each class of
      // failure now says what actually happened.
      console.error("Login request failed:", err);

      if (!err?.response) {
        setError(
          `Can't reach the server at ${API_BASE}. Check that the backend is running, then try again.`
        );
      } else if (err.response.status === 401) {
        setError(err.response.data?.detail || "Invalid username or password.");
      } else {
        setError(
          err.response.data?.detail ||
            `Login failed — the server responded with ${err.response.status}.`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#050816] text-white">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-14 xl:p-20 overflow-hidden border-r border-white/5">
        <BackgroundGlow />

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-20">
            <div className="bg-red-500/15 text-red-400 rounded-2xl p-3.5">
              <ShieldCheck size={34} />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">Safesight</div>
              <div className="text-sm text-gray-400">Safety Intelligence Platform</div>
            </div>
          </div>

          <h1 className="text-5xl xl:text-6xl font-bold leading-[1.1] mb-7">
            See every site.
            <br />
            <span className="text-red-400">Stop every risk.</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-md leading-relaxed">
            AI-powered PPE detection, a RAG safety assistant, and full compliance
            analytics — all in one secure platform.
          </p>
        </div>

        <div className="relative z-10 space-y-6">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="flex items-center gap-4">
                <div className="shrink-0 w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-red-400">
                  <Icon size={20} />
                </div>
                <p className="text-base text-gray-300">{f.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <div className="absolute inset-0 lg:hidden">
          <BackgroundGlow />
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="bg-red-500/15 text-red-400 rounded-2xl p-3">
              <ShieldCheck size={28} />
            </div>
            <div>
              <div className="text-xl font-bold">Safesight</div>
              <div className="text-xs text-gray-400">Safety Intelligence Platform</div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl">
            <h2 className="text-3xl font-bold mb-2">Welcome back</h2>
            <p className="text-gray-400 text-base mb-9">
              Sign in to your Safesight account
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-300 text-base font-medium mb-2">
                  Username
                </label>
                <div className="flex items-center bg-[#0b1120] border border-gray-700 rounded-xl px-4 py-3.5 focus-within:border-red-400 transition">
                  <UserIcon size={19} className="text-gray-500 mr-3 shrink-0" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin or user"
                    className="bg-transparent outline-none text-white text-base flex-1 placeholder:text-gray-600"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 text-base font-medium mb-2">
                  Password
                </label>
                <div className="flex items-center bg-[#0b1120] border border-gray-700 rounded-xl px-4 py-3.5 focus-within:border-red-400 transition">
                  <Lock size={19} className="text-gray-500 mr-3 shrink-0" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-transparent outline-none text-white text-base flex-1 placeholder:text-gray-600"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-gray-500 hover:text-gray-300 shrink-0 ml-2"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-base bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-lg font-semibold py-3.5 rounded-xl transition"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-sm text-gray-500 text-center leading-relaxed">
                Demo accounts (change in production):
                <br />
                <span className="text-gray-400">
                  <b className="text-gray-300">admin</b> / admin123 &nbsp;·&nbsp;{" "}
                  <b className="text-gray-300">user</b> / user123
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
