import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  const [message, setMessage] = useState("Connecting to API…");
  useEffect(() => { fetch("/api/health").then(r => r.json()).then(d => setMessage(d.message)).catch(() => setMessage("API unavailable")); }, []);
  return <main><h1>Applywise</h1><p>Your focused job-application workspace.</p><p className="api-status">{message}</p></main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

