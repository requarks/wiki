import _ from 'lodash-es'
import { generateError, generateSuccess } from '../../helpers/graph.mjs'

export default {
  Query: {
    async mailConfig(obj, args, context) {
      if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
        throw new Error('ERR_FORBIDDEN')
      }

      return {
        ...WIKI.config.mail,
        pass: WIKI.config.mail.pass.length > 0 ? '********' : ''
      }
    }
  },
  Mutation: {
    async sendMailTest(obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }

        if (_.isEmpty(args.recipientEmail) || args.recipientEmail.length < 6) {
          throw new WIKI.Error.MailInvalidRecipient()
        }

        await WIKI.mail.send({
          template: 'test',
          to: args.recipientEmail,
          subject: 'A test email from your wiki',
          text: 'This is a test email sent from your wiki.',
          data: {
            preheadertext: 'This is a test email sent from your wiki.'
          }
        })

        return {
          operation: generateSuccess('Test email sent successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    async updateMailConfig(obj, args, context) {
      try {
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'])) {
          throw new Error('ERR_FORBIDDEN')
        }

        WIKI.config.mail = {
          senderName: args.senderName,
          senderEmail: args.senderEmail,
          host: args.host,
          port: args.port,
          name: args.name,
          secure: args.secure,
          verifySSL: args.verifySSL,
          user: args.user,
          pass: (args.pass === '********') ? WIKI.config.mail.pass : args.pass,
          useDKIM: args.useDKIM,
          dkimDomainName: args.dkimDomainName,
          dkimKeySelector: args.dkimKeySelector,
          dkimPrivateKey: args.dkimPrivateKey
        }
        await WIKI.configSvc.saveToDb(['mail'])

        WIKI.mail.init()

        return {
          operation: generateSuccess('Mail configuration updated successfully.')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  }
}
