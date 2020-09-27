<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-browse-page.svg', alt='Dashboard', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:dashboard.title') }}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s {{ $t('admin:dashboard.subtitle') }}
      v-flex(xs12 md6 lg4 xl3 d-flex)
        v-card.primary.dashboard-card.animated.fadeInUp(dark)
          v-card-text
            v-icon.dashboard-icon mdi-file-document-outline
            .overline {{$t('admin:dashboard.pages')}}
            animated-number.display-1(
              :value='info.pagesTotal'
              :duration='2000'
              :formatValue='round'
              easing='easeOutQuint'
              )
      v-flex(xs12 md6 lg4 xl3 d-flex)
        v-card.blue.darken-3.dashboard-card.animated.fadeInUp.wait-p2s(dark)
          v-card-text
            v-icon.dashboard-icon mdi-account
            .overline {{$t('admin:dashboard.users')}}
            animated-number.display-1(
              :value='info.usersTotal'
              :duration='2000'
              :formatValue='round'
              easing='easeOutQuint'
              )
      v-flex(xs12 md6 lg4 xl3 d-flex)
        v-card.blue.darken-4.dashboard-card.animated.fadeInUp.wait-p4s(dark)
          v-card-text
            v-icon.dashboard-icon mdi-account-group
            .overline {{$t('admin:dashboard.groups')}}
            animated-number.display-1(
              :value='info.groupsTotal'
              :duration='2000'
              :formatValue='round'
              easing='easeOutQuint'
              )
      v-flex(xs12 md6 lg12 xl3 d-flex)
        v-card.dashboard-card.animated.fadeInUp.wait-p6s(
          :class='isLatestVersion ? "green" : "red lighten-2"'
          dark
          )
          v-btn.btn-animate-wrench(fab, absolute, :right='!$vuetify.rtl', :left='$vuetify.rtl', top, small, light, to='system', v-if='hasPermission(`manage:system`)')
            v-icon(:color='isLatestVersion ? `green` : `red darken-4`', small) mdi-wrench
          v-card-text
            v-icon.dashboard-icon mdi-blur
            .subtitle-1 Wiki.js {{info.currentVersion}}
            .body-2(v-if='isLatestVersion') {{$t('admin:dashboard.versionLatest')}}
            .body-2(v-else) {{$t('admin:dashboard.versionNew', { version: info.latestVersion })}}
      v-flex(xs12, xl6)
        v-card.radius-7.animated.fadeInUp.wait-p2s
          v-toolbar(:color='$vuetify.theme.dark ? `grey darken-2` : `grey lighten-5`', dense, flat)
            v-spacer
            .overline {{$t('admin:dashboard.recentPages')}}
            v-spacer
          v-data-table.pb-2(
            :items='recentPages'
            :headers='recentPagesHeaders'
            :loading='recentPagesLoading'
            hide-default-footer
            hide-default-header
            )
            template(slot='item', slot-scope='props')
              tr.is-clickable(:active='props.selected', @click='$router.push(`/pages/` + props.item.id)')
                td
                  .body-2: strong {{ props.item.title }}
                td.admin-pages-path
                  v-chip(label, small, :color='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-4`') {{ props.item.locale }}
                  span.ml-2.grey--text(:class='$vuetify.theme.dark ? `text--lighten-1` : `text--darken-2`') / {{ props.item.path }}
                td.text-right.caption(width='250') {{ props.item.updatedAt | moment('calendar') }}
      v-flex(xs12, xl6)
        v-card.radius-7.animated.fadeInUp.wait-p4s
          v-toolbar(:color='$vuetify.theme.dark ? `grey darken-2` : `grey lighten-5`', dense, flat)
            v-spacer
            .overline {{$t('admin:dashboard.lastLogins')}}
            v-spacer
          v-data-table.pb-2(
            :items='lastLogins'
            :headers='lastLoginsHeaders'
            :loading='lastLoginsLoading'
            hide-default-footer
            hide-default-header
            )
            template(slot='item', slot-scope='props')
              tr.is-clickable(:active='props.selected', @click='$router.push(`/users/` + props.item.id)')
                td
                  .body-2: strong {{ props.item.name }}
                td.text-right.caption(width='250') {{ props.item.lastLoginAt | moment('calendar') }}

      v-flex(xs12)
        v-card.dashboard-contribute.animated.fadeInUp.wait-p4s
          v-card-text
            img(src='/_assets/svg/icon-heart-health.svg', alt='Contribute', style='height: 80px;')
            .pl-5
              .subtitle-1 {{$t('admin:contribute.title')}}
              .body-2.mt-3: strong {{$t('admin:dashboard.contributeSubtitle')}}
              .body-2 {{$t('admin:dashboard.contributeHelp')}}
              v-btn.mx-0.mt-4(:color='$vuetify.theme.dark ? `indigo lighten-3` : `indigo`', outlined, small, to='/contribute')
                .caption: strong {{$t('admin:dashboard.contributeLearnMore')}}

