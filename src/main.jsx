import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Guasto from "./components/Guasto.jsx";
import "./index.css";

// L'anello grosso: se qualcosa esplode fuori dal libro, il lettore vede
// una candela spenta e due tasti, non uno schermo bianco.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Guasto>
      <App />
    </Guasto>
  </React.StrictMode>
);
