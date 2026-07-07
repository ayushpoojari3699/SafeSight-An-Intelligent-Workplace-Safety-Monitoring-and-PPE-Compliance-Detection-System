import { useState } from "react";
import axios from "axios";

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [annotatedImage, setAnnotatedImage] = useState(null);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return alert("Upload an image first");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);

      const res = await axios.post(
        "http://127.0.0.1:8000/detect",
        formData
      );

      setViolations(res.data.violations);
      setAnnotatedImage(res.data.annotated_image);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const groupedViolations = violations.reduce((acc, violation) => {
    const parts = violation.split(" missing ");
    const worker = parts[0];
    const item = parts[1];

    if (!acc[worker]) acc[worker] = [];
    acc[worker].push(item);

    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#050816] text-white">
      
      {/* Navbar */}
      <nav className="w-full px-10 py-6 flex justify-between items-center border-b border-gray-800 backdrop-blur-lg">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-500">
            PPE Sentinel
          </h1>
          <p className="text-gray-400 text-sm">
            AI-Based Construction Safety Monitoring
          </p>
        </div>

        <div className="bg-green-500/20 border border-green-500 px-4 py-2 rounded-full text-green-400 text-sm">
          System Active
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-8 py-12">

        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold mb-4">
            PPE Violation Detection
          </h2>
          <p className="text-gray-400 text-lg">
            Upload construction site images and detect safety compliance instantly.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-8">

          {/* Upload */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
            <h3 className="text-2xl font-semibold mb-6">Upload Image</h3>

            <label className="w-full h-72 border-2 border-dashed border-gray-700 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-red-500 transition-all duration-300">
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files[0]);
                  setPreview(URL.createObjectURL(e.target.files[0]));
                  setAnnotatedImage(null);
                }}
              />

              <div className="text-center">
                <p className="text-xl font-medium mb-2">
                  Click to Upload
                </p>
                <p className="text-gray-500">
                  PNG, JPG, JPEG supported
                </p>
              </div>
            </label>

            <button
              onClick={handleUpload}
              className="w-full mt-6 bg-red-500 hover:bg-red-600 py-4 rounded-2xl text-lg font-semibold transition-all"
            >
              {loading ? "Processing..." : "Run Detection"}
            </button>
          </div>

          {/* Original Image */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
            <h3 className="text-2xl font-semibold mb-6">Original Image</h3>

            {preview ? (
              <img
                src={preview}
                alt="preview"
                className="w-full h-72 object-cover rounded-2xl"
              />
            ) : (
              <div className="w-full h-72 rounded-2xl bg-gray-900 flex items-center justify-center text-gray-500">
                No image selected
              </div>
            )}
          </div>

          {/* Detection Output */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
            <h3 className="text-2xl font-semibold mb-6">Detection Output</h3>

            {annotatedImage ? (
              <img
                src={annotatedImage}
                alt="annotated"
                className="w-full h-72 object-cover rounded-2xl"
              />
            ) : (
              <div className="w-full h-72 rounded-2xl bg-gray-900 flex items-center justify-center text-gray-500">
                Detection output will appear here
              </div>
            )}
          </div>
        </div>

        {/* Violations */}
        <div className="mt-12 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
          <h3 className="text-2xl font-semibold mb-6">
            Violation Report
          </h3>

          {violations.length > 0 ? (
            <div className="space-y-5">
              {Object.entries(groupedViolations).map(
                ([worker, items], index) => (
                  <div
                    key={index}
                    className="bg-red-500/10 border border-red-500 rounded-2xl p-5"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-semibold text-white">
                        {worker}
                      </h4>

                      <span className="text-red-400 font-semibold">
                        ALERT
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {items.map((item, i) => (
                        <span
                          key={i}
                          className="px-4 py-2 bg-red-900 text-red-200 rounded-full text-sm"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="bg-green-500/10 border border-green-500 rounded-2xl p-5 text-green-400">
              No violations detected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;