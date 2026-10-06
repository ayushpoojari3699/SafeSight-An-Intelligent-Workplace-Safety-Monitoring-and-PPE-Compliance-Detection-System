import { useEffect, useState } from "react";
import axios from "axios";
import { Activity, Users, ShieldCheck, AlertTriangle } from "lucide-react";
import { API_BASE } from "../../lib/api";
import ComplianceTrendChart from "../../components/charts/ComplianceTrendChart";
import ViolationBarChart from "../../components/charts/ViolationBarChart";

function SummaryCard({ label, value, icon: Icon, tone }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-gray-400 text-base">{label}</p>
          <h2 className="text-4xl font-bold mt-2">{value}</h2>
        </div>
        <Icon className={tone} size={32} />
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get(`${API_BASE}/analytics`)
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error(err);
        setError("Could not load analytics.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="text-4xl font-bold">Analytics</h2>
        <p className="text-gray-400 mt-1">
          Compliance trends and PPE violation breakdown across all inspections.
        </p>
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-400">Loading analytics...</div>
      ) : error ? (
        <div className="p-10 text-center text-red-400">{error}</div>
      ) : (
        <div className="space-y-8">
          <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6">
            <SummaryCard
              label="Total Inspections"
              value={data.totals.total_inspections}
              icon={Activity}
              tone="text-blue-400"
            />
            <SummaryCard
              label="Workers Assessed"
              value={data.totals.total_workers}
              icon={Users}
              tone="text-green-400"
            />
            <SummaryCard
              label="Violations"
              value={data.totals.unsafe_workers}
              icon={AlertTriangle}
              tone="text-red-400"
            />
            <SummaryCard
              label="Avg. Compliance"
              value={`${data.avg_compliance}%`}
              icon={ShieldCheck}
              tone="text-emerald-400"
            />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h3 className="text-xl font-semibold mb-4">Compliance Trend Over Time</h3>
            <ComplianceTrendChart trend={data.trend} />
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h3 className="text-xl font-semibold mb-6">PPE Violation Breakdown</h3>
            <ViolationBarChart breakdown={data.violation_breakdown} />
          </div>
        </div>
      )}
    </div>
  );
}
