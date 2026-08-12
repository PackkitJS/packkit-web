// CI smoke: import each adapter (the same modules the browser bundle uses) and
// generate a project, asserting real files come out for every generator. Catches
// a broken adapter or a generator that stopped being browser-safe before deploy.
import { adapters } from '../src/adapters/index.js';

let failed = false;
for (const a of adapters) {
  try {
    const preset = a.presets()[0];
    const config = a.applyPreset(preset.name, { name: 'smoke' });
    const { files, summary } = a.generate(config, preset.name);
    const count = Object.keys(files).length;
    if (count < 3) throw new Error(`only ${count} files generated`);
    if (typeof a.command(config, preset.name) !== 'string') throw new Error('command() did not return a string');
    console.log(`  ✓ ${a.id}: ${preset.name} → ${count} files (${summary.stack.join(' · ')})`);
  } catch (e) {
    failed = true;
    console.error(`  ✖ ${a.id}: ${e instanceof Error ? e.message : e}`);
  }
}
if (failed) {
  console.error('\ncheck: an adapter failed');
  process.exit(1);
}
console.log('\ncheck: all adapters generate');
