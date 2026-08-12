// JavaScript / TypeScript generator adapter — wraps create-packkit's browser-safe
// core and normalizes its schema (OPTIONS/GROUPS) to the shape the UI renders.
import {
  generate,
  OPTIONS,
  GROUPS,
  OPTION_HELP,
  defaultConfig,
  PRESETS,
  PRESET_INFO,
} from 'create-packkit/core';

// Options that only matter to the CLI (disk/git) — never shown in the browser form.
const HIDDEN = new Set(['gitInit', 'install']);

export const javascript = {
  id: 'javascript',
  label: 'JavaScript / TypeScript',
  language: 'javascript',
  npm: 'create-packkit',
  repoUrl: 'https://github.com/PackkitJS/create-packkit',
  npmUrl: 'https://www.npmjs.com/package/create-packkit',
  metaKeys: ['name', 'description', 'author'],

  defaultConfig: () => ({ ...defaultConfig(), name: 'my-package', description: '', author: '' }),

  groups: () => GROUPS,

  options() {
    return Object.entries(OPTIONS)
      .filter(([id]) => !HIDDEN.has(id))
      .map(([id, o]) => ({
        id,
        label: o.label || id,
        type: o.type,
        choices: o.choices || [],
        default: o.default,
        help: OPTION_HELP[id],
        group: o.group,
        when: o.when,
      }));
  },

  presets: () => Object.keys(PRESETS).map((name) => ({ name, description: PRESET_INFO[name] || '' })),

  applyPreset(name, keep) {
    return { ...defaultConfig(), ...PRESETS[name], ...keep };
  },

  generate(config) {
    const { files, summary } = generate(config);
    return { files, summary: { fileCount: summary.fileCount, stack: summary.stack || [] } };
  },

  // Prefill from an uploaded package.json (JS only).
  importPackageJson(pj, config) {
    if (pj.name) config.name = String(pj.name);
    if (pj.description) config.description = String(pj.description);
    if (pj.author) config.author = typeof pj.author === 'string' ? pj.author : pj.author.name || '';
    if (pj.type === 'module') config.moduleFormat = 'esm';
    else if (pj.type === 'commonjs') config.moduleFormat = 'cjs';
    if (pj.bin && !config.target.includes('cli')) config.target = [...new Set([...config.target, 'cli'])];
  },

  command(cfg) {
    const d = defaultConfig();
    const q = (v) => (/^[\w.@/:-]+$/.test(String(v)) ? String(v) : `'${String(v).replace(/'/g, "'\\''")}'`);
    const parts = ['npx create-packkit', q(cfg.name || 'my-package')];
    const diff = (k) => JSON.stringify(cfg[k]) !== JSON.stringify(d[k]);
    const flag = (k, f) => {
      if (diff(k) && cfg[k] !== '' && cfg[k] != null) parts.push(`--${f} ${q(cfg[k])}`);
    };
    flag('description', 'description');
    flag('author', 'author');
    flag('keywords', 'keywords');
    flag('repo', 'repo');
    flag('language', 'language');
    flag('framework', 'framework');
    flag('moduleFormat', 'module');
    flag('bundler', 'bundler');
    if (cfg.target.includes('service') || cfg.monorepoLayout === 'fullstack') flag('serviceFramework', 'server');
    flag('test', 'test');
    flag('lint', 'lint');
    flag('gitHooks', 'hooks');
    flag('release', 'release');
    flag('deps', 'deps');
    flag('license', 'license');
    flag('packageManager', 'pm');
    flag('nodeVersion', 'node');
    if (diff('target')) cfg.target.forEach((t) => parts.push(`--target ${t}`));
    if (diff('workflows')) cfg.workflows.forEach((w) => parts.push(`--workflows ${w}`));
    for (const [k, f] of [
      ['minify', 'minify'],
      ['storybook', 'storybook'],
      ['pkgChecks', 'pkg-checks'],
      ['knip', 'knip'],
      ['jsr', 'jsr'],
      ['sizeLimit', 'size-limit'],
      ['e2e', 'e2e'],
      ['env', 'env'],
      ['canary', 'canary'],
      ['doctor', 'doctor'],
      ['monorepo', 'monorepo'],
    ]) {
      if (cfg[k]) parts.push(`--${f}`);
    }
    if (cfg.monorepo && cfg.monorepoLayout && cfg.monorepoLayout !== 'libraries') parts.push(`--monorepo-layout ${cfg.monorepoLayout}`);
    if (cfg.publishable && cfg.sourcemaps === false) parts.push('--no-sourcemaps');
    if (cfg.coverage === false && (cfg.test === 'vitest' || cfg.test === 'jest')) parts.push('--no-coverage');
    for (const b of ['community', 'agents', 'vscode', 'editorconfig']) {
      if (cfg[b] === false && d[b] === true) parts.push(`--no-${b}`);
    }
    if (parts.length === 2) parts.push('-y');
    return parts.join(' ');
  },
};
