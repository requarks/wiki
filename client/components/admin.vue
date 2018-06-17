<template lang='pug'>
  v-app(:dark='darkMode').admin
    nav-header
    v-navigation-drawer.pb-0(v-model='adminDrawerShown', app, fixed, clipped, left, permanent)
      v-list(dense)
        v-list-tile.pt-2(to='/dashboard')
          v-list-tile-avatar: v-icon dashboard
          v-list-tile-title {{ $t('admin:dashboard.title') }}
        v-divider.my-2
        v-subheader.pl-4 {{ $t('admin:nav.site') }}
        v-list-tile(to='/general')
          v-list-tile-avatar: v-icon widgets
          v-list-tile-title {{ $t('admin:general.title') }}
        v-list-tile(to='/locale')
          v-list-tile-avatar: v-icon language
          v-list-tile-title {{ $t('admin:locale.title') }}
        v-list-tile(to='/stats')
          v-list-tile-avatar: v-icon show_chart
          v-list-tile-title {{ $t('admin:stats.title') }}
        v-list-tile(to='/theme')
          v-list-tile-avatar: v-icon palette
          v-list-tile-title {{ $t('admin:theme.title') }}
        v-divider.my-2
        v-subheader.pl-4 {{ $t('admin:nav.users') }}
        v-list-tile(to='/groups')
          v-list-tile-avatar: v-icon people
          v-list-tile-title {{ $t('admin:groups.title') }}
        v-list-tile(to='/users')
          v-list-tile-avatar: v-icon perm_identity
          v-list-tile-title {{ $t('admin:users.title') }}
          v-list-tile-action
            .justify-end
              v-chip(small, disabled, color='grey lighten-4')
                .caption.grey--text 1
        v-divider.my-2
        v-subheader.pl-4 {{ $t('admin:nav.modules') }}
        v-list-tile(to='/auth')
          v-list-tile-avatar: v-icon lock_outline
          v-list-tile-title {{ $t('admin:auth.title') }}
        v-list-tile(to='/editor')
          v-list-tile-avatar: v-icon transform
          v-list-tile-title {{ $t('admin:editor.title') }}
        v-list-tile(to='/logging')
          v-list-tile-avatar: v-icon graphic_eq
          v-list-tile-title {{ $t('admin:logging.title') }}
        v-list-tile(to='/rendering')
          v-list-tile-avatar: v-icon system_update_alt
          v-list-tile-title {{ $t('admin:rendering.title') }}
        v-list-tile(to='/search')
          v-list-tile-avatar: v-icon search
          v-list-tile-title {{ $t('admin:search.title') }}
        v-list-tile(to='/storage')
          v-list-tile-avatar: v-icon storage
          v-list-tile-title {{ $t('admin:storage.title') }}
        v-divider.my-2
        v-subheader.pl-4 {{ $t('admin:nav.system') }}
        v-list-tile(to='/api')
          v-list-tile-avatar: v-icon call_split
          v-list-tile-title {{ $t('admin:api.title') }}
        v-list-tile(to='/system')
          v-list-tile-avatar: v-icon tune
          v-list-tile-title {{ $t('admin:system.title') }}
        v-list-tile(to='/utilities')
          v-list-tile-avatar: v-icon build
          v-list-tile-title {{ $t('admin:utilities.title') }}
        v-list-tile(to='/dev')
          v-list-tile-avatar: v-icon weekend
          v-list-tile-title {{ $t('admin:dev.title') }}
        v-divider.my-2
        v-list-tile(to='/contribute')
          v-list-tile-avatar: v-icon favorite
          v-list-tile-title {{ $t('admin:contribute.title') }}

    v-content
      transition(name='admin-router')
        router-view

    v-footer.py-2.justify-center(app, absolute, :color='darkMode ? "" : "grey lighten-3"', inset, height='auto')
      .caption.grey--text.text--darken-1 {{ $t('common:footer.poweredBy') }} Wiki.js

    v-snackbar(
      :color='notification.style'
      bottom,
      right,
      multi-line,
      v-model='notificationState'
    )
      .text-xs-left
        v-icon.mr-3(dark) {{ notification.icon }}
        span {{ notification.message }}
</template>

<script>
import VueRouter from 'vue-router'
import { mapState } from 'vuex'

import adminStore from '@/store/admin'

/* global WIKI, siteConfig */

WIKI.$store.registerModule('admin', adminStore)

const router = new VueRouter({
  mode: 'history',
  base: '/a',
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-dashboard.vue') },
    { path: '/general', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-general.vue') },
    { path: '/locale', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-locale.vue') },
    { path: '/stats', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-stats.vue') },
    { path: '/theme', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-theme.vue') },
    { path: '/groups', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-groups.vue') },
    { path: '/groups/:id', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-groups-edit.vue') },
    { path: '/users', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-users.vue') },
    { path: '/auth', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-auth.vue') },
    { path: '/rendering', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-rendering.vue') },
    { path: '/editor', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-editor.vue') },
    { path: '/logging', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-logging.vue') },
    { path: '/search', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-search.vue') },
    { path: '/storage', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-storage.vue') },
    { path: '/api', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-api.vue') },
    { path: '/system', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-system.vue') },
    { path: '/utilities', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-utilities.vue') },
    { path: '/dev', component: () => import(/* webpackChunkName: "admin-dev" */ './admin/admin-dev.vue') },
    { path: '/contribute', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-contribute.vue') }
  ]
})

export default {
  i18nOptions: { namespaces: 'admin' },
  data() {
    return {
      adminDrawerShown: true
    }
  },
  computed: {
    ...mapState({
      notification: state => state.notification,
      darkMode: state => state.admin.theme.dark
    }),
    notificationState: {
      get() { return this.notification.isActive },
      set(newState) { this.$store.commit('updateNotificationState', newState) }
    }
  },
  router,
  mounted() {
    this.$store.commit('admin/setThemeDarkMode', siteConfig.darkMode)
  }
}
</script>

<style lang='scss'>

.admin-router {
  &-enter-active, &-leave-active {
    transition: opacity .25s ease;
    opacity: 1;
  }
  &-enter-active {
    transition-delay: .25s;
  }
  &-enter, &-leave-to {
    opacity: 0;
  }
}

</style>
