import { useEffect, useState } from "react";
import axios from "axios";
import { Trash2, FileDown, Loader2, UploadCloud, Image as ImageIcon, Film, Sheet } from "lucide-react";
import { Link } from "react-router-dom";
import { API_BASE, complianceTone, formatTimestamp, downloadInspectionReport, exportRowsToCsv } from "../../lib/api";

function StatusBadge({ compliance }) {
  const tone = complianceTone(compliance);
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${tone.bg} ${tone.text} ${tone.border}`}>
      {compliance}%
    </span>
  );
}

function SourceBadge({ sourceType }) {
  const isVideo = sourceType === "video";
  const Icon = isVideo ? Film : ImageIcon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium border ${
        isVideo
          ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
          : "bg-blue-500/10 text-blue-400 border-blue-500/30"
      }`}
    >
      <Icon size={13} />
      {isVideo ? "Video" : "Image"}
    </span>
  );
}

export default function AdminDetections() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    setError("");
    axios
      .get(`${API_BASE}/detections`)
      .then((res) => setRows(res.data.detections || []))
      .catch((err) => {
        console.error(err);
        setError("Could not load detections.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!confirm("Delete this inspection record? This cannot be undone.")) return;
    setBusyId(id);
    try {
      await axios.delete(`${API_BASE}/detections/${id}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err);
      alert("Delete failed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (id) => {
    setBusyId(id);
    try {
      await downloadInspectionReport(id);
    } catch (err) {
      console.error(err);
      alert("Download failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-bold">Manage Detections</h2>
          <p className="text-gray-400 mt-1">
            Every PPE inspection record stored in MongoDB.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() =>
              exportRowsToCsv(
                rows,
                [
                  { label: "Date", value: (r) => formatTimestamp(r.timestamp) },
                  { label: "Source", value: (r) => r.source_type || "image" },
                  { label: "Sites", value: (r) => (r.sites || []).join("; ") },
                  { label: "Images", value: (r) => r.summary?.total_images ?? 0 },
                  { label: "Workers", value: (r) => r.summary?.total_workers ?? 0 },
                  { label: "Safe", value: (r) => r.summary?.safe_workers ?? 0 },
                  { label: "Unsafe", value: (r) => r.summary?.unsafe_workers ?? 0 },
                  { label: "Compliance %", value: (r) => r.summary?.compliance ?? 0 },
                ],
                `safesight-detections-${Date.now()}.csv`
              )
            }
            disabled={rows.length === 0}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 px-4 py-2 rounded-xl text-base transition w-fit"
          >
            <Sheet size={16} />
            Export CSV
          </button>
          <Link
            to="/admin/upload"
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl text-base transition w-fit"
          >
            <UploadCloud size={16} />
            Run New Detection
          </Link>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-400">{error}</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No inspections recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-400">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-center">Source</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-center">Images</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-center">Workers</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-center">Safe</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-center">Unsafe</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-center">Compliance</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/5 transition">
                    <td className="px-6 py-4">{formatTimestamp(r.timestamp)}</td>
                    <td className="px-4 py-4 text-center">
                      <SourceBadge sourceType={r.source_type || "image"} />
                    </td>
                    <td className="px-4 py-4 text-center">{r.summary?.total_images ?? 0}</td>
                    <td className="px-4 py-4 text-center">{r.summary?.total_workers ?? 0}</td>
                    <td className="px-4 py-4 text-center text-green-400">{r.summary?.safe_workers ?? 0}</td>
                    <td className="px-4 py-4 text-center text-red-400">{r.summary?.unsafe_workers ?? 0}</td>
                    <td className="px-4 py-4 text-center">
                      <StatusBadge compliance={r.summary?.compliance ?? 0} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleDownload(r.id)}
                          disabled={busyId === r.id}
                          className="text-blue-400 hover:text-blue-300 disabled:opacity-50 inline-flex items-center gap-1.5 text-sm font-medium"
                        >
                          {busyId === r.id ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                          PDF
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={busyId === r.id}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50 inline-flex items-center gap-1.5 text-sm font-medium"
                        >
                          <Trash2 size={14} />
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
    </div>
  );
}
