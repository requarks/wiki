/**
 * Helpers turning the security settings an operator edits in the admin area into the shapes the
 * HTTP plugins expect.
 */

/** CORS modes offered by the admin area, in the order they appear there. */
export const CORS_MODES = ['OFF', 'REFLECT', 'HOSTNAMES', 'REGEX'] as const
export type CorsMode = (typeof CORS_MODES)[number]

/**
 * Turn a Content-Security-Policy string into helmet's directives object.
 *
 * `default-src 'self'; img-src * data:` becomes
 * `{ 'default-src': ["'self'"], 'img-src': ['*', 'data:'] }`. A directive with no value, such as
 * `upgrade-insecure-requests`, maps to an empty list, which is how helmet expresses it too.
 */
export function parseCspDirectives(value: string): Record<string, string[]> {
  const directives: Record<string, string[]> = {}
  for (const chunk of value.split(';')) {
    const parts = chunk.trim().split(/\s+/).filter(Boolean)
    const name = parts.shift()
    if (!name) {
      continue
    }
    directives[name.toLowerCase()] = parts
  }
  return directives
}

/**
 * The `origin` option for `@fastify/cors`, from the configured mode.
 *
 * `false` means no CORS headers at all, i.e. same-origin only, which is both the `OFF` mode and what
 * anything unrecognised degrades to — a misconfiguration should not end up more permissive than the
 * operator asked for.
 */
export function corsOrigin(security: {
  corsMode?: string
  corsConfig?: string
}): boolean | string[] | RegExp {
  switch (security.corsMode) {
    case 'REFLECT':
      return true
    case 'HOSTNAMES':
      return (security.corsConfig ?? '')
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    case 'REGEX':
      try {
        return new RegExp(security.corsConfig ?? '')
      } catch (err: any) {
        WIKI.logger.warn(
          `The CORS regex pattern is invalid (${err.message}) — falling back to same-origin only.`
        )
        return false
      }
    default:
      return false
  }
}
