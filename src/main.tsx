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

createRoot(document.getElementById("root")!).render(<App />);

