import { useRef, useState } from "react";

/**
 * Dependency-free line/area chart over the filtered inspection history.
 *
 * Expects trend = [{ date: "YYYY-MM-DD", compliance, violations, workers }, ...]
 * and a `metric` describing which of those numbers to plot.
 *
 * Three interactions:
 *   - hover a point for exact values (all metrics, not just the plotted one)
 *   - click a point to jump the dashboard to that single day
 *   - drag across the plot to select a date range (released = range applied)
 *
 * The drag is the reason this chart tracks pixel geometry itself: the SVG is
 * scaled to its container, so client coordinates are converted back into
 * viewBox units before being mapped to a date index.
 */

export const TREND_METRICS = [
  { key: "compliance", label: "Compliance", color: "#ef4444", suffix: "%", max: 100 },
  { key: "violations", label: "Violations", color: "#f97316", suffix: "", max: null },
  { key: "workers", label: "Workers", color: "#22c55e", suffix: "", max: null },
];

export default function ComplianceTrendChart({
  trend,
  metric = TREND_METRICS[0],
  gradientId = "complianceGradient",
  onPointClick,
  onRangeSelect,
}) {
  const width = 900;
  const height = 260;
  const padding = { top: 20, right: 20, bottom: 36, left: 44 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const svgRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [drag, setDrag] = useState(null); // { from: x, to: x } in viewBox units

  if (!trend || trend.length === 0) {
    return <div className="text-gray-500 text-base py-16 text-center">No trend data yet.</div>;
  }

  const color = metric.color;
  const values = trend.map((t) => Number(t[metric.key]) || 0);
  // Percentages keep a fixed 0–100 scale so days stay visually comparable;
  // count metrics scale to their own max (with headroom) or the chart would
  // be a flat line hugging the axis.
  const maxValue = metric.max ?? Math.max(1, Math.ceil(Math.max(...values) * 1.15));

  const xFor = (i) => (trend.length === 1 ? innerW / 2 : (i / (trend.length - 1)) * innerW) + padding.left;
  const yFor = (v) => innerH - (Math.min(maxValue, Math.max(0, v)) / maxValue) * innerH + padding.top;

  const points = trend.map((t, i) => ({ ...t, x: xFor(i), y: yFor(Number(t[metric.key]) || 0) }));

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${path} L ${points[points.length - 1].x} ${innerH + padding.top} L ${points[0].x} ${innerH + padding.top} Z`;

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxValue * f));

  // ---- drag-to-select ------------------------------------------------
  const toViewBoxX = (clientX) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return ((clientX - rect.left) / rect.width) * width;
  };

  const nearestIndex = (vbX) => {
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - vbX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  };

  const handlePointerDown = (e) => {
    if (!onRangeSelect || trend.length < 2) return;
    const x = toViewBoxX(e.clientX);
    if (x == null) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ from: x, to: x });
  };

  const handlePointerMove = (e) => {
    if (!drag) return;
    const x = toViewBoxX(e.clientX);
    if (x == null) return;
    setDrag((d) => (d ? { ...d, to: x } : d));
  };

  const handlePointerUp = () => {
    if (!drag) return;
    const { from, to } = drag;
    setDrag(null);
    // A click (no meaningful movement) falls through to the point's own
    // onClick rather than selecting a one-pixel range.
    if (Math.abs(to - from) < 8) return;
    const startIdx = nearestIndex(Math.min(from, to));
    const endIdx = nearestIndex(Math.max(from, to));
    onRangeSelect?.(trend[startIdx].date, trend[endIdx].date);
  };

  const dragRect = drag
    ? { x: Math.min(drag.from, drag.to), w: Math.abs(drag.to - drag.from) }
    : null;

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={`w-full h-64 ${onRangeSelect && trend.length > 1 ? "cursor-crosshair" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {gridValues.map((v, i) => {
          const y = padding.top + innerH - (maxValue ? v / maxValue : 0) * innerH;
          return (
            <g key={`${v}-${i}`}>
              {/* Gridlines are drawn in SVG, so they can't inherit the theme
                  layer in index.css — this is a light-surface grey. */}
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="13" fill="#64748b">
                {v}
                {metric.suffix}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} opacity="0.25" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" />

        {dragRect && dragRect.w > 2 && (
          <rect
            x={dragRect.x}
            y={padding.top}
            width={dragRect.w}
            height={innerH}
            fill={color}
            opacity="0.12"
            stroke={color}
            strokeOpacity="0.4"
            strokeDasharray="4 3"
          />
        )}

        {hovered != null && !drag && (
          <line
            x1={points[hovered].x}
            x2={points[hovered].x}
            y1={padding.top}
            y2={innerH + padding.top}
            stroke={color}
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.5"
          />
        )}

        {points.map((p, i) => (
          <g key={i}>
            {(i === 0 || i === points.length - 1 || points.length <= 8) && (
              <text x={p.x} y={height - 10} textAnchor="middle" fontSize="12" fill="#64748b">
                {p.date?.slice(5)}
              </text>
            )}
            <circle cx={p.x} cy={p.y} r={hovered === i ? 6 : 4} fill={color} className="transition-all" />
            {/* Larger invisible hit target so the tooltip is easy to trigger */}
            <circle
              cx={p.x}
              cy={p.y}
              r="14"
              fill="transparent"
              className={onPointClick ? "cursor-pointer" : "cursor-default"}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
              onClick={() => !drag && onPointClick?.(p.date)}
            />
          </g>
        ))}

        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {hovered != null && !drag && (
        <div
          className="absolute z-10 pointer-events-none bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm shadow-xl whitespace-nowrap"
          style={{
            left: `${(points[hovered].x / width) * 100}%`,
            top: `${(points[hovered].y / height) * 100}%`,
            transform: "translate(-50%, -125%)",
          }}
        >
          <div className="text-gray-400 mb-0.5">{points[hovered].date}</div>
          {/* Every metric is shown, not just the plotted one — switching the
              toggle just to read a second number is needless friction. */}
          {TREND_METRICS.map((m) => (
            <div
              key={m.key}
              className={`flex items-center justify-between gap-4 ${
                m.key === metric.key ? "font-semibold" : "text-gray-400"
              }`}
              style={m.key === metric.key ? { color } : undefined}
            >
              <span>{m.label}</span>
              <span>
                {points[hovered][m.key] ?? 0}
                {m.suffix}
              </span>
            </div>
          ))}
          <div className="text-gray-600 text-xs mt-1">
            {points[hovered].inspections} inspection{points[hovered].inspections === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </div>
  );
}
