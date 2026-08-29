import { createTransport } from 'nodemailer'
import type { Transporter } from 'nodemailer'

/**
 * The templates this wiki sends, and what each one needs.
 *
 * Two of them are the ones the admin area names under Mail Templates; `test` is the button beside
 * them. Held as literals rather than rows in a table because nothing sends a mail this wiki did not
 * ask it to — a template is part of the flow that uses it, and a flow that gained one would have to
 * gain code here anyway.
 */
export interface MailTemplateData {
  welcome: {
    /** Who the account was created for, as they typed it. */
    name: string
    /** Where the site the account was created on lives, without a trailing slash. */
    baseUrl: string
    /**
     * Where to go to confirm the address, when it has to be confirmed at all. Absent on a site whose
     * local strategy does not validate addresses, where the account is usable as soon as it is made.
     *
     * A page that asks, not a link that acts: fetching it confirms nothing, which is what keeps the
     * mail scanners that follow every link in a message from spending the token before the reader
     * does.
     */
    verifyUrl?: string
  }
  resetPwd: {
    name: string
    baseUrl: string
    /** Where to choose the new password. Stands for the request until it is used or expires. */
    resetUrl: string
  }
  test: {
    baseUrl: string
  }
}

/** A template key, i.e. one of the keys of `MailTemplateData`. */
export type MailTemplate = keyof MailTemplateData

/** What a rendered template is: a subject line and the two bodies every mail carries. */
interface RenderedMail {
  subject: string
  text: string
  html: string
}

/**
 * The SMTP settings, as they are stored under the `mail` key of the settings table.
 *
 * Everything here is what an administrator typed in the admin area's Mail page, which is also the
 * only thing that writes it — see `api/mail.ts`.
 */
interface MailConfig {
  senderName?: string
  senderEmail?: string
  defaultBaseURL?: string
  host?: string
  port?: number
  name?: string
  secure?: boolean
  verifySSL?: boolean
  user?: string
  pass?: string
  useDKIM?: boolean
  dkimDomainName?: string
  dkimKeySelector?: string
  dkimPrivateKey?: string
}

/** One outgoing mail, as the models ask for it. */
export interface MailRequest<K extends MailTemplate = MailTemplate> {
  /** The site the mail is about, which is what names the wiki in it. */
  siteId: string
  to: string
  template: K
  data: MailTemplateData[K]
}

/**
 * Take a value out of the template language it is being put into.
 *
 * Every substitution below is a name somebody typed or a URL built from a hostname, so all of it goes
 * through here on the way into the HTML body. The text body needs none of it.
 */
function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * The HTML body every mail shares: a heading, some paragraphs, at most one button.
 *
 * Written as a table with inline styles and no external anything, which is what a mail client will
 * actually render — the stylesheet, the web font and the background image a page would use are all
 * either stripped or blocked by the ones people read mail in.
 */
function htmlShell({
  title,
  body,
  action,
  footer
}: {
  title: string
  /** Paragraphs, already escaped. */
  body: string[]
  action?: { label: string; url: string }
  footer: string
}): string {
  const paragraphs = body
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#37474f;">${p}</p>`)
    .join('')
  const button = action
    ? `<p style="margin:0 0 16px;"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 24px;border-radius:4px;background:#1976d2;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(action.label)}</a></p>` +
      // -> The same link in full, for the client that will not render the button and for the reader
      //    who wants to see where it goes before following it
      `<p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#78909c;word-break:break-all;">${escapeHtml(action.url)}</p>`
    : ''
  return [
    '<!DOCTYPE html>',
    '<html><body style="margin:0;padding:24px;background:#eceff1;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:6px;">',
    '<tr><td style="padding:32px;">',
    `<h1 style="margin:0 0 24px;font-size:20px;line-height:1.4;color:#263238;">${escapeHtml(title)}</h1>`,
    paragraphs,
    button,
    `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eceff1;font-size:12px;line-height:1.6;color:#90a4ae;">${escapeHtml(footer)}</p>`,
    '</td></tr></table></body></html>'
  ].join('')
}

/**
 * Mail model
 *
 * The one way anything in this wiki sends an email, and the only place nodemailer is used. Three
 * flows need it — confirming an address at registration, resetting a forgotten password, and the
 * admin area's test button — and all three go through `send()`.
 *
 * **A wiki with no SMTP settings is the normal case.** Plenty of instances never configure one, so
 * nothing here throws on its own: `isConfigured` is what a caller asks first, and what decides
 * whether a flow that needs mail is offered at all. `send()` refuses with `ERR_MAIL_NOT_CONFIGURED`
 * rather than failing obscurely inside the transport, so a flow that got that far says something
 * an administrator can act on.
 *
 * The transport is built once and kept, and rebuilt when the settings behind it change —
 * `configFingerprint()` is how that is noticed, rather than an event, because the settings can be
 * changed on another instance in an HA set and this one would never hear about it.
 */
