import { useEffect, useState } from "react";
import axios from "axios";
import { MapPin, Plus, Trash2, Loader2 } from "lucide-react";
import { API_BASE } from "../../lib/api";

export default function AdminSites() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    setError("");
    axios
      .get(`${API_BASE}/sites`)
      .then((res) => setSites(res.data.sites || []))
      .catch((err) => {
        console.error(err);
        setError("Could not load sites.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    setCreateError("");
    try {
      const res = await axios.post(`${API_BASE}/sites`, { name });
      setSites((prev) => [...prev, res.data.site].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
    } catch (err) {
      setCreateError(err?.response?.data?.detail || "Could not create site.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete site "${name}"? Past inspection records will keep this site name, but it will no longer appear as an option for new uploads.`)) return;
    setBusyId(id);
    try {
      await axios.delete(`${API_BASE}/sites/${id}`);
      setSites((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(err?.response?.data?.detail || "Could not delete site.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="text-4xl font-bold">Site Management</h2>
        <p className="text-gray-400 mt-1">
          Construction sites available when running a PPE detection from the Upload Center.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex gap-3 mb-6">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New site name, e.g. Construction Site B"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-base outline-none focus:border-red-400"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 px-4 py-2.5 rounded-xl text-base font-medium transition shrink-0"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Add Site
        </button>
      </form>
      {createError && <p className="text-red-400 text-sm -mt-4 mb-6">{createError}</p>}

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading sites...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-400">{error}</div>
        ) : sites.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No sites yet. Add one above.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {sites.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="bg-red-500/15 text-red-400 rounded-lg p-2">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <div className="text-base font-medium">{s.name}</div>
                    {s.created_at && (
                      <div className="text-xs text-gray-500">Added {s.created_at}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(s.id, s.name)}
                  disabled={busyId === s.id}
                  className="text-red-400 hover:text-red-300 disabled:opacity-50 inline-flex items-center gap-1.5 text-sm font-medium"
                >
                  {busyId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
