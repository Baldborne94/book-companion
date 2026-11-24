import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Guasto from "./components/Guasto.jsx";
import "./index.css";
import { ascoltaErrori } from "./lib/registro.js";
import { codiceArrivato } from "./lib/tempi.js";

codiceArrivato();

// i guasti che nessuno raccoglie finiscono nel registro (vedi `lib/registro.js`)
ascoltaErrori(window);

// L'anello grosso: se qualcosa esplode fuori dal libro, il lettore vede
// una candela spenta e due tasti, non uno schermo bianco.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Guasto>
      <App />
    </Guasto>
  </React.StrictMode>
);
