import JSZip from 'jszip';
import { adapters, adapterById } from './adapters/index.js';

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, kids = []) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of [].concat(kids)) n.append(k);
  return n;
};

// ---- state -----------------------------------------------------------------
let adapter = adapters[0];
let state = adapter.defaultConfig();
let activePreset = null;
let activeFile = null;
let current = { files: {}, summary: { fileCount: 0, stack: [] } };

// ---- language picker -------------------------------------------------------
function renderLangs() {
  const bar = $('#langs');
  bar.innerHTML = '';
  for (const a of adapters) {
    const c = el('span', { className: 'chip' + (a.id === adapter.id ? ' on' : ''), textContent: a.label });
    c.onclick = () => setAdapter(a.id);
    bar.append(c);
  }
  $('#genRepo').href = adapter.repoUrl;
  $('#genRepo').textContent = adapter.npm;
}

function setAdapter(id, config) {
  adapter = adapterById(id);
  state = config || adapter.defaultConfig();
  activePreset = null;
  activeFile = null;
  $('#import').style.display = adapter.importPackageJson ? '' : 'none';
  renderLangs();
  renderPresets();
  renderForm();
  update();
  showFile(pickDefaultFile(current.files));
}

// ---- presets ---------------------------------------------------------------
const PRESET_HINT = 'Quick-start from a common setup — hover for details.';
function renderPresets() {
  const bar = $('#presets');
  const desc = $('#presetDesc');
  bar.innerHTML = '';
  desc.textContent = PRESET_HINT;
  for (const { name, description } of adapter.presets()) {
    const b = el('button', { textContent: name, title: description });
    b.onmouseenter = () => description && (desc.textContent = description);
    b.onfocus = b.onmouseenter;
    b.onclick = () => {
      const keep = Object.fromEntries(adapter.metaKeys.map((k) => [k, state[k]]));
      state = adapter.applyPreset(name, keep);
      activePreset = name;
      if (description) desc.textContent = description;
      renderForm();
      update();
    };
    bar.append(b);
  }
  bar.onmouseleave = () => (desc.textContent = PRESET_HINT);
}

// ---- form (driven by the adapter's normalized schema) ----------------------
function applies(opt) {
  return typeof opt.when === 'function' ? !!opt.when(state) : true;
}

function renderForm() {
  const form = $('#form');
  form.innerHTML = '';
  const opts = adapter.options().filter(applies);
  const groups = adapter.groups() || [{ id: null, label: '' }];
  for (const group of groups) {
    const keys = opts.filter((o) => o.group === group.id || group.id == null);
    if (!keys.length) continue;
    const wrap = el('div', { className: 'group' });
    if (group.label) wrap.append(el('h3', { textContent: group.label }));
    for (const opt of keys) wrap.append(renderField(opt));
    form.append(wrap);
  }
}

function renderField(opt) {
  const field = el('div', { className: 'field' }, el('label', { textContent: opt.label }));
  if (opt.help) field.append(el('p', { className: 'field-hint', textContent: opt.help }));

  if (opt.type === 'text') {
    const input = el('input', { type: 'text', value: state[opt.id] ?? '', placeholder: opt.default || '' });
    input.oninput = () => {
      state[opt.id] = input.value;
      update();
    };
    field.append(input);
  } else if (opt.type === 'boolean') {
    field.append(
      chip('Enabled', !!state[opt.id], false, () => {
        state[opt.id] = !state[opt.id];
        renderForm();
        update();
      }),
    );
  } else {
    const chips = el('div', { className: 'chips' });
    const multi = opt.type === 'multiselect';
    for (const c of opt.choices) {
      const on = multi ? (state[opt.id] || []).includes(c.value) : state[opt.id] === c.value;
      chips.append(
        chip(c.label, on, multi, () => {
          if (multi) {
            const set = new Set(state[opt.id] || []);
            set.has(c.value) ? set.delete(c.value) : set.add(c.value);
            state[opt.id] = [...set];
          } else {
            state[opt.id] = c.value;
          }
          renderForm();
          update();
        }),
      );
    }
    field.append(chips);
  }
  return field;
}

function chip(label, on, multi, onclick) {
  const c = el('span', { className: 'chip' + (multi ? ' multi' : '') + (on ? ' on' : ''), textContent: label });
  c.onclick = onclick;
  return c;
}

// ---- live preview ----------------------------------------------------------
function update() {
  try {
    current = adapter.generate(state, activePreset);
    $('#cmd').textContent = adapter.command(state, activePreset);
    $('#fileCount').textContent = `(${current.summary.fileCount})`;
    $('#stack').textContent = current.summary.stack.join(' · ');
    $('#err').style.display = 'none';
  } catch (e) {
    $('#err').textContent = e instanceof Error ? e.message : String(e);
    $('#err').style.display = '';
    current = { files: {}, summary: { fileCount: 0, stack: [] } };
  }
  renderTree(current.files);
}

const pickDefaultFile = (files) => (files['README.md'] ? 'README.md' : Object.keys(files).sort()[0]);

