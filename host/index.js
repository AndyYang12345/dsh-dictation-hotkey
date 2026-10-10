/**
 * Host half of `dsh-dictation-hotkey` — pure UI plugin, node side.
 *
 * This body does nothing on purpose, exactly like the shipped
 * `@deepseek-ai/dsh-client-ui-input-trigger` package: the empty `apply` exists
 * so the plugin appears in the host `cordis.yml`/Loader, and the browser half
 * ships through the `dsh.client` declaration in package.json plus the
 * `exports["./client"]` bundle. All behavior lives in the browser half.
 *
 * Two constraints are load-bearing here, both learned from failing Web boots:
 *
 * - **No `@deepseek-ai/*` import.** A profile installs this package with
 *   `pnpm add <dir>`, which resolves no dependencies for a linked package, so a
 *   host-side `import z from '@deepseek-ai/schemastery'` aborts activation with
 *   ERR_MODULE_NOT_FOUND and DSH refuses to boot the whole Web GUI.
 * - **No undeclared service access.** `ctx.config` and `ctx.connection` throw
 *   `cannot get property "<name>" without inject` unless this module declares
 *   them via `inject`; the Web composition provides no `config` service at all,
 *   so declaring it parks the entry as `pending (waiting for service: config)`.
 *   Doing nothing avoids both failure modes.
 */

export const name = 'dictation-hotkey'

/** Host plugin body: no host-side behavior for this UI-only plugin. */
export function apply() {}
