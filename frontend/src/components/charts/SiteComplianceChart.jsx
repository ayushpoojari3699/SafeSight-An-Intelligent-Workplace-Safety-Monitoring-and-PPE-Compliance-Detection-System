/**
 * Average compliance per site, worst first — the ordering is the point:
 * the site that needs attention should be the first thing read, not
 * whichever one happens to be alphabetically first.
 *
 * Expects sites = [{ name, compliance, inspections, unsafe }, ...].
 * Clicking a row filters the dashboard to that site; clicking the active
 * one clears the filter.
 */
export default function SiteComplianceChart({ sites, activeSite, onSiteClick }) {
  if (!sites || sites.length === 0) {
    return <div className="text-gray-500 text-base py-10 text-center">No site data yet.</div>;
  }

  const toneFor = (compliance) => {
    if (compliance >= 90) return { bar: "bg-emerald-500", text: "text-emerald-400" };
    if (compliance >= 70) return { bar: "bg-yellow-500", text: "text-yellow-400" };
    return { bar: "bg-red-500", text: "text-red-400" };
  };

  return (
    <div className="space-y-3">
      {sites.map((site) => {
        const tone = toneFor(site.compliance);
        const isActive = activeSite === site.name;
        return (
          <button
            key={site.name}
            onClick={() => onSiteClick?.(isActive ? "all" : site.name)}
            className={`w-full text-left group rounded-xl px-3 py-2 border transition ${
              isActive
                ? "bg-white/10 border-white/20"
                : "bg-transparent border-transparent hover:bg-white/5"
            }`}
            title={`${site.inspections} inspection${site.inspections === 1 ? "" : "s"} · ${site.unsafe} violation${
              site.unsafe === 1 ? "" : "s"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5 text-sm">
              <span className="truncate text-gray-300 group-hover:text-white transition">{site.name}</span>
              <span className={`font-semibold shrink-0 ml-3 ${tone.text}`}>{site.compliance}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full ${tone.bar} transition-all duration-500`}
                style={{ width: `${Math.min(100, Math.max(0, site.compliance))}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-gray-600">
              <span>
                {site.inspections} inspection{site.inspections === 1 ? "" : "s"}
              </span>
              <span className={site.unsafe > 0 ? "text-red-400/70" : ""}>
                {site.unsafe} violation{site.unsafe === 1 ? "" : "s"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
