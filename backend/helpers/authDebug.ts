/**
 * What an authentication module has to say about one attempt, while the `authDebug` flag is on.
 *
 * A failed login deliberately tells whoever is at the login screen almost nothing: every refusal
 * arrives as one of a handful of coded errors (`ERR_LOGIN_FAILED`, `ERR_STRATEGY_MISCONFIGURED`,
 * `ERR_PROVIDER_REQUEST_FAILED`), because that form is open to whoever can reach the wiki and a
 * message naming the check that refused is a message telling an attacker what to change. This is the
 * other half of that arrangement: the detail goes to the server log, where the administrator setting
 * the strategy up can read it and nobody else can.
 *
 * Which is what makes it the difference between a directory that cannot be reached, the wiki's own
 * bind credentials being wrong, a search base with a typo in it, a filter matching two people and a
 * password that is simply not the right one — five different things to go and fix, all of which reach
 * the user as the same `ERR_LOGIN_FAILED`.
 *
 * **Never a credential, whatever is being diagnosed**: not the password being tried, not the
 * strategy's own bind credentials or client secret, not a token a provider issued. Configuration is
 * quoted freely — a search filter or an issuer URL is what the message is *for* — and secrets are
 * described instead: whether one is set, never what it is.
 *
 * @param strategy The module instance. Every one carries `strategyId`, and `models/authentication.ts`
 *                 sets `module` on it right after construction, so a message says which of several
 *                 strategies of the same kind it is about.
 */
export function strategyDebug(
  strategy: { strategyId: string; module?: string },
  message: string
): void {
  WIKI.models.flags.authDebug(
    `${strategy.module ?? 'unknown'} strategy ${strategy.strategyId}: ${message}`
  )
}

/**
 * Which of a set of settings are empty, by the names the admin area shows them under.
 *
 * The titles rather than the config keys, because these names are only ever read in a log message
 * about a strategy that will not work, and the point of such a message is to name the field to go and
 * fill in — "Client Secret is empty", not `clientSecret`.
 */
export function missingSettings(settings: Record<string, unknown>): string {
  const missing = Object.entries(settings)
    .filter(([, value]) => !value)
    .map(([title]) => title)
  return `${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} empty`
}

/**
 * What a directory, a provider or the network said, as far as it can be put on one line.
 *
 * Every field of it earns its place, and each comes from a different kind of failure:
 *
 *   - the **class name**, because `ldapts` raises a result-code error whose message is often only the
 *     code's own name — and `InvalidCredentialsError` on the wiki's own search connection is what
 *     says the strategy's bind DN is wrong rather than the person's password;
 *   - the **code**, which is an LDAP result code (49, 32) that a directory's documentation is indexed
 *     by, or a socket error's (`ECONNREFUSED`, `ETIMEDOUT`) that is the whole answer on its own;
 *   - the OAuth2 **`error` / `error_description`**, which `openid-client` attaches when a provider
 *     refuses something and is the provider's own account of why — `invalid_client` for a rotated
 *     secret, `invalid_grant` for a redirect URI it does not have registered.
 */
export function describeAuthError(err: any): string {
  const code = err?.code === undefined ? '' : ` [${err.code}]`
  const detail = [err?.error, err?.error_description].filter(Boolean).join(': ')
  return `${err?.name ?? 'Error'}${code}: ${err?.message ?? err}${detail ? ` (${detail})` : ''}`
}
