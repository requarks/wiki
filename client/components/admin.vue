<template lang='pug'>
  v-app.admin
    v-toolbar(color='black', dark, app, clipped-left, fixed, flat)
      v-toolbar-side-icon(@click.native='')
      v-toolbar-title
        span.subheading Wiki.js
      v-spacer
      v-btn(icon)
        v-icon(color='grey') search
      v-btn(icon, @click.native='darkTheme = !darkTheme')
        v-icon(color='grey') settings
      v-menu(offset-y, min-width='300')
        v-btn(icon, slot='activator')
          v-icon(color='grey') account_circle
        v-list.py-0
          v-list-tile.py-3(avatar)
            v-list-tile-avatar
              v-avatar.red(:size='40'): span.white--text.subheading JD
            v-list-tile-content
              v-list-tile-title John Doe
              v-list-tile-sub-title john.doe@example.com
          v-divider.my-0
          v-list-tile(@click='')
            v-list-tile-action: v-icon(color='red') exit_to_app
            v-list-tile-title Logout

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
        v-list-tile(to='/storage')
          v-list-tile-action: v-icon storage
          v-list-tile-title Storage
        v-divider.my-2
        v-subheader System
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
      router-view

    v-footer.py-2.justify-center(app, fixed, color='grey lighten-3', inset, height='auto')
      .caption.grey--text.text--darken-1 Powered by Wiki.js
</template>

<script>
import VueRouter from 'vue-router'

const router = new VueRouter({
  mode: 'history',
  base: '/a',
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: () => import(/* webpackChunkName: "admin" */ './admin-dashboard.vue') },
    { path: '/general', component: () => import(/* webpackChunkName: "admin" */ './admin-general.vue') }
  ]
})

export default {
  data() {
    return {
      adminDrawerShown: true
    }
  },
  router
}
</script>

<style lang='scss'>

</style>
