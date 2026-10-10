import { createTransport } from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { locales } from './locales.ts'
import type { Translator } from './locales.ts'

/**
 * The templates this wiki sends, and what each one needs.
 *
 * Two of them belong to a flow — registration and a forgotten password; `test` is the admin area's
 * button; `notification` and `notificationDigest` are what the notification system sends (see
 * `notifications/mailer.ts`). Held as literals rather than rows in a table because nothing sends a mail this wiki did
 * not ask it to — a template is part of the flow that uses it, and a flow that gained one would
 * have to gain code here anyway.
 *
 * **What each one SAYS is not here**: every string lives in `locales/en.json` under `mail.*` and is
 * translated with the rest of the interface, so adding a template means adding its keys there. See
 * `render`.
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
  /** One notification, on its own. */
  notification: MailNotificationData
  /** Several, gathered into one mail — whatever came due for one person on one site at once. */
  notificationDigest: MailNotificationData
}

/** One notification as a mail describes it. Everything here is already resolved to text and URLs. */
export interface MailNotificationEntry {
  /** A category key, which is what picks the strings. */
  category: string
  variant: string
  /** How many events the entry absorbed. */
  count: number
  actorName: string | null
  pageTitle: string
  /** A comment's first lines, as typed. */
  excerpt?: string
  /** Set in place of `excerpt` for a comment on a password-protected page, which is not quoted. */
  excerptWithheld?: boolean
  /** Set when nobody did it by hand: `import` or `bulk`. */
  origin?: string
  /** Where the entry leads. */
  url: string
}

export interface MailNotificationData {
  baseUrl: string
  entries: MailNotificationEntry[]
  /** How many more there were than a digest lists. */
  more: number
  /** Profile → Notifications. */
  manageUrl: string
  /** The page that asks before it unsubscribes, which is what a link in the body may point at. */
  unsubscribeUrl: string
}

/** A template key, i.e. one of the keys of `MailTemplateData`. */
export type MailTemplate = keyof MailTemplateData

/**
 * One mail as its template describes it, before either body exists.
 *
 * Every mail this wiki sends is the same shape — a heading, some paragraphs, at most one thing to
 * press — so a template says what goes in those slots and nothing about how they are drawn. Which
 * is what lets the HTML body and the text body be two renderings of one description rather than
 * two hand-written copies that drift: the pair of them used to be written out per template, and a
 * string changed in one was a string not changed in the other.
 */
