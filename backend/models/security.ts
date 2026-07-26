import { CORS_MODES, parseCspDirectives } from '../helpers/security.ts'

/** Fields stored in the `security` settings blob. */
export const SECURITY_FIELDS = [
  'corsConfig',
  'corsMode',
  'cspDirectives',
  'disallowFloc',
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

/**
 * The JWT fields the admin area shows, mapped onto the `auth` settings they really live in.
 *
 * The `security` blob used to carry copies of these under the 2.x names, which nothing read — so the
 * view was editing values with no effect. These are the keys the running server uses.
 */
export const AUTH_FIELD_MAP = {
  authJwtAudience: 'audience',
  authJwtExpiration: 'tokenExpiration',
  authJwtRenewablePeriod: 'tokenRenewal'
} as const

/** A duration as the admin area writes it: `30m`, `14d`, `1y`. */
const DURATION_PATTERN = /^\d+[smhdwy]$/

/**
 * Security model
 *
 * One flat surface for the admin area's security view, even though the values are stored in two
 * settings blobs. Most of them are read when the HTTP server starts — see the `Security` section of
 * `index.ts` — so saving them here takes effect on the next restart.
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
    for (const [field, authKey] of Object.entries(AUTH_FIELD_MAP)) {
      config[field] = WIKI.config.auth?.[authKey]
    }
    return config
  }

  /**
   * Keep only the fields this model owns, dropping anything else a client sends
   */
  pickFields(body: Record<string, any>): Record<string, any> {
    const patch: Record<string, any> = {}
    for (const field of [...SECURITY_FIELDS, ...Object.keys(AUTH_FIELD_MAP)]) {
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

    for (const [field, label] of [
      ['authJwtExpiration', 'token expiration'],
      ['authJwtRenewablePeriod', 'token renewal period']
    ] as const) {
      if (!DURATION_PATTERN.test(merged[field] ?? '')) {
        return `The ${label} must be a duration such as 30m, 12h or 14d.`
      }
    }
    if (!merged.authJwtAudience || `${merged.authJwtAudience}`.trim().length < 1) {
      return 'The JWT audience cannot be empty.'
    }

    return null
  }

  /**
   * Save a validated patch, splitting it across the two settings blobs it belongs to.
   *
   * Both are written in one go and rolled back together, so a failure cannot leave the JWT settings
   * updated while the rest is not.
   *
   * @returns Whether the settings were saved
   */
  async updateConfig(patch: Record<string, any>): Promise<boolean> {
    const previousSecurity = WIKI.config.security
    const previousAuth = WIKI.config.auth
    const keys: string[] = []

    const securityPatch: Record<string, any> = {}
    const authPatch: Record<string, any> = {}
    for (const [field, value] of Object.entries(patch)) {
      const authKey = AUTH_FIELD_MAP[field as keyof typeof AUTH_FIELD_MAP]
      if (authKey) {
        authPatch[authKey] = typeof value === 'string' ? value.trim() : value
      } else {
        securityPatch[field] = value
      }
    }

    if (Object.keys(securityPatch).length > 0) {
      WIKI.config.security = { ...previousSecurity, ...securityPatch }
      keys.push('security')
    }
    if (Object.keys(authPatch).length > 0) {
      WIKI.config.auth = { ...previousAuth, ...authPatch }
      keys.push('auth')
    }

    if (!(await WIKI.configSvc.saveToDb(keys))) {
      WIKI.config.security = previousSecurity
      WIKI.config.auth = previousAuth
      return false
    }
    return true
  }
}

export const security = new Security()
