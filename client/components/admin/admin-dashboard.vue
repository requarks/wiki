<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-browse-page.svg', alt='Dashboard', style='width: 80px;')
          .admin-header-title
            .headline.primary--text {{ $t('admin:dashboard.title') }}
            .subheading.grey--text {{ $t('admin:dashboard.subtitle') }}
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
          v-btn(fab, absolute, right, top, small, light, to='system', v-if='hasPermission(`manage:system`)')
            v-icon(v-if='isLatestVersion', color='teal') build
            v-icon(v-else, color='red darken-4') get_app
          v-card-text
            v-icon.dashboard-icon blur_on
            .subheading Wiki.js {{info.currentVersion}} BETA
            .body-2(v-if='isLatestVersion') You are running the latest version.
            .body-2(v-else) A new version is available: {{info.latestVersion}}
      v-flex(xs12)
        v-card.radius-7
          v-card-title.subheading(:class='$vuetify.dark ? `grey darken-2` : `grey lighten-5`') Recent Pages
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
        v-card.radius-7
          v-card-title.subheading(:class='$vuetify.dark ? `grey darken-2` : `grey lighten-5`') Most Popular Pages
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

      v-flex(xs12)
        v-card.dashboard-contribute
          v-card-text
            img(src='/svg/icon-heart-health.svg', alt='Contribute', style='height: 80px;')
            .pl-3
              .subheading Contribute
              .body-2.pt-2 Wiki.js is a free and open source project. There are several ways you can contribute to the project.
              .body-1 We need your help!
              v-btn.mx-0.mt-2(:color='$vuetify.dark ? `indigo lighten-3` : `indigo`', outline, small, to='/contribute') Learn More

</template>

<script>
import _ from 'lodash'
import AnimatedNumber from 'animated-number-vue'
import { get } from 'vuex-pathify'

export default {
  components: {
    AnimatedNumber
  },
  data() {
    return {
      recentPages: [],
      popularPages: []
    }
  },
  computed: {
    isLatestVersion() {
      return this.info.currentVersion === this.info.latestVersion
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
  }
}
</script>

<style lang='scss'>

.dashboard-card {
  display: flex;
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
    color: mc('indigo', '500');

    @at-root .theme--dark & {
      color: mc('grey', '300');
    }
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
