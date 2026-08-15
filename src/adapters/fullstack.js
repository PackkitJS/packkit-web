// Fullstack composition adapter — not a single generator, but a *composer*. It runs a
// static frontend generator + a service backend generator (any languages) and stitches
// them with @packkit/core's language-neutral composeFullstack. All in the browser.
import { composeFullstack } from "@packkit/core";
import {
  generate as jsGenerate,
  PRESETS as JS_PRESETS,
} from "create-packkit/core";
import { pythonGenerator } from "create-packkit-py";
import { goGenerator } from "create-packkit-go";

// Frontends are JS SPAs (Vite → dist). The browser-safe JS core doesn't expose a
// deploymentContract, so we attach the uniform static one every Vite SPA satisfies.
const FRONTENDS = {
  "react-app": "React (Vite)",
  "vue-app": "Vue (Vite)",
  "svelte-app": "Svelte (Vite)",
};

const BACKENDS = {
  "py-service": "Python — FastAPI",
  "go-service": "Go — net/http",
  "node-service": "Node — Hono",
};

const COMBOS = {
  "react-fastapi": { frontend: "react-app", backend: "py-service" },
  "react-go": { frontend: "react-app", backend: "go-service" },
  "react-node": { frontend: "react-app", backend: "node-service" },
  "vue-fastapi": { frontend: "vue-app", backend: "py-service" },
  "svelte-go": { frontend: "svelte-app", backend: "go-service" },
};

const DEFAULT = () => ({
  name: "my-app",
  frontend: "react-app",
  backend: "py-service",
});

function frontendProject(preset, name) {
  const { files } = jsGenerate({ ...(JS_PRESETS[preset] || {}), name });
  return {
    config: { name },
    files,
    diagnostics: [],
    metadata: { generatorId: "javascript", protocolVersion: 1 },
    deploymentContract: {
      type: "static",
      buildCommand: "npm run build",
      outputDirectory: "dist",
    },
  };
}

function backendProject(preset, name) {
  if (preset === "py-service")
    return pythonGenerator.createProject({ preset, name });
  if (preset === "go-service")
    return goGenerator.createProject({ preset, name });
  // node-service — JS core has no contract browser-side; attach the known one.
  const { files } = jsGenerate({ ...(JS_PRESETS["node-service"] || {}), name });
  return {
    config: { name },
    files,
    diagnostics: [],
    metadata: { generatorId: "javascript", protocolVersion: 1 },
    deploymentContract: {
      type: "service",
      runtime: "node",
      startCommand: "node dist/index.js",
      defaultPort: 3000,
      portEnvironmentVariable: "PORT",
      healthCheckPath: "/health",
      requiredEnvironmentVariables: [],
      optionalEnvironmentVariables: ["PORT"],
    },
  };
}

export const fullstack = {
  id: "fullstack",
  label: "Fullstack",
  language: "fullstack",
  npm: "@packkit/core",
  repoUrl: "https://github.com/PackkitLabs/packkit-core",
  npmUrl: "https://www.npmjs.com/package/@packkit/core",
  metaKeys: ["name"],

  defaultConfig: DEFAULT,
  groups: () => [{ id: "stack", label: "Stack" }],

  options: () => [
    {
      id: "name",
      label: "App name",
      type: "text",
      default: "my-app",
      help: "Repo name (and the download filename).",
      group: "stack",
    },
    {
      id: "frontend",
      label: "Frontend",
      type: "select",
      group: "stack",
      choices: Object.entries(FRONTENDS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      id: "backend",
      label: "Backend",
      type: "select",
      group: "stack",
      choices: Object.entries(BACKENDS).map(([value, label]) => ({
        value,
        label,
      })),
    },
  ],

  presets: () =>
    Object.entries(COMBOS).map(([name, { frontend, backend }]) => ({
      name,
      description: `${FRONTENDS[frontend]} + ${BACKENDS[backend]}`,
    })),

  applyPreset(name, keep) {
    return { ...DEFAULT(), ...COMBOS[name], ...keep };
  },

  generate(config) {
    const frontend = frontendProject(config.frontend, "web");
    const backend = backendProject(config.backend, "api");
    const { project } = composeFullstack({
      frontend,
      backend,
      options: { name: config.name },
    });
    return {
      files: project.files,
      summary: {
        fileCount: Object.keys(project.files).length,
        stack: [
          FRONTENDS[config.frontend],
          BACKENDS[config.backend],
          "fullstack",
        ],
      },
    };
  },

  command(config) {
    return [
      `# Fullstack: ${FRONTENDS[config.frontend]} + ${BACKENDS[config.backend]}`,
      `# Composed in your browser — download the zip below.`,
      `# Agents can do the same via the MCP 'compose_fullstack' tool.`,
    ].join("\n");
  },
};
