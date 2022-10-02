const { Octokit, App } = require('octokit')

module.exports = {
  async activated () { },
  async deactivated () { },
  async init () { },

  /**
   * SETUP FUNCTIONS
   */
  async setup (id, state) {
    try {
      switch (state.step) {
        // --------------------------------------------
        // -> VALIDATE CALLBACK CODE AFTER APP CREATION
        // --------------------------------------------
        case 'connect': {
          const gh = new Octokit({
            userAgent: 'wikijs'
          })
          const resp = await gh.request('POST /app-manifests/{code}/conversions', {
            code: state.code
          })
          if (resp.status > 200 && resp.status < 300) {
            await WIKI.db.storage.query().patch({
              config: {
                appId: resp.data.id,
                appName: resp.data.name,
                appSlug: resp.data.slug,
                appClientId: resp.data.client_id,
                appClientSecret: resp.data.client_secret,
                appWebhookSecret: resp.data.webhook_secret,
                appPem: resp.data.pem,
                appPermissions: resp.data.permissions,
                appEvents: resp.data.events,
                ownerLogin: resp.data.owner?.login,
                ownerId: resp.data.owner?.id
              },
              state: {
                current: 'ok',
                setup: 'pendinginstall'
              }
            }).where('id', id)
            return {
              nextStep: 'installApp',
              url: `https://github.com/apps/${resp.data.slug}/installations/new/permissions?target_id=${resp.data.owner?.id}`
            }
          } else {
            throw new Error('GitHub refused the code or could not be reached.')
          }
        }
        // -----------------------
        // VERIFY APP INSTALLATION
        // -----------------------
        case 'verify': {
          const tgt = await WIKI.db.storage.query().findById(id)
          if (!tgt) {
            throw new Error('Invalid Target ID')
          }

          const ghApp = new App({
            appId: tgt.config.appId,
            privateKey: tgt.config.appPem,
            Octokit: Octokit.defaults({
              userAgent: 'wikijs'
            }),
            oauth: {
              clientId: tgt.config.appClientId,
              clientSecret: tgt.config.appClientSecret
            },
            webhooks: {
              secret: tgt.config.appWebhookSecret
            }
          })

          // -> Find Installation ID

          let installId = null
          let installTotal = 0
          for await (const { installation } of ghApp.eachInstallation.iterator()) {
            if (installTotal < 1) {
              installId = installation.id
              WIKI.logger.debug(`Using GitHub App installation ID ${installId}`)
            }
            installTotal++
          }
          if (installTotal < 1) {
            throw new Error('App is not installed on any GitHub account!')
          } else if (installTotal > 1) {
            WIKI.logger.warn(`GitHub App ${tgt.config.appName} is installed on more than 1 account. Only the first one ${installId} will be used.`)
          }

          // -> Fetch Repository Info

          let repo = null
          let repoTotal = 0
          for await (const { repository } of ghApp.eachRepository.iterator({ installationId: installId })) {
            if (repository.archived || repository.disabled) {
              WIKI.logger.debug(`Skipping GitHub Repository ${repo.id} because of it is archived or disabled.`)
              continue
            }
            if (repoTotal < 1) {
              repo = repository
              WIKI.logger.debug(`Using GitHub Repository ${repo.id}`)
            }
            repoTotal++
          }
          if (repoTotal < 1) {
            throw new Error('App is not installed on any GitHub repository!')
          } else if (repoTotal > 1) {
            WIKI.logger.warn(`GitHub App ${tgt.config.appName} is installed on more than 1 repository. Only the first one (${repo.full_name}) will be used.`)
          }

          // -> Save install/repo info

          await WIKI.db.storage.query().patch({
            isEnabled: true,
            config: {
              ...tgt.config,
              installId,
              repoId: repo.id,
              repoName: repo.name,
              repoOwner: repo.owner?.login,
              repoDefaultBranch: repo.default_branch,
              repoFullName: repo.full_name
            },
            state: {
              current: 'ok',
              setup: 'configured'
            }
          }).where('id', id)

          return {
            nextStep: 'completed'
          }
        }
        default: {
          throw new Error('Invalid Setup Step')
        }
      }
    } catch (err) {
      WIKI.logger.warn('GitHub Storage Module Setup Failed:')
      WIKI.logger.warn(err)
      throw err
    }
  },
  async setupDestroy (id) {
    try {
      const tgt = await WIKI.db.storage.query().findById(id)
      if (!tgt) {
        throw new Error('Invalid Target ID')
      }

      WIKI.logger.info('Resetting GitHub storage configuration...')

      const ghApp = new App({
        appId: tgt.config.appId,
        privateKey: tgt.config.appPem,
        Octokit: Octokit.defaults({
          userAgent: 'wikijs'
        }),
        oauth: {
          clientId: tgt.config.appClientId,
          clientSecret: tgt.config.appClientSecret
        },
        webhooks: {
          secret: tgt.config.appWebhookSecret
        }
      })

      // -> Reset storage module config

      await WIKI.db.storage.query().patch({
        isEnabled: false,
        config: {},
        state: {
          current: 'ok',
          setup: 'notconfigured'
        }
      }).where('id', id)

      // -> Try to delete installation on GitHub

      if (tgt.config.installId) {
        try {
          await ghApp.octokit.request('DELETE /app/installations/{installation_id}', {
            installation_id: tgt.config.installId
          })
          WIKI.logger.info('Deleted GitHub installation successfully.')
        } catch (err) {
          WIKI.logger.warn('Could not delete GitHub installation automatically. Please remove the installation on GitHub.')
        }
      }
    } catch (err) {
      WIKI.logger.warn('GitHub Storage Module Destroy Failed:')
      WIKI.logger.warn(err)
      throw err
    }
  },
  async created (page) { },
  async updated (page) { },
  async deleted (page) { },
  async renamed (page) { },
  async assetUploaded (asset) { },
  async assetDeleted (asset) { },
  async assetRenamed (asset) { },
  async getLocalLocation () { },
  async exportAll () { }
}
