import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

let deferredPrompt: any = null;

window.addEventListener("beforeinstallprompt", (e: any
  e.preventDefault();
  deferredPrompt = e;
  window.dispatchEvent(new Event("pwa-install-available"));
});

(window as any).installPWA = async () => {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === "accepted";
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
