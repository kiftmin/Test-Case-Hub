import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getAuthToken } from "./lib/auth";

// Wire up the token getter so every API call includes the Bearer token
setAuthTokenGetter(getAuthToken);

createRoot(document.getElementById("root")!).render(<App />);