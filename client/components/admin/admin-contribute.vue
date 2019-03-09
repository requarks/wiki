<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-heart-health.svg', alt='Contribute', style='width: 80px;')
          .admin-header-title
            .headline.primary--text {{ $t('admin:contribute.title') }}
            .subheading.grey--text {{ $t('admin:contribute.subtitle') }}
        v-card.mt-3
          v-card-text
            i18next.body-1.pl-3(path='admin:contribute.openSource', tag='div')
              v-icon(color='red') favorite
              a(href='https://requarks.io', target='_blank') requarks.io
              a(href='https://github.com/Requarks/wiki/graphs/contributors', target='_blank') {{ $t('admin:contribute.openSourceContributors') }}
            .body-1.pt-3.pl-3 {{ $t('admin:contribute.needYourHelp') }}
            v-divider.mt-3
            v-subheader {{ $t('admin:contribute.fundOurWork') }}
            .body-1.pl-3 {{ $t('admin:contribute.patreon') }}
            v-card-actions.ml-2
              a(href='https://www.patreon.com/bePatron?u=16744039', :title='$t(`admin:contribute.becomeAPatron`)')
                img(src='/img/become_a_patron_button.png', :alt='$t(`admin:contribute.becomeAPatron`)' style='width:200px;')
            .body-1.mt-3.pl-3 {{ $t('admin:contribute.openCollective') }}
            v-card-actions.ml-2
              v-btn(outline, :color='darkMode ? `blue lighten-1` : `primary`', href='https://opencollective.com/wikijs')
                v-icon(left) local_atm
                span {{ $t('admin:contribute.makeADonation') }}
            .body-1.mt-3.pl-3 {{ $t('admin:contribute.tshirts') }}
            v-card-actions.ml-2
              v-btn(outline, :color='darkMode ? `blue lighten-1` : `primary`', href='https://wikijs.threadless.com')
                v-icon(left) shopping_cart
                span {{ $t('admin:contribute.shop') }}
            v-divider.mt-3
            v-subheader {{ $t('admin:contribute.contribute') }}
            .body-1.pl-3
              ul
                i18next(path='admin:contribute.submitAnIdea', tag='li')
                  a(href='https://requests.requarks.io/wiki', target='_blank') {{ $t('admin:contribute.submitAnIdeaLink') }}
                i18next(path='admin:contribute.foundABug', tag='li')
                  a(href='https://github.com/Requarks/wiki/issues', target='_blank') Github
                i18next(path='admin:contribute.helpTranslate', tag='li')
                  a(href='https://gitter.im/Requarks/wiki', target='_blank') Gitter
            v-divider.mt-3
            v-subheader {{ $t('admin:contribute.spreadTheWord') }}
            .body-1.pl-3
              ul
                li {{ $t('admin:contribute.talkToFriends') }}
                i18next(path='admin:contribute.followUsOnTwitter', tag='li')
                  a(href='https://twitter.com/requarks', target='_blank') Twitter
          v-toolbar(color='teal', dense, dark)
            .subheading Sponsors
            v-spacer
            v-btn(outline, small, href='https://opencollective.com/wikijs/order/1273') Become a Sponsor
          v-list(two-line)
            template(v-for='(sponsor, idx) in sponsors')
              v-list-tile(:key='sponsor.id')
                v-list-tile-avatar
                  img(v-if='sponsor.image', :src='sponsor.image')
                  v-avatar(v-else, color='teal', size='40')
                    span.white--text.subheading {{sponsor.name[0].toUpperCase()}}
                v-list-tile-content
                  v-list-tile-title {{sponsor.name}}
                  v-list-tile-sub-title {{sponsor.description}}
                v-list-tile-action(v-if='sponsor.twitter')
                  v-btn(icon, :href='sponsor.twitter', target='_blank')
                    icon-twitter(fillColor='#9e9e9e')
                v-list-tile-action(v-if='sponsor.website')
                  v-btn(icon, :href='sponsor.website', target='_blank')
                    v-icon(color='grey') public
              v-divider(v-if='idx < sponsors.length - 1')
          v-toolbar(color='blue-grey', dense, dark)
            .subheading Backers
            v-spacer
            v-btn(outline, small, href='https://opencollective.com/wikijs/order/1272') Become a Backer
          v-list(two-line, dense)
            template(v-for='(backer, idx) in backers')
              v-list-tile(:key='backer.id')
                v-list-tile-avatar
                  img(v-if='backer.image', :src='backer.image')
                  v-avatar(v-else, color='blue-grey', size='40')
                    span.white--text.subheading {{backer.name[0].toUpperCase()}}
                v-list-tile-content
                  v-list-tile-title {{backer.name}}
                  v-list-tile-sub-title {{backer.description}}
                v-list-tile-action(v-if='backer.twitter')
                  v-btn(icon, :href='backer.twitter', target='_blank')
                    icon-twitter(fillColor='#9e9e9e')
                v-list-tile-action(v-if='backer.website')
                  v-btn(icon, :href='backer.website', target='_blank')
                    v-icon(color='grey') public
              v-divider(v-if='idx < backers.length - 1')
          v-toolbar(color='primary', dense, dark)
            .subheading Special Thanks
          v-list(two-line)
            v-list-tile
              v-list-tile-avatar
                img(src='https://static.requarks.io/logo/algolia.svg', alt='Algolia')
              v-list-tile-content
                v-list-tile-title Algolia
                v-list-tile-sub-title Algolia is a powerful search-as-a-service solution, made easy to use with API clients, UI libraries, and pre-built integrations.
              v-list-tile-action
                v-btn(icon, href='https://www.algolia.com/', target='_blank')
                  v-icon(color='grey') public
            v-divider
            v-list-tile
              v-list-tile-avatar
                img(src='https://static.requarks.io/logo/browserstack.svg', alt='Browserstack')
              v-list-tile-content
                v-list-tile-title BrowserStack
                v-list-tile-sub-title BrowserStack is a cloud web and mobile testing platform that enables developers to test their websites and mobile applications.
              v-list-tile-action
                v-btn(icon, href='https://www.browserstack.com/', target='_blank')
                  v-icon(color='grey') public
            v-divider
            v-list-tile
              v-list-tile-avatar
                img(src='https://static.requarks.io/logo/cloudflare.svg', alt='Cloudflare')
              v-list-tile-content
                v-list-tile-title Cloudflare
                v-list-tile-sub-title Providing content delivery network services, DDoS mitigation, Internet security and distributed domain name server services.
              v-list-tile-action
                v-btn(icon, href='https://www.cloudflare.com/', target='_blank')
                  v-icon(color='grey') public
            v-divider
            v-list-tile
              v-list-tile-avatar
                img(src='https://static.requarks.io/logo/digitalocean.svg', alt='DigitalOcean')
              v-list-tile-content
                v-list-tile-title DigitalOcean
                v-list-tile-sub-title Providing developers and businesses a reliable, easy-to-use cloud computing platform of virtual servers (Droplets), object storage (Spaces), and more.
              v-list-tile-action
                v-btn(icon, href='https://m.do.co/c/5f7445bfa4d0', target='_blank')
                  v-icon(color='grey') public
            v-divider
            v-list-tile
              v-list-tile-avatar(tile)
                img(src='/svg/logo-icons8.svg', alt='Icons8')
              v-list-tile-content
                v-list-tile-title Icons8
                v-list-tile-sub-title All the Icons You Need. Guaranteed.
              v-list-tile-action
                v-btn(icon, href='https://icons8.com', target='_blank')
                  v-icon(color='grey') public
            v-divider
            v-list-tile
              v-list-tile-avatar(tile)
                img(src='https://static.requarks.io/logo/lokalise.png', alt='Lokalise')
              v-list-tile-content
                v-list-tile-title Lokalise
                v-list-tile-sub-title Lokalise is a translation management system built for agile teams who want to automate their localization process.
              v-list-tile-action
                v-btn(icon, href='https://lokalise.co', target='_blank')
                  v-icon(color='grey') public
            v-divider
            v-list-tile
              v-list-tile-avatar(tile)
                img(src='https://static.requarks.io/logo/netlify.svg', alt='Netlify')
              v-list-tile-content
                v-list-tile-title Netlify
                v-list-tile-sub-title Deploy modern static websites with Netlify. Get CDN, Continuous deployment, 1-click HTTPS, and all the services you need.
              v-list-tile-action
                v-btn(icon, href='https://wwwnetlify.com', target='_blank')
                  v-icon(color='grey') public

</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'

import groupsQuery from 'gql/admin/contribute/contribute-query-contributors.gql'

import IconTwitter from 'mdi/Twitter'

export default {
  components: {
    IconTwitter
  },
  data() {
    return {
      contributors: []
    }
  },
  computed: {
    darkMode: get('site/dark'),
    sponsors() {
      return _.filter(this.contributors, ['tier', 'sponsors'])
    },
    backers() {
      return _.reject(this.contributors, ['tier', 'sponsors'])
    }
  },
  apollo: {
    contributors: {
      query: groupsQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.contribute.contributors,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-contribute-refresh')
      }
    }
  }
}
</script>

<style lang='scss' scoped>
ul {
  margin-left: 1rem;
  list-style-type: square;
}
</style>
