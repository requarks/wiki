<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          v-icon(size='80', color='grey lighten-2') favorite
          .admin-header-title
            .headline.primary--text {{ $t('admin:contribute.title') }}
            .subheading.grey--text {{ $t('admin:contribute.subtitle') }}
          v-spacer
          v-btn(depressed, color='primary', href='https://opencollective.com/wikijs', large)
            v-icon(left) local_atm
            span {{ $t('admin:contribute.makeADonation') }}
        v-card.mt-3
          v-card-text
            i18next.body-1.pl-3(path='admin:contribute.openSource', tag='div')
              v-icon(color='red') favorite
              a(href='https://requarks.io', target='_blank') requarks.io
              a(href='https://github.com/Requarks/wiki/graphs/contributors', target='_blank') {{ $t('admin:contribute.openSourceContributors') }}
            .body-1.pt-3.pl-3 {{ $t('admin:contribute.needYourHelp') }}
            v-divider.mt-3
            v-subheader {{ $t('admin:contribute.fundOurWork') }}
            .body-1.pl-3 {{ $t('admin:contribute.openCollective') }}
            v-card-actions.ml-2
              v-btn(outline, color='primary', href='https://opencollective.com/wikijs')
                v-icon(left) local_atm
                span {{ $t('admin:contribute.makeADonation') }}
            .body-1.mt-3.pl-3 {{ $t('admin:contribute.tshirts') }}
            v-card-actions.ml-2
              v-btn(outline, color='primary', href='https://wikijs.threadless.com')
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
          v-list(two-line, dense)
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

</template>

<script>
import _ from 'lodash'

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
