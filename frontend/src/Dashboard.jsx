import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  Activity,
  Search,
  X,
  FileDown,
  RefreshCcw,
  Image as ImageIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Inbox,
  ChevronLeft,
  ChevronRight,
  Radio,
  Film,
  Sheet,
} from "lucide-react";
import { API_BASE, complianceTone, formatTimestamp, downloadInspectionReport, exportRowsToCsv } from "./lib/api";
import ComplianceTrendChart, { TREND_METRICS } from "./components/charts/ComplianceTrendChart";
import ViolationBarChart from "./components/charts/ViolationBarChart";
import SiteComplianceChart from "./components/charts/SiteComplianceChart";
import WorkerSplitDonut from "./components/charts/WorkerSplitDonut";
import WorkerComplianceTable from "./components/WorkerComplianceTable";

const VIOLATION_CATEGORIES = [
  { key: "helmet", label: "Helmet" },
  { key: "vest", label: "Vest" },
  { key: "gloves", label: "Gloves" },
  { key: "boots", label: "Boots" },
  { key: "goggles", label: "Goggles" },
];

const DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All time" },
];

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function formatAgo(seconds) {
  if (seconds == null) return "";
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

/** Eases a numeric value from its previous value to a new one on change. */
function useAnimatedNumber(value, duration = 600) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;

    if (typeof to !== "number" || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    let raf;
    const start = performance.now();
    const isDecimal = !Number.isInteger(to) || !Number.isInteger(from);

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setDisplay(isDecimal ? Math.round(current * 10) / 10 : Math.round(current));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

function SummaryCard({ label, value, icon: Icon, tone, trend, animate = false, suffix = "", onClick, active, badge }) {
  const animated = useAnimatedNumber(animate ? value : null);
  const displayValue = animate ? `${animated}${suffix}` : value;
  const clickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-white/5 border p-6 transition ${
        clickable ? "cursor-pointer hover:bg-white/[0.07] hover:border-white/20" : ""
      } ${active ? "border-red-500/40 ring-1 ring-inset ring-red-500/20" : "border-white/10"}`}
    >
      <div className="flex justify-between items-center">
        <div>
          <p className="text-gray-400 text-base flex items-center gap-2">
            {label}
            {badge && (
              <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </p>
          <h2 className="text-4xl font-bold mt-2">{displayValue}</h2>
          {trend && (
            <div
              className={`flex items-center gap-1 text-sm mt-2 ${
                trend.direction === "up"
                  ? "text-green-400"
                  : trend.direction === "down"
                  ? "text-red-400"
                  : "text-gray-500"
              }`}
            >
              {trend.direction === "up" ? (
                <TrendingUp size={13} />
              ) : trend.direction === "down" ? (
                <TrendingDown size={13} />
              ) : (
                <Minus size={13} />
              )}
              {trend.label}
            </div>
          )}
        </div>
        <Icon className={tone} size={32} />
      </div>
    </div>
  );
}

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

function SortHeader({ label, field, sort, onSort, align = "left" }) {
  const active = sort.field === field;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <th
      onClick={() => onSort(field)}
      className={`px-4 py-3 font-medium text-gray-400 cursor-pointer select-none hover:text-white transition ${
        align === "center" ? "text-center" : "text-left"
      }`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "center" ? "justify-center" : ""}`}>
        {label}
        <Icon size={13} className={active ? "text-red-400" : "text-gray-600"} />
      </span>
    </th>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-white/5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <div className="h-4 bg-white/10 rounded w-32" />
          <div className="h-4 bg-white/10 rounded w-16" />
          <div className="h-4 bg-white/10 rounded w-16" />
          <div className="h-4 bg-white/10 rounded w-16" />
          <div className="h-6 bg-white/10 rounded-full w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-6 animate-pulse">
      <div className="h-3 bg-white/10 rounded w-20 mb-4" />
      <div className="h-8 bg-white/10 rounded w-14" />
    </div>
  );
}

