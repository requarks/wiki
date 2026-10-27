import { X509Certificate } from 'node:crypto'
import { SAML, ValidateInResponseTo } from '@node-saml/node-saml'
import type { SamlConfig } from '@node-saml/node-saml'
import * as cheerio from 'cheerio'
import type { AnyNode, Element } from 'domhandler'
import { missingSettings, strategyDebug } from '../../../helpers/authDebug.ts'
import { CustomError } from '../../../helpers/common.ts'
import type {
  AuthFlow,
  AuthFlowCallback,
  AuthRequestTarget,
  ProviderProfile,
  ProviderProfileMetaKey
} from '../../../models/authentication.ts'

/** Which setting names the attribute for each profile field a provider may fill in. */
const META_MAPPINGS: Record<ProviderProfileMetaKey, string> = {
  location: 'mappingLocation',
  jobTitle: 'mappingJobTitle',
  pronouns: 'mappingPronouns'
}

/** The longest a provider's signing key list may be, so a pasted mistake cannot become a loop. */
const MAX_CERTS = 10

/** The Certificate setting as the list of certificates it holds, joined by `|`. */
function splitCerts(cert: unknown): string[] {
  return String(cert ?? '')
    .split('|')
    .map((one) => one.trim())
    .filter((one) => one.length > 0)
    .slice(0, MAX_CERTS)
}

/**
 * A certificate's SHA-1 thumbprint, in the form AD FS and the Windows certificate dialog show it —
 * which is what an administrator has in front of them to compare against. Identification only:
 * nothing is verified by it. Takes PEM or bare base64, as the Certificate setting does.
 */
