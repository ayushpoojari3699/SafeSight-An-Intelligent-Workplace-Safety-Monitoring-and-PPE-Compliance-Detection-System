import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  Send,
  Copy,
  FileText,
  Sparkles,
  Database,
  FileDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";
import { API_BASE, downloadInspectionReport } from "../lib/api";
import { loadChatHistory, saveChatHistory } from "../lib/chatHistory";
import { useAuth } from "../context/AuthContext";

const EMPTY_STATE_PROMPTS = [
  "Give me the overall compliance rate",
  "Who was not wearing a helmet?",
  "Show the overall safety summary",
  "Give me a summary of the PPE manual",
  "How can these violations be prevented?",
  "Workers missing gloves",
];

// Quick-prompt chips — each is worded to reliably hit a specific intent in
// the LangGraph router (analytics / summary / worker lookup / prevention),
// so they're a fast way to explore what the assistant can do.
const QUICK_PROMPTS = [
  { label: "Compliance analytics", text: "Show me the overall compliance analytics" },
  { label: "Today's summary", text: "Give me today's inspection summary" },
  { label: "Who's missing PPE?", text: "Which workers are missing PPE right now?" },
  { label: "Reduce violations", text: "How can we prevent and reduce PPE violations?" },
];

/**
 * Lightweight markdown renderer for the AI's answers. The backend prompts
 * ask the LLM to reply with "## Headings", "**bold**" and "- bullet" markdown,
 * but the UI previously just dumped that raw text with whitespace-pre-wrap —
 * so every response showed literal "##" and "**" characters instead of
 * looking formatted. No markdown package is installed, so this parses the
 * small subset the backend actually produces.
 */
function FormattedMessage({ text }) {
  const lines = text.split("\n");
  const blocks = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      blocks.push({ type: "list", items: listBuffer });
      listBuffer = [];
    }
  };

  lines.forEach((rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      blocks.push({ type: "h2", text: trimmed.slice(3) });
    } else if (trimmed.startsWith("### ")) {
      flushList();
      blocks.push({ type: "h3", text: trimmed.slice(4) });
    } else if (trimmed.startsWith("# ")) {
      flushList();
      blocks.push({ type: "h2", text: trimmed.slice(2) });
    } else if (/^[-•]\s+/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^[-•]\s+/, ""));
    } else {
      flushList();
      blocks.push({ type: "p", text: trimmed });
    }
  });
  flushList();

  const renderInline = (str, key) => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={key}>
        {parts.map((part, i) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={i} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.type === "h2") {
          return (
            <h3 key={i} className="text-lg font-bold text-white mt-4 first:mt-0">
              {renderInline(block.text, `${i}-t`)}
            </h3>
          );
        }
        if (block.type === "h3") {
          return (
            <h4 key={i} className="text-base font-semibold text-gray-200 mt-3">
              {renderInline(block.text, `${i}-t`)}
            </h4>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="text-gray-200 leading-relaxed">
                  {renderInline(item, `${i}-${j}`)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-gray-200 leading-relaxed">
            {renderInline(block.text, `${i}-t`)}
          </p>
        );
      })}
    </div>
  );
}

