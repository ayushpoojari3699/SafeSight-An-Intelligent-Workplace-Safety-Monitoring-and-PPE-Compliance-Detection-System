import { useEffect, useRef, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  UploadCloud,
  Image as ImageIcon,
  Film,
  FileText,
  Loader2,
  CheckCircle,
  ShieldCheck,
  Users,
  AlertTriangle,
  FileDown,
  Layers,
  Clock,
  Gauge,
  Radio,
  MapPin,
} from "lucide-react";
import { API_BASE, getAuthToken } from "../../lib/api";
import WorkerComplianceTable from "../../components/WorkerComplianceTable";

const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm"];

function Tabs({ active, onChange }) {
  const tabs = [
    { id: "detection", label: "PPE Detection", icon: ImageIcon },
    { id: "documents", label: "Knowledge Base Document", icon: FileText },
  ];

  return (
    <div className="flex gap-2 mb-6 bg-white/5 border border-white/10 rounded-2xl p-1.5 w-fit">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-base font-medium transition ${
              isActive
                ? "bg-red-500 text-white shadow"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon size={16} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function ModeToggle({ mode, onChange }) {
  const modes = [
    { id: "image", label: "Image Upload", icon: ImageIcon },
    { id: "video", label: "Video Upload", icon: Film },
  ];

  return (
    <div className="flex gap-2 mb-6">
      {modes.map((m) => {
        const Icon = m.icon;
        const isActive = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-base font-medium border transition ${
              isActive
                ? "bg-red-500/15 text-red-400 border-red-500/30"
                : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
            }`}
          >
            <Icon size={16} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function SiteSelector({ sites, value, onChange }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <MapPin size={16} className="text-red-400 shrink-0" />
      <label className="text-gray-400 text-base shrink-0">Site</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#0b1120] border border-white/10 rounded-lg px-3 py-1.5 text-base outline-none focus:border-red-400"
      >
        {sites.length === 0 ? (
          <option value="Construction Site A">Construction Site A</option>
        ) : (
          sites.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}

function buildWorkerRows(results) {
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
}

function exportDetectionPdf({ title, summary, results, extraLines = [], cumulativeWorkers = [] }) {
  if (!summary || results.length === 0) {
    alert("Run detection before exporting.");
    return;
  }
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(title, 14, 18);
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
      ...extraLines,
    ],
    14,
    35
  );

  let cursorY = 35 + (extraLines.length + 5) * 6;

  // Whole-video, per-tracked-worker checklist first — it's the summary a
  // reader wants ("did worker 1 ever have a helmet on?"), whereas the
  // per-frame table below it is the frame-by-frame evidence.
  if (cumulativeWorkers.length > 0) {
    doc.setFontSize(12);
    doc.text("Per-Worker PPE (cumulative across all analyzed frames)", 14, cursorY);
    autoTable(doc, {
      startY: cursorY + 4,
      head: [["Worker", "Frames Seen", "Helmet", "Vest", "Gloves", "Boots", "Goggles", "Status", "Missing"]],
      body: cumulativeWorkers.map((w) => [
        `Worker ${w.track_id ?? w.worker_id}`,
        w.frames_seen ?? "—",
        w.helmet ? "Yes" : "No",
        w.vest ? "Yes" : "No",
        w.gloves ? "Yes" : "No",
        w.boots ? "Yes" : "No",
        w.goggles ? "Yes" : "No",
        w.status,
        (w.missing || []).join(", "),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 38, 38] },
    });
    cursorY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text("Frame-by-frame detections", 14, cursorY);
    cursorY += 4;
  }

  const rows = buildWorkerRows(results);
  autoTable(doc, {
    startY: cursorY,
    head: [["Image", "Worker", "Helmet", "Vest", "Gloves", "Boots", "Goggles", "Status", "Missing"]],
    body: rows.map((r) => [
      r.image, r.worker_id, r.helmet, r.vest, r.gloves, r.boots, r.goggles, r.status, r.missing,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [220, 38, 38] },
  });

  doc.save(`ppe-report-${Date.now()}.pdf`);
}

function SummaryCards({ summary, imagesLabel = "Images" }) {
  return (
    <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-6">
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <p className="text-gray-400 text-base">{imagesLabel}</p>
        <h2 className="text-4xl font-bold mt-2">{summary.total_images}</h2>
      </div>
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <p className="text-gray-400 text-base flex items-center gap-2"><Users size={14}/> Workers</p>
        <h2 className="text-4xl font-bold mt-2">{summary.total_workers}</h2>
      </div>
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <p className="text-gray-400 text-base flex items-center gap-2"><AlertTriangle size={14}/> Violations</p>
        <h2 className="text-4xl font-bold mt-2">{summary.unsafe_workers}</h2>
      </div>
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
        <p className="text-gray-400 text-base flex items-center gap-2"><ShieldCheck size={14}/> Compliance</p>
        <h2 className="text-4xl font-bold mt-2">{summary.compliance}%</h2>
      </div>
    </div>
  );
}

function FrameResultViewer({ title, results, selectedImage, onSelect, onExport, cumulativeWorkers }) {
  if (!selectedImage) return null;
  // Video results carry tracked, whole-video cumulative rows; image results
  // don't (separate uploads aren't the same person), so those stay per-image.
  const isCumulative = Array.isArray(cumulativeWorkers) && cumulativeWorkers.length > 0;
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-semibold">{title}</h3>
        <button
          onClick={onExport}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-xl text-base"
        >
          <FileDown size={16} /> Export PDF
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
        {results.map((img, i) => (
          <button
            key={i}
            onClick={() => onSelect(img)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
              selectedImage.name === img.name
                ? "bg-red-500/15 text-red-400 border-red-500/30"
                : "bg-white/5 text-gray-400 border-white/10"
            }`}
          >
            {img.timestamp_sec != null ? `${img.timestamp_sec}s` : img.name}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <img src={selectedImage.original} className="w-full h-72 object-contain rounded-2xl bg-black" alt="original" />
        <img src={selectedImage.annotated} className="w-full h-72 object-contain rounded-2xl bg-black" alt="annotated" />
      </div>

      <WorkerComplianceTable
        workers={isCumulative ? cumulativeWorkers : selectedImage.workers}
        cumulative={isCumulative}
      />
    </div>
  );
}

function ImageDetectionPanel({ sites, site, onSiteChange }) {
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
      alert("Please select images first.");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      files.forEach((img) => formData.append("files", img.file));
      formData.append("site_name", site);

      const res = await axios.post(`${API_BASE}/detect`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSummary(res.data.summary);
      setResults(res.data.images);
      if (res.data.images.length > 0) setSelectedImage(res.data.images[0]);
    } catch (err) {
      console.error(err);
      alert("Detection failed. Check the backend logs for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
        <h3 className="text-2xl font-semibold mb-3">Upload Construction Site Images</h3>

        <SiteSelector sites={sites} value={site} onChange={onSiteChange} />

        <label className="border-2 border-dashed border-gray-700 rounded-2xl h-56 flex flex-col justify-center items-center cursor-pointer hover:border-red-500 transition">
          <UploadCloud size={48} className="mb-4 text-red-400" />
          <h4 className="text-xl font-semibold">Click to upload multiple images</h4>
          <p className="text-gray-400 mt-1 text-base">PNG • JPG • JPEG</p>
          <input type="file" multiple hidden onChange={handleFileChange} accept="image/*" />
        </label>

        {files.length > 0 && (
          <div className="grid lg:grid-cols-6 md:grid-cols-4 gap-3 mt-6">
            {files.map((img, i) => (
              <div key={i} className="rounded-xl overflow-hidden bg-white/5 border border-white/10">
                <img src={img.preview} alt="" className="w-full h-24 object-cover" />
                <p className="text-xs p-1.5 truncate">{img.file.name}</p>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={loading || files.length === 0}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-2xl py-4 font-semibold transition"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Running Detection...
            </>
          ) : (
            "Start Detection"
          )}
        </button>
      </div>

      {summary && (
        <>
          <SummaryCards summary={summary} />
          <FrameResultViewer
            title="Detection Result"
            results={results}
            selectedImage={selectedImage}
            onSelect={setSelectedImage}
            onExport={() =>
              exportDetectionPdf({
                title: "Safesight — Compliance Report",
                summary,
                results,
              })
            }
          />
        </>
      )}
    </div>
  );
}

function VideoDetectionPanel({ sites, site, onSiteChange }) {
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Live-stream state — populated as each frame comes in from the backend.
  const [liveProcessed, setLiveProcessed] = useState(0);
  const [liveTotal, setLiveTotal] = useState(null);
  const [liveCurrentFrame, setLiveCurrentFrame] = useState(null);
  const [liveSummary, setLiveSummary] = useState(null);
  const [liveThumbs, setLiveThumbs] = useState([]);

  // One row per tracked worker, accumulated over every frame analyzed so far
  // (backend `workers_cumulative`). Updated live during processing and
  // finalized on the "done" event; drives the checklist in both places.
  const [cumulativeWorkers, setCumulativeWorkers] = useState([]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const extension = "." + file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_VIDEO_EXTENSIONS.includes(extension)) {
      alert(`Unsupported video format. Allowed: ${ALLOWED_VIDEO_EXTENSIONS.join(", ")}`);
      return;
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setResults([]);
    setSummary(null);
    setMeta(null);
    setSelectedImage(null);
    setCumulativeWorkers([]);
    setError("");
  };

  const handleUpload = async () => {
    if (!videoFile) {
      alert("Please select a video first.");
      return;
    }

    setLoading(true);
    setError("");
    setLiveProcessed(0);
    setLiveTotal(null);
    setLiveCurrentFrame(null);
    setLiveSummary(null);
    setLiveThumbs([]);
    setCumulativeWorkers([]);
    setResults([]);
    setSummary(null);
    setMeta(null);

    try {
      const formData = new FormData();
      formData.append("file", videoFile);
      formData.append("site_name", site);
      const token = getAuthToken();

      const res = await fetch(`${API_BASE}/detect-video`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const contentType = res.headers.get("content-type") || "";

      // The backend returns a plain JSON error (no stream) for validation
      // failures caught before processing starts (bad format, corrupt file).
      if (contentType.includes("application/json")) {
        const data = await res.json();
        throw new Error(data.error || data.detail || "Video detection failed.");
      }
      if (!res.ok || !res.body) {
        throw new Error(`Video detection failed (status ${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleEvent = (event) => {
        if (event.type === "start") {
          setLiveTotal(event.frames_total);
        } else if (event.type === "frame") {
          setLiveProcessed(event.processed_count);
          setLiveCurrentFrame(event);
          setLiveSummary(event.summary_so_far);
          setLiveThumbs((prev) => [...prev.slice(-11), event]);
          if (event.workers_cumulative) setCumulativeWorkers(event.workers_cumulative);
        } else if (event.type === "done") {
          setSummary(event.summary);
          setResults(event.images);
          setCumulativeWorkers(event.workers_cumulative || []);
          setMeta({
            frames_total: event.frames_total,
            frames_processed: event.frames_processed,
            frames_sampled: event.frames_sampled,
            duration_sec: event.duration_sec,
            processing_time: event.processing_time,
          });
          if (event.images.length > 0) setSelectedImage(event.images[0]);
        } else if (event.type === "error") {
          setError(event.error || "Video detection failed.");
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          handleEvent(JSON.parse(line));
        }
      }
      if (buffer.trim()) {
        handleEvent(JSON.parse(buffer));
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Video detection failed. Check the backend logs for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
        <h3 className="text-2xl font-semibold mb-2">Upload Construction Site Video</h3>
        <p className="text-gray-400 text-base mb-5">
          Every frame is run through the same YOLO PPE-detection pipeline used for images.
          Longer videos are sampled evenly across their full length to keep processing time
          and result size reasonable.
        </p>

        <SiteSelector sites={sites} value={site} onChange={onSiteChange} />

        {!videoPreview ? (
          <label className="border-2 border-dashed border-gray-700 rounded-2xl h-56 flex flex-col justify-center items-center cursor-pointer hover:border-red-500 transition">
            <UploadCloud size={48} className="mb-4 text-red-400" />
            <h4 className="text-xl font-semibold">Click to upload a video</h4>
            <p className="text-gray-400 mt-1 text-base">MP4 • MOV • AVI • MKV • WEBM</p>
            <input type="file" hidden onChange={handleFileChange} accept="video/*" />
          </label>
        ) : (
          <div className="rounded-2xl overflow-hidden bg-black border border-white/10">
            <video src={videoPreview} controls className="w-full max-h-96" />
          </div>
        )}

        {videoFile && (
          <div className="flex items-center justify-between mt-4 text-base text-gray-400">
            <span className="truncate">{videoFile.name}</span>
            <label className="text-red-400 hover:text-red-300 cursor-pointer font-medium shrink-0 ml-4">
              Choose different file
              <input type="file" hidden onChange={handleFileChange} accept="video/*" />
            </label>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={loading || !videoFile}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-2xl py-4 font-semibold transition"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Processing video frame-by-frame... this can take a while
            </>
          ) : (
            "Start Video Detection"
          )}
        </button>

        {error && (
          <div className="mt-4 rounded-xl p-4 text-base border bg-red-500/10 border-red-500/30 text-red-300">
            {error}
          </div>
        )}
      </div>

      {loading && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-2xl font-semibold flex items-center gap-2">
              <Radio size={18} className="text-red-400 animate-pulse-dot" />
              Live Detection
            </h3>
            <span className="text-base text-gray-400">
              {liveTotal ? `${liveProcessed} / ${liveTotal} frames` : `${liveProcessed} frames processed`}
            </span>
          </div>

          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-300"
              style={{
                width: liveTotal
                  ? `${Math.min(100, Math.round((liveProcessed / liveTotal) * 100))}%`
                  : liveProcessed > 0 ? "100%" : "8%",
              }}
            />
          </div>

          {liveCurrentFrame ? (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
                <img
                  src={liveCurrentFrame.annotated}
                  className="w-full h-72 object-contain"
                  alt="live detection frame"
                />
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold">{liveSummary?.total_workers ?? 0}</div>
                    <div className="text-xs text-gray-500">Workers so far</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-red-400">{liveSummary?.unsafe_workers ?? 0}</div>
                    <div className="text-xs text-gray-500">Violations so far</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-base bg-[#0b1120] border border-white/10 rounded-xl px-4 py-2.5">
                  <span className="text-gray-400">Current frame</span>
                  <span className={liveCurrentFrame.status === "Safe" ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                    {liveCurrentFrame.status}
                    {liveCurrentFrame.timestamp_sec != null && ` · ${liveCurrentFrame.timestamp_sec}s`}
                  </span>
                </div>

                {liveThumbs.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {liveThumbs.map((f, i) => (
                      <img
                        key={`${f.name}-${i}`}
                        src={f.annotated}
                        className={`w-14 h-14 object-cover rounded-lg border shrink-0 transition ${
                          f.name === liveCurrentFrame.name ? "border-red-500" : "border-white/10 opacity-50"
                        }`}
                        alt=""
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-base py-8 text-center">Waiting for the first frame...</div>
          )}

          {cumulativeWorkers.length > 0 && (
            <div>
              <p className="text-sm text-gray-500 mb-2">
                PPE detected so far, per tracked worker — items stay ✅ once detected.
              </p>
              <WorkerComplianceTable workers={cumulativeWorkers} cumulative />
            </div>
          )}
        </div>
      )}

      {/* Processing metadata only — detection outcome stats (workers,
          violations, compliance) live in the SummaryCards below so
          "Compliance" isn't shown twice with the same number. */}
      {meta && (
        <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <p className="text-gray-400 text-base flex items-center gap-2"><Layers size={14}/> Frames Processed</p>
            <h2 className="text-3xl font-bold mt-2">
              {meta.frames_processed} <span className="text-gray-500 text-lg font-medium">/ {meta.frames_total}</span>
            </h2>
            {meta.frames_sampled && (
              <p className="text-sm text-yellow-400 mt-1">Sampled across full video</p>
            )}
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <p className="text-gray-400 text-base flex items-center gap-2"><Clock size={14}/> Duration</p>
            <h2 className="text-3xl font-bold mt-2">{meta.duration_sec != null ? `${meta.duration_sec}s` : "—"}</h2>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <p className="text-gray-400 text-base flex items-center gap-2"><Gauge size={14}/> Processing Time</p>
            <h2 className="text-3xl font-bold mt-2">{meta.processing_time}s</h2>
          </div>
        </div>
      )}

      {summary && (
        <>
          <SummaryCards summary={summary} imagesLabel="Frames Analyzed" />
          <FrameResultViewer
            title="Detection Result"
            results={results}
            selectedImage={selectedImage}
            onSelect={setSelectedImage}
            cumulativeWorkers={cumulativeWorkers}
            onExport={() =>
              exportDetectionPdf({
                title: "Safesight — Video Compliance Report",
                summary,
                results,
                cumulativeWorkers,
                extraLines: [
                  `Video: ${videoFile?.name || ""}`,
                  `Duration: ${meta?.duration_sec != null ? meta.duration_sec + "s" : "—"}`,
                  `Frames Processed: ${meta?.frames_processed} / ${meta?.frames_total}`,
                ],
              })
            }
          />
        </>
      )}
    </div>
  );
}

function DocumentUploadPanel() {
  const [document, setDocument] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null);
  const fileInputRef = useRef(null);

  const upload = async () => {
    if (!document) return;

    const formData = new FormData();
    formData.append("file", document);

    setUploading(true);
    setStatus(null);

    try {
      const res = await axios.post(`${API_BASE}/upload-document`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        setStatus({ ok: true, ...res.data });
        setDocument(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setStatus({ ok: false, error: res.data.error });
      }
    } catch (err) {
      console.error(err);
      setStatus({ ok: false, error: err?.response?.data?.detail || "Upload failed." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 max-w-2xl">
      <h3 className="text-2xl font-semibold mb-2">Upload a Safety Manual / Document</h3>
      <p className="text-gray-400 text-base mb-6">
        Uploaded files are stored in MongoDB, chunked and embedded (MiniLM),
        indexed into FAISS, and immediately become searchable by the AI
        Assistant's RAG pipeline.
      </p>

      <label className="border-2 border-dashed border-gray-700 rounded-2xl h-40 flex flex-col justify-center items-center cursor-pointer hover:border-red-500 transition">
        <FileText size={36} className="mb-3 text-red-400" />
        <span className="text-base text-gray-300">
          {document ? document.name : "Click to select a PDF, DOCX or TXT file"}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept=".pdf,.docx,.txt"
          onChange={(e) => setDocument(e.target.files[0])}
        />
      </label>

      <button
        onClick={upload}
        disabled={!document || uploading}
        className="mt-6 w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-2xl py-3.5 font-semibold transition"
      >
        {uploading ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Uploading &amp; indexing...
          </>
        ) : (
          <>
            <UploadCloud size={18} /> Upload Document
          </>
        )}
      </button>

      {status && (
        <div
          className={`mt-6 rounded-xl p-4 text-base border ${
            status.ok
              ? "bg-green-500/10 border-green-500/30 text-green-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {status.ok ? (
            <div className="flex items-start gap-2">
              <CheckCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{status.filename} indexed successfully.</p>
                <p className="text-sm text-green-400/80 mt-1">
                  {status.document_type} &middot; {status.characters?.toLocaleString()} chars &middot;{" "}
                  {status.word_count?.toLocaleString()} words &middot; {status.processing_time}s
                </p>
                <p className="text-sm text-green-400/80">
                  Embedding: {status.embedding_model} &middot; Vector DB: {status.vector_database}
                </p>
              </div>
            </div>
          ) : (
            status.error
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminUploadCenter() {
  const [tab, setTab] = useState("detection");
  const [mode, setMode] = useState("image");
  const [sites, setSites] = useState([]);
  const [site, setSite] = useState("Construction Site A");

  useEffect(() => {
    axios
      .get(`${API_BASE}/sites`)
      .then((res) => {
        const list = res.data.sites || [];
        setSites(list);
        if (list.length > 0) setSite(list[0].name);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="text-4xl font-bold">Upload Center</h2>
        <p className="text-gray-400 mt-1">
          Run PPE detections on site images or video, or add documents to the RAG
          knowledge base.
        </p>
      </div>

      <Tabs active={tab} onChange={setTab} />

      {tab === "detection" ? (
        <>
          <ModeToggle mode={mode} onChange={setMode} />
          {mode === "image" ? (
            <ImageDetectionPanel sites={sites} site={site} onSiteChange={setSite} />
          ) : (
            <VideoDetectionPanel sites={sites} site={site} onSiteChange={setSite} />
          )}
        </>
      ) : (
        <DocumentUploadPanel />
      )}
    </div>
  );
}
