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

    nav-footer
    search-results
</template>

<script>
import VueRouter from 'vue-router'

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
    darkMode() { return siteConfig.darkMode }
  },
  router,
  created() {
    this.$store.commit('page/SET_MODE', 'profile')
  }
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
