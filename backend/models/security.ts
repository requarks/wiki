import { CORS_MODES, parseCspDirectives } from '../helpers/security.ts'

/** Fields stored in the `security` settings blob. */
export const SECURITY_FIELDS = [
  'authRateLimitBan',
  'authRateLimitEnabled',
  'authRateLimitMax',
  'authRateLimitWindow',
  'corsConfig',
  'corsMode',
  'cspDirectives',
  'disallowIframe',
  'disallowOpenRedirect',
  'enforceCsp',
  'enforceHsts',
  'enforceSameOriginReferrerPolicy',
  'forceAssetDownload',
  'hstsDuration',
  'trustProxy',
  'uploadMaxFileSize',
  'uploadMaxFiles',
  'uploadScanSVG'
] as const

/** A duration as the admin area writes it: `30m`, `14d`, `1y`. */
const DURATION_PATTERN = /^\d+[smhdwy]$/

/**
 * Security model
 *
 * The admin area's security view, which is exactly the `security` settings blob. Most of it is read
 * when the HTTP server starts — see the `Security` section of `index.ts` — so saving here takes
 * effect on the next restart.
 */
class Security {
  /**
   * The security configuration as the admin area expects it
   */
  getConfig(): Record<string, any> {
    const security = WIKI.config.security ?? {}
    const config: Record<string, any> = {}
    for (const field of SECURITY_FIELDS) {
      config[field] = security[field]
    }
    return config
  }

  /**
   * Keep only the fields this model owns, dropping anything else a client sends
   */
  pickFields(body: Record<string, any>): Record<string, any> {
    const patch: Record<string, any> = {}
    for (const field of SECURITY_FIELDS) {
      if (body[field] !== undefined) {
        patch[field] = body[field]
      }
    }
    return patch
  }

  /**
   * Check a patch against the settings it will end up merged with.
   *
   * Merged rather than in isolation, because these fields constrain each other: turning CSP on with
   * no directives, or picking the hostname whitelist mode without hostnames, would store a setting
   * that quietly does nothing.
   *
   * @returns The reason it is invalid, or null when it is fine
   */
  validate(patch: Record<string, any>): string | null {
    const merged = { ...this.getConfig(), ...patch }

    if (!CORS_MODES.includes(merged.corsMode)) {
      return `"${merged.corsMode}" is not a valid CORS mode.`
    }
    if (merged.corsMode === 'REGEX') {
      try {
        new RegExp(merged.corsConfig ?? '')
      } catch (err: any) {
        return `The CORS regex pattern is invalid: ${err.message}`
      }
    }
    if (merged.corsMode === 'HOSTNAMES') {
      const hostnames = (merged.corsConfig ?? '')
        .split(/[\n,]/)
        .map((entry: string) => entry.trim())
        .filter(Boolean)
      if (hostnames.length < 1) {
        return 'The hostname whitelist mode needs at least one hostname.'
      }
    }

    if (merged.enforceCsp) {
      if (Object.keys(parseCspDirectives(merged.cspDirectives ?? '')).length < 1) {
        return 'Enforcing a Content-Security-Policy needs at least one directive.'
      }
    }

    if (merged.enforceHsts && !(merged.hstsDuration > 0)) {
      return 'Enforcing HSTS needs a duration greater than zero.'
    }

    if (merged.authRateLimitEnabled) {
      if (!(merged.authRateLimitMax > 0)) {
        return 'The attempt limit must be greater than zero.'
      }
      for (const [field, label] of [
        ['authRateLimitWindow', 'time window'],
        ['authRateLimitBan', 'ban duration']
      ] as const) {
        if (!DURATION_PATTERN.test(`${merged[field] ?? ''}`.trim())) {
          return `The ${label} must be a duration such as 30s, 15m, 2h or 1d.`
        }
      }
    }

    return null
  }

  /**
   * Save a validated patch.
   *
   * @returns Whether the settings were saved
   */
  async updateConfig(patch: Record<string, any>): Promise<boolean> {
    const previousSecurity = WIKI.config.security
    WIKI.config.security = { ...previousSecurity, ...patch }

    if (!(await WIKI.configSvc.saveToDb(['security']))) {
      WIKI.config.security = previousSecurity
      return false
    }
    return true
  }
}

export const security = new Security()
