import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

import Dashboard from "./Dashboard";
import AIAssistant from "./pages/AIAssistant";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">

        <nav className="bg-[#0b1120] border-b border-gray-800 text-white">

          <div className="max-w-7xl mx-auto flex gap-8 px-8 py-4">

            <Link
              to="/"
              className="hover:text-red-400 font-semibold"
            >
              Dashboard
            </Link>

            <Link
              to="/assistant"
              className="hover:text-red-400 font-semibold"
            >
              AI Assistant
            </Link>

          </div>

        </nav>

        <Routes>

          <Route
            path="/"
            element={<Dashboard />}
          />

          <Route
            path="/assistant"
            element={<AIAssistant />}
          />

        </Routes>

      </div>
    </BrowserRouter>
  );
}

export default App;