import axios from "axios";

export const API_BASE = "http://127.0.0.1:8000";

/**
 * Reads the current bearer token out of the same localStorage entry
 * AuthContext writes to. axios gets its Authorization header from an
 * axios-level default set in AuthContext, but the native fetch() API (used
 * for streaming responses, e.g. live video detection) doesn't share that,
 * so callers using fetch need to attach this manually.
 */
export function getAuthToken() {
  try {
    const raw = localStorage.getItem("safesight_auth");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.token || null;
  } catch {
    return null;
  }
}

/**
 * Downloads a PDF inspection report through an authenticated axios request
 * (window.open/direct navigation can't carry the Authorization header, so
 * we fetch as a blob and trigger the save ourselves).
 */
export async function downloadInspectionReport(inspectionId) {
  const res = await axios.get(`${API_BASE}/download-report/${inspectionId}`, {
    responseType: "blob",
  });

  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `Inspection_${inspectionId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function complianceTone(compliance) {
  if (compliance >= 90) return { text: "text-green-400", bg: "bg-green-500/15", border: "border-green-500/30" };
  if (compliance >= 70) return { text: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-yellow-500/30" };
  return { text: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30" };
}

/**
 * Converts an array of flat row objects into a CSV file and triggers a
 * browser download. `columns` maps CSV header labels to either a key on
 * the row object or a function that derives the cell value from the row,
 * so callers can shape exactly what gets exported without pre-transforming
 * their data.
 */
export function exportRowsToCsv(rows, columns, filename = "export.csv") {
  if (!rows || rows.length === 0) {
    alert("Nothing to export.");
    return;
  }

  const escapeCell = (value) => {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => escapeCell(typeof c.value === "function" ? c.value(row) : row[c.value]))
      .join(",")
  );

  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function formatTimestamp(ts) {
  if (!ts) return "—";
  const d = new Date(ts.replace(" ", "T"));
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
