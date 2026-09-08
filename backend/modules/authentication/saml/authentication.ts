import { SAML, ValidateInResponseTo } from '@node-saml/node-saml'
import type { SamlConfig } from '@node-saml/node-saml'
import { CustomError } from '../../../helpers/common.ts'
import type {
  AuthFlow,
  AuthFlowCallback,
  AuthRequestTarget,
  ProviderProfile
} from '../../../models/authentication.ts'

/** The longest a provider's signing key list may be, so a pasted mistake cannot become a loop. */
const MAX_CERTS = 10

/**
 * SAML 2.0
 *
 * The Web Browser SSO profile: the wiki sends an AuthnRequest to the identity provider, the provider
 * authenticates the person and posts a signed assertion back to the callback. What makes it SAML
 * rather than a redirect with a claim on the end is that assertion — an XML document signed by the
 * provider's key, restricted to an audience and valid only for a few minutes — and every one of
 * those properties is checked before a word of it is believed.
 *
 * That checking is why this goes through `@node-saml/node-saml`. XML signature verification is not
 * something to write: the document is canonicalized, the signature covers a subset of it named by
 * reference, and the ways of getting that wrong — signature wrapping, comment splicing, a signature
 * over a different element than the one being read — are the entire published history of broken SAML
 * implementations.
 *
 * The assertion arrives as a cross-site form POST, which is why the definition declares
 * `postCallback` and why the flow this login started travels in a cookie of its own. See
 * `api/authentication.ts`.
 */
export default class SamlAuthentication {
  strategyId: string
  conf: Record<string, any>
  /** Set by `models/authentication.ts` right after construction. */
  module?: string

  constructor(strategyId: string, conf: Record<string, any>) {
    this.strategyId = strategyId
    this.conf = conf
  }

