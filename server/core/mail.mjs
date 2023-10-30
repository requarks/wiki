import nodemailer from 'nodemailer'
import { get } from 'lodash-es'
import path from 'node:path'
import { config } from '@vue-email/compiler'

export default {
  vueEmail: null,
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
      this.vueEmail = config(path.join(WIKI.SERVERPATH, 'templates/mail'), {
        verbose: false,
        options: {
          baseUrl: WIKI.config.mail.defaultBaseURL
        }
      })
    } else {
      WIKI.logger.warn('Mail is not setup! Please set the configuration in the administration area!')
      this.transport = null
    }
    return this
  },
  async send(opts) {
    if (!this.transport) {
      WIKI.logger.warn('Cannot send email because mail is not setup in the administration area!')
      throw new Error('ERR_MAIL_NOT_CONFIGURED')
    }
    return this.transport.sendMail({
      headers: {
        'x-mailer': 'Wiki.js'
      },
      from: `"${WIKI.config.mail.senderName}" <${WIKI.config.mail.senderEmail}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: await this.loadTemplate(opts.template, opts.data)
    })
  },
  async loadTemplate(key, opts = {}) {
    try {
      return this.vueEmail.render(`${key}.vue`, {
        props: opts
      })
    } catch (err) {
      WIKI.logger.warn(err)
      throw new Error('ERR_MAIL_RENDER_FAILED')
    }
  }
}