export default function AIAssistant() {
  const { user } = useAuth();
  const username = user?.username;

  const [question, setQuestion] = useState("");
  // Restored from localStorage on mount, so leaving for the Dashboard and
  // coming back doesn't wipe the conversation. The lazy initialiser matters:
  // starting empty and filling in via an effect would flash the empty-state
  // welcome screen before the history appeared.
  const [messages, setMessages] = useState(() => loadChatHistory(username));
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState([]);

  // Manual selection state
  const [manuals, setManuals] = useState([]);
  const [selectedManuals, setSelectedManuals] = useState([]);
  const [searchScope, setSearchScope] = useState("all");

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // State for selected report
  const [selectedReport, setSelectedReport] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-focus the input on load so people can start typing immediately.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // What's actually answering questions, for the sidebar footer. Falls back
  // to a neutral label if /health can't be reached, rather than asserting a
  // model name the backend may not be running.
  const [stack, setStack] = useState({ model: "Local model" });
  useEffect(() => {
    axios
      .get(`${API_BASE}/health`)
      .then((res) => {
        if (res.data?.model) setStack({ model: res.data.model });
      })
      .catch(() => {});
  }, []);

  // Fetch manuals on component mount
  useEffect(() => {
    axios
      .get(`${API_BASE}/manuals`)
      .then((res) => {
        if (res.data.success) {
          setManuals(res.data.manuals);
        }
      })
      .catch((err) => {
        console.error("Error fetching manuals:", err);
      });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  // Persist after every change — including "Clear conversation", which
  // should stick rather than reappear on the next visit.
  //
  // The username guard is load-bearing: on logout, auth flips to null before
  // this component unmounts, so `username` changes to undefined and re-fires
  // this effect. Without the guard it would write the transcript back out
  // under the "anonymous" key milliseconds after logout wiped it — leaving
  // exactly the history the logout was supposed to clear.
  useEffect(() => {
    if (!username) return;
    saveChatHistory(username, messages);
  }, [messages, username]);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;

    const userMessage = {
      type: "user",
      text,
      time: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/chat`, {
        question: text,
        search_scope: searchScope,
        selected_manuals: selectedManuals,
      });

      // The backend catches its own errors and still replies with HTTP 200
      // (so axios won't throw), just with success:false and no "answer" —
      // handle that explicitly instead of rendering "undefined".
      if (!response.data.success) {
        setMessages((prev) => [
          ...prev,
          {
            type: "ai",
            text: response.data.error || "Something went wrong generating a response.",
            time: new Date(),
          },
        ]);
        setLoading(false);
        return;
      }

      const inspectionSources =
        response.data.sources?.filter((source) => source.image) || [];

      setSources(inspectionSources);

      setMessages((prev) => [
        ...prev,
        { type: "ai", text: response.data.answer, time: new Date() },
      ]);
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          text: "Unable to connect to the AI Assistant.",
          time: new Date(),
        },
      ]);
    }

    setLoading(false);
    inputRef.current?.focus();
  };

  const handleSend = () => sendMessage(question);

  const handleClear = () => {
    setMessages([]);
    setSources([]);
  };

  const closeReports = () => {
    setSources([]);
  };

  const handleDownloadReport = async (inspectionId) => {
    setDownloadingId(inspectionId);
    try {
      await downloadInspectionReport(inspectionId);
    } catch (err) {
      console.error(err);
      alert("Could not download the PDF report.");
    } finally {
      setDownloadingId(null);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="h-[calc(100vh-64px)] flex text-white">
      {/* Sidebar */}
      <div
        className={`relative z-10 border-r border-white/10 bg-white/[0.03] overflow-hidden transition-all duration-300 flex-shrink-0 ${
          sidebarOpen ? "w-[280px]" : "w-[56px]"
        }`}
      >
        <div className="p-4 flex justify-between items-center border-b border-white/10">
          {sidebarOpen && (
            <h2 className="font-bold text-sm flex items-center gap-2">
              <Database size={15} className="text-red-400" />
              Knowledge Base
            </h2>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-500 hover:text-white transition"
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {sidebarOpen && (
          <>
            {/* Manual Selection Checkboxes */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-xs uppercase tracking-wide text-gray-500">Manuals</h3>
                <span className="text-xs text-gray-500">
                  {manuals.length} indexed
                </span>
              </div>

              {manuals.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No documents indexed yet. Ask an administrator to upload
                  safety manuals from the Upload Center.
                </p>
              ) : (
                <div className="space-y-1 max-h-[260px] overflow-y-auto">
                  {manuals.map((manual) => (
                    <label
                      key={manual}
                      className="flex items-center gap-2.5 rounded-lg p-2 cursor-pointer transition hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={selectedManuals.includes(manual)}
                        onChange={() => {
                          if (selectedManuals.includes(manual)) {
                            setSelectedManuals(
                              selectedManuals.filter((m) => m !== manual)
                            );
                          } else {
                            setSelectedManuals([...selectedManuals, manual]);
                          }
                        }}
                        className="sr-only peer"
                      />
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition ${
                          selectedManuals.includes(manual)
                            ? "bg-red-500 border-red-500"
                            : "border-gray-600 bg-transparent peer-hover:border-gray-400"
                        }`}
                      >
                        {selectedManuals.includes(manual) && (
                          <Check size={11} strokeWidth={3} className="text-white" />
                        )}
                      </span>
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={14} className="text-gray-500 flex-shrink-0" />
                        <span className="truncate text-sm text-gray-300">{manual}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Search Scope Radio Buttons */}
            <div className="px-4 pb-3">
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide font-semibold text-gray-500">Search Scope</span>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    value="all"
                    checked={searchScope === "all"}
                    onChange={() => setSearchScope("all")}
                    className="w-3.5 h-3.5 accent-red-500"
                  />
                  All Manuals
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    value="selected"
                    checked={searchScope === "selected"}
                    onChange={() => setSearchScope("selected")}
                    className="w-3.5 h-3.5 accent-red-500"
                  />
                  Selected Manuals
                  {searchScope === "selected" && selectedManuals.length > 0 && (
                    <span className="text-xs text-red-400 ml-1">
                      ({selectedManuals.length})
                    </span>
                  )}
                </label>
                {searchScope === "selected" && selectedManuals.length === 0 && (
                  <span className="text-xs text-amber-400">
                    No manuals selected
                  </span>
                )}
              </div>
            </div>

            {/* Sidebar Footer — the model name comes from /health rather
                than being written in here, so it can't keep claiming
                Llama 3.1 after the backend has been pointed elsewhere. */}
            <div className="mt-6 border-t border-white/10 pt-4 px-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {stack.model} &middot; FAISS &middot; MiniLM
              </div>
            </div>
          </>
        )}
      </div>

      {/* Chat Wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Chat Area — centered, constrained-width column (like ChatGPT/Claude)
            instead of full-bleed message bubbles, so it reads as a focused
            writing/reading surface rather than a dashboard widget. */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[760px] mx-auto px-6 py-10 min-h-full flex flex-col justify-end">
            {/* Empty State */}
            {isEmpty && !loading && (
              <div className="my-auto animate-fadeIn">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-red-500/15 text-red-400 rounded-xl p-2.5">
                    <Sparkles size={22} />
                  </div>
                  <h2 className="font-bold text-2xl">Welcome to Safesight AI</h2>
                </div>
                <p className="text-gray-400 mb-6">
                  Ask about inspection reports, workers, PPE manuals and safety compliance.
                </p>
                <div className="flex flex-wrap gap-2">
                  {EMPTY_STATE_PROMPTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuestion(q)}
                      className="text-sm px-4 py-2 rounded-full border border-white/10 bg-white/[0.02] hover:bg-red-500/10 hover:border-red-500/30 hover:text-white text-gray-300 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, index) => (
              <div key={index} className={`mb-8 animate-fadeIn group ${msg.type === "user" ? "flex justify-end" : ""}`}>
                {msg.type === "user" ? (
                  <div className="max-w-[80%] rounded-2xl bg-white/[0.06] border border-white/10 px-5 py-3">
                    <div className="whitespace-pre-wrap text-[15px] text-gray-100">{msg.text}</div>
                    <div className="text-[11px] text-gray-500 mt-1.5 text-right">
                      {msg.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-500 mb-1.5">Safesight AI</div>
                      <FormattedMessage text={msg.text} />
                      <div className="flex items-center gap-4 mt-3 h-4 opacity-0 group-hover:opacity-100 transition">
                        <span className="text-[11px] text-gray-600">
                          {msg.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <button
                          onClick={() => navigator.clipboard.writeText(msg.text)}
                          className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition"
                        >
                          <Copy size={12} />
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator — a simple typing dot, not a dashboard-style
                progress card, to stay consistent with the minimal chat feel. */}
            {loading && (
              <div className="mb-8 flex gap-3 animate-fadeIn">
                <div className="w-7 h-7 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck size={14} />
                </div>
                <div className="flex items-center gap-1.5 pt-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Report Popup */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-[#111827] border border-gray-800 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">AI Inspection Report</h2>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="whitespace-pre-wrap text-gray-300 text-sm leading-relaxed">
                {selectedReport.inspection_report || "AI report not generated yet."}
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="mt-6 bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Retrieved Reports */}
        {sources.length > 0 && (
          <div className="relative z-10 bg-white/[0.03] border-t border-white/10 p-6 max-h-[40vh] overflow-y-auto flex-shrink-0">
            <div className="max-w-[900px] mx-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Retrieved Reports</h2>
                <button
                  onClick={closeReports}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5"
                >
                  <X size={13} /> Close
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-4 max-h-[32vh] overflow-y-auto pr-2">
                {sources.map((report, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-white/20 transition"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-bold text-red-400 text-base truncate pr-2">{report.image}</h3>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                          report.status === "SAFE"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {report.status}
                      </span>
                    </div>

                    {report.compliance_rate != null && (
                      <p className="text-sm text-gray-300">
                        <b className="text-gray-400 font-medium">Compliance:</b> {report.compliance_rate}%
                      </p>
                    )}

                    <div className="mt-2">
                      <b className="text-gray-400 font-medium text-sm">Risk Level:</b>
                      <span
                        className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                          report.risk_level === "HIGH"
                            ? "bg-red-500/20 text-red-400"
                            : report.risk_level === "MEDIUM"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : report.risk_level === "LOW"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-green-500/20 text-green-400"
                        }`}
                      >
                        {report.risk_level || "Unknown"}
                      </span>
                    </div>

                    {report.site_name && (
                      <p className="text-sm text-gray-300 mt-2">
                        <b className="text-gray-400 font-medium">Site:</b> {report.site_name}
                      </p>
                    )}

                    {report.total_workers != null && (
                      <p className="text-sm text-gray-300">
                        <b className="text-gray-400 font-medium">Total Workers:</b> {report.total_workers}
                      </p>
                    )}

                    {report.date && (
                      <p className="text-sm text-gray-300">
                        <b className="text-gray-400 font-medium">Date:</b> {report.date}
                      </p>
                    )}

                    <p className="text-sm text-gray-300 mt-2">
                      <b className="text-gray-400 font-medium">Missing PPE:</b>{" "}
                      {report.missing?.length ? report.missing.join(", ") : "None"}
                    </p>

                    {report.recommendations?.length > 0 && (
                      <div className="mt-3">
                        <b className="text-gray-400 font-medium text-sm">Recommendations</b>
                        <ul className="list-disc ml-5 mt-1 text-sm text-gray-300 space-y-0.5">
                          {report.recommendations.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 space-y-2">
                      {report.inspection_report && (
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg py-2 text-sm transition"
                        >
                          View AI Report
                        </button>
                      )}

                      {report.inspection_id && (
                        <button
                          onClick={() => handleDownloadReport(report.inspection_id)}
                          disabled={downloadingId === report.inspection_id}
                          className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-lg py-2 text-sm transition"
                        >
                          {downloadingId === report.inspection_id ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Preparing PDF...
                            </>
                          ) : (
                            <>
                              <FileDown size={14} />
                              Download PDF
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Sticky Input Section — same centered column width as the
            conversation, per ChatGPT/Claude convention, instead of
            stretching edge-to-edge. */}
        <div className="relative z-10 border-t border-white/10 bg-[#08090d]/90 backdrop-blur">
          <div className="max-w-[760px] mx-auto px-6 py-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => sendMessage(q.text)}
                  disabled={loading}
                  className="text-xs font-medium px-3 py-1.5 rounded-full border border-white/10 text-gray-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-300 disabled:opacity-50 transition"
                >
                  {q.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask about reports, PPE manual, workers, compliance..."
                className="flex-1 bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-3.5 text-[15px] text-white placeholder:text-gray-500 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20 transition"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSend();
                  }
                }}
              />

              <button
                onClick={handleSend}
                disabled={loading}
                className="bg-red-500 hover:bg-red-600 text-white w-12 rounded-2xl flex items-center justify-center disabled:opacity-50 transition shadow-lg shadow-red-500/20 hover:shadow-red-500/30 shrink-0"
                aria-label="Send"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>

            <div className="flex justify-between items-center mt-2.5 px-1">
              <span className="text-xs text-gray-600">
                Safesight AI can make mistakes — verify important compliance decisions.
              </span>
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  className="text-xs text-gray-500 hover:text-white transition"
                >
                  Clear conversation
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
