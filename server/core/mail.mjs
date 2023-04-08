import nodemailer from 'nodemailer'
import { get, has, kebabCase, set, template } from 'lodash-es'
import fs from 'node:fs/promises'
import path from 'node:path'

export default {
  transport: null,
  templates: {},
  init() {
    if (get(WIKI.config, 'mail.host', '').length > 2) {
      let conf = {
        host: WIKI.config.mail.host,
        port: WIKI.config.mail.port,
        name: WIKI.config.mail.name,
        secure: WIKI.config.mail.secure,
        tls: {
          rejectUnauthorized: !(WIKI.config.mail.verifySSL === false)
        }
      }
      if (get(WIKI.config, 'mail.user', '').length > 1) {
        conf = {
          ...conf,
          auth: {
            user: WIKI.config.mail.user,
            pass: WIKI.config.mail.pass
          }
        }
      }
      if (get(WIKI.config, 'mail.useDKIM', false)) {
        conf = {
          ...conf,
          dkim: {
            domainName: WIKI.config.mail.dkimDomainName,
            keySelector: WIKI.config.mail.dkimKeySelector,
            privateKey: WIKI.config.mail.dkimPrivateKey
          }
        }
      }
      this.transport = nodemailer.createTransport(conf)
    } else {
      WIKI.logger.warn('Mail is not setup! Please set the configuration in the administration area!')
      this.transport = null
    }
    return this
  },
  async send(opts) {
    if (!this.transport) {
      WIKI.logger.warn('Cannot send email because mail is not setup in the administration area!')
      throw new WIKI.Error.MailNotConfigured()
    }
    await this.loadTemplate(opts.template)
    return this.transport.sendMail({
      headers: {
        'x-mailer': 'Wiki.js'
      },
      from: `"${WIKI.config.mail.senderName}" <${WIKI.config.mail.senderEmail}>`,
      to: opts.to,
      subject: `${opts.subject} - ${WIKI.config.title}`,
      text: opts.text,
      html: get(this.templates, opts.template)({
        logo: (WIKI.config.logoUrl.startsWith('http') ? '' : WIKI.config.host) + WIKI.config.logoUrl,
        siteTitle: WIKI.config.title,
        copyright: WIKI.config.company.length > 0 ? WIKI.config.company : 'Powered by Wiki.js',
        ...opts.data
      })
    })
  },
  async loadTemplate(key) {
    if (has(this.templates, key)) { return }
    const keyKebab = kebabCase(key)
    try {
      const rawTmpl = await fs.readFile(path.join(WIKI.SERVERPATH, `templates/${keyKebab}.html`), 'utf8')
      set(this.templates, key, template(rawTmpl))
    } catch (err) {
      WIKI.logger.warn(err)
      throw new WIKI.Error.MailTemplateFailed()
    }
  }
}
