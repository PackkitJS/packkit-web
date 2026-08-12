// Bundle the configurator into dist/ — the directory Cloudflare Pages serves.
// esbuild pulls in the browser-safe generator cores (create-packkit/core,
// create-packkit-py) and JSZip. `--serve` runs a local dev server with rebuild.
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = join(root, 'dist');
const serve = process.argv.includes('--serve');

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });
cpSync(join(root, 'index.html'), join(outdir, 'index.html'));

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [join(root, 'src', 'app.js')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: join(outdir, 'app.js'),
  minify: !serve,
  sourcemap: serve,
  logLevel: 'info',
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { host, port } = await ctx.serve({ servedir: outdir, port: 8788 });
  console.log(`\n  packkit-web → http://${host === '0.0.0.0' ? 'localhost' : host}:${port}\n`);
} else {
  await esbuild.build(options);
  console.log('Built dist/ (index.html + app.js).');
}
