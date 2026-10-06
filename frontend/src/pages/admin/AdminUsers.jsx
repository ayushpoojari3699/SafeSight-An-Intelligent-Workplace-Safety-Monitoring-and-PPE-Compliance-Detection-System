import { useEffect, useState } from "react";
import axios from "axios";
import { UserPlus, Trash2, KeyRound, X, Loader2, ShieldCheck } from "lucide-react";
import { API_BASE } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#111827] border border-gray-800 rounded-2xl w-full max-w-sm p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await axios.post(`${API_BASE}/users`, { username, password, role });
      onCreated(res.data.user);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not create user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add User" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-gray-400 text-sm mb-1">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-[#0b1120] border border-gray-700 rounded-lg px-3 py-2 text-base outline-none focus:border-red-400"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#0b1120] border border-gray-700 rounded-lg px-3 py-2 text-base outline-none focus:border-red-400"
          />
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-[#0b1120] border border-gray-700 rounded-lg px-3 py-2 text-base outline-none"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 rounded-lg py-2.5 font-medium transition"
        >
          {saving ? "Creating..." : "Create User"}
        </button>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/users/${encodeURIComponent(user.username)}`, { password });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not reset password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Reset password — ${user.username}`} onClose={onClose}>
      {done ? (
        <p className="text-green-400 text-base">Password updated.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0b1120] border border-gray-700 rounded-lg px-3 py-2 text-base outline-none focus:border-red-400"
              autoFocus
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 rounded-lg py-2.5 font-medium transition"
          >
            {saving ? "Saving..." : "Reset Password"}
          </button>
        </form>
      )}
    </Modal>
  );
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [busyUsername, setBusyUsername] = useState(null);

  const load = () => {
    setLoading(true);
    setError("");
    axios
      .get(`${API_BASE}/users`)
      .then((res) => setUsers(res.data.users || []))
      .catch((err) => {
        console.error(err);
        setError("Could not load users.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleRoleChange = async (username, role) => {
    setBusyUsername(username);
    try {
      await axios.put(`${API_BASE}/users/${encodeURIComponent(username)}`, { role });
      setUsers((prev) => prev.map((u) => (u.username === username ? { ...u, role } : u)));
    } catch (err) {
      alert(err?.response?.data?.detail || "Could not update role.");
    } finally {
      setBusyUsername(null);
    }
  };

  const handleDelete = async (username) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    setBusyUsername(username);
    try {
      await axios.delete(`${API_BASE}/users/${encodeURIComponent(username)}`);
      setUsers((prev) => prev.filter((u) => u.username !== username));
    } catch (err) {
      alert(err?.response?.data?.detail || "Could not delete user.");
    } finally {
      setBusyUsername(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-bold">User Management</h2>
          <p className="text-gray-400 mt-1">Create accounts and manage roles and access.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl text-base transition w-fit"
        >
          <UserPlus size={16} />
          Add User
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading users...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-400">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-400">Username</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-left">Role</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-left">Created</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.username} className="border-t border-white/5 hover:bg-white/5 transition">
                    <td className="px-6 py-4 flex items-center gap-2">
                      {u.username}
                      {u.username === currentUser?.username && (
                        <span className="text-[11px] bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={u.role}
                        disabled={busyUsername === u.username}
                        onChange={(e) => handleRoleChange(u.username, e.target.value)}
                        className="bg-[#0b1120] border border-white/10 rounded-lg px-2 py-1 text-sm outline-none disabled:opacity-50"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 text-gray-400">{u.created_at || "—"}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setResetTarget(u)}
                          className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1.5 text-sm font-medium"
                        >
                          <KeyRound size={14} />
                          Reset Password
                        </button>
                        <button
                          onClick={() => handleDelete(u.username)}
                          disabled={u.username === currentUser?.username || busyUsername === u.username}
                          className="text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1.5 text-sm font-medium"
                        >
                          {busyUsername === u.username ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
        <ShieldCheck size={14} />
        You cannot delete your own account or demote the last remaining admin.
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(u) => setUsers((prev) => [...prev, u])}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />
      )}
    </div>
  );
}
