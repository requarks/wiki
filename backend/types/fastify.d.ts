/**
 * Module augmentations for Fastify.
 *
 * `@fastify/session` exposes `interface Session` inside the `fastify` module as the extension point
 * for application session data; everything Wiki.js stores on the session is declared here.
 */

import 'fastify'
import '@fastify/session'
import type { ApiKeyIdentity } from '../models/apiKeys.ts'

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Set by the API key hook in `index.ts` when a request carries a valid bearer key. Null for
     * cookie-authenticated and anonymous requests.
     */
    apiKey?: ApiKeyIdentity | null
  }

  interface Session {
    /** Set by `models/users.ts` → `updateSession()` once a login completes. */
    authenticated?: boolean
    user?: {
      id: string
      email: string
      name: string
      hasAvatar?: boolean
      timezone?: string
      dateFormat?: string
      timeFormat?: string
      appearance?: string
      cvd?: string
    }
    /** Flattened, de-duplicated permissions of every group the user belongs to. */
    permissions?: string[]
    /** Ids of the groups the user belongs to, which is what per-group visibility is checked against. */
    groups?: string[]
  }

  interface FastifyContextConfig {
    /**
     * Permissions required to reach the route, enforced by the `preHandler` hook in `index.ts`.
     *
     * The outer array is OR-ed; a nested array is AND-ed. `manage:system` bypasses the check.
     */
    permissions?: (string | string[])[]
  }
}