interface MailContent {
  subject: string
  /** The heading, which is the subject without the site's name repeated in it. */
  title: string
  /** Paragraphs, as plain text: escaping is the business of whichever body they end up in. */
  body: string[]
  /**
   * A list of things, each leading somewhere — what a digest is made of. Drawn after the paragraphs
   * and before the action.
   */
  items?: { text: string; detail?: string; url: string }[]
  action?: { label: string; url: string }
  footer: string
  /** Small links under the footer: where a notification mail says how to stop receiving it. */
  links?: { label: string; url: string }[]
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

/**
 * The site a mail is about, as far as the mail needs to know it.
 *
 * Passed in rather than looked up, because the notification mails are sent from a worker thread,
 * which has no `WIKI.sites`. Everything else builds it with `siteFor`.
 */
export interface MailSite {
  /** What the mail calls the wiki. */
  name: string
  /** The language to write in when nothing is known about the recipient's. */
  primaryLocale: string | null
}

/** One outgoing mail, as the models ask for it. */
export interface MailRequest<K extends MailTemplate = MailTemplate> {
  /** The site the mail is about, which is what names the wiki in it. */
  site: MailSite
  to: string
  template: K
  data: MailTemplateData[K]
  /**
   * What language to write it in, when anything is known about the recipient's.
   *
   * The caller's job rather than this model's, because what is known differs at every send site and
   * none of it is reachable from here: an account's own `prefs.locale`, the locale the browser
   * making the request was reading the wiki in, or nothing at all for a mail nobody asked for. A
   * locale that is not installed is ignored, so a value straight off a request body is safe to pass.
   *
   * Left empty, the mail is written in the site's primary locale — see `localeFor`.
   */
  locale?: string | null
  /** Extra headers, e.g. `List-Unsubscribe`. */
  headers?: Record<string, string>
}

/**
 * The headers a DKIM signature covers: nodemailer's own default list, which is RFC 4871's, plus
 * `List-Unsubscribe-Post`.
 *
 * RFC 8058 requires both unsubscribe headers to be signed, and Gmail and Yahoo will not honour
 * one-click unsubscribe without that — nodemailer's default covers `List-Unsubscribe` and not the
 * second one. Setting the option replaces the default rather than adding to it, hence the full list.
 */
const DKIM_SIGNED_HEADERS = [
  'From',
  'Sender',
  'Reply-To',
  'Subject',
  'Date',
  'Message-ID',
  'To',
  'Cc',
  'MIME-Version',
  'Content-Type',
  'Content-Transfer-Encoding',
  'Content-ID',
  'Content-Description',
  'Resent-Date',
  'Resent-From',
  'Resent-Sender',
  'Resent-To',
  'Resent-Cc',
  'Resent-Message-ID',
  'In-Reply-To',
  'References',
  'List-Id',
  'List-Help',
  'List-Unsubscribe',
  'List-Unsubscribe-Post',
  'List-Subscribe',
  'List-Post',
  'List-Owner',
  'List-Archive'
].join(':')

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
 *
 * **The direction is declared three times on purpose.** Gmail and Outlook.com drop the `<html>` and
 * `<body>` elements and paste what is between them into their own document, taking any `dir` on
 * them with it — so a right-to-left mail read there would come out left-aligned, with its
 * punctuation at the wrong end, unless the cell that survives carries the direction itself.
 */
function htmlShell(
  { title, body, items, action, footer, links }: MailContent,
  isRTL: boolean
): string {
  const dir = isRTL ? 'rtl' : 'ltr'
  const align = isRTL ? 'right' : 'left'
  const paragraphs = body
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#37474f;">${escapeHtml(p)}</p>`
    )
    .join('')
  const list = items?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;">` +
      items
        .map(
          (item) =>
            `<tr><td dir="${dir}" style="padding:10px 0;border-bottom:1px solid #eceff1;text-align:${align};">` +
            `<a href="${escapeHtml(item.url)}" style="font-size:15px;line-height:1.5;color:#1976d2;text-decoration:none;">${escapeHtml(item.text)}</a>` +
            (item.detail
              ? `<div style="margin-top:4px;font-size:13px;line-height:1.5;color:#78909c;">${escapeHtml(item.detail)}</div>`
              : '') +
            '</td></tr>'
        )
        .join('') +
      '</table>'
    : ''
  const button = action
    ? `<p style="margin:0 0 16px;"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 24px;border-radius:4px;background:#1976d2;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(action.label)}</a></p>` +
      // -> The same link in full, for the client that will not render the button and for the reader
      //    who wants to see where it goes before following it. Always left to right: a URL is not
      //    written in the language around it, and bidi reordering makes one unreadable.
      `<p dir="ltr" style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#78909c;word-break:break-all;text-align:${align};">${escapeHtml(action.url)}</p>`
    : ''
  return [
    '<!DOCTYPE html>',
    `<html dir="${dir}"><body dir="${dir}" style="margin:0;padding:24px;background:#eceff1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">`,
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:6px;">',
    `<tr><td dir="${dir}" style="padding:32px;text-align:${align};">`,
    `<h1 style="margin:0 0 24px;font-size:20px;line-height:1.4;color:#263238;">${escapeHtml(title)}</h1>`,
    paragraphs,
    list,
    button,
    `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eceff1;font-size:12px;line-height:1.6;color:#90a4ae;">${escapeHtml(footer)}</p>`,
    links?.length
      ? `<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#90a4ae;">${links
          .map(
            (link) =>
              `<a href="${escapeHtml(link.url)}" style="color:#78909c;">${escapeHtml(link.label)}</a>`
          )
          .join(' &middot; ')}</p>`
      : '',
    '</td></tr></table></body></html>'
  ].join('')
}

/**
 * The text body, which is the same description with nothing drawn around it.
 *
 * Every client that will not render HTML shows this one, and it is also what keeps a mail out of
 * the spam folder a filter puts HTML-only messages in. Every field of the description appears,
 * including the title: it is a heading in the HTML body and a first line here, and a paragraph
 * written under one refers to it — "if you are reading it" has nothing to point at in a text body
 * that opened with the sentence itself.
 *
 * The action's URL goes after the paragraphs rather than beside whichever sentence introduces it,
 * so that the two bodies say things in the same order — the button sits after the paragraphs in
 * the HTML one for the same reason.
 */
