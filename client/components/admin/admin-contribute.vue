<template lang='pug'>
  v-container.admin-contribute(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-heart-health.svg', alt='Contribute', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:contribute.title') }}
            .subheading.grey--text.animated.fadeInLeft.wait-p4s {{ $t('admin:contribute.subtitle') }}
        v-card.mt-3.animated.fadeInUp
          v-card-text
            i18next.body-1.pl-3(path='admin:contribute.openSource', tag='div')
              v-icon(color='red') favorite
              a(href='https://requarks.io', target='_blank') requarks.io
              a(href='https://github.com/Requarks/wiki/graphs/contributors', target='_blank') {{ $t('admin:contribute.openSourceContributors') }}
            .body-1.pt-3.pl-3 {{ $t('admin:contribute.needYourHelp') }}
            v-divider.mt-3
            v-subheader {{ $t('admin:contribute.fundOurWork') }}
            v-tabs.mx-3.radius-7.admin-contribute-tabs(
              centered
              fixed-tabs
              color='primary'
              dark
              slider-color='#FFF'
              icons-and-text
              )
              v-tab
                span Patreon
                img(src='/svg/icon-patreon.svg')
              v-tab
                span OpenCollective
                img(src='/svg/icon-opencollective.svg')
              v-tab
                span PayPal
                img(src='/svg/icon-paypal.svg')
              v-tab
                span Ethereum
                img(src='/svg/icon-ethereum.svg')
              v-tab
                span T-Shirts
                img(src='/svg/icon-t-shirt.svg')
              v-tab-item(:transition='false', :reverse-transition='false')
                .body-1.pa-3 {{ $t('admin:contribute.patreon') }}
                a.ml-3(href='https://www.patreon.com/bePatron?u=16744039', :title='$t(`admin:contribute.becomeAPatron`)')
                  img(src='/img/donate_patreon.png', :alt='$t(`admin:contribute.becomeAPatron`)' style='width:200px;')
              v-tab-item(:transition='false', :reverse-transition='false')
                .body-1.pa-3 {{ $t('admin:contribute.openCollective') }}
                a.ml-3(href='https://opencollective.com/wikijs/donate', :title='$t(`admin:contribute.makeADonation`)')
                  img(src='/img/donate_opencollective.png', :alt='$t(`admin:contribute.makeADonation`)' style='width:300px;')
              v-tab-item(:transition='false', :reverse-transition='false')
                .body-1.pa-3 {{ $t('admin:contribute.paypal') }}
                .ml-3
                  form(action='https://www.paypal.com/cgi-bin/webscr', method='post', target='_top')
                    input(type='hidden', name='cmd', value='_s-xclick')
                    input(type='hidden', name='hosted_button_id', value='FLV5X255Z9CJU')
                    input(type='image', src='/img/donate_paypal.png', border='0', name='submit', title='PayPal - The safer, easier way to pay online!', alt='Donate with PayPal button')
                    img(alt='', border='0', src='https://www.paypal.com/en_CA/i/scr/pixel.gif', width='1', height='1')
              v-tab-item(:transition='false', :reverse-transition='false')
                .body-1.pa-3 {{ $t('admin:contribute.ethereum') }}
                .ml-3
                  .admin-contribute-ethaddress
                    strong Ethereum Address
                    span 0xE1d55C19aE86f6Bcbfb17e7f06aCe96BdBb22Cb5
                  div: img(src='/img/donate_eth_qr.png')
              v-tab-item(:transition='false', :reverse-transition='false')
                .body-1.pa-3 {{ $t('admin:contribute.tshirts') }}
                v-card-actions.ml-2
                  v-btn(outline, :color='darkMode ? `blue lighten-1` : `primary`', href='https://wikijs.threadless.com', large)
                    v-icon(left) shopping_cart
                    span {{ $t('admin:contribute.shop') }}
            v-divider.mt-3
            v-subheader {{ $t('admin:contribute.contribute') }}
            .body-1.pl-3
              ul
                i18next(path='admin:contribute.submitAnIdea', tag='li')
                  a(href='https://wiki.js.org/feedback', target='_blank') {{ $t('admin:contribute.submitAnIdeaLink') }}
                i18next(path='admin:contribute.foundABug', tag='li')
                  a(href='https://github.com/Requarks/wiki/issues', target='_blank') Github
                i18next(path='admin:contribute.helpTranslate', tag='li')
                  a(href='https://wiki.requarks.io/slack', target='_blank') Slack
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

<style lang='scss'>
.admin-contribute {

  &-tabs {
    .v-tabs__item img {
      height: 24px;
      margin-bottom: 5px;
    }
  }

  &-ethaddress {
    display: inline-block;
    margin-bottom: 12px;
    border-radius: 7px;
    background-color: mc('grey', '100');
    padding: 12px;

    strong {
      display: block;
    }
  }

  ul {
    margin-left: 1rem;
    list-style-type: square;
  }
}
</style>
