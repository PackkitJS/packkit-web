// Go generator adapter — wraps create-packkit-go's browser-safe entry. Its schema
// comes from the protocol (goGenerator.getSchema()), normalized to the same shape the
// JS and Python adapters produce so the UI renders all three identically.
import { generate, defaultConfig, PRESETS, PRESET_INFO, PRESET_NAMES, goGenerator } from 'create-packkit-go';

const humanize = (id) =>
  id
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

// Infer a UI control from a protocol schema option.
function toField(opt) {
  const type = opt.choices ? 'select' : typeof opt.default === 'boolean' ? 'boolean' : 'text';
  return {
    id: opt.id,
    label: humanize(opt.id),
    type,
    choices: (opt.choices || []).map((c) => ({ label: String(c), value: c })),
    default: opt.default,
    help: opt.description,
    group: 'options',
    when: undefined,
  };
}

// Which preset a target maps back to, for the copyable CLI command.
const PRESET_FOR_TARGET = { library: 'go-lib', cli: 'go-cli', worker: 'go-worker', service: 'go-service' };

export const go = {
  id: 'go',
  label: 'Go',
  language: 'go',
  npm: 'create-packkit-go',
  repoUrl: 'https://github.com/PackkitJS/create-packkit-go',
  npmUrl: 'https://www.npmjs.com/package/create-packkit-go',
  metaKeys: ['name', 'description', 'author'],

  defaultConfig: () => ({ ...defaultConfig(), name: 'my-lib', description: '', author: '' }),

  groups: () => [{ id: 'options', label: 'Options' }],

  options: () => goGenerator.getSchema().options.map(toField),

  presets: () => PRESET_NAMES.map((name) => ({ name, description: PRESET_INFO[name] || '' })),

  applyPreset(name, keep) {
    return { ...defaultConfig(), ...PRESETS[name], ...keep };
  },

  generate(config, preset) {
    const { files, summary } = generate(config, { preset });
    const stack = [
      summary.target,
      `Go ≥${config.goVersion}`,
      config.license === 'none' ? 'no license' : config.license,
    ].filter(Boolean);
    return { files, summary: { fileCount: summary.fileCount, stack } };
  },

  command(cfg) {
    const d = defaultConfig();
    const q = (v) => (/^[\w.@/:-]+$/.test(String(v)) ? String(v) : `'${String(v).replace(/'/g, "'\\''")}'`);
    const preset = PRESET_FOR_TARGET[cfg.target] || 'go-lib';
    const parts = ['npx create-packkit-go', preset, q(cfg.name || 'my-lib')];
    if (cfg.module) parts.push(`--module ${q(cfg.module)}`);
    if (cfg.description) parts.push(`--description ${q(cfg.description)}`);
    if (cfg.author) parts.push(`--author ${q(cfg.author)}`);
    if (cfg.license !== d.license) parts.push(`--license ${cfg.license}`);
    if (cfg.goVersion !== d.goVersion) parts.push(`--go ${cfg.goVersion}`);
    return parts.join(' ');
  },
};