function textBody({ title, body, items, action, footer, links }: MailContent): string {
  return [
    title,
    ...body,
    ...(items ?? []).map((item) =>
      [`- ${item.text}`, ...(item.detail ? [`  ${item.detail}`] : []), `  ${item.url}`].join('\n')
    ),
    ...(action ? [action.url] : []),
    footer,
    ...(links ?? []).map((link) => `${link.label}: ${link.url}`)
  ].join('\n\n')
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
 *
 * **Nothing here is written in English.** Every string comes out of `locales/en.json` under `mail.*`
 * through `locales.translator`, which is the same string set and the same CrowdIn pipeline the
 * interface uses — so a locale somebody translates arrives in the mails as well, and a template
 * added here is a set of keys added there. Which language one mail is written in is `localeFor`.
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
            privateKey: conf.dkimPrivateKey,
            headerFieldNames: DKIM_SIGNED_HEADERS
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
   * @param hostname That site's hostname, for a caller with no `WIKI.sites` to look it up in
   */
  baseUrl({
    req,
    siteId,
    hostname: knownHostname
  }: {
    req?: { protocol: string; host: string }
    siteId?: string
    hostname?: string
  } = {}): string {
    const configured = this.config.defaultBaseURL?.trim()
    if (configured) {
      return configured.replace(/\/+$/, '')
    }
    const hostname = knownHostname ?? (siteId ? WIKI.sites[siteId]?.hostname : null)
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
   * What a mail needs to know about a site, from the site configurations this process holds.
   *
   * The name is per site, since that is what the reader was looking at.
   */
  siteFor(siteId: string): MailSite {
    const config = WIKI.sites[siteId]?.config
    return { name: config?.title || 'Wiki.js', primaryLocale: config?.locales?.primary || null }
  }

  /**
   * The language a mail is written in.
   *
   * What the caller knows about the recipient, and the site's primary locale when it knows nothing
   * — which is the wiki's own language, and the right answer for a mail about a site rather than
   * one addressed to a reader with a preference. `translator` takes it from there: a code naming a
   * locale that is not installed falls back to English rather than sending a mail full of keys.
   */
  private localeFor(locale: string | null | undefined, site: MailSite): string | null {
    return locale || site.primaryLocale || null
  }

  /**
   * Describe one of the templates in the locale it is being sent in.
   *
   * Strings come from `locales/en.json` under `mail.*` and are translated with the rest of the
   * interface, so what is left here is which keys a template uses and what it puts in them. Both
   * bodies are rendered from the one description that comes out — see `MailContent`.
   */
  private render<K extends MailTemplate>(
    { t }: Translator,
    siteName: string,
    template: K,
    data: MailTemplateData[K]
  ): MailContent {
    switch (template) {
      case 'welcome': {
        const d = data as MailTemplateData['welcome']
        if (d.verifyUrl) {
          return {
            subject: t('mail.welcome.verify.subject', { siteName }),
            title: t('mail.welcome.verify.title'),
            body: [
              t('mail.common.greeting', { name: d.name }),
              t('mail.welcome.verify.body', { siteName }),
              t('mail.welcome.verify.expiry')
            ],
            action: { label: t('mail.welcome.verify.action'), url: d.verifyUrl },
            footer: t('mail.welcome.footer', { siteName })
          }
        }
        return {
          subject: t('mail.welcome.subject', { siteName }),
          title: t('mail.welcome.subject', { siteName }),
          body: [t('mail.common.greeting', { name: d.name }), t('mail.welcome.body', { siteName })],
          action: { label: t('mail.welcome.action'), url: `${d.baseUrl}/login` },
          footer: t('mail.welcome.footer', { siteName })
        }
      }
      case 'resetPwd': {
        const d = data as MailTemplateData['resetPwd']
        return {
          subject: t('mail.resetPwd.subject', { siteName }),
          title: t('mail.resetPwd.title'),
          body: [
            t('mail.common.greeting', { name: d.name }),
            t('mail.resetPwd.body', { siteName }),
            t('mail.resetPwd.expiry')
          ],
          action: { label: t('mail.resetPwd.action'), url: d.resetUrl },
          footer: t('mail.resetPwd.footer', { siteName })
        }
      }
      case 'notification':
      case 'notificationDigest':
        return this.renderNotification(t, siteName, data as MailTemplateData['notification'])
      default: {
        const d = data as MailTemplateData['test']
        return {
          subject: t('mail.test.subject', { siteName }),
          title: t('mail.test.title'),
          body: [t('mail.test.body', { siteName })],
          action: { label: t('mail.test.action'), url: d.baseUrl },
          footer: t('mail.test.footer')
        }
      }
    }
  }

  /**
   * A notification mail: one entry told in full, or several as a list.
   *
   * The sentence describing an entry is the same one the inbox draws —
   * `notifications.messages.<category>.<variant>` — so a person reads the same words in both places,
   * and a translator translates them once.
   */
  private renderNotification(
    t: Translator['t'],
    siteName: string,
    d: MailNotificationData
  ): MailContent {
    const describe = (entry: MailNotificationEntry) =>
      t(`notifications.messages.${entry.category}.${entry.variant}`, {
        actor: entry.actorName || t('notifications.someone'),
        page: entry.pageTitle
      })
    const detailOf = (entry: MailNotificationEntry) =>
      [
        ...(entry.count > 1 ? [t('notifications.count', { count: entry.count })] : []),
        ...(entry.origin ? [t(`notifications.origin.${entry.origin}`)] : [])
      ].join(' · ')
    // -> What stands where the comment would be quoted: its text, or why it is not there
    const quoteOf = (entry: MailNotificationEntry) =>
      entry.excerptWithheld
        ? t('notifications.excerptWithheld')
        : entry.excerpt
          ? `“${entry.excerpt}”`
          : ''
    const footer = t('mail.notification.footer', { siteName })
    const links = [
      { label: t('mail.notification.manage'), url: d.manageUrl },
      { label: t('mail.notification.unsubscribe'), url: d.unsubscribeUrl }
    ]

    if (d.entries.length === 1 && d.more < 1) {
      const entry = d.entries[0]!
      const message = describe(entry)
      const detail = detailOf(entry)
      return {
        subject: t('mail.notification.subject', { siteName, message }),
        title: message,
        body: [quoteOf(entry), detail].filter(Boolean),
        action: {
          label: t(`mail.notification.actions.${entry.category}`),
          url: entry.url
        },
        footer,
        links
      }
    }

    const total = d.entries.length + d.more
    return {
      subject: t('mail.notificationDigest.subject', { siteName, count: total }),
      title: t('mail.notificationDigest.title', { siteName }),
      body: [t('mail.notificationDigest.body', { count: total })],
      items: d.entries.map((entry) => {
        const detail = [quoteOf(entry), detailOf(entry)].filter(Boolean).join(' — ')
        return { text: describe(entry), url: entry.url, ...(detail && { detail }) }
      }),
      action: {
        label:
          d.more > 0
            ? t('mail.notificationDigest.more', { count: d.more })
            : t('mail.notificationDigest.action'),
        url: `${d.baseUrl}/_inbox`
      },
      footer,
      links
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
    site,
    to,
    template,
    data,
    locale,
    headers
  }: MailRequest<K>): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('ERR_MAIL_NOT_CONFIGURED')
    }
    const conf = this.config
    const siteName = site.name
    // -> The model itself rather than `WIKI.models.locales`, which a worker thread does not have
    const translator = await locales.translator(this.localeFor(locale, site))
    const content = this.render(translator, siteName, template, data)
    const { subject } = content
    const text = textBody(content)
    const html = htmlShell(content, translator.isRTL)
    WIKI.logger.debug(`Sending ${template} email to <${to}> in ${translator.locale}...`)
    await this.getTransporter().sendMail({
      from: {
        name: conf.senderName?.trim() || siteName,
        address: conf.senderEmail!.trim()
      },
      to,
      subject,
      text,
      html,
      ...(headers && { headers })
    })
    WIKI.logger.info(`Sent ${template} email to <${to}>.`)
  }
}

export const mail = new Mail()
