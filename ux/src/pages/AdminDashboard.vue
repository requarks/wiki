<template lang='pug'>
q-page.admin-dashboard
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-apps-tab.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.dashboard.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.dashboard.subtitle') }}
  .row.q-px-md.q-col-gutter-md
    .col-3
      q-card.shadow-1
        q-card-section.admin-dashboard-card
          img(src='/_assets/icons/fluent-change-theme.svg')
          div
            strong Sites
            span 4
        q-separator
        q-card-actions(align='right')
          q-btn(
            flat
            color='primary'
            icon='las la-plus'
            label='New'
            )
          q-separator.q-mx-sm(vertical)
          q-btn(
            flat
            color='primary'
            icon='las la-sitemap'
            label='Manage'
            to='/_admin/sites'
            )
    .col-3
      q-card.shadow-1
        q-card-section.admin-dashboard-card
          img(src='/_assets/icons/fluent-account.svg')
          div
            strong Users
            span 123
        q-separator
        q-card-actions(align='right')
          q-btn(
            flat
            color='primary'
            icon='las la-plus'
            label='New'
            )
          q-separator.q-mx-sm(vertical)
          q-btn(
            flat
            color='primary'
            icon='las la-users'
            label='Manage'
            to='/_admin/users'
            )
    .col-3
      q-card.shadow-1
        q-card-section.admin-dashboard-card
          img(src='/_assets/icons/fluent-female-working-with-a-laptop.svg')
          div
            strong Logins
            small 45 / last 24h
        q-separator
        q-card-actions(align='right')
          q-btn(
            flat
            color='primary'
            icon='las la-chart-area'
            label='Analytics'
            )
    .col-3
      q-card.shadow-1
        q-card-section.admin-dashboard-card
          img(src='/_assets/icons/fluent-ssd-animated.svg')
          div
            strong Storage
            small Operational
        q-separator
        q-card-actions(align='right')
          q-btn(
            flat
            color='primary'
            icon='las la-server'
            label='Manage'
            )
    .col-12
      q-banner.bg-positive.text-white(
        inline-actions
        rounded
        )
        i.las.la-check.q-mr-sm
        span.text-weight-medium Your Wiki.js server is running the latest version! (3.0.0)
        template(#action)
          q-btn(
            flat
            label='Check'
            )
          q-btn(
            flat
            label='System Info'
            to='/_admin/system'
            )
    .col-12
      q-card.shadow-1
        q-card-section ---

//- v-container(fluid, grid-list-lg)
//-   v-layout(row, wrap)
//-     v-flex(xs12)
//-       .admin-header
//-         img.animated.fadeInUp(src='/_assets/svg/icon-browse-page.svg', alt='Dashboard', style='width: 80px;')
//-         .admin-header-title
//-           .headline.primary--text.animated.fadeInLeft {{ $t('admin.dashboard.title') }}
//-           .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s {{ $t('admin.dashboard.subtitle') }}
//-     v-flex(xs12 md6 lg4 xl3 d-flex)
//-       v-card.primary.dashboard-card.animated.fadeInUp(dark)
//-         v-card-text
//-           v-icon.dashboard-icon mdi-file-document-outline
//-           .overline {{$t('admin.dashboard.pages')}}
//-           animated-number.display-1(
//-             :value='info.pagesTotal'
//-             :duration='2000'
//-             :formatValue='round'
//-             easing='easeOutQuint'
//-             )
//-     v-flex(xs12 md6 lg4 xl3 d-flex)
//-       v-card.blue.darken-3.dashboard-card.animated.fadeInUp.wait-p2s(dark)
//-         v-card-text
//-           v-icon.dashboard-icon mdi-account
//-           .overline {{$t('admin.dashboard.users')}}
//-           animated-number.display-1(
//-             :value='info.usersTotal'
//-             :duration='2000'
//-             :formatValue='round'
//-             easing='easeOutQuint'
//-             )
//-     v-flex(xs12 md6 lg4 xl3 d-flex)
//-       v-card.blue.darken-4.dashboard-card.animated.fadeInUp.wait-p4s(dark)
//-         v-card-text
//-           v-icon.dashboard-icon mdi-account-group
//-           .overline {{$t('admin.dashboard.groups')}}
//-           animated-number.display-1(
//-             :value='info.groupsTotal'
//-             :duration='2000'
//-             :formatValue='round'
//-             easing='easeOutQuint'
//-             )
//-     v-flex(xs12 md6 lg12 xl3 d-flex)
//-       v-card.dashboard-card.animated.fadeInUp.wait-p6s(
//-         :class='isLatestVersion ? "green" : "red lighten-2"'
//-         dark
//-         )
//-         v-btn.btn-animate-wrench(fab, absolute, :right='!$vuetify.rtl', :left='$vuetify.rtl', top, small, light, to='system', v-if='hasPermission(`manage:system`)')
//-           v-icon(:color='isLatestVersion ? `green` : `red darken-4`', small) mdi-wrench
//-         v-card-text
//-           v-icon.dashboard-icon mdi-blur
//-           .subtitle-1 Wiki.js {{info.currentVersion}}
//-           .body-2(v-if='isLatestVersion') {{$t('admin.dashboard.versionLatest')}}
//-           .body-2(v-else) {{$t('admin.dashboard.versionNew', { version: info.latestVersion })}}
//-     v-flex(xs12, xl6)
//-       v-card.radius-7.animated.fadeInUp.wait-p2s
//-         v-toolbar(:color='$q.dark.isActive ? `grey darken-2` : `grey lighten-5`', dense, flat)
//-           v-spacer
//-           .overline {{$t('admin.dashboard.recentPages')}}
//-           v-spacer
//-         v-data-table.pb-2(
//-           :items='recentPages'
//-           :headers='recentPagesHeaders'
//-           :loading='recentPagesLoading'
//-           hide-default-footer
//-           hide-default-header
//-           )
//-           template(slot='item', slot-scope='props')
//-             tr.is-clickable(:active='props.selected', @click='$router.push(`/pages/` + props.item.id)')
//-               td
//-                 .body-2: strong {{ props.item.title }}
//-               td.admin-pages-path
//-                 v-chip(label, small, :color='$q.dark.isActive ? `grey darken-4` : `grey lighten-4`') {{ props.item.locale }}
//-                 span.ml-2.grey--text(:class='$q.dark.isActive ? `text--lighten-1` : `text--darken-2`') / {{ props.item.path }}
//-               td.text-right.caption(width='250') {{ props.item.updatedAt | moment('calendar') }}
//-     v-flex(xs12, xl6)
//-       v-card.radius-7.animated.fadeInUp.wait-p4s
//-         v-toolbar(:color='$q.dark.isActive ? `grey darken-2` : `grey lighten-5`', dense, flat)
//-           v-spacer
//-           .overline {{$t('admin.dashboard.lastLogins')}}
//-           v-spacer
//-         v-data-table.pb-2(
//-           :items='lastLogins'
//-           :headers='lastLoginsHeaders'
//-           :loading='lastLoginsLoading'
//-           hide-default-footer
//-           hide-default-header
//-           )
//-           template(slot='item', slot-scope='props')
//-             tr.is-clickable(:active='props.selected', @click='$router.push(`/users/` + props.item.id)')
//-               td
//-                 .body-2: strong {{ props.item.name }}
//-               td.text-right.caption(width='250') {{ props.item.lastLoginAt | moment('calendar') }}

//-     v-flex(xs12)
//-       v-card.dashboard-contribute.animated.fadeInUp.wait-p4s
//-         v-card-text
//-           img(src='/_assets/svg/icon-heart-health.svg', alt='Contribute', style='height: 80px;')
//-           .pl-5
//-             .subtitle-1 {{$t('admin.contribute.title')}}
//-             .body-2.mt-3: strong {{$t('admin.dashboard.contributeSubtitle')}}
//-             .body-2 {{$t('admin.dashboard.contributeHelp')}}
//-             v-btn.mx-0.mt-4(:color='$q.dark.isActive ? `indigo lighten-3` : `indigo`', outlined, small, to='/contribute')
//-               .caption: strong {{$t('admin.dashboard.contributeLearnMore')}}

</template>

<script setup>
import { useMeta } from 'quasar'
import { useI18n } from 'vue-i18n'

// STORES / ROUTERS / i18n

const { t } = useI18n()

// META

useMeta({
  title: t('admin.dashboard.title')
})

</script>

<style lang='scss'>

.admin-dashboard {
  &-card {
    display: flex;
    align-items: center;

    img {
      width: 64px;
      margin-right: 12px;
    }

    strong {
      font-size: 1.1rem;
      font-weight: 300;
      display: block;
      line-height: 1.2rem;
      padding-left: 2px;
    }

    span {
      font-size: 2rem;
      line-height: 2rem;
      font-weight: 500;
      color: $secondary;
      display: block;
    }

    small {
      font-size: 1.4rem;
      line-height: 2rem;
      font-weight: 400;
      color: $positive;
      display: block;
    }
  }
}

</style>
