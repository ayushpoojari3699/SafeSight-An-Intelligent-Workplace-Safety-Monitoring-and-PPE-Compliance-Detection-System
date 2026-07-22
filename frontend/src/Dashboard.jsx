import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Upload,
  ShieldCheck,
  AlertTriangle,
  Users,
  Image as ImageIcon,
  FileDown,
  Activity,
  Bot,
} from "lucide-react";

function Dashboard() {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);

    const previews = selected.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setFiles(previews);
    setResults([]);
    setSummary(null);
    setSelectedImage(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert("Please select images");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();

      files.forEach((img) => {
        formData.append("files", img.file);
      });

      const res = await axios.post(
        "http://127.0.0.1:8000/detect",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setSummary(res.data.summary);
      setResults(res.data.images);

      if (res.data.images.length > 0) {
        setSelectedImage(res.data.images[0]);
      }

      setLoading(false);
    } catch (err) {
      // -----------------------------
      // Detailed error logging
      // -----------------------------
      console.error("Full Error:", err);

      if (err.response) {
        // Backend responded, but with an error status (4xx / 5xx)
        console.log("Backend Response:", err.response.data);
        console.log("Status:", err.response.status);
      } else if (err.request) {
        // Request was sent, but no response came back
        console.log("No response from backend");
      } else {
        // Something went wrong setting up the request itself
        console.log("Error:", err.message);
      }

      setLoading(false);
      alert("Detection failed");
    }
  };

  // ---------- Export helpers ----------

  const downloadBlob = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const buildWorkerRows = () => {
    // Flattens every worker from every processed image into one table
    const rows = [];
    results.forEach((image) => {
      image.workers.forEach((worker) => {
        rows.push({
          image: image.name,
          worker_id: worker.worker_id,
          helmet: worker.helmet ? "Yes" : "No",
          vest: worker.vest ? "Yes" : "No",
          gloves: worker.gloves ? "Yes" : "No",
          boots: worker.boots ? "Yes" : "No",
          goggles: worker.goggles ? "Yes" : "No",
          status: worker.status,
          missing: (worker.missing || []).join(", "),
        });
      });
    });
    return rows;
  };

  const handleExportJSON = () => {
    if (!summary || results.length === 0) {
      alert("Run detection before exporting.");
      return;
    }
    const payload = {
      generated_at: new Date().toISOString(),
      summary,
      images: results,
    };
    downloadBlob(
      JSON.stringify(payload, null, 2),
      `ppe-report-${Date.now()}.json`,
      "application/json"
    );
  };

  const handleExportCSV = () => {
    if (results.length === 0) {
      alert("Run detection before exporting.");
      return;
    }
    const rows = buildWorkerRows();
    const headers = [
      "Image",
      "Worker ID",
      "Helmet",
      "Vest",
      "Gloves",
      "Boots",
      "Goggles",
      "Status",
      "Missing Items",
    ];

    const escapeCell = (val) => {
      const str = String(val ?? "");
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const csvLines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.image,
          r.worker_id,
          r.helmet,
          r.vest,
          r.gloves,
          r.boots,
          r.goggles,
          r.status,
          r.missing,
        ]
          .map(escapeCell)
          .join(",")
      ),
    ];

    downloadBlob(csvLines.join("\n"), `ppe-report-${Date.now()}.csv`, "text/csv");
  };

  const handleExportPDF = () => {
    if (!summary || results.length === 0) {
      alert("Run detection before exporting.");
      return;
    }

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Safesight — Compliance Report", 14, 18);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);

    doc.setFontSize(12);
    doc.text(
      [
        `Images Processed: ${summary.total_images}`,
        `Workers Detected: ${summary.total_workers}`,
        `Safe Workers: ${summary.safe_workers}`,
        `Unsafe Workers: ${summary.unsafe_workers}`,
        `Overall Compliance: ${summary.compliance}%`,
      ],
      14,
      35
    );

    doc.text(
      [
        `Helmet Violations: ${summary.helmet}`,
        `Vest Violations: ${summary.vest}`,
        `Gloves Violations: ${summary.gloves}`,
        `Boots Violations: ${summary.boots}`,
        `Goggles Violations: ${summary.goggles}`,
      ],
      14,
      65
    );

    const rows = buildWorkerRows();

    autoTable(doc, {
      startY: 95,
      head: [
        [
          "Image",
          "Worker",
          "Helmet",
          "Vest",
          "Gloves",
          "Boots",
          "Goggles",
          "Status",
          "Missing",
        ],
      ],
      body: rows.map((r) => [
        r.image,
        r.worker_id,
        r.helmet,
        r.vest,
        r.gloves,
        r.boots,
        r.goggles,
        r.status,
        r.missing,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 38, 38] },
    });

    doc.save(`ppe-report-${Date.now()}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#050816] text-white">

      {/* Navbar */}

      <nav className="border-b border-gray-800 bg-[#0b1120]">

        <div className="max-w-7xl mx-auto flex justify-between items-center px-8 py-6">

          <div>

            <h1 className="text-3xl font-bold text-red-500">
               SAFESIGHT
            </h1>

            <p className="text-gray-400 mt-1">
              AI Construction Safety Monitoring Dashboard
            </p>

          </div>

          <div className="flex items-center gap-4">

            <Link
              to="/assistant"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-full transition"
            >
              <Bot size={18} />
              <span>AI Assistant</span>
            </Link>

            <div className="flex items-center gap-3 bg-green-500/20 px-5 py-2 rounded-full border border-green-500">

              <Activity size={18} />

              <span>System Active</span>

            </div>

          </div>

        </div>

      </nav>

      <div className="max-w-7xl mx-auto px-8 py-10">

        {/* Heading */}

        <div className="mb-10">

          <h2 className="text-5xl font-bold mb-3">

            PPE Compliance Dashboard

          </h2>

          <p className="text-gray-400 text-lg">

            Upload multiple construction site images and generate
            automatic PPE compliance reports.

          </p>

        </div>

        {/* Summary Cards */}

        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6 mb-10">

          <div className="rounded-3xl bg-white/5 border border-white/10 p-6">

            <div className="flex justify-between items-center">

              <div>

                <p className="text-gray-400">
                  Images
                </p>

                <h2 className="text-4xl font-bold mt-2">
                  {summary ? summary.total_images : 0}
                </h2>

              </div>

              <ImageIcon className="text-blue-400" size={40} />

            </div>

          </div>

          <div className="rounded-3xl bg-white/5 border border-white/10 p-6">

            <div className="flex justify-between items-center">

              <div>

                <p className="text-gray-400">
                  Workers
                </p>

                <h2 className="text-4xl font-bold mt-2">
                  {summary ? summary.total_workers : 0}
                </h2>

              </div>

              <Users className="text-green-400" size={40} />

            </div>

          </div>

          <div className="rounded-3xl bg-white/5 border border-white/10 p-6">

            <div className="flex justify-between items-center">

              <div>

                <p className="text-gray-400">
                  Violations
                </p>

                <h2 className="text-4xl font-bold mt-2">
                  {summary ? summary.unsafe_workers : 0}
                </h2>

              </div>

              <AlertTriangle className="text-red-400" size={40} />

            </div>

          </div>

          <div className="rounded-3xl bg-white/5 border border-white/10 p-6">

            <div className="flex justify-between items-center">

              <div>

                <p className="text-gray-400">
                  Compliance
                </p>

                <h2 className="text-4xl font-bold mt-2">
                  {summary ? `${summary.compliance}%` : "0%"}
                </h2>

              </div>

              <ShieldCheck className="text-emerald-400" size={40} />

            </div>

          </div>

        </div>

        {/* Upload Section */}

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-10">

          <h3 className="text-2xl font-semibold mb-6">

            Upload Construction Images

          </h3>

          <label className="border-2 border-dashed border-gray-700 rounded-3xl h-72 flex flex-col justify-center items-center cursor-pointer hover:border-red-500 transition">

            <Upload size={60} className="mb-5 text-red-400" />

            <h3 className="text-2xl font-semibold">

              Click to Upload Multiple Images

            </h3>

            <p className="text-gray-400 mt-2">

              PNG • JPG • JPEG

            </p>

            <input
              type="file"
              multiple
              hidden
              onChange={handleFileChange}
            />

          </label>

          <button
            onClick={handleUpload}
            disabled={loading}
            className="mt-6 w-full bg-red-500 hover:bg-red-600 rounded-2xl py-4 text-lg font-semibold transition"
          >
            {loading ? "Running Detection..." : "Start Detection"}
          </button>

        </div>

        {/* Selected Images */}

        <div className="grid lg:grid-cols-5 md:grid-cols-3 gap-5 mb-10">

          {files.map((img, index) => (

            <div
              key={index}
              onClick={() => {
                if (results[index]) {
                  setSelectedImage(results[index]);
                }
              }}
              className="cursor-pointer rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-red-500 transition"
            >

              <img
                src={img.preview}
                alt=""
                className="w-full h-44 object-cover"
              />

              <div className="p-3">

                <p className="truncate">
                  {img.file.name}
                </p>

              </div>

            </div>

          ))}

        </div>

        {/* Selected Detection */}

        {selectedImage && (
          <div className="grid lg:grid-cols-2 gap-8 mb-10">

            {/* Original Image */}

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

              <h3 className="text-2xl font-semibold mb-5">
                Original Image
              </h3>

              <img
                src={
                  files.find(
                    (f) => f.file.name === selectedImage.name
                  )?.preview
                }
                alt="Original"
                className="w-full h-[450px] object-contain rounded-2xl bg-black"
              />

            </div>

            {/* Annotated */}

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">

              <h3 className="text-2xl font-semibold mb-5">
                Detection Output
              </h3>

              <img
                src={selectedImage.annotated}
                alt="Detection"
                className="w-full h-[450px] object-contain rounded-2xl bg-black"
              />

            </div>

          </div>
        )}

        {/* Worker Table */}

        {selectedImage && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-10">

            <h3 className="text-2xl font-semibold mb-6">
              Worker PPE Status
            </h3>

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>

                  <tr className="border-b border-gray-700">

                    <th className="text-left py-4">Worker</th>
                    <th>Helmet</th>
                    <th>Vest</th>
                    <th>Gloves</th>
                    <th>Boots</th>
                    <th>Goggles</th>
                    <th>Status</th>

                  </tr>

                </thead>

                <tbody>

                  {selectedImage.workers.map((worker) => (

                    <tr
                      key={worker.worker_id}
                      className="border-b border-gray-800"
                    >

                      <td className="py-5 font-medium">
                        Worker {worker.worker_id}
                      </td>

                      <td className="text-center">
                        {worker.helmet ? "✅" : "❌"}
                      </td>

                      <td className="text-center">
                        {worker.vest ? "✅" : "❌"}
                      </td>

                      <td className="text-center">
                        {worker.gloves ? "✅" : "❌"}
                      </td>

                      <td className="text-center">
                        {worker.boots ? "✅" : "❌"}
                      </td>

                      <td className="text-center">
                        {worker.goggles ? "✅" : "❌"}
                      </td>

                      <td className="text-center">

                        {worker.status === "Safe" ? (

                          <span className="text-green-400 font-semibold">
                            SAFE
                          </span>

                        ) : (

                          <span className="text-red-400 font-semibold">
                            UNSAFE
                          </span>

                        )}

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>
        )}

        {/* Violation Report */}

        {selectedImage && (

          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-10">

            <div className="flex justify-between items-center mb-6">

              <h3 className="text-2xl font-semibold">
                Violation Report
              </h3>

              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 px-5 py-3 rounded-xl"
              >

                <FileDown size={18} />

                Download Report

              </button>

            </div>

            {selectedImage.workers.filter(
              (w) => w.status === "Unsafe"
            ).length === 0 ? (

              <div className="bg-green-500/10 border border-green-500 rounded-2xl p-6 text-green-400 text-lg">

                🎉 All workers are PPE compliant.

              </div>

            ) : (

              <div className="space-y-5">

                {selectedImage.workers
                  .filter((worker) => worker.status === "Unsafe")
                  .map((worker) => (

                    <div
                      key={worker.worker_id}
                      className="border border-red-500 bg-red-500/10 rounded-2xl p-5"
                    >

                      <div className="flex justify-between items-center mb-4">

                        <h4 className="text-xl font-semibold">

                          Worker {worker.worker_id}

                        </h4>

                        <span className="text-red-400 font-bold">
                          ALERT
                        </span>

                      </div>

                      <div className="flex flex-wrap gap-3">

                        {worker.missing.map((item, index) => (

                          <span
                            key={index}
                            className="bg-red-900 text-red-200 px-4 py-2 rounded-full"
                          >

                            {item}

                          </span>

                        ))}

                      </div>

                    </div>

                  ))}

              </div>

            )}

          </div>

        )}

        {/* Overall Summary Dashboard */}

        {summary && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-10">

            <div className="flex justify-between items-center mb-8">

              <div>
                <h3 className="text-3xl font-bold">
                  Overall Detection Summary
                </h3>

                <p className="text-gray-400 mt-2">
                  Complete PPE compliance statistics for all uploaded images.
                </p>
              </div>

              <div
                className={`px-6 py-3 rounded-full font-semibold text-lg ${
                  summary.compliance >= 90
                    ? "bg-green-500/20 text-green-400 border border-green-500"
                    : summary.compliance >= 70
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500"
                    : "bg-red-500/20 text-red-400 border border-red-500"
                }`}
              >
                {summary.compliance}% Compliance
              </div>

            </div>

            <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6">

              <div className="bg-[#0f172a] rounded-2xl p-6 border border-gray-700">
                <p className="text-gray-400 text-sm">Images Processed</p>
                <h2 className="text-4xl font-bold mt-3">
                  {summary.total_images}
                </h2>
              </div>

              <div className="bg-[#0f172a] rounded-2xl p-6 border border-gray-700">
                <p className="text-gray-400 text-sm">Workers Detected</p>
                <h2 className="text-4xl font-bold mt-3">
                  {summary.total_workers}
                </h2>
              </div>

              <div className="bg-[#0f172a] rounded-2xl p-6 border border-gray-700">
                <p className="text-gray-400 text-sm">Safe Workers</p>
                <h2 className="text-4xl font-bold text-green-400 mt-3">
                  {summary.safe_workers}
                </h2>
              </div>

              <div className="bg-[#0f172a] rounded-2xl p-6 border border-gray-700">
                <p className="text-gray-400 text-sm">Unsafe Workers</p>
                <h2 className="text-4xl font-bold text-red-400 mt-3">
                  {summary.unsafe_workers}
                </h2>
              </div>

            </div>

            <div className="grid lg:grid-cols-5 gap-5 mt-8">

              <div className="bg-red-500/10 border border-red-500 rounded-2xl p-5">
                <h4 className="text-gray-400 mb-2">
                  Helmet Violations
                </h4>

                <p className="text-4xl font-bold text-red-400">
                  {summary.helmet}
                </p>
              </div>

              <div className="bg-orange-500/10 border border-orange-500 rounded-2xl p-5">
                <h4 className="text-gray-400 mb-2">
                  Vest Violations
                </h4>

                <p className="text-4xl font-bold text-orange-400">
                  {summary.vest}
                </p>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500 rounded-2xl p-5">
                <h4 className="text-gray-400 mb-2">
                  Gloves Violations
                </h4>

                <p className="text-4xl font-bold text-yellow-400">
                  {summary.gloves}
                </p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500 rounded-2xl p-5">
                <h4 className="text-gray-400 mb-2">
                  Boots Violations
                </h4>

                <p className="text-4xl font-bold text-blue-400">
                  {summary.boots}
                </p>
              </div>

              <div className="bg-purple-500/10 border border-purple-500 rounded-2xl p-5">
                <h4 className="text-gray-400 mb-2">
                  Goggles Violations
                </h4>

                <p className="text-4xl font-bold text-purple-400">
                  {summary.goggles}
                </p>
              </div>

            </div>

          </div>
        )}

        {/* Detection History */}

        {results.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-10">

            <div className="flex justify-between items-center mb-6">

              <div>
                <h3 className="text-3xl font-bold">
                  Detection History
                </h3>

                <p className="text-gray-400 mt-2">
                  Processed images in the current session.
                </p>
              </div>

              <span className="bg-blue-500/20 border border-blue-500 text-blue-400 px-4 py-2 rounded-full">
                {results.length} Images
              </span>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>

                  <tr className="border-b border-gray-700">

                    <th className="text-left py-4">Image</th>
                    <th className="text-center">Workers</th>
                    <th className="text-center">Safe</th>
                    <th className="text-center">Unsafe</th>
                    <th className="text-center">Compliance</th>

                  </tr>

                </thead>

                <tbody>

                  {results.map((image, index) => {

                    const safe =
                      image.workers.filter(
                        (w) => w.status === "Safe"
                      ).length;

                    const unsafe =
                      image.workers.filter(
                        (w) => w.status === "Unsafe"
                      ).length;

                    const compliance =
                      image.workers.length === 0
                        ? 100
                        : (
                            (safe / image.workers.length) *
                            100
                          ).toFixed(1);

                    return (

                      <tr
                        key={index}
                        className="border-b border-gray-800 hover:bg-white/5 cursor-pointer"
                        onClick={() => setSelectedImage(image)}
                      >

                        <td className="py-5">
                          {image.name}
                        </td>

                        <td className="text-center">
                          {image.workers.length}
                        </td>

                        <td className="text-center text-green-400 font-semibold">
                          {safe}
                        </td>

                        <td className="text-center text-red-400 font-semibold">
                          {unsafe}
                        </td>

                        <td className="text-center">

                          <span
                            className={`px-4 py-2 rounded-full font-semibold ${
                              compliance >= 90
                                ? "bg-green-500/20 text-green-400"
                                : compliance >= 70
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {compliance}%
                          </span>

                        </td>

                      </tr>

                    );

                  })}

                </tbody>

              </table>

            </div>

          </div>
        )}

        {/* Export Center */}

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-10">

          <div className="flex justify-between items-center mb-8">

            <div>
              <h3 className="text-3xl font-bold">
                Reports & Export
              </h3>
              <p className="text-gray-400 mt-2">
                Download inspection reports in multiple formats.
              </p>
            </div>

          </div>

          <div className="grid md:grid-cols-4 gap-6">

            <button
              onClick={handleExportPDF}
              className="bg-red-500 hover:bg-red-600 rounded-2xl py-6 transition text-lg font-semibold"
            >
              📄 Export PDF
            </button>

            <button
              onClick={handleExportCSV}
              className="bg-green-500 hover:bg-green-600 rounded-2xl py-6 transition text-lg font-semibold"
            >
              📊 Export CSV
            </button>

            <button
              onClick={handleExportJSON}
              className="bg-blue-500 hover:bg-blue-600 rounded-2xl py-6 transition text-lg font-semibold"
            >
              📁 Export JSON
            </button>

            <button
              onClick={() => window.print()}
              className="bg-purple-500 hover:bg-purple-600 rounded-2xl py-6 transition text-lg font-semibold"
            >
              🖨 Print Report
            </button>

          </div>

        </div>

        {/* Footer */}

        <footer className="border-t border-gray-800 py-8 text-center text-gray-400">

          <h3 className="text-xl font-semibold text-white mb-2">
             SAFESIGHT
          </h3>

          <p>
            AI-Based Construction Safety Monitoring System
          </p>

          <p className="mt-2 text-sm">
            Powered by YOLOv8 • FastAPI • React • Tailwind CSS
          </p>

        </footer>

      </div>
    </div>
  );
}

export default Dashboard;
