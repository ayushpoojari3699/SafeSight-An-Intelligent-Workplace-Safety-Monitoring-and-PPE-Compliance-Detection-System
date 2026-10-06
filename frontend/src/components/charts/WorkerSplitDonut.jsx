import { useState } from "react";

/**
 * Safe vs unsafe workers as a donut, with the split shown in the middle.
 *
 * Hovering a segment swaps the center label to that segment's own numbers,
 * so the ring doubles as a readout instead of needing a separate legend
 * lookup. Clicking the unsafe segment toggles the dashboard's
 * "violations only" filter.
 */
export default function WorkerSplitDonut({ safe = 0, unsafe = 0, onSegmentClick, activeSegment }) {
  const [hovered, setHovered] = useState(null);

  const total = safe + unsafe;
  const size = 200;
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { key: "safe", label: "Safe", value: safe, color: "#22c55e" },
    { key: "unsafe", label: "Unsafe", value: unsafe, color: "#ef4444" },
  ];

  if (total === 0) {
    return <div className="text-gray-500 text-base py-10 text-center">No workers assessed yet.</div>;
  }

  const focus = hovered ? segments.find((s) => s.key === hovered) : null;
  const centerValue = focus ? focus.value : total;
  const centerLabel = focus ? focus.label : "Workers";
  const centerPct = Math.round(((focus ? focus.value : safe) / total) * 100);

  let offset = 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-48 h-48 -rotate-90">
          {/* Unfilled track behind the segments — light-surface grey, since
              SVG strokes can't pick up the theme layer in index.css. */}
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
          {segments.map((seg) => {
            if (seg.value === 0) return null;
            const length = (seg.value / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const el = (
              <circle
                key={seg.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={hovered === seg.key || activeSegment === seg.key ? stroke + 6 : stroke}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                className={`transition-all duration-300 ${onSegmentClick ? "cursor-pointer" : ""}`}
                opacity={hovered && hovered !== seg.key ? 0.35 : 1}
                onMouseEnter={() => setHovered(seg.key)}
                onMouseLeave={() => setHovered((h) => (h === seg.key ? null : h))}
                onClick={() => onSegmentClick?.(seg.key)}
              />
            );
            offset += length;
            return el;
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div
            className="text-4xl font-bold"
            style={{ color: focus ? focus.color : undefined }}
          >
            {centerValue}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{centerLabel}</div>
          <div className="text-xs text-gray-600">
            {centerPct}% {focus ? "of total" : "compliant"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4">
        {segments.map((seg) => (
          <button
            key={seg.key}
            onClick={() => onSegmentClick?.(seg.key)}
            onMouseEnter={() => setHovered(seg.key)}
            onMouseLeave={() => setHovered((h) => (h === seg.key ? null : h))}
            className={`flex items-center gap-2 text-sm px-2.5 py-1 rounded-lg border transition ${
              activeSegment === seg.key
                ? "border-white/20 bg-white/10 text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
            {seg.label}
            <span className="text-gray-500">{seg.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
