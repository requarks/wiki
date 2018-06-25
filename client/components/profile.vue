<template lang='pug'>
  v-app(:dark='darkMode').profile
    nav-header
    v-navigation-drawer.pb-0(v-model='profileDrawerShown', app, fixed, clipped, left, permanent)
      v-list(dense)
        v-list-tile.pt-2(to='/profile')
          v-list-tile-action: v-icon account_circle
          v-list-tile-title Profile
        v-list-tile(to='/preferences')
          v-list-tile-action: v-icon settings
          v-list-tile-title Preferences
        v-divider.my-2
        v-subheader My Content
        v-list-tile(to='/pages')
          v-list-tile-action: v-icon pages
          v-list-tile-title Pages
        v-list-tile(to='/comments')
          v-list-tile-action: v-icon question_answer
          v-list-tile-title Comments

    v-content
      transition(name='profile-router')
        router-view

    v-footer.py-2.justify-center(app, absolute, :color='darkMode ? "" : "grey lighten-3"', inset, height='auto')
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

/* global WIKI, siteConfig */

const router = new VueRouter({
  mode: 'history',
  base: '/p',
  routes: [
    { path: '/', redirect: '/profile' },
    { path: '/profile', component: () => import(/* webpackChunkName: "profile" */ './profile/profile.vue') },
    { path: '/preferences', component: () => import(/* webpackChunkName: "profile" */ './profile/preferences.vue') },
    { path: '/pages', component: () => import(/* webpackChunkName: "profile" */ './profile/pages.vue') },
    { path: '/comments', component: () => import(/* webpackChunkName: "profile" */ './profile/comments.vue') }
  ]
})

router.beforeEach((to, from, next) => {
  WIKI.$store.commit('loadingStart', 'profile')
  next()
})

router.afterEach((to, from) => {
  WIKI.$store.commit('loadingStop', 'profile')
})

export default {
  data() {
    return {
      profileDrawerShown: true
    }
  },
  computed: {
    ...mapState(['notification']),
    notificationState: {
      get() { return this.notification.isActive },
      set(newState) { this.$store.commit('updateNotificationState', newState) }
    },
    darkMode() { return siteConfig.darkMode }
  },
  router
}
</script>

<style lang='scss'>

.profile-router {
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
