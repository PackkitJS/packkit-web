// Python generator adapter — wraps create-packkit-py's browser-safe entry. Its
// schema comes from the protocol (pythonGenerator.getSchema()), normalized to the
// same shape the JS adapter produces so the UI renders both identically.
import { generate, defaultConfig, PRESETS, PRESET_INFO, PRESET_NAMES, pythonGenerator } from 'create-packkit-py';

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

export const python = {
  id: 'python',
  label: 'Python',
  language: 'python',
  npm: 'create-packkit-py',
  repoUrl: 'https://github.com/PackkitLabs/create-packkit-py',
  npmUrl: 'https://www.npmjs.com/package/create-packkit-py',
  metaKeys: ['name', 'description', 'author'],

  defaultConfig: () => ({ ...defaultConfig(), name: 'my-lib', description: '', author: '' }),

  groups: () => [{ id: 'options', label: 'Options' }],

  options: () => pythonGenerator.getSchema().options.map(toField),

  presets: () => PRESET_NAMES.map((name) => ({ name, description: PRESET_INFO[name] || '' })),

  applyPreset(name, keep) {
    return { ...defaultConfig(), ...PRESETS[name], ...keep };
  },

  generate(config, preset) {
    const { files, summary } = generate(config, { preset });
    const stack = [
      summary.target,
      `Python ≥${config.pythonVersion}`,
      config.license === 'none' ? 'no license' : config.license,
      config.typecheck ? 'mypy' : null,
    ].filter(Boolean);
    return { files, summary: { fileCount: summary.fileCount, stack } };
  },

  command(cfg) {
    const d = defaultConfig();
    const q = (v) => (/^[\w.@/:-]+$/.test(String(v)) ? String(v) : `'${String(v).replace(/'/g, "'\\''")}'`);
    const preset = cfg.target === 'cli' ? 'py-cli' : 'py-lib';
    const parts = ['npx create-packkit-py', preset, q(cfg.name || 'my-lib')];
    if (cfg.description) parts.push(`--description ${q(cfg.description)}`);
    if (cfg.author) parts.push(`--author ${q(cfg.author)}`);
    if (cfg.license !== d.license) parts.push(`--license ${cfg.license}`);
    if (cfg.pythonVersion !== d.pythonVersion) parts.push(`--python ${cfg.pythonVersion}`);
    if (cfg.typecheck === false) parts.push('--no-typecheck');
    return parts.join(' ');
  },
};
