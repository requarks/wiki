import { AsyncLocalStorage } from 'node:async_hooks'

/** The ways in a change can record, beyond the wiki's own interface. See `pageHistory.via`. */
export type Via = 'mcp'

const viaStore = new AsyncLocalStorage<Via>()

/**
 * Run `work` as something done through `via` — `mcp` for an AI assistant on the MCP server.
 *
 * A scope rather than a parameter, for the same reason `notifications.withOrigin` and
 * `storage.importingFrom` are: what is marked is everything the work leads to, several calls down —
 * the version a save records (`pageHistory.via`), the audit entry the route writes (`meta.via`) —
 * including a REST route the MCP server calls in-process with `app.inject`, which has no idea it was
 * asked by an assistant. `controllers/mcp.ts` opens it around every call.
 */
export function withVia<T>(via: Via, work: () => Promise<T>): Promise<T> {
  return viaStore.run(via, work)
}

/** How the work in progress is being done, or null when it is the wiki's own interface. */
export function currentVia(): Via | null {
  return viaStore.getStore() ?? null
}
