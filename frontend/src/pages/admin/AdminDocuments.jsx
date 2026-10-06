import { useEffect, useState } from "react";
import axios from "axios";
import { FileText, Trash2, RefreshCcw, UploadCloud, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../lib/api";

export default function AdminDocuments() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = () => {
    setLoading(true);
    setError("");
    axios
      .get(`${API_BASE}/documents`)
      .then((res) => setDocs(res.data.documents || []))
      .catch((err) => {
        console.error(err);
        setError("Could not load documents.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (filename) => {
    if (!confirm(`Delete "${filename}"? This removes it from the knowledge base too.`)) return;

    setDeletingId(filename);
    try {
      await axios.delete(`${API_BASE}/documents/${encodeURIComponent(filename)}`);
      setDocs((prev) => prev.filter((d) => d.filename !== filename));
      setNotice({ ok: true, text: `"${filename}" deleted and knowledge base rebuilt.` });
    } catch (err) {
      console.error(err);
      setNotice({ ok: false, text: err?.response?.data?.detail || "Delete failed." });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    setNotice(null);
    try {
      await axios.post(`${API_BASE}/rebuild-knowledge-base`);
      setNotice({ ok: true, text: "Knowledge base rebuilt successfully." });
    } catch (err) {
      console.error(err);
      setNotice({ ok: false, text: "Rebuild failed." });
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-4xl font-bold">Manage Documents</h2>
          <p className="text-gray-400 mt-1">
            RAG knowledge-base manuals and inspection documents.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-base transition disabled:opacity-50"
          >
            {rebuilding ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            Rebuild Index
          </button>
          <Link
            to="/admin/upload"
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl text-base transition"
          >
            <UploadCloud size={16} />
            Upload
          </Link>
        </div>
      </div>

      {notice && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-base ${
            notice.ok
              ? "bg-green-500/10 border-green-500/30 text-green-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading documents...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-400">{error}</div>
        ) : docs.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            No documents uploaded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-400">Filename</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-left">Type</th>
                  <th className="px-4 py-3 font-medium text-gray-400 text-left">Uploaded</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.filename} className="border-t border-white/5 hover:bg-white/5 transition">
                    <td className="px-6 py-4 flex items-center gap-2">
                      <FileText size={16} className="text-blue-400 shrink-0" />
                      {d.filename}
                    </td>
                    <td className="px-4 py-4 text-gray-400">{d.document_type}</td>
                    <td className="px-4 py-4 text-gray-400">{d.uploaded_at}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(d.filename)}
                        disabled={deletingId === d.filename}
                        className="text-red-400 hover:text-red-300 disabled:opacity-50 inline-flex items-center gap-1.5 text-sm font-medium"
                      >
                        {deletingId === d.filename ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        Delete
                      </button>
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
