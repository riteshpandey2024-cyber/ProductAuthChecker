import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./styles.css";
import App from "./App.jsx";

// Measure and lay out only once the web fonts are loaded, so slide content is fitted to its real size.
const FONTS = [
  ["Space Grotesk", 600], ["Space Grotesk", 700], ["Inter", 400], ["Inter", 500], ["Inter", 600],
  ["JetBrains Mono", 400], ["JetBrains Mono", 500], ["JetBrains Mono", 600],
];
const fontsLoaded = Promise.all(FONTS.map(([family, weight]) => document.fonts.load(`${weight} 24px "${family}"`))).catch(() => {});
const giveUp = new Promise((resolve) => { setTimeout(resolve, 2500); });
Promise.race([fontsLoaded, giveUp]).then(() => {
  createRoot(document.getElementById("root")).render(<App />);
});
