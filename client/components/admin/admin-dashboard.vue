<template lang='pug'>
  v-card(tile, flat :color='$vuetify.dark ? "grey darken-4" : "grey lighten-5"')
    .pa-3.pt-4
      .headline.primary--text {{ $t('admin:dashboard.title') }}
      .subheading.grey--text {{ $t('admin:dashboard.subtitle') }}
    v-container(fluid, grid-list-lg)
      v-layout(row, wrap)
        v-flex(xs12 md6 lg4 xl3 d-flex)
          v-card.primary.dashboard-card(dark)
            v-card-text
              v-icon.dashboard-icon insert_drive_file
              .subheading Pages
              animated-number.display-1(
                :value='info.pagesTotal'
                :duration='2000'
                :formatValue='round'
                easing='easeOutQuint'
                )
        v-flex(xs12 md6 lg4 xl3 d-flex)
          v-card.indigo.lighten-1.dashboard-card(dark)
            v-card-text
              v-icon.dashboard-icon person
              .subheading Users
              animated-number.display-1(
                :value='info.usersTotal'
                :duration='2000'
                :formatValue='round'
                easing='easeOutQuint'
                )
        v-flex(xs12 md6 lg4 xl3 d-flex)
          v-card.indigo.lighten-2.dashboard-card(dark)
            v-card-text
              v-icon.dashboard-icon people
              .subheading Groups
              animated-number.display-1(
                :value='info.groupsTotal'
                :duration='2000'
                :formatValue='round'
                easing='easeOutQuint'
                )
        v-flex(xs12 md6 lg12 xl3 d-flex)
          v-card.dashboard-card(
            :class='isLatestVersion ? "teal lighten-2" : "red lighten-2"'
            dark
            )
            v-btn(fab, absolute, right, top, small, light, to='system')
              v-icon(v-if='isLatestVersion', color='teal') build
              v-icon(v-else, color='red darken-4') get_app
            v-card-text
              v-icon.dashboard-icon blur_on
              .subheading Wiki.js {{info.currentVersion}}
              .body-2(v-if='isLatestVersion') You are running the latest version.
              .body-2(v-else) A new version is available: {{info.latestVersion}}
        v-flex(xs12)
          v-card
            v-card-title.subheading Recent Pages
            v-data-table.pb-2(
              :items='recentPages'
              hide-actions
              hide-headers
              )
              template(slot='items' slot-scope='props')
                td(width='20', style='padding-right: 0;'): v-icon insert_drive_file
                td
                  .body-2.primary--text {{ props.item.title }}
                  .caption.grey--text.text--darken-2 {{ props.item.description }}
                td.caption /{{ props.item.path }}
                td.grey--text.text--darken-2(width='250')
                  .caption: strong Updated {{ props.item.updatedAt | moment('from') }}
                  .caption Created {{ props.item.createdAt | moment('calendar') }}
        v-flex(xs12)
          v-card
            v-card-title.subheading Most Popular Pages
            v-data-table.pb-2(
              :items='popularPages'
              hide-actions
              hide-headers
              )
              template(slot='items' slot-scope='props')
                td(width='20', style='padding-right: 0;'): v-icon insert_drive_file
                td
                  .body-2.primary--text {{ props.item.title }}
                  .caption.grey--text.text--darken-2 {{ props.item.description }}
                td.caption /{{ props.item.path }}
                td.grey--text.text--darken-2(width='250')
                  .caption: strong Updated {{ props.item.updatedAt | moment('from') }}
                  .caption Created {{ props.item.createdAt | moment('calendar') }}

</template>

<script>
import AnimatedNumber from 'animated-number-vue'

import statsQuery from 'gql/admin/dashboard/dashboard-query-stats.gql'

export default {
  components: {
    AnimatedNumber
  },
  data() {
    return {
      info: {
        currentVersion: 'n/a',
        latestVersion: 'n/a',
        groupsTotal: 0,
        pagesTotal: 0,
        usersTotal: 0
      },
      recentPages: [],
      popularPages: []
    }
  },
  computed: {
    isLatestVersion() {
      return this.info.currentVersion === this.info.latestVersion
    }
  },
  methods: {
    round(val) { return Math.round(val) }
  },
  apollo: {
    info: {
      query: statsQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.system.info,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-system-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

.dashboard-card {
  display: flex;

  .v-card__text {
    overflow: hidden;
    position: relative;
  }
}

.dashboard-icon {
  position: absolute;
  right: 0;
  top: 12px;
  font-size: 120px;
  opacity: .25;
}

</style>
