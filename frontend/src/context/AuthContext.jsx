import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { clearAllChatHistory } from "../lib/chatHistory";

const AuthContext = createContext(null);

const STORAGE_KEY = "safesight_auth";

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth);

  // Keep axios' default Authorization header in sync with the current token
  useEffect(() => {
    if (auth?.token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${auth.token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [auth]);

  const login = ({ token, username, role }) => {
    const next = { token, username, role };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAuth(next);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    // The AI Assistant transcript is kept across navigation on purpose, so
    // ending the session is the one moment it has to go — it can name sites,
    // workers and incidents, and the next person at this machine shouldn't
    // see it.
    clearAllChatHistory();
    setAuth(null);
  };

  // Auto-logout on expired/invalid sessions (401 from the API)
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error?.response?.status === 401 && auth?.token) {
          localStorage.removeItem(STORAGE_KEY);
          // Same reasoning as logout(): an expired session is still the end
          // of a session, and this path bypasses logout() entirely.
          clearAllChatHistory();
          setAuth(null);
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [auth]);

  const value = {
    user: auth,
    isAuthenticated: !!auth?.token,
    role: auth?.role || null,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