function DetailDrawer({ id, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .get(`${API_BASE}/detections/${id}`)
      .then((res) => {
        if (!cancelled) {
          setDetail(res.data.detection);
          setActiveImage(0);
        }
      })
      .catch((err) => console.error("Failed to load detection detail:", err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const image = detail?.images?.[activeImage];
  const isVideo = detail?.source_type === "video";
  const cumulativeWorkers = detail?.workers_cumulative || [];

  const handleDownload = async () => {
    try {
      setDownloading(true);
      await downloadInspectionReport(id);
    } catch (err) {
      console.error(err);
      alert("Could not download report.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:w-[640px] h-full bg-[#0b1120] border-l border-gray-800 overflow-y-auto">
        <div className="sticky top-0 bg-[#0b1120] border-b border-gray-800 px-6 py-4 flex justify-between items-center z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-semibold">Inspection Detail</h2>
              {detail?.source_type && <SourceBadge sourceType={detail.source_type} />}
            </div>
            <p className="text-sm text-gray-500">{formatTimestamp(detail?.timestamp)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-gray-400">Loading...</div>
        ) : !detail ? (
          <div className="p-8 text-gray-400">Could not load this inspection.</div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{detail.summary.total_images}</div>
                <div className="text-xs text-gray-500">{isVideo ? "Frames" : "Images"}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{detail.summary.total_workers}</div>
                <div className="text-xs text-gray-500">Workers</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-green-400">{detail.summary.safe_workers}</div>
                <div className="text-xs text-gray-500">Safe</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{detail.summary.unsafe_workers}</div>
                <div className="text-xs text-gray-500">Unsafe</div>
              </div>
            </div>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 rounded-xl py-3 font-medium transition"
            >
              <FileDown size={16} />
              {downloading ? "Preparing PDF..." : "Download PDF Report"}
            </button>

            {/* Whole-video checklist. The cards above count these rows, so
                showing them here is what makes "1 Safe / 0 Unsafe" legible
                next to a frame that reads Unsafe on its own. */}
            {isVideo && cumulativeWorkers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-2">
                  Whole video
                  <span className="text-gray-600 font-normal ml-2">
                    per tracked worker — what the counts above are based on
                  </span>
                </h3>
                <WorkerComplianceTable workers={cumulativeWorkers} cumulative />
              </div>
            )}

            {detail.images?.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-gray-300 -mb-2">
                  {isVideo ? "Individual frames" : "Images"}
                  <span className="text-gray-600 font-normal ml-2">
                    {isVideo
                      ? "what was visible at that moment — may differ from the whole-video row above"
                      : "per image"}
                  </span>
                </h3>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {detail.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                        i === activeImage
                          ? "bg-red-500/15 text-red-400 border-red-500/30"
                          : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      {/* Frame files are named after the source video, so the
                          raw filename is both enormous and identical across
                          every chip — the timestamp is the useful part. */}
                      {img.timestamp_sec != null ? `${img.timestamp_sec}s` : img.name}
                    </button>
                  ))}
                </div>

                {image && (
                  <div className="space-y-4">
                    <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
                      <img
                        src={image.annotated}
                        alt={image.name}
                        className="w-full max-h-80 object-contain"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          image.status === "Safe"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {image.status}
                        <span className="font-normal opacity-70 ml-1.5">
                          {isVideo ? "in this frame" : "in this image"}
                        </span>
                      </span>
                      <StatusBadge compliance={image.compliance_rate} />
                    </div>

                    <WorkerComplianceTable workers={image.workers} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const hasLoadedRef = useRef(false);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [onlyViolations, setOnlyViolations] = useState(false);
  const [violationCategory, setViolationCategory] = useState(null);
  const [sort, setSort] = useState({ field: "date", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState(null);
  const [trendMetric, setTrendMetric] = useState(TREND_METRICS[0]);

  // Toasts for inspections that appeared since the last poll. seenIdsRef is
  // seeded on the first load so an initial page view doesn't announce the
  // entire history as "new".
  const [toasts, setToasts] = useState([]);
  const seenIdsRef = useRef(null);

  const dismissToast = (key) => setToasts((list) => list.filter((t) => t.key !== key));

  // Ticks once a second purely so the "Updated Xs ago" label stays live.
  const [, setClock] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClock((c) => c + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const load = () => {
    if (!hasLoadedRef.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError("");
    axios
      .get(`${API_BASE}/detections`)
      .then((res) => {
        const rows = res.data.detections || [];

        if (seenIdsRef.current === null) {
          seenIdsRef.current = new Set(rows.map((r) => r.id));
        } else {
          const fresh = rows.filter((r) => !seenIdsRef.current.has(r.id));
          fresh.forEach((r) => seenIdsRef.current.add(r.id));
          if (fresh.length > 0) {
            const added = fresh.slice(0, 3).map((r) => ({
              key: `${r.id}-${Date.now()}`,
              id: r.id,
              timestamp: r.timestamp,
              unsafe: r.summary?.unsafe_workers || 0,
              compliance: r.summary?.compliance ?? 0,
              sourceType: r.source_type || "image",
            }));
            setToasts((list) => [...list, ...added].slice(-4));
          }
        }

        setDetections(rows);
        setLastUpdated(new Date());
        setRefreshTick((t) => t + 1);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load inspection history.");
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
        hasLoadedRef.current = true;
      });
  };

  useEffect(load, []);

  // Toasts clear themselves; the timers reset whenever the list changes,
  // which is fine — a burst of arrivals stays on screen a moment longer.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => dismissToast(t.key), 8000));
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  // Background polling for fresh data — doesn't disturb the current view.
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  // Reset to page 1 whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [search, dateFrom, dateTo, statusFilter, siteFilter, sourceFilter, onlyViolations, violationCategory, sort]);

  const sites = useMemo(() => {
    const set = new Set();
    detections.forEach((d) => (d.sites || []).forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [detections]);

  const handleSort = (field) => {
    setSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" }
    );
  };

  const applyDatePreset = (id) => {
    if (id === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }
    const today = new Date();
    const todayStr = toDateStr(today);
    if (id === "today") {
      setDateFrom(todayStr);
      setDateTo(todayStr);
      return;
    }
    const days = id === "7d" ? 6 : 29;
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    setDateFrom(toDateStr(start));
    setDateTo(todayStr);
  };

  const filtered = useMemo(() => {
    let rows = detections.filter((d) => {
      const matchesSearch =
        !search || formatTimestamp(d.timestamp).toLowerCase().includes(search.toLowerCase());

      const dayStr = (d.timestamp || "").slice(0, 10);
      const matchesFrom = !dateFrom || dayStr >= dateFrom;
      const matchesTo = !dateTo || dayStr <= dateTo;

      const compliance = d.summary?.compliance ?? 0;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "high" && compliance >= 90) ||
        (statusFilter === "medium" && compliance >= 70 && compliance < 90) ||
        (statusFilter === "low" && compliance < 70);

      const matchesSite = siteFilter === "all" || (d.sites || []).includes(siteFilter);

      const matchesSource = sourceFilter === "all" || (d.source_type || "image") === sourceFilter;

      const matchesOnlyViolations = !onlyViolations || (d.summary?.unsafe_workers || 0) > 0;
      const matchesViolationCategory =
        !violationCategory || (d.summary?.[violationCategory] || 0) > 0;

      return (
        matchesSearch &&
        matchesFrom &&
        matchesTo &&
        matchesStatus &&
        matchesSite &&
        matchesSource &&
        matchesOnlyViolations &&
        matchesViolationCategory
      );
    });

    const dir = sort.dir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      switch (sort.field) {
        case "date":
          return dir * (a.timestamp || "").localeCompare(b.timestamp || "");
        case "workers":
          return dir * ((a.summary?.total_workers || 0) - (b.summary?.total_workers || 0));
        case "safe":
          return dir * ((a.summary?.safe_workers || 0) - (b.summary?.safe_workers || 0));
        case "unsafe":
          return dir * ((a.summary?.unsafe_workers || 0) - (b.summary?.unsafe_workers || 0));
        case "compliance":
          return dir * ((a.summary?.compliance || 0) - (b.summary?.compliance || 0));
        default:
          return 0;
      }
    });

    return rows;
  }, [detections, search, dateFrom, dateTo, statusFilter, siteFilter, sourceFilter, onlyViolations, violationCategory, sort]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, d) => {
        acc.inspections += 1;
        acc.workers += d.summary?.total_workers || 0;
        acc.safe += d.summary?.safe_workers || 0;
        acc.unsafe += d.summary?.unsafe_workers || 0;
        acc.complianceSum += d.summary?.compliance || 0;
        VIOLATION_CATEGORIES.forEach((c) => {
          acc.violations[c.key] = (acc.violations[c.key] || 0) + (d.summary?.[c.key] || 0);
        });
        return acc;
      },
      { inspections: 0, workers: 0, safe: 0, unsafe: 0, complianceSum: 0, violations: {} }
    );
  }, [filtered]);

  const avgCompliance = totals.inspections
    ? Math.round((totals.complianceSum / totals.inspections) * 10) / 10
    : 0;

  const topViolation = useMemo(() => {
    const entries = VIOLATION_CATEGORIES.map((c) => ({ ...c, count: totals.violations[c.key] || 0 }));
    entries.sort((a, b) => b.count - a.count);
    return entries[0]?.count > 0 ? entries[0] : null;
  }, [totals]);

  const complianceTrendInfo = useMemo(() => {
    // Compare average compliance of the newer half vs the older half of the
    // filtered (chronologically sorted) set.
    const chrono = [...filtered].sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
    if (chrono.length < 2) return null;

    const mid = Math.floor(chrono.length / 2);
    const older = chrono.slice(0, mid);
    const newer = chrono.slice(mid);

    const avg = (rows) =>
      rows.reduce((sum, d) => sum + (d.summary?.compliance || 0), 0) / (rows.length || 1);

    const delta = Math.round((avg(newer) - avg(older)) * 10) / 10;
    if (Math.abs(delta) < 0.5) return { direction: "flat", label: "Stable" };
    return {
      direction: delta > 0 ? "up" : "down",
      label: `${delta > 0 ? "+" : ""}${delta} pts`,
    };
  }, [filtered]);

  // Per-day series for the trend chart. Compliance is averaged across that
  // day's inspections; workers and violations are summed, since those are
  // counts of distinct things rather than rates.
  const trendChartData = useMemo(() => {
    const byDay = {};
    filtered.forEach((d) => {
      const day = (d.timestamp || "").slice(0, 10) || "unknown";
      const bucket = byDay[day] || { date: day, sum: 0, count: 0, violations: 0, workers: 0 };
      bucket.sum += d.summary?.compliance || 0;
      bucket.count += 1;
      bucket.violations += d.summary?.unsafe_workers || 0;
      bucket.workers += d.summary?.total_workers || 0;
      byDay[day] = bucket;
    });
    return Object.values(byDay)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((b) => ({
        date: b.date,
        compliance: Math.round((b.sum / b.count) * 10) / 10,
        violations: b.violations,
        workers: b.workers,
        inspections: b.count,
      }));
  }, [filtered]);

  // Per-site rollup, worst compliance first. An inspection can cover more
  // than one site, so it contributes to each of them.
  const siteStats = useMemo(() => {
    const bySite = {};
    filtered.forEach((d) => {
      (d.sites || []).forEach((name) => {
        const bucket = bySite[name] || { name, sum: 0, inspections: 0, unsafe: 0 };
        bucket.sum += d.summary?.compliance || 0;
        bucket.inspections += 1;
        bucket.unsafe += d.summary?.unsafe_workers || 0;
        bySite[name] = bucket;
      });
    });
    return Object.values(bySite)
      .map((b) => ({
        name: b.name,
        compliance: Math.round((b.sum / b.inspections) * 10) / 10,
        inspections: b.inspections,
        unsafe: b.unsafe,
      }))
      .sort((a, b) => a.compliance - b.compliance);
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("all");
    setSiteFilter("all");
    setSourceFilter("all");
    setOnlyViolations(false);
    setViolationCategory(null);
  };

  const hasActiveFilters =
    search ||
    dateFrom ||
    dateTo ||
    statusFilter !== "all" ||
    siteFilter !== "all" ||
    sourceFilter !== "all" ||
    onlyViolations ||
    violationCategory;

  const secondsAgo = lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000) : null;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-4xl font-bold">Interactive Dashboard</h2>
          <p className="text-gray-400 mt-1">
            Browse PPE compliance inspections and drill into any report.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            title={autoRefresh ? "Auto-refresh is on — click to pause" : "Auto-refresh is off — click to resume"}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition ${
              autoRefresh
                ? "bg-green-500/10 border-green-500/30 text-green-400"
                : "bg-white/5 border-white/10 text-gray-400"
            }`}
          >
            <Radio size={13} className={autoRefresh ? "animate-pulse-dot" : ""} />
            {autoRefresh ? "Live" : "Paused"}
          </button>

          {lastUpdated && (
            <span className="text-sm text-gray-500 hidden sm:inline">Updated {formatAgo(secondsAgo)}</span>
          )}

          <button
            onClick={load}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-base transition"
          >
            <RefreshCcw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={() =>
              exportRowsToCsv(
                filtered,
                [
                  { label: "Date", value: (r) => formatTimestamp(r.timestamp) },
                  { label: "Source", value: (r) => r.source_type || "image" },
                  { label: "Sites", value: (r) => (r.sites || []).join("; ") },
                  { label: "Workers", value: (r) => r.summary?.total_workers ?? 0 },
                  { label: "Safe", value: (r) => r.summary?.safe_workers ?? 0 },
                  { label: "Unsafe", value: (r) => r.summary?.unsafe_workers ?? 0 },
                  { label: "Compliance %", value: (r) => r.summary?.compliance ?? 0 },
                ],
                `safesight-dashboard-${Date.now()}.csv`
              )
            }
            disabled={filtered.length === 0}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 px-4 py-2 rounded-xl text-base transition"
          >
            <Sheet size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="grid lg:grid-cols-5 md:grid-cols-2 gap-6 mb-8">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 md:grid-cols-2 gap-6 mb-8">
          <SummaryCard
            label="Inspections"
            value={totals.inspections}
            icon={ImageIcon}
            tone="text-blue-400"
            animate
            onClick={hasActiveFilters ? clearFilters : undefined}
            badge={hasActiveFilters ? "Clear" : null}
          />
          <SummaryCard label="Workers Assessed" value={totals.workers} icon={Users} tone="text-green-400" animate />
          <SummaryCard
            label="Violations"
            value={totals.unsafe}
            icon={AlertTriangle}
            tone="text-red-400"
            animate
            onClick={() => setOnlyViolations((v) => !v)}
            active={onlyViolations}
            badge={onlyViolations ? "Filtering" : null}
          />
          <SummaryCard
            label="Avg. Compliance"
            value={avgCompliance}
            suffix="%"
            icon={ShieldCheck}
            tone="text-emerald-400"
            trend={complianceTrendInfo}
            animate
            onClick={() => setSort({ field: "compliance", dir: "asc" })}
            active={sort.field === "compliance" && sort.dir === "asc"}
          />
          <SummaryCard
            label="Top Violation"
            value={topViolation ? topViolation.label : "None"}
            icon={AlertTriangle}
            tone="text-orange-400"
            trend={topViolation ? { direction: "flat", label: `${topViolation.count} occurrences` } : null}
            onClick={topViolation ? () => setViolationCategory((k) => (k === topViolation.key ? null : topViolation.key)) : undefined}
            active={!!topViolation && violationCategory === topViolation.key}
            badge={topViolation && violationCategory === topViolation.key ? "Filtering" : null}
          />
        </div>
      )}

      {/* Charts */}
      {!loading && filtered.length > 0 && (
        <>
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-base font-semibold text-gray-300">
                  {trendMetric.label} Trend
                  <span className="text-gray-600 font-normal ml-2 text-sm">
                    click a point, or drag across to select a range
                  </span>
                </h3>

                <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                  {TREND_METRICS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setTrendMetric(m)}
                      className={`px-2.5 py-1 rounded-lg text-sm transition ${
                        trendMetric.key === m.key ? "text-white" : "text-gray-500 hover:text-gray-300"
                      }`}
                      style={trendMetric.key === m.key ? { background: `${m.color}26`, color: m.color } : undefined}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <ComplianceTrendChart
                trend={trendChartData}
                metric={trendMetric}
                gradientId={`trendGradient-${trendMetric.key}`}
                onPointClick={(date) => {
                  setDateFrom(date);
                  setDateTo(date);
                }}
                onRangeSelect={(from, to) => {
                  setDateFrom(from);
                  setDateTo(to);
                }}
              />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-base font-semibold mb-4 text-gray-300">
                Violation Breakdown
                <span className="text-gray-600 font-normal ml-2 text-sm">click to filter</span>
              </h3>
              <ViolationBarChart
                breakdown={totals.violations}
                onCategoryClick={setViolationCategory}
                activeCategory={violationCategory}
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-base font-semibold mb-4 text-gray-300">
                Worker Split
                <span className="text-gray-600 font-normal ml-2 text-sm">click a segment</span>
              </h3>
              <WorkerSplitDonut
                safe={totals.safe}
                unsafe={totals.unsafe}
                activeSegment={onlyViolations ? "unsafe" : null}
                onSegmentClick={(key) => {
                  if (key === "unsafe") setOnlyViolations((v) => !v);
                  else setOnlyViolations(false);
                }}
              />
            </div>

            <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-base font-semibold mb-4 text-gray-300">
                Compliance by Site
                <span className="text-gray-600 font-normal ml-2 text-sm">worst first · click to filter</span>
              </h3>
              <SiteComplianceChart
                sites={siteStats}
                activeSite={siteFilter}
                onSiteClick={setSiteFilter}
              />
            </div>
          </div>
        </>
      )}

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500 mr-1">Quick range:</span>
          {DATE_PRESETS.map((p) => {
            const isActive =
              (p.id === "today" && dateFrom === toDateStr(new Date()) && dateTo === toDateStr(new Date())) ||
              (p.id === "all" && !dateFrom && !dateTo);
            return (
              <button
                key={p.id}
                onClick={() => applyDatePreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                  isActive
                    ? "bg-red-500/15 text-red-400 border-red-500/30"
                    : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[180px] flex items-center gap-2 bg-[#0b1120] border border-white/10 rounded-xl px-3 py-2">
            <Search size={16} className="text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by date..."
              className="bg-transparent outline-none text-base flex-1"
            />
          </div>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-[#0b1120] border border-white/10 rounded-xl px-3 py-2 text-base outline-none text-gray-300"
          />
          <span className="text-gray-600 text-base">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-[#0b1120] border border-white/10 rounded-xl px-3 py-2 text-base outline-none text-gray-300"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0b1120] border border-white/10 rounded-xl px-3 py-2 text-base outline-none"
          >
            <option value="all">All compliance levels</option>
            <option value="high">High (&ge;90%)</option>
            <option value="medium">Medium (70–89%)</option>
            <option value="low">Low (&lt;70%)</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-[#0b1120] border border-white/10 rounded-xl px-3 py-2 text-base outline-none"
          >
            <option value="all">Image &amp; Video</option>
            <option value="image">Images only</option>
            <option value="video">Videos only</option>
          </select>

          {sites.length > 1 && (
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="bg-[#0b1120] border border-white/10 rounded-xl px-3 py-2 text-base outline-none"
            >
              <option value="all">All sites</option>
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white px-2"
            >
              <X size={14} />
              Clear filters
            </button>
          )}
        </div>

        {(onlyViolations || violationCategory) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {onlyViolations && (
              <button
                onClick={() => setOnlyViolations(false)}
                className="flex items-center gap-1.5 text-sm bg-red-500/10 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full"
              >
                Only violations
                <X size={12} />
              </button>
            )}
            {violationCategory && (
              <button
                onClick={() => setViolationCategory(null)}
                className="flex items-center gap-1.5 text-sm bg-red-500/10 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full"
              >
                {VIOLATION_CATEGORIES.find((c) => c.key === violationCategory)?.label || violationCategory} violations
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="p-10 text-center text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 flex flex-col items-center text-center text-gray-500">
            <Inbox size={36} className="mb-3 text-gray-600" />
            <p className="font-medium text-gray-400">No inspections match your filters</p>
            <p className="text-base mt-1">Try widening the date range or clearing filters.</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 text-base bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl transition"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead className="bg-white/5">
                  <tr>
                    <SortHeader label="Date" field="date" sort={sort} onSort={handleSort} />
                    <th className="px-4 py-3 font-medium text-gray-400 text-center">Source</th>
                    <th className="px-4 py-3 font-medium text-gray-400 text-center">Images</th>
                    <SortHeader label="Workers" field="workers" sort={sort} onSort={handleSort} align="center" />
                    <SortHeader label="Safe" field="safe" sort={sort} onSort={handleSort} align="center" />
                    <SortHeader label="Unsafe" field="unsafe" sort={sort} onSort={handleSort} align="center" />
                    <SortHeader label="Compliance" field="compliance" sort={sort} onSort={handleSort} align="center" />
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody key={refreshTick} className="animate-fadeIn">
                  {paged.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => setSelectedId(d.id)}
                      className="border-t border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">{formatTimestamp(d.timestamp)}</td>
                      <td className="px-4 py-4 text-center">
                        <SourceBadge sourceType={d.source_type || "image"} />
                      </td>
                      <td className="px-4 py-4 text-center">{d.summary?.total_images ?? 0}</td>
                      <td className="px-4 py-4 text-center">{d.summary?.total_workers ?? 0}</td>
                      <td className="px-4 py-4 text-center text-green-400">{d.summary?.safe_workers ?? 0}</td>
                      <td className="px-4 py-4 text-center text-red-400">{d.summary?.unsafe_workers ?? 0}</td>
                      <td className="px-4 py-4 text-center">
                        <StatusBadge compliance={d.summary?.compliance ?? 0} />
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500">View &rarr;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/5">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of{" "}
                {filtered.length}
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="ml-2 bg-[#0b1120] border border-white/10 rounded-lg px-2 py-1 text-sm outline-none"
                >
                  {[10, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-sm text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
        <Activity size={14} />
        Read-only view. Ask an administrator to run new PPE detections from the Upload Center.
      </div>

      {selectedId && <DetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />}

      {/* Live arrivals. Rendered outside the table because a new inspection
          may not match the current filters — the toast is the only place it
          would otherwise be visible, and its "View report" opens the drawer
          directly regardless of what's filtered. */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 w-80">
          {toasts.map((t) => (
            <div
              key={t.key}
              className={`rounded-xl border p-4 shadow-2xl backdrop-blur animate-slide-up ${
                t.unsafe > 0
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-[#111827]/95 border-white/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {t.sourceType === "video" ? (
                    <Film size={14} className="text-purple-400" />
                  ) : (
                    <ImageIcon size={14} className="text-blue-400" />
                  )}
                  New inspection
                </div>
                <button
                  onClick={() => dismissToast(t.key)}
                  className="text-gray-500 hover:text-white transition"
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="text-xs text-gray-400 mt-1">{formatTimestamp(t.timestamp)}</div>

              <div className="flex items-center gap-3 mt-2 text-sm">
                <span className={complianceTone(t.compliance).text}>{t.compliance}% compliance</span>
                {t.unsafe > 0 && (
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertTriangle size={12} /> {t.unsafe} violation{t.unsafe === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  setSelectedId(t.id);
                  dismissToast(t.key);
                }}
                className="mt-3 w-full text-sm bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg py-1.5 transition"
              >
                View report
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
