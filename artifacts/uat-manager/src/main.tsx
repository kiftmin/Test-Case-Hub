import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getAuthToken } from "./lib/auth";

// Wire up the token getter so every API call includes the Bearer token
setAuthTokenGetter(getAuthToken);

// Silence AbortErrors from React Query Strict Mode double-mount cancellations
window.addEventListener("unhandledrejection", (event) => {
  if (event.reason?.name === "AbortError") {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);