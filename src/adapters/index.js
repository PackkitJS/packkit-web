import { javascript } from "./javascript.js";
import { python } from "./python.js";
import { go } from "./go.js";
import { fullstack } from "./fullstack.js";

// Registered generators, in the order the language picker shows them. Adding a
// language = one browser-safe generator package + one adapter here. `fullstack` is a
// composer, not a single generator — it stitches a static frontend + a service backend.
export const adapters = [javascript, python, go, fullstack];
export const adapterById = (id) =>
  adapters.find((a) => a.id === id) || adapters[0];
