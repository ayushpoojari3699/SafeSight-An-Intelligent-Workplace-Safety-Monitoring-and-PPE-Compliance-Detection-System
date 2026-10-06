import { useEffect, useState } from "react";
import axios from "axios";
import { KeyRound, ShieldCheck, Server, Database, Cpu } from "lucide-react";
import { API_BASE } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2 text-gray-400 text-base">
        <Icon size={15} />
        {label}
      </div>
      <div className="text-base font-medium">{value}</div>
    </div>
  );
}

export default function AdminSettings() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Platform info is read from /health so this panel reports the model that
  // is actually configured, instead of a string baked in at build time.
  const [health, setHealth] = useState(null);
  useEffect(() => {
    axios
      .get(`${API_BASE}/health`)
      .then((res) => setHealth(res.data))
      .catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ ok: false, text: "New passwords do not match." });
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API_BASE}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setMessage({ ok: true, text: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setMessage({ ok: false, text: err?.response?.data?.detail || "Could not update password." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h2 className="text-4xl font-bold">Settings</h2>
        <p className="text-gray-400 mt-1">Account security and platform information.</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
        <h3 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <KeyRound size={18} className="text-red-400" />
          Change Password
        </h3>
        <p className="text-gray-500 text-base mb-6">
          Signed in as <span className="text-gray-300">{user?.username}</span>
        </p>

        <form onSubmit={submit} className="space-y-4 max-w-sm">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-[#0b1120] border border-gray-700 rounded-lg px-3 py-2 text-base outline-none focus:border-red-400"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-[#0b1120] border border-gray-700 rounded-lg px-3 py-2 text-base outline-none focus:border-red-400"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#0b1120] border border-gray-700 rounded-lg px-3 py-2 text-base outline-none focus:border-red-400"
            />
          </div>

          {message && (
            <p className={`text-base ${message.ok ? "text-green-400" : "text-red-400"}`}>{message.text}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-red-500 hover:bg-red-600 disabled:opacity-60 rounded-lg px-5 py-2.5 text-base font-medium transition"
          >
            {saving ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <ShieldCheck size={18} className="text-red-400" />
          Platform Information
        </h3>
        <InfoRow
          icon={Server}
          label="API Version"
          value={health?.version ? `Safesight API v${health.version}` : "Safesight API"}
        />
        <InfoRow icon={Database} label="Database" value="MongoDB (SAFESIGHT)" />
        <InfoRow icon={Cpu} label="Detection Model" value="YOLOv8m" />
        <InfoRow
          icon={Cpu}
          label="RAG Stack"
          value={`${health?.model || "…"} · FAISS · MiniLM`}
        />
        <InfoRow
          icon={Cpu}
          label="LLM Provider"
          value={
            health
              ? `${health.llm_provider}${health.llm_is_local ? " (local)" : " (hosted)"}`
              : "…"
          }
        />
      </div>
    </div>
  );
}
