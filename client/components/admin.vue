<template lang='pug'>
  v-app.admin
    nav-header
    v-navigation-drawer.pb-0(v-model='adminDrawerShown', app, fixed, clipped, left, permanent)
      v-list(dense)
        v-list-tile.pt-2(to='/dashboard')
          v-list-tile-action: v-icon dashboard
          v-list-tile-title Dashboard
        v-divider.my-2
        v-subheader Site
        v-list-tile(to='/general')
          v-list-tile-action: v-icon widgets
          v-list-tile-title General
        v-list-tile(to='/locale')
          v-list-tile-action: v-icon language
          v-list-tile-title Locale
        v-list-tile(to='/stats')
          v-list-tile-action: v-icon show_chart
          v-list-tile-title Statistics
        v-list-tile(to='/theme')
          v-list-tile-action: v-icon palette
          v-list-tile-title Theme
        v-divider.my-2
        v-subheader Users
        v-list-tile(to='/groups')
          v-list-tile-action: v-icon people
          v-list-tile-title Groups
        v-list-tile(to='/users')
          v-list-tile-action: v-icon perm_identity
          v-list-tile-title Users
        v-divider.my-2
        v-subheader Modules
        v-list-tile(to='/auth')
          v-list-tile-action: v-icon lock_outline
          v-list-tile-title Authentication
        v-list-tile(to='/rendering')
          v-list-tile-action: v-icon system_update_alt
          v-list-tile-title Content Rendering
        v-list-tile(to='/editor')
          v-list-tile-action: v-icon transform
          v-list-tile-title Editor
        v-list-tile(to='/logging')
          v-list-tile-action: v-icon graphic_eq
          v-list-tile-title Logging
        v-list-tile(to='/search')
          v-list-tile-action: v-icon search
          v-list-tile-title Search Engine
        v-list-tile(to='/storage')
          v-list-tile-action: v-icon storage
          v-list-tile-title Storage
        v-divider.my-2
        v-subheader System
        v-list-tile(to='/api')
          v-list-tile-action: v-icon call_split
          v-list-tile-title API Access
        v-list-tile(to='/system')
          v-list-tile-action: v-icon tune
          v-list-tile-title System Info
        v-list-tile(to='/utilities')
          v-list-tile-action: v-icon build
          v-list-tile-title Utilities
        v-list-tile(to='/dev')
          v-list-tile-action: v-icon weekend
          v-list-tile-title Developer Tools

    v-content
      transition(name='admin-router')
        router-view

    v-footer.py-2.justify-center(app, absolute, color='grey lighten-3', inset, height='auto')
      .caption.grey--text.text--darken-1 Powered by Wiki.js

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

const router = new VueRouter({
  mode: 'history',
  base: '/a',
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: () => import(/* webpackChunkName: "admin" */ './admin-dashboard.vue') },
    { path: '/general', component: () => import(/* webpackChunkName: "admin" */ './admin-general.vue') },
    { path: '/locale', component: () => import(/* webpackChunkName: "admin" */ './admin-locale.vue') },
    { path: '/stats', component: () => import(/* webpackChunkName: "admin" */ './admin-stats.vue') },
    { path: '/theme', component: () => import(/* webpackChunkName: "admin" */ './admin-theme.vue') },
    { path: '/groups', component: () => import(/* webpackChunkName: "admin" */ './admin-groups.vue') },
    { path: '/users', component: () => import(/* webpackChunkName: "admin" */ './admin-users.vue') },
    { path: '/auth', component: () => import(/* webpackChunkName: "admin" */ './admin-auth.vue') },
    { path: '/rendering', component: () => import(/* webpackChunkName: "admin" */ './admin-rendering.vue') },
    { path: '/editor', component: () => import(/* webpackChunkName: "admin" */ './admin-editor.vue') },
    { path: '/logging', component: () => import(/* webpackChunkName: "admin" */ './admin-logging.vue') },
    { path: '/search', component: () => import(/* webpackChunkName: "admin" */ './admin-search.vue') },
    { path: '/storage', component: () => import(/* webpackChunkName: "admin" */ './admin-storage.vue') },
    { path: '/api', component: () => import(/* webpackChunkName: "admin" */ './admin-api.vue') },
    { path: '/system', component: () => import(/* webpackChunkName: "admin" */ './admin-system.vue') },
    { path: '/utilities', component: () => import(/* webpackChunkName: "admin" */ './admin-utilities.vue') },
    { path: '/dev', component: () => import(/* webpackChunkName: "admin-dev" */ './admin-dev.vue') }
  ]
})

export default {
  data() {
    return {
      adminDrawerShown: true
    }
  },
  computed: {
    ...mapState(['notification']),
    notificationState: {
      get() { return this.notification.isActive },
      set(newState) { this.$store.commit('updateNotificationState', newState) }
    }
  },
  router
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
