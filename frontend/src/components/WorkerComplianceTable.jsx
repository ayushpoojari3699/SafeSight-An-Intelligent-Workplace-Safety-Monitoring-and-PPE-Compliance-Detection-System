const PPE_COLUMNS = [
  { key: "helmet", label: "Helmet" },
  { key: "vest", label: "Vest" },
  { key: "gloves", label: "Gloves" },
  { key: "boots", label: "Boots" },
  { key: "goggles", label: "Goggles" },
];

/**
 * Per-worker PPE checklist, used by both the upload screen and the
 * inspection detail drawer so the two can't drift apart.
 *
 * Two modes, and which one is on screen matters:
 *
 *  - cumulative (video): the backend's `workers_cumulative` rows — one row
 *    per tracked person for the WHOLE video, where an item stays ticked once
 *    it has been detected in enough frames. A worker who pulls on a vest at
 *    0.7s and a helmet at 3s ends up with both ticked. This is what the
 *    summary cards count.
 *  - per-frame: exactly what was on that person's body in the frame being
 *    shown. Useful as evidence, but it will legitimately disagree with the
 *    cumulative row — which is why callers must label which one they're
 *    showing rather than leaving the reader to guess.
 */
export default function WorkerComplianceTable({ workers, cumulative = false }) {
  if (!workers || workers.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 px-4 py-6 text-center text-gray-500 text-base">
        No workers detected yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-base">
        <thead className="bg-white/5">
          <tr>
            <th className="text-left px-4 py-2 text-gray-400">Worker</th>
            {PPE_COLUMNS.map((c) => (
              <th key={c.key} className="px-2 py-2 text-gray-400">{c.label}</th>
            ))}
            <th className="px-2 py-2 text-gray-400">Status</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((w) => (
            <tr key={w.track_id ?? w.worker_id} className="border-t border-white/5">
              <td className="px-4 py-2">
                Worker {w.track_id ?? w.worker_id}
                {w.track_id != null && (
                  <span className="text-gray-500 text-xs ml-1.5">
                    {cumulative && w.frames_seen ? `(${w.frames_seen} frames)` : "(tracked)"}
                  </span>
                )}
              </td>
              {PPE_COLUMNS.map((c) => (
                <td
                  key={c.key}
                  className="text-center"
                  title={
                    cumulative && w[c.key]
                      ? [
                          w.first_seen?.[c.key] != null ? `Confirmed at ${w.first_seen[c.key]}s` : null,
                          w.detection_counts?.[c.key] != null
                            ? `detected in ${w.detection_counts[c.key]} of ${w.frames_seen} frames`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || undefined
                      : undefined
                  }
                >
                  {w[c.key] ? "✅" : "❌"}
                </td>
              ))}
              <td className="text-center">
                <span className={w.status === "Safe" ? "text-green-400" : "text-red-400"}>
                  {w.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
