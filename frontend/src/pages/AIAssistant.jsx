import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  Bot,
  User,
  Send,
  Loader2,
  MessageSquare,
  Copy,
  Upload,
  FileText,
  CheckCircle,
} from "lucide-react";

export default function AIAssistant() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      type: "ai",
      text: "Hello! I'm the SAFESIGHT AI Assistant. Ask me anything about PPE violations, safety reports, or construction site safety.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [document, setDocument] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedFileInfo, setUploadedFileInfo] = useState(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = async () => {
    if (!question.trim()) return;

    const userMessage = {
      type: "user",
      text: question,
    };

    setMessages((prev) => [...prev, userMessage]);

    const currentQuestion = question;

    setQuestion("");
    setLoading(true);

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/chat",
        {
          question: currentQuestion,
        }
      );

      // Keep only inspection report sources (sources that have an image)
      const inspectionSources = response.data.sources?.filter(
        source => source.image
      ) || [];

      setSources(inspectionSources);

      const aiMessage = {
        type: "ai",
        text: response.data.answer,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          type: "ai",
          text: "Unable to connect to the AI Assistant.",
        },
      ]);
    }

    setLoading(false);
  };

  const handleClear = () => {
    setMessages([
      {
        type: "ai",
        text: "Hello! I'm the SAFESIGHT AI Assistant. Ask me anything about PPE reports.",
      },
    ]);
    setSources([]);
  };

  const closeReports = () => {
    setSources([]);
  };

  const uploadDocument = async () => {
    if (!document) return;

    const formData = new FormData();
    formData.append("file", document);

    setUploading(true);
    setUploadStatus("");

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/upload-document",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success) {
        setUploadStatus("Document uploaded successfully!");
        setUploadedFileInfo({
          filename: response.data.filename,
          document_type: response.data.document_type,
          characters: response.data.characters,
          url: response.data.url,
        });
        
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setDocument(null);
      } else {
        setUploadStatus(`Upload failed: ${response.data.error}`);
        setUploadedFileInfo(null);
      }
    } catch (error) {
      console.error(error);
      setUploadStatus("Upload failed. Please try again.");
      setUploadedFileInfo(null);
    }

    setUploading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-center p-6">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-cyan-600 text-white px-8 py-5 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">
              SAFESIGHT AI Assistant
            </h1>
            <p className="text-sm mt-1 opacity-90">
              Construction Safety RAG Chatbot
            </p>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare />
            <span>Powered by Llama 3.1 + FAISS</span>
          </div>
        </div>

        {/* Knowledge Base Section */}
        <div className="bg-white border-b p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="text-blue-600" />
            Knowledge Base
          </h2>

          <div className="flex flex-wrap gap-3 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => setDocument(e.target.files[0])}
              className="flex-1 min-w-[200px] text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />

            <button
              onClick={uploadDocument}
              disabled={!document || uploading}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Upload
                </>
              )}
            </button>
          </div>

          <p className="text-sm text-gray-500 mt-2">
            Supported: <span className="font-medium">PDF • DOCX • TXT</span>
          </p>

          {uploadStatus && (
            <div className="mt-3">
              {uploadStatus.includes("successfully") ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-green-600 mt-1" size={20} />
                    <div>
                      <p className="text-green-700 font-medium">
                        {uploadedFileInfo?.filename} uploaded successfully.
                      </p>
                      {uploadedFileInfo && (
                        <div className="mt-2 text-sm text-gray-600 space-y-1">
                          <p>
                            <span className="font-semibold">Type:</span>{" "}
                            {uploadedFileInfo.document_type}
                          </p>
                          <p>
                            <span className="font-semibold">Characters:</span>{" "}
                            {uploadedFileInfo.characters.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-400">
                            Knowledge Base Updated ✓
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700">{uploadStatus}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="h-[500px] overflow-y-auto p-6 bg-gray-50">
          {/* Messages */}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex mb-6 ${
                msg.type === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`flex gap-3 max-w-4xl ${
                  msg.type === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md ${
                    msg.type === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-green-600 text-white"
                  }`}
                >
                  {msg.type === "user" ? (
                    <User size={20} />
                  ) : (
                    <Bot size={20} />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`rounded-2xl px-5 py-4 shadow-lg ${
                    msg.type === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white border"
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap leading-7">
                    {msg.text}
                  </div>

                  <div
                    className={`text-xs mt-3 ${
                      msg.type === "user"
                        ? "text-blue-100"
                        : "text-gray-400"
                    }`}
                  >
                    {new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>

                  {msg.type === "ai" && (
                    <button
                      onClick={() => navigator.clipboard.writeText(msg.text)}
                      className="mt-3 text-sm text-blue-600 flex items-center gap-2 hover:text-blue-800 transition"
                    >
                      <Copy size={15} />
                      Copy
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Loading Animation */}
          {loading && (
            <div className="flex gap-3 mb-6">
              <div className="w-11 h-11 rounded-full bg-green-600 flex justify-center items-center text-white">
                <Bot size={20} />
              </div>
              <div className="bg-white rounded-2xl px-5 py-4 shadow-lg border">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-300"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Retrieved Reports Panel - Only show for inspection reports */}
        {sources.length > 0 && (
          <div className="bg-white border-t p-6">
            {/* Header with Close Button */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Retrieved Reports</h2>
              <button
                onClick={closeReports}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {sources.map((report, index) => (
                <div
                  key={index}
                  className="border rounded-xl p-4 shadow hover:shadow-lg transition"
                >
                  <h3 className="font-semibold text-blue-600">
                    {report.image}
                  </h3>
                  <p className="text-sm mt-2">
                    <b>Status:</b> {report.status}
                  </p>
                  <p className="text-sm">
                    <b>Missing PPE:</b>{" "}
                    {report.missing?.length
                      ? report.missing.join(", ")
                      : "None"}
                  </p>
                  {report.site_name && (
                    <p className="text-sm">
                      <b>Site:</b> {report.site_name}
                    </p>
                  )}
                  {report.date && (
                    <p className="text-xs text-gray-500 mt-3">{report.date}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Section */}
        <div className="border-t bg-white p-5">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Ask about PPE violations, reports, or safety..."
              className="flex-1 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
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
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-xl flex items-center gap-2 disabled:bg-gray-400 transition"
            >
              <Send size={18} />
              Send
            </button>

            <button
              onClick={handleClear}
              className="bg-gray-600 hover:bg-gray-700 text-white px-5 rounded-xl transition"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}