import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress Jazz's internal IDB "connection is closing" errors that surface as
// uncaught promise rejections during provider remount / reconnect cycles.
// These are transient — Jazz's retry logic recovers automatically.
window.addEventListener("unhandledrejection", (event) => {
  const msg = String(event.reason?.message ?? event.reason ?? "");
  if (
    msg.includes("database connection is closing") ||
    (msg.includes("InvalidStateError") && msg.includes("transaction"))
  ) {
    console.warn("[jazz-idb] Suppressed transient IDB closing error:", msg);
    event.preventDefault();
  }
});

/**
 * DEEP PURGE: Reset all session state and networking for a clean test.
 * Set `toDevLocal` to true to bypass random code generation and load the sandbox.
 */
(window as any).HARD_RESET = (toDevLocal = false) => {
  console.warn("[HARD_RESET] Initializing deep purge...");
  
  // 1. Clear Zustand persist storages
  localStorage.removeItem("vtt-session-storage");
  localStorage.removeItem("vtt-multiplayer-storage");
  
  // 2. Disconnect networking (closes WebRTC and WebSockets)
  try {
    const { netManager } = require("@/lib/net");
    netManager.disconnect();
  } catch(e) {}

  let newCode = 'DEV_LOCAL';
  if (!toDevLocal) {
    // 3. Generate a fresh session code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    newCode = '';
    for (let i = 0; i < 6; i++) {
        newCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }

  const url = new URL(window.location.href);
  url.searchParams.set("session", newCode);
  
  console.log("[HARD_RESET] Redirecting to clean session:", newCode);
  window.location.href = url.toString();
};

createRoot(document.getElementById("root")!).render(<App />);

