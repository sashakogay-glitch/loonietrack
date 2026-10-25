import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const el = document.getElementById("root");
function note(text){
  var d = document.createElement("pre");
  d.style.cssText = "padding:16px;color:#900;font:12px monospace;white-space:pre-wrap";
  d.textContent = text;
  el.appendChild(d);
}
try {
  ReactDOM.createRoot(el).render(<React.StrictMode><App /></React.StrictMode>);
  setTimeout(function(){ if (el.childElementCount === 0) note("BUNDLE RAN, ROOT EMPTY after 4s"); }, 4000);
} catch (e) {
  note("MOUNT ERROR\n" + ((e && (e.stack || e.message)) || e));
}
