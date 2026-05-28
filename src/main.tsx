import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import App from "./App";
import "./index.css";

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.posthog.com",
    autocapture: true,
    capture_pageview: true,
    session_recording: { maskAllInputs: true },
  });
}

createRoot(document.getElementById("root")!).render(<App />);