function thumbprintOf(cert: string): string | null {
  try {
    const der = Buffer.from(cert.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64')
    return new X509Certificate(der).fingerprint.replaceAll(':', '')
  } catch {
    return null
  }
}

/**
 * What kind of node this is, as a string: domhandler types it with an enum from a package this
 * workspace does not depend on directly, and in XML mode every element is a `tag`.
 */
function isElement(node: AnyNode): node is Element {
  return (node.type as string) === 'tag'
}

/** The children of an element with a local name, regardless of what prefix the provider gave them. */
function childrenNamed(el: Element | undefined, name: string): Element[] {
  return (el?.children ?? []).filter(
    (node): node is Element => isElement(node) && node.name.split(':').pop() === name
  )
}

function childNamed(el: Element | undefined, name: string): Element | undefined {
  return childrenNamed(el, name)[0]
}

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
      strategyDebug(
        this,
        `is not configured: ${missingSettings({ 'Login URL': entryPoint, 'Issuer / Entity ID': issuer, "Identity Provider's Certificate": cert })}`
      )
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    const idpCert = splitCerts(cert)
    if (idpCert.length < 1) {
      strategyDebug(
        this,
        "the Identity Provider's Certificate holds no certificate, so no assertion can be verified"
      )
      throw new Error('ERR_STRATEGY_MISCONFIGURED')
    }
    strategyDebug(
      this,
      `assertions are expected from ${entryPoint} for audience \`${this.conf.audience || issuer}\`, verified against ${idpCert.length} certificate(s), posted back to ${callbackUrl}`
    )

    const options: SamlConfig = {
      callbackUrl,
      entryPoint,
      issuer,
      idpCert,
      identifierFormat: this.conf.identifierFormat || null,
      signatureAlgorithm: this.conf.signatureAlgorithm || 'sha256',
      digestAlgorithm: this.conf.digestAlgorithm || 'sha256',
      wantAssertionsSigned: this.conf.wantAssertionsSigned !== false,
      // -> The library's own default is true, which refuses AD FS out of the box: it signs only the
      //    assertion unless its relying party trust is told otherwise
      wantAuthnResponseSigned: this.conf.wantAuthnResponseSigned === true,
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
      strategyDebug(
        this,
        `the callback carried no SAMLResponse. It carried: ${Object.keys(body ?? {}).join(', ') || 'nothing'}`
      )
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
      if (WIKI.models.flags.isEnabled('authDebug')) {
        for (const line of this.describeResponse(body.SAMLResponse)) {
          strategyDebug(this, line)
        }
      }
      throw new Error('ERR_LOGIN_FAILED')
    }
    if (!profile) {
      strategyDebug(
        this,
        'the assertion verified but carried no subject, so there is nobody in it to sign in'
      )
      throw new Error('ERR_NO_PROVIDER_ACCOUNT')
    }
    // -> The names and not the values: which attributes an identity provider actually asserts is what
    //    the four Field Mapping settings have to be chosen from, and is never quite what its
    //    documentation says — AD FS and Entra both send URI-shaped ones
    strategyDebug(this, `the assertion carries: ${Object.keys(profile).join(', ')}`)

    /*
      Attributes are read off the profile, where `node-saml` puts each of them under its own name
      alongside the NameID and the rest of the assertion's own fields. A configured mapping is
      therefore looked up as a plain key, which is what lets it be either a bare attribute name or one
      of the URI-shaped ones an AD FS or an Entra assertion uses.
    */
    const id = this.attr(profile, this.conf.mappingUID) ?? profile.nameID
    if (!id) {
      strategyDebug(
        this,
        `neither \`${this.conf.mappingUID || '(no Unique ID mapping)'}\` nor the NameID identifies this account`
      )
      throw new Error('ERR_NO_PROVIDER_ACCOUNT')
    }
    const email = this.attr(profile, this.conf.mappingEmail)
    if (!email) {
      strategyDebug(
        this,
        `\`${this.conf.mappingEmail || '(no Email mapping)'}\` carries no address, and an account here is matched by address`
      )
      throw new Error('ERR_NO_EMAIL_FROM_PROVIDER')
    }
    this.checkEmailVerified(profile, email)
    const groups = this.conf.mapGroups === true ? this.groupsFrom(profile) : undefined
    strategyDebug(
      this,
      `${id} signs in as <${email}>${groups ? `, in ${groups.length} asserted group(s)` : ', groups not mapped'}`
    )
    return {
      id,
      email,
      name: this.attr(profile, this.conf.mappingDisplayName) || email,
      picture: this.attr(profile, this.conf.mappingPicture),
      meta: this.metaFrom(profile),
      ...(groups
        ? {
            groups,
            groupsExclusive: this.conf.unassignMissingGroups === true
          }
        : {})
    }
  }

  /**
   * What a response the library refused is made of, for the log.
   *
   * The library's reason is one line — `Invalid document signature` — which does not say which of the
   * handful of things behind it is the case: a response the provider signed only inside, a certificate
   * other than the configured one, an audience or a validity window that does not line up. Each of
   * those is in the document, so this reads it again for its shape: which parts are signed, with
   * what and by which certificate, who issued it, for whom and for how long. Never an attribute and
   * never the NameID, which are the person's.
   *
   * A description and nothing more. Elements are matched by local name with no namespace resolved,
   * which a verifier must never do and a description can afford, since nothing here decides anything.
   */
  private describeResponse(samlResponse: unknown): string[] {
    const $ = cheerio.load(Buffer.from(String(samlResponse), 'base64').toString('utf8'), {
      xml: true
    })
    const textOf = (el: Element | undefined): string => (el ? $(el).text().trim() : '')
    const root = $.root().children().get()[0]
    if (root?.name.split(':').pop() !== 'Response') {
      return [
        `the posted SAMLResponse is not a SAML Response${root ? ` but a <${root.name}>` : ', or not XML at all'}`
      ]
    }
    const lines: string[] = []

    const configured = splitCerts(this.conf.cert).map(thumbprintOf)
    configured.forEach((thumbprint, index) => {
      if (!thumbprint) {
        lines.push(`configured certificate ${index + 1} cannot be read as an X.509 certificate`)
      }
    })
    const signedBy = (el: Element, what: string): string => {
      const signature = childNamed(el, 'Signature')
      if (!signature) {
        return `${what} is not signed`
      }
      const signedInfo = childNamed(signature, 'SignedInfo')
      const algorithm =
        childNamed(signedInfo, 'SignatureMethod')?.attribs.Algorithm?.split('#').pop() ??
        'no named algorithm'
      const reference = childNamed(signedInfo, 'Reference')?.attribs.URI
      const scope =
        reference === `#${el.attribs.ID}`
          ? ''
          : `, over ${reference ? `\`${reference}\`` : 'no reference'} rather than its own ID \`${el.attribs.ID}\``
      const keyCert = textOf(
        childNamed(childNamed(childNamed(signature, 'KeyInfo'), 'X509Data'), 'X509Certificate')
      )
      if (!keyCert) {
        return `${what} is signed (${algorithm})${scope}, naming no certificate`
      }
      const thumbprint = thumbprintOf(keyCert)
      if (!thumbprint) {
        return `${what} is signed (${algorithm})${scope}, naming a certificate that cannot be read`
      }
      const match = configured.indexOf(thumbprint)
      return `${what} is signed (${algorithm})${scope} by certificate ${thumbprint}, which ${match >= 0 ? `is configured certificate ${match + 1}` : `is none of the ${configured.length} configured`}`
    }

    lines.push(signedBy(root, 'the response'))
    if (!childNamed(root, 'Signature') && this.conf.wantAuthnResponseSigned === true) {
      lines.push(
        'Require Signed Response is on, which refuses a response not signed as a whole before its assertion is looked at. A provider signing only the assertion — AD FS unless its relying party trust says SamlResponseSignature MessageAndAssertion — has to be told to sign the response too, or the setting turned off'
      )
    }
    const assertions = childrenNamed(root, 'Assertion')
    const encrypted = childrenNamed(root, 'EncryptedAssertion')
    if (assertions.length + encrypted.length > 1) {
      lines.push(
        `it carries ${assertions.length + encrypted.length} assertions, where only one is ever accepted`
      )
    }
    if (encrypted.length > 0) {
      lines.push(
        `its assertion is encrypted, and this strategy has ${this.conf.decryptionPvk ? 'a' : 'no'} Decryption Private Key to read it with`
      )
    }
    const assertion = assertions[0]
    if (assertion) {
      lines.push(signedBy(assertion, 'its assertion'))
    } else if (encrypted.length < 1) {
      lines.push('it carries no assertion')
    }

    const issuer = textOf(childNamed(root, 'Issuer')) || textOf(childNamed(assertion, 'Issuer'))
    const statusCode = childNamed(childNamed(root, 'Status'), 'StatusCode')
    const status = [statusCode, childNamed(statusCode, 'StatusCode')]
      .map((el) => el?.attribs.Value?.split(':').pop())
      .filter(Boolean)
      .join('/')
    const statusMessage = textOf(childNamed(childNamed(root, 'Status'), 'StatusMessage'))
    const destination = root.attribs.Destination
    lines.push(
      `it was issued by ${issuer ? `\`${issuer}\`` : 'nobody it names'} to ${destination ? `\`${destination}\`` : 'no destination'}, with status ${status || 'none'}${statusMessage ? ` (${statusMessage})` : ''}`
    )

    if (assertion) {
      const conditions = childNamed(assertion, 'Conditions')
      const audiences = childrenNamed(conditions, 'AudienceRestriction')
        .flatMap((restriction) => childrenNamed(restriction, 'Audience'))
        .map((el) => `\`${textOf(el)}\``)
      lines.push(
        `its assertion is for ${audiences.join(', ') || 'no audience in particular'} where \`${this.conf.audience || this.conf.issuer}\` is expected, valid from ${conditions?.attribs.NotBefore ?? 'any time'} until ${conditions?.attribs.NotOnOrAfter ?? 'any time'} by the provider's clock, and this server's reads ${Temporal.Now.instant().toString({ smallestUnit: 'second' })}`
      )
    }
    return lines
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
   * Hold the provider to having verified the email address, when the strategy requires it.
   *
   * Not read through `attr()`, which keeps strings only: an attribute is normally text by the time
   * `node-saml` hands it over, but a boolean is let through too rather than refused for its type. The
   * first value is taken, as everywhere else.
   *
   * What counts as yes is `xs:boolean`'s own lexical space — `true` and `1` — plus `True` and any
   * other casing of it, which is not valid XML Schema but is what AD FS sends, being .NET's
   * `Boolean.ToString()`. Nothing looser: `yes` or `verified` is not a boolean in any schema a
   * provider would write against, and a value this has to guess at is one it should refuse.
   *
   * Absent counts as not verified — this is the check that stops an address nobody proved they hold
   * from logging into the account that has it, so the direction for it to fail in is closed.
   *
   * @throws `ERR_EMAIL_NOT_VERIFIED`
   */
  private checkEmailVerified(profile: Record<string, any>, email: string): void {
    if (this.conf.requireVerifiedEmail !== true) {
      return
    }
    const name = this.conf.mappingVerifiedEmail || 'email_verified'
    const value = profile[name]
    const first = Array.isArray(value) ? value[0] : value
    const verified = typeof first === 'string' ? first.trim().toLowerCase() : first
    if (verified !== true && verified !== 'true' && verified !== '1') {
      strategyDebug(
        this,
        `\`${name}\` does not say <${email}> is verified (it says ${JSON.stringify(value) ?? 'nothing'}), and this strategy requires a verified address (Verified Email Field Mapping)`
      )
      throw new Error('ERR_EMAIL_NOT_VERIFIED')
    }
  }

  /**
   * The profile fields the assertion carries, for those an administrator has mapped.
   *
   * Every one is unmapped by default, so people keep what they set here. A mapped attribute missing
   * from the assertion leaves the field alone too — a provider asserts the attributes it has been
   * told to release to this service provider, so one it leaves out has usually not been, which is
   * not the same as saying the person has none. An attribute asserted empty does clear it, which is
   * why this does not go through `attr()`.
   */
  private metaFrom(profile: Record<string, any>): ProviderProfile['meta'] {
    const meta: ProviderProfile['meta'] = {}
    for (const [key, setting] of Object.entries(META_MAPPINGS) as [
      ProviderProfileMetaKey,
      string
    ][]) {
      const name = this.conf[setting]
      if (!name) {
        continue
      }
      const value = profile[name]
      const first = Array.isArray(value) ? value[0] : value
      if (typeof first !== 'string') {
        strategyDebug(this, `\`${name}\` carries no text for ${key}, which is left as it was`)
        continue
      }
      meta[key] = first
    }
    return meta
  }

  /**
   * The group names the assertion carries.
   *
   * Either one name or a list of them: a provider sending a single group commonly sends the bare
   * string, and both forms mean the same thing here.
   */
  private groupsFrom(profile: Record<string, any>): string[] {
    const attribute = this.conf.mappingGroups || 'memberOf'
    const value = profile[attribute]
    const raw = typeof value === 'string' ? [value] : Array.isArray(value) ? value : []
    const names = raw
      .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim())
    /*
      Logged even when it is empty, and especially then: a provider asserts group membership only for
      a relying party configured to receive it, and an empty answer is not distinguishable on the
      wiki side from somebody genuinely being in no group.
    */
    strategyDebug(
      this,
      `\`${attribute}\` names ${names.length} group(s): ${names.join(', ') || 'none'}`
    )
    return names
  }
}
