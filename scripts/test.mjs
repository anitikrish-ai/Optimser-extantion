// Bundles each tests/*.test.ts and runs it with the Node test runner.
import { build } from 'esbuild';
import { readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, '.test-tmp');
rmSync(out, { recursive: true, force: true });
const files = readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.ts'));
await build({
  entryPoints: files.map((f) => join(root, 'tests', f)),
  outdir: out, bundle: true, format: 'esm', platform: 'node', outExtension: { '.js': '.mjs' },
  external: ['jsdom', 'esbuild'], logLevel: 'warning', sourcemap: 'inline'
});
const r = spawnSync('node', ['--test', '--enable-source-maps', ...files.map((f) => join(out, f.replace('.ts', '.mjs')))], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true });
process.exit(r.status ?? 1);
