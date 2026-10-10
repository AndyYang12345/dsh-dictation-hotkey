/**
 * Builds the browser bundle consumed by the DSH client-module table.
 * Output: client/dist/client.js (referenced by package.json exports["./client"]).
 *
 * The bundle follows the module-table contract used by every official client
 * package: register a CJS factory through
 * `window.__ModuleLoader__.load({ id, factory: (require) => ... })`. The page
 * loader's `require` resolves seed modules, so `react` is the single external
 * and everything else (type-only cordis imports, app code) is inlined. The
 * client half uses `createElement` instead of JSX on purpose: one seed
 * dependency, nothing else.
 *
 * Run `npm run build` BEFORE installing: the host's activation scan fails loud
 * when a package declares dsh.client but its bundle is missing.
 */
import { mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** First esbuild we can find. A profile link install resolves no dependencies
 * for this package, so the build tool may live in a sibling project instead. */
function esbuildEntry() {
  const candidates = [
    join(here, 'node_modules/esbuild/lib/main.js'),
    '/home/harekasa/dsh-butler-memory/node_modules/esbuild/lib/main.js',
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  throw new Error('esbuild not found: run `npm i -D esbuild` in this package')
}

const { build } = await import(pathToFileURL(esbuildEntry()).href)

mkdirSync(join(here, 'client/dist'), { recursive: true })

await build({
  entryPoints: [join(here, 'client/src/index.js')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  outfile: join(here, 'client/dist/client.js'),
  external: ['react'],
  banner: {
    js: 'window.__ModuleLoader__.load({ id: "dsh-dictation-hotkey", factory: function (require) { var module = { exports: {} }; var exports = module.exports; Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
  },
  footer: {
    js: 'return module.exports; } });',
  },
  sourcemap: false,
  logLevel: 'info',
})
