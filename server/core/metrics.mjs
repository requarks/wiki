import { collectDefaultMetrics, register, Gauge } from 'prom-client'
import { toSafeInteger } from 'lodash-es'

export default {
  customMetrics: {},
  async init () {
    if (WIKI.config.metrics.isEnabled) {
      WIKI.logger.info('Initializing metrics...')

      register.setDefaultLabels({
        WIKI_INSTANCE: WIKI.INSTANCE_ID
      })

      collectDefaultMetrics()

      this.customMetrics.groupsTotal = new Gauge({
        name: 'wiki_groups_total',
        help: 'Total number of groups',
        async collect() {
          const total = await WIKI.db.groups.query().count('* as total').first()
          this.set(toSafeInteger(total.total))
        }
      })

      this.customMetrics.pagesTotal = new Gauge({
        name: 'wiki_pages_total',
        help: 'Total number of pages',
        async collect() {
          const total = await WIKI.db.pages.query().count('* as total').first()
          this.set(toSafeInteger(total.total))
        }
      })

      this.customMetrics.tagsTotal = new Gauge({
        name: 'wiki_tags_total',
        help: 'Total number of tags',
        async collect() {
          const total = await WIKI.db.tags.query().count('* as total').first()
          this.set(toSafeInteger(total.total))
        }
      })

      this.customMetrics.usersTotal = new Gauge({
        name: 'wiki_users_total',
        help: 'Total number of users',
        async collect() {
          const total = await WIKI.db.users.query().count('* as total').first()
          this.set(toSafeInteger(total.total))
        }
      })
      WIKI.logger.info('Metrics ready [ OK ]')
    } else {
      this.customMetrics = {}
      register.clear()
    }
    return this
  },
  async render (res) {
    try {
      res.contentType(register.contentType)
      res.send(await register.metrics())
    } catch (err) {
      res.status(500).end(err.message)
    }
  }
}
