import { useState } from "react";

const DEFAULT_CATEGORIES = [
  { key: "helmet", label: "Helmet", color: "#ef4444" },
  { key: "vest", label: "Vest", color: "#f97316" },
  { key: "gloves", label: "Gloves", color: "#eab308" },
  { key: "boots", label: "Boots", color: "#3b82f6" },
  { key: "goggles", label: "Goggles", color: "#a855f7" },
];

/**
 * Horizontal bar breakdown of PPE violation counts.
 * Expects breakdown = { helmet: n, vest: n, gloves: n, boots: n, goggles: n }
 *
 * When onCategoryClick is provided, bars become clickable/hoverable so the
 * parent can filter the table down to inspections with that violation type.
 */
export default function ViolationBarChart({
  breakdown,
  categories = DEFAULT_CATEGORIES,
  onCategoryClick,
  activeCategory,
}) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const total = categories.reduce((sum, c) => sum + (breakdown?.[c.key] || 0), 0);
  const max = Math.max(1, ...categories.map((c) => breakdown?.[c.key] || 0));

  return (
    <div className="space-y-4">
      {categories.map((c) => {
        const value = breakdown?.[c.key] || 0;
        const pct = (value / max) * 100;
        const share = total > 0 ? Math.round((value / total) * 100) : 0;
        const isActive = activeCategory === c.key;
        const isHovered = hoveredKey === c.key;
        const clickable = !!onCategoryClick && value > 0;

        return (
          <div
            key={c.key}
            onClick={() => clickable && onCategoryClick(isActive ? null : c.key)}
            onMouseEnter={() => setHoveredKey(c.key)}
            onMouseLeave={() => setHoveredKey((k) => (k === c.key ? null : k))}
            className={`rounded-lg -mx-2 px-2 py-1 transition-colors ${
              clickable ? "cursor-pointer hover:bg-white/5" : ""
            } ${isActive ? "bg-white/5 ring-1 ring-inset ring-white/15" : ""}`}
          >
            <div className="flex justify-between text-base mb-1">
              <span className={isActive ? "text-white font-medium" : "text-gray-300"}>
                {c.label}
                {isActive && <span className="ml-2 text-xs text-red-400 font-normal">Filtering</span>}
              </span>
              <span className="text-gray-400">
                {value}
                {isHovered && value > 0 && (
                  <span className="text-gray-500 text-sm ml-1.5">({share}% of flagged)</span>
                )}
              </span>
            </div>
            <div className="h-3 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: c.color,
                  opacity: isHovered || isActive ? 1 : 0.85,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { DEFAULT_CATEGORIES };