function renderTree(files) {
  const tree = {};
  for (const path of Object.keys(files).sort()) {
    let node = tree;
    path.split('/').forEach((seg, i, segs) => {
      const isFile = i === segs.length - 1;
      node[seg] = node[seg] || (isFile ? { __file: path } : {});
      node = node[seg];
    });
  }
  const box = $('#tree');
  box.innerHTML = '';
  const sortEntries = (node) => (a, b) => {
    if (a === '__file') return -1;
    const ad = !node[a].__file,
      bd = !node[b].__file;
    if (ad !== bd) return ad ? -1 : 1;
    return a.localeCompare(b);
  };
  const walk = (node, depth) => {
    for (const key of Object.keys(node).sort(sortEntries(node))) {
      if (key === '__file') continue;
      const entry = node[key];
      const isFile = entry.__file;
      const row = el('div', {
        className: 'row ' + (isFile ? 'file' : 'dir') + (activeFile === entry.__file ? ' active' : ''),
        textContent: '  '.repeat(depth) + (isFile ? '' : '📁 ') + key,
      });
      if (isFile) row.onclick = () => showFile(entry.__file);
      box.append(row);
      if (!isFile) walk(entry, depth + 1);
    }
  };
  walk(tree, 0);
  if (activeFile && files[activeFile] != null) $('#filebody').textContent = files[activeFile];
}

function showFile(path) {
  activeFile = path;
  $('#filebody').textContent = current.files[path] ?? 'Select a file to preview…';
  renderTree(current.files);
}

// ---- actions ---------------------------------------------------------------
function flash(btn, msg) {
  const t = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => (btn.textContent = t), 1200);
}

$('#download').onclick = async () => {
  const zip = new JSZip();
  const root = state.name || 'project';
  for (const [path, contents] of Object.entries(current.files)) zip.file(`${root}/${path}`, contents);
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `${root}.zip` });
  document.body.append(a);
  a.click();
  a.remove();
};

$('#copy').onclick = async () => {
  await navigator.clipboard.writeText($('#cmd').textContent);
  flash($('#copy'), 'Copied!');
};

$('#import').onclick = () => $('#importFile').click();
$('#importFile').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file || !adapter.importPackageJson) return;
  try {
    adapter.importPackageJson(JSON.parse(await file.text()), state);
    renderForm();
    update();
    flash($('#import'), '✓ Imported');
  } catch {
    flash($('#import'), '✗ Invalid JSON');
  }
  e.target.value = '';
};

// ---- share the config as a URL ---------------------------------------------
function changedConfig() {
  const d = adapter.defaultConfig();
  const changed = {};
  for (const k of Object.keys(state)) {
    if (adapter.metaKeys.includes(k)) {
      if (state[k]) changed[k] = state[k];
    } else if (JSON.stringify(state[k]) !== JSON.stringify(d[k])) {
      changed[k] = state[k];
    }
  }
  return changed;
}

$('#share').onclick = async () => {
  const url = `${location.origin}${location.pathname}?g=${adapter.id}&c=${encodeURIComponent(JSON.stringify(changedConfig()))}`;
  history.replaceState(null, '', url);
  await navigator.clipboard.writeText(url);
  flash($('#share'), 'Link copied!');
};

// ---- GitHub: create a repo + push the scaffold as an initial commit --------
// The generated files are stashed in sessionStorage across the OAuth redirect (the token
// lives only in an httpOnly cookie, server-side — see functions/api/github/*).
const GH_PENDING = 'pk_gh_pending';
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function ghResult(html, isError = false) {
  const box = $('#ghResult');
  box.hidden = false;
  box.className = 'gh-result' + (isError ? ' error' : '');
  box.innerHTML = html;
}

async function ghSession() {
  try {
    const r = await fetch('/api/github/session', { headers: { accept: 'application/json' } });
    return r.ok ? await r.json() : { connected: false };
  } catch {
    return { connected: false };
  }
}

async function finishGitHub() {
  const raw = sessionStorage.getItem(GH_PENDING);
  if (!raw) return;
  ghResult('Creating repository and pushing files…');
  try {
    const r = await fetch('/api/github/create-repo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    ghResult(
      `✓ Created <a href="${data.html_url}" target="_blank" rel="noopener">${escapeHtml(
        data.html_url.replace('https://github.com/', ''),
      )}</a>${data.private ? ' · private' : ''} — pushed the scaffold as the initial commit.`,
    );
  } catch (e) {
    const reconnect = /not_connected/.test(e.message)
      ? ' — <a href="/api/github/start">connect again</a>'
      : '';
    ghResult('GitHub: ' + escapeHtml(e.message) + reconnect, true);
  } finally {
    sessionStorage.removeItem(GH_PENDING);
  }
}

$('#ghCreate').onclick = async () => {
  if (!Object.keys(current.files).length) return;
  sessionStorage.setItem(
    GH_PENDING,
    JSON.stringify({
      name: state.name || 'project',
      private: $('#ghPrivate').checked,
      description: state.description || '',
      files: current.files,
    }),
  );
  const s = await ghSession();
  if (s.connected) return finishGitHub();
  location.href = '/api/github/start'; // → GitHub OAuth, returns to ?github=connected
};

// Complete a pending push after the OAuth round-trip (or report a failed sign-in).
function handleGitHubReturn() {
  const params = new URLSearchParams(location.search);
  const status = params.get('github');
  if (!status) return;
  params.delete('github');
  history.replaceState(null, '', location.pathname + (params.toString() ? `?${params}` : ''));
  if (status === 'connected') finishGitHub();
  else ghResult('GitHub sign-in failed or was cancelled. <a href="/api/github/start">Try again</a>', true);
}

function bootFromUrl() {
  const params = new URLSearchParams(location.search);
  const g = params.get('g');
  const start = g ? adapterById(g) : adapters[0];
  let config = start.defaultConfig();
  const c = params.get('c');
  if (c) {
    try {
      Object.assign(config, JSON.parse(decodeURIComponent(c)));
    } catch {
      /* ignore a malformed link */
    }
  }
  setAdapter(start.id, config);
}

// ---- boot ------------------------------------------------------------------
bootFromUrl();
handleGitHubReturn();