  /**
   * The provider as `node-saml` sees it.
   *
   * Built per request rather than kept, because the ACS URL is derived from the request — an
   * instance answering on more than one hostname has more than one — and unlike a discovery
   * document it costs nothing: this is a constructor call over values already in hand.
   */
  private saml(callbackUrl: string): SAML {
    const { entryPoint, issuer, cert } = this.conf
    if (!entryPoint || !issuer || !cert) {
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    const idpCert = String(cert)
      .split('|')
      .map((one) => one.trim())
      .filter((one) => one.length > 0)
      .slice(0, MAX_CERTS)
    if (idpCert.length < 1) {
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }

    const options: SamlConfig = {
      callbackUrl,
      entryPoint,
      issuer,
      idpCert,
      identifierFormat: this.conf.identifierFormat || null,
      signatureAlgorithm: this.conf.signatureAlgorithm || 'sha256',
      digestAlgorithm: this.conf.digestAlgorithm || 'sha256',
      wantAssertionsSigned: this.conf.wantAssertionsSigned !== false,
      acceptedClockSkewMs: Number.parseInt(this.conf.acceptedClockSkewMs, 10) || 0,
      disableRequestedAuthnContext: this.conf.disableRequestedAuthnContext === true,
      authnContext: String(this.conf.authnContext || '')
        .split('|')
        .map((one) => one.trim())
        .filter((one) => one.length > 0),
      racComparison: this.conf.racComparison || 'exact',
      forceAuthn: this.conf.forceAuthn === true,
      passive: this.conf.passive === true,
      skipRequestCompression: this.conf.skipRequestCompression === true,
      authnRequestBinding: this.conf.authnRequestBinding || 'HTTP-Redirect',
      /*
        Not validated, and it cannot be here. `InResponseTo` is checked against the request IDs this
        process issued, which in a clustered wiki is the wrong set: the instance that answers the
        provider's POST is not necessarily the one that sent the request, so an assertion for a
        perfectly good login would be refused about half the time. The binding between this browser
        and this answer is the flow's `state`, echoed back as `RelayState` and checked by the route —
        which every strategy here is held to, whatever its protocol.
      */
      validateInResponseTo: ValidateInResponseTo.never,
      ...(this.conf.providerName ? { providerName: this.conf.providerName } : {}),
      ...(this.conf.audience ? { audience: this.conf.audience } : {}),
      ...(this.conf.privateKey ? { privateKey: this.conf.privateKey } : {}),
      ...(this.conf.decryptionPvk ? { decryptionPvk: this.conf.decryptionPvk } : {})
    }
    return new SAML(options)
  }

  /**
   * Where to send the browser to sign in.
   *
   * The flow's `state` goes as `RelayState`, which the provider echoes back untouched and the route
   * checks — SAML's equivalent of the `state` an OAuth2 login carries, and the reason a stray
   * assertion posted at the callback is not a login.
   *
   * Which binding produces which answer: Redirect is a URL with the deflated request on its query
   * string, POST is a page holding a form the browser submits to the provider. Both are answers the
   * start route knows how to send; see `AuthRequestTarget`.
   */
  async authorizationUrl({ redirectUri, state }: AuthFlow): Promise<AuthRequestTarget> {
    const saml = this.saml(redirectUri)
    if (this.conf.authnRequestBinding === 'HTTP-POST') {
      return { html: await saml.getAuthorizeFormAsync(state, undefined, {}) }
    }
    return saml.getAuthorizeUrlAsync(state, undefined, {})
  }

  /**
   * Turn the assertion the provider posted into who signed in.
   *
   * `validatePostResponseAsync` is what does the checking: the signature against the provider's
   * certificate, the audience restriction, the conditions' validity window, and the status the
   * provider reported. Everything after it is reading attributes.
   */
  async profile({ redirectUri, body }: AuthFlowCallback): Promise<ProviderProfile> {
    if (!body?.SAMLResponse) {
      throw new Error('ERR_NO_PROVIDER_ACCOUNT')
    }
    const saml = this.saml(redirectUri)
    let profile
    try {
      profile = (await saml.validatePostResponseAsync(body)).profile
    } catch (err: any) {
      /*
        What the library says about a rejected assertion goes to the log and no further. Its messages
        are precise — an invalid signature, an audience that does not match, conditions not yet
        valid — and precise is exactly what must not be handed back: this endpoint is open to whoever
        can reach the wiki, and told which check it failed, a forged assertion can be worked on until
        it passes.
      */
      WIKI.logger.warn(`SAML strategy ${this.strategyId} rejected an assertion: ${err.message}`)
      throw new Error('ERR_LOGIN_FAILED')
    }
    if (!profile) {
      throw new Error('ERR_NO_PROVIDER_ACCOUNT')
    }

    /*
      Attributes are read off the profile, where `node-saml` puts each of them under its own name
      alongside the NameID and the rest of the assertion's own fields. A configured mapping is
      therefore looked up as a plain key, which is what lets it be either a bare attribute name or one
      of the URI-shaped ones an AD FS or an Entra assertion uses.
    */
    const id = this.attr(profile, this.conf.mappingUID) ?? profile.nameID
    if (!id) {
      throw new Error('ERR_NO_PROVIDER_ACCOUNT')
    }
    const email = this.attr(profile, this.conf.mappingEmail)
    if (!email) {
      throw new Error('ERR_NO_EMAIL_FROM_PROVIDER')
    }
    return {
      id,
      email,
      name: this.attr(profile, this.conf.mappingDisplayName) || email,
      picture: this.attr(profile, this.conf.mappingPicture),
      ...(this.conf.mapGroups === true
        ? {
            groups: this.groupsFrom(profile),
            groupsExclusive: this.conf.unassignMissingGroups === true
          }
        : {})
    }
  }

  /**
   * This wiki as a service provider, in the form a provider configures itself from.
   *
   * Carries the entity ID, the ACS URL and the certificates — the public halves, and only where the
   * corresponding key is configured, since a provider has nothing to do with a certificate this wiki
   * never signs or decrypts with. Served by `GET /_api/auth/:strategyId/metadata`.
   */
  async metadata({ callbackUrl }: { callbackUrl: string }): Promise<string> {
    /*
      A key with no certificate beside it cannot be described. Refused with a message rather than
      left to fail inside the library, since the answer is a specific thing to go and do — and a 500
      on a public endpoint says nothing about which of the two fields is missing.
    */
    if (this.conf.privateKey && !this.conf.signingCert) {
      throw new CustomError(
        'samlMetadataIncomplete',
        'This strategy signs its requests, so its Signing Certificate has to be configured before metadata can describe it.'
      )
    }
    if (this.conf.decryptionPvk && !this.conf.decryptionCert) {
      throw new CustomError(
        'samlMetadataIncomplete',
        'This strategy accepts encrypted assertions, so its Decryption Certificate has to be configured before metadata can describe it.'
      )
    }
    return this.saml(callbackUrl).generateServiceProviderMetadata(
      this.conf.decryptionCert || null,
      this.conf.signingCert || null
    )
  }

  /**
   * One attribute of the assertion, as a string.
   *
   * A SAML attribute may carry several values, and `node-saml` hands over an array when it does. The
   * first is taken. An empty mapping means the administrator has turned that mapping off, which is
   * not the same as an attribute that happens to be missing.
   */
  private attr(profile: Record<string, any>, name: string | undefined): string | undefined {
    if (!name) {
      return undefined
    }
    const value = profile[name]
    const first = Array.isArray(value) ? value[0] : value
    if (typeof first !== 'string') {
      return undefined
    }
    return first.trim().length > 0 ? first.trim() : undefined
  }

  /**
   * The group names the assertion carries.
   *
   * Either one name or a list of them: a provider sending a single group commonly sends the bare
   * string, and both forms mean the same thing here.
   */
  private groupsFrom(profile: Record<string, any>): string[] {
    const value = profile[this.conf.mappingGroups || 'memberOf']
    const raw = typeof value === 'string' ? [value] : Array.isArray(value) ? value : []
    return raw
      .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim())
  }
}
