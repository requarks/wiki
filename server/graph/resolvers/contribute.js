const request = require('request-promise')
const _ = require('lodash')

module.exports = {
  Query: {
    async contribute() { return {} }
  },
  ContributeQuery: {
    async contributors(obj, args, context, info) {
      const resp = await request({
        uri: 'https://opencollective.com/wikijs/members/all.json',
        json: true
      })
      return _.filter(resp, c => {
        return c.role === 'BACKER' && c.totalAmountDonated > 0
      }).map(c => ({
        company: _.get(c, 'company', '') || '',
        currency: _.get(c, 'currency', 'USD') || 'USD',
        description: _.get(c, 'description', '') || '',
        id: _.get(c, 'MemberId', 0),
        image: _.get(c, 'image', '') || '',
        name: _.get(c, 'name', 'Anonymous') || '',
        profile: _.get(c, 'profile', ''),
        tier: _.toLower(_.get(c, 'tier', 'backers')),
        totalDonated: Math.ceil(_.get(c, 'totalAmountDonated', 0)),
        twitter: _.get(c, 'twitter', '') || '',
        website: _.get(c, 'website', '') || ''
      }))
    }
  }
}