class Mail {
  private transporter: Transporter | null = null
  private fingerprint = ''

  /** The stored settings, whatever state they are in. */
  private get config(): MailConfig {
    return (WIKI.config.mail ?? {}) as MailConfig
  }

  /**
   * Whether mail can be sent at all.
   *
   * A host and a sender address, which are the two things no default can stand in for. Everything
   * else has one: a port, whether to use TLS, and credentials that plenty of relays do not want.
   */
  get isConfigured(): boolean {
    const conf = this.config
    return Boolean(conf.host?.trim() && conf.senderEmail?.trim())
  }

  /**
   * What the current transport was built from. A change here is what invalidates it.
   */
  private configFingerprint(): string {
    const conf = this.config
    return JSON.stringify([
      conf.host,
      conf.port,
      conf.name,
      conf.secure,
      conf.verifySSL,
      conf.user,
      conf.pass,
      conf.useDKIM,
      conf.dkimDomainName,
      conf.dkimKeySelector,
      conf.dkimPrivateKey
    ])
  }

  private getTransporter(): Transporter {
    const fingerprint = this.configFingerprint()
    if (this.transporter && fingerprint === this.fingerprint) {
      return this.transporter
    }
    this.transporter?.close?.()
    const conf = this.config
    this.transporter = createTransport({
      host: conf.host,
      port: conf.port ?? 465,
      secure: conf.secure ?? true,
      // -> The name this client identifies itself as in EHLO. Left off, nodemailer sends the machine
      //    hostname, which is what most relays expect.
      ...(conf.name?.trim() && { name: conf.name.trim() }),
      // -> No credentials at all rather than empty ones: a relay that authenticates by IP address
      //    refuses an empty AUTH instead of skipping it.
      ...(conf.user?.trim() && {
        auth: {
          user: conf.user.trim(),
          pass: conf.pass ?? ''
        }
      }),
      tls: {
        rejectUnauthorized: conf.verifySSL !== false
      },
      ...(conf.useDKIM &&
        conf.dkimPrivateKey?.trim() && {
          dkim: {
            domainName: conf.dkimDomainName ?? '',
            keySelector: conf.dkimKeySelector ?? '',
            privateKey: conf.dkimPrivateKey
          }
        })
    })
    this.fingerprint = fingerprint
    return this.transporter
  }

  /**
   * Where links in emails point, without a trailing slash.
   *
   * Three answers, in the order they are preferred:
   *
   * 1. The configured base URL, which is the only one an administrator has actually vouched for. An
   *    instance behind a proxy, on a private address, or answering to several hostnames cannot be
   *    trusted to describe itself to somebody reading a mail somewhere else.
   * 2. The site's own hostname, which is what the account is on — and which is not necessarily the
   *    host the request came in on: an administrator creating an account for another site is doing
   *    exactly that. Skipped for the wildcard site, which names no host.
   * 3. What the request was addressed to, which is right often enough that a small instance never has
   *    to configure anything.
   *
   * @param req The request that triggered the mail, when there is one
   * @param siteId The site the mail is about, when it is about one
   */
  baseUrl({
    req,
    siteId
  }: { req?: { protocol: string; host: string }; siteId?: string } = {}): string {
    const configured = this.config.defaultBaseURL?.trim()
    if (configured) {
      return configured.replace(/\/+$/, '')
    }
    const hostname = siteId ? WIKI.sites[siteId]?.hostname : null
    if (hostname && hostname !== '*') {
      // -> The scheme the caller was reached by, since the hostname alone does not carry one
      return `${req?.protocol ?? 'https'}://${hostname}`
    }
    if (req) {
      return `${req.protocol}://${req.host}`
    }
    return ''
  }

  /**
   * What to call this wiki in a mail. Per site, since that is what the reader was looking at.
   */
  private siteName(siteId: string): string {
    return WIKI.sites[siteId]?.config?.title || 'Wiki.js'
  }