</template>

<script>
import _ from 'lodash'
import AnimatedNumber from 'animated-number-vue'
import { get } from 'vuex-pathify'
import gql from 'graphql-tag'
import semverLte from 'semver/functions/lte'

export default {
  components: {
    AnimatedNumber
  },
  data() {
    return {
      recentPages: [],
      recentPagesLoading: false,
      recentPagesHeaders: [
        { text: 'Title', value: 'title' },
        { text: 'Path', value: 'path' },
        { text: 'Last Updated', value: 'updatedAt', width: 250 }
      ],
      lastLogins: [],
      lastLoginsLoading: false,
      lastLoginsHeaders: [
        { text: 'User', value: 'displayName' },
        { text: 'Last Login', value: 'lastLoginAt', width: 250 }
      ]
    }
  },
  computed: {
    isLatestVersion() {
      if (this.info.latestVersion === 'n/a' || this.info.currentVersion === 'n/a') {
        return true
      } else {
        return semverLte(this.info.latestVersion, this.info.currentVersion)
      }
    },
    info: get('admin/info'),
    permissions: get('user/permissions')
  },
  methods: {
    round(val) { return Math.round(val) },
    hasPermission(prm) {
      if (_.isArray(prm)) {
        return _.some(prm, p => {
          return _.includes(this.permissions, p)
        })
      } else {
        return _.includes(this.permissions, prm)
      }
    }
  },
  apollo: {
    recentPages: {
      query: gql`
        query {
          pages {
            list(limit: 10, orderBy: UPDATED, orderByDirection: DESC) {
              id
              locale
              path
              title
              description
              contentType
              isPublished
              isPrivate
              privateNS
              createdAt
              updatedAt
            }
          }
        }
      `,
      update: (data) => data.pages.list,
      watchLoading (isLoading) {
        this.recentPagesLoading = isLoading
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-dashboard-recentpages')
      }
    },
    lastLogins: {
      query: gql`
        query {
          users {
            lastLogins {
              id
              name
              lastLoginAt
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => data.users.lastLogins,
      watchLoading (isLoading) {
        this.lastLoginsLoading = isLoading
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-dashboard-lastlogins')
      }
    }
  }
}
</script>

<style lang='scss'>

.dashboard-card {
  display: flex;
  width: 100%;
  border-radius: 7px;

  .v-card__text {
    overflow: hidden;
    position: relative;
  }
}

.dashboard-contribute {
  background-color: #FFF;
  background-image: linear-gradient(to bottom, #FFF 0%, lighten(mc('indigo', '50'), 3%) 100%);
  border-radius: 7px;

  @at-root .theme--dark & {
    background-color: mc('grey', '800');
    background-image: linear-gradient(to bottom, mc('grey', '800') 0%, darken(mc('grey', '800'), 6%) 100%);
  }

  .v-card__text {
    display: flex;
    align-items: center;
    color: mc('indigo', '500') !important;

    @at-root .theme--dark & {
      color: mc('grey', '300') !important;
    }
  }
}

.v-icon.dashboard-icon {
  position: absolute !important;
  right: 0;
  top: 12px;
  font-size: 100px !important;
  opacity: .25;

  @at-root .v-application--is-rtl & {
    left: 0;
    right: initial;
  }
}

</style>
