/**
 * Persistence for the AI Assistant conversation.
 *
 * The chat lived in component state, so navigating to the Dashboard and back
 * unmounted the component and threw the conversation away. It now survives
 * navigation and page reloads, and is cleared on logout.
 *
 * History is keyed per username so that logging in as someone else on a
 * shared machine never surfaces the previous person's questions — which can
 * name sites, workers and incidents.
 */

const PREFIX = "safesight_chat_history";

// Cap on stored messages. localStorage is ~5MB per origin and answers can be
// long; keeping the most recent slice means a runaway conversation can't fill
// the quota and start throwing on every write.
const MAX_STORED_MESSAGES = 200;

function keyFor(username) {
  return `${PREFIX}:${username || "anonymous"}`;
}

/**
 * Messages are stored as JSON, which turns `time` (a Date) into a string.
 * The chat renders `msg.time.toLocaleTimeString(...)`, so it has to come
 * back as a real Date or the first render after a reload throws.
 */
function reviveMessage(msg) {
  if (!msg || typeof msg !== "object") return null;
  if (typeof msg.text !== "string") return null;

  const time = msg.time ? new Date(msg.time) : new Date();

  return {
    ...msg,
    type: msg.type === "user" ? "user" : "ai",
    time: Number.isNaN(time.getTime()) ? new Date() : time,
  };
}

export function loadChatHistory(username) {
  try {
    const raw = localStorage.getItem(keyFor(username));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(reviveMessage).filter(Boolean);
  } catch (err) {
    // Corrupt or unreadable history should never block the page from
    // loading — start a fresh conversation instead.
    console.warn("Could not restore chat history:", err);
    return [];
  }
}

export function saveChatHistory(username, messages) {
  try {
    const trimmed = (messages || []).slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(keyFor(username), JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Could not save chat history:", err);
  }
}

export function clearChatHistory(username) {
  try {
    localStorage.removeItem(keyFor(username));
  } catch (err) {
    console.warn("Could not clear chat history:", err);
  }
}

/**
 * Wipes every stored conversation, not just the current user's. Used on
 * logout: the username is the only thing tying history to a person, and a
 * session that ends shouldn't leave transcripts behind on the machine.
 */
export function clearAllChatHistory() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    console.warn("Could not clear chat history:", err);
  }
}