  /**
   * Render one of the templates.
   *
   * Both bodies are built from the same values: the text one is what a client that will not render
   * HTML shows, and is also what keeps the mail out of a spam folder that scores HTML-only mail.
   */
  private render<K extends MailTemplate>(
    siteName: string,
    template: K,
    data: MailTemplateData[K]
  ): RenderedMail {
    switch (template) {
      case 'welcome': {
        const d = data as MailTemplateData['welcome']
        const footer = `You are receiving this because an account was created for this address on ${siteName}.`
        if (d.verifyUrl) {
          return {
            subject: `Confirm your email address — ${siteName}`,
            text: [
              `Hi ${d.name},`,
              '',
              `An account was created for this address on ${siteName}. Confirm that it is yours to finish signing up:`,
              '',
              d.verifyUrl,
              '',
              'This link is valid for 24 hours. If you did not create this account, you can ignore this message.',
              '',
              footer
            ].join('\n'),
            html: htmlShell({
              title: 'Confirm your email address',
              body: [
                `Hi ${escapeHtml(d.name)},`,
                `An account was created for this address on ${escapeHtml(siteName)}. Confirm that it is yours to finish signing up.`,
                'This link is valid for 24 hours. If you did not create this account, you can ignore this message.'
              ],
              action: { label: 'Confirm my email address', url: d.verifyUrl },
              footer
            })
          }
        }
        return {
          subject: `Welcome to ${siteName}`,
          text: [
            `Hi ${d.name},`,
            '',
            `Your account on ${siteName} is ready. You can sign in at any time:`,
            '',
            `${d.baseUrl}/login`,
            '',
            footer
          ].join('\n'),
          html: htmlShell({
            title: `Welcome to ${escapeHtml(siteName)}`,
            body: [
              `Hi ${escapeHtml(d.name)},`,
              'Your account is ready. You can sign in at any time.'
            ],
            action: { label: 'Go to the wiki', url: `${d.baseUrl}/login` },
            footer
          })
        }
      }
      case 'resetPwd': {
        const d = data as MailTemplateData['resetPwd']
        const footer = `You are receiving this because a password reset was requested for this address on ${siteName}.`
        return {
          subject: `Reset your password — ${siteName}`,
          text: [
            `Hi ${d.name},`,
            '',
            `Somebody asked to reset the password for your account on ${siteName}. Choose a new one here:`,
            '',
            d.resetUrl,
            '',
            'This link is valid for 24 hours and can only be used once. If you did not ask for this, nothing has changed and you can ignore this message.',
            '',
            footer
          ].join('\n'),
          html: htmlShell({
            title: 'Reset your password',
            body: [
              `Hi ${escapeHtml(d.name)},`,
              `Somebody asked to reset the password for your account on ${escapeHtml(siteName)}.`,
              'This link is valid for 24 hours and can only be used once. If you did not ask for this, nothing has changed and you can ignore this message.'
            ],
            action: { label: 'Choose a new password', url: d.resetUrl },
            footer
          })
        }
      }
      default: {
        const d = data as MailTemplateData['test']
        const footer =
          'You are receiving this because somebody sent a test email from the Wiki.js admin area.'
        return {
          subject: `Test email — ${siteName}`,
          text: [
            'This is a test email.',
            '',
            `If you are reading it, ${siteName} can send mail through the SMTP server it is configured with.`,
            '',
            d.baseUrl,
            '',
            footer
          ].join('\n'),
          html: htmlShell({
            title: 'This is a test email',
            body: [
              `If you are reading it, ${escapeHtml(siteName)} can send mail through the SMTP server it is configured with.`
            ],
            footer
          })
        }
      }
    }
  }

  /**
   * Send one mail, and wait for the relay to have taken it.
   *
   * Waiting is deliberate: every caller has something to tell the user about the result — a
   * registration that says to go and check, a reset that says the same, a test button whose entire
   * purpose is the answer — and a queued send would have to report success before it knew.
   *
   * @throws `ERR_MAIL_NOT_CONFIGURED` when there is no SMTP server to send through, and whatever
   *         nodemailer raises for a send that was attempted and failed
   */
  async send<K extends MailTemplate>({
    siteId,
    to,
    template,
    data
  }: MailRequest<K>): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('ERR_MAIL_NOT_CONFIGURED')
    }
    const conf = this.config
    const siteName = this.siteName(siteId)
    const { subject, text, html } = this.render(siteName, template, data)
    WIKI.logger.debug(`Sending ${template} email to <${to}>...`)
    await this.getTransporter().sendMail({
      from: {
        name: conf.senderName?.trim() || siteName,
        address: conf.senderEmail!.trim()
      },
      to,
      subject,
      text,
      html
    })
    WIKI.logger.info(`Sent ${template} email to <${to}>.`)
  }
}

export const mail = new Mail()
