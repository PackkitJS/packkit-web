import { javascript } from './javascript.js';
import { python } from './python.js';
import { go } from './go.js';

// Registered generators, in the order the language picker shows them. Adding a
// language = one browser-safe generator package + one adapter here.
export const adapters = [javascript, python, go];
export const adapterById = (id) => adapters.find((a) => a.id === id) || adapters[0];
