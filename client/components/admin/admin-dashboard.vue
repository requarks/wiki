<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-browse-page.svg', alt='Dashboard', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:dashboard.title') }}
            .subheading.grey--text.animated.fadeInLeft.wait-p2s {{ $t('admin:dashboard.subtitle') }}
      v-flex(xs12 md6 lg4 xl3 d-flex)
        v-card.primary.dashboard-card.animated.fadeInUp(dark)
          v-card-text
            v-icon.dashboard-icon insert_drive_file
            .subheading {{$t('admin:dashboard.pages')}}
            animated-number.display-1(
              :value='info.pagesTotal'
              :duration='2000'
              :formatValue='round'
              easing='easeOutQuint'
              )
      v-flex(xs12 md6 lg4 xl3 d-flex)
        v-card.indigo.lighten-1.dashboard-card.animated.fadeInUp.wait-p2s(dark)
          v-card-text
            v-icon.dashboard-icon person
            .subheading {{$t('admin:dashboard.users')}}
            animated-number.display-1(
              :value='info.usersTotal'
              :duration='2000'
              :formatValue='round'
              easing='easeOutQuint'
              )
      v-flex(xs12 md6 lg4 xl3 d-flex)
        v-card.indigo.lighten-2.dashboard-card.animated.fadeInUp.wait-p4s(dark)
          v-card-text
            v-icon.dashboard-icon people
            .subheading {{$t('admin:dashboard.groups')}}
            animated-number.display-1(
              :value='info.groupsTotal'
              :duration='2000'
              :formatValue='round'
              easing='easeOutQuint'
              )
      v-flex(xs12 md6 lg12 xl3 d-flex)
        v-card.dashboard-card.animated.fadeInUp.wait-p6s(
          :class='isLatestVersion ? "teal lighten-2" : "red lighten-2"'
          dark
          )
          v-btn.btn-animate-wrench(fab, absolute, right, top, small, light, to='system', v-if='hasPermission(`manage:system`)')
            v-icon(:color='isLatestVersion ? `teal` : `red darken-4`') build
          v-card-text
            v-icon.dashboard-icon blur_on
            .subheading Wiki.js {{info.currentVersion}}
            .body-2(v-if='isLatestVersion') {{$t('admin:dashboard.versionLatest')}}
            .body-2(v-else) {{$t('admin:dashboard.versionNew', { version: info.latestVersion })}}
      v-flex(xs12, xl6)
        v-card.radius-7.animated.fadeInUp.wait-p2s
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
      v-flex(xs12, xl6)
        v-card.radius-7.animated.fadeInUp.wait-p4s
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
        v-card.dashboard-contribute.animated.fadeInUp.wait-p4s
          v-card-text
            img(src='/svg/icon-heart-health.svg', alt='Contribute', style='height: 80px;')
            .pl-3
              .subheading {{$t('admin:contribute.title')}}
              .body-2.pt-2 {{$t('admin:dashboard.contributeSubtitle')}}
              .body-1 {{$t('admin:dashboard.contributeHelp')}}
              v-btn.mx-0.mt-2(:color='$vuetify.dark ? `indigo lighten-3` : `indigo`', outline, small, to='/contribute') {{$t('admin:dashboard.contributeLearnMore')}}

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
