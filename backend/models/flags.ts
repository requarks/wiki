/**
 * The system flags, and what enabling each one actually does.
 *
 * Flags are read live: nothing here needs a restart, and every one of them has an effect somewhere in
 * the running server. Anything added to this list needs a consumer, otherwise the admin area offers a
 * switch that changes nothing.
 */
export const FLAGS = {
  /** Consumed by the frontend, which reveals unfinished features when it is on. */
  experimental: 'Unfinished features are offered in the interface.',
  /** Consumed by `models/users.ts` and `api/authentication.ts` via `authDebug()` below. */
  authDebug: 'Login and account creation attempts are logged in detail.',
  /** Consumed by the query logger in `core/db.ts`. */
  sqlLog: 'Every database query is logged.'
} as const

export type Flag = keyof typeof FLAGS

export const FLAG_KEYS = Object.keys(FLAGS) as Flag[]

/**
 * Flags model
 *
 * Low-level switches for debugging and for unfinished features, stored in the `flags` settings blob.
 * They are readable without authentication — the frontend needs `experimental` before anyone has
 * logged in — so a flag must never carry anything sensitive.
 */
class Flags {
  /**
   * Every flag, with anything missing from the stored blob reported as off
   */
  getFlags(): Record<Flag, boolean> {
    const flags = WIKI.config.flags ?? {}
    return Object.fromEntries(FLAG_KEYS.map((key) => [key, flags[key] === true])) as Record<
      Flag,
      boolean
    >
  }

  /**
   * Whether a single flag is on.
   *
   * Reads the config directly on every call, so flipping a flag takes effect immediately — including
   * on the other instances of a cluster, which reload their config when this one saves.
   */
  isEnabled(flag: Flag): boolean {
    return WIKI.config.flags?.[flag] === true
  }

  /**
   * Keep only the flags this model owns, dropping anything else a client sends
   */
  pickFlags(body: Record<string, any>): Partial<Record<Flag, boolean>> {
    const patch: Partial<Record<Flag, boolean>> = {}
    for (const key of FLAG_KEYS) {
      if (body[key] !== undefined) {
        patch[key] = body[key] === true
      }
    }
    return patch
  }

  /**
   * Save a patch of flags, leaving the ones it does not mention alone
   *
   * @returns Whether the flags were saved
   */
  async updateFlags(patch: Partial<Record<Flag, boolean>>): Promise<boolean> {
    const previous = WIKI.config.flags
    WIKI.config.flags = { ...previous, ...patch }

    if (!(await WIKI.configSvc.saveToDb(['flags']))) {
      WIKI.config.flags = previous
      return false
    }

    for (const [key, value] of Object.entries(patch)) {
      WIKI.logger.info(`System flag ${key} is now ${value ? 'enabled' : 'disabled'}.`)
    }
    return true
  }

  /**
   * Log an authentication detail, but only while the auth debug flag is on.
   *
   * At info level rather than debug, because the default log level is info: sending these to debug
   * would mean turning the flag on and seeing nothing.
   */
  authDebug(message: string): void {
    if (this.isEnabled('authDebug')) {
      WIKI.logger.info(`[AUTH] ${message}`)
    }
  }
}

export const flags = new Flags()
