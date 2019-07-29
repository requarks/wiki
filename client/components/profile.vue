<template lang='pug'>
  v-app(:dark='darkMode').profile
    nav-header
    v-navigation-drawer.pb-0(v-model='profileDrawerShown', app, fixed, clipped, left, permanent)
      v-list(dense)
        v-list-item.pt-2(to='/profile')
          v-list-item-action: v-icon account_circle
          v-list-item-title Profile
        v-list-item(to='/preferences')
          v-list-item-action: v-icon settings
          v-list-item-title Preferences
        v-divider.my-2
        v-subheader My Content
        v-list-item(to='/pages')
          v-list-item-action: v-icon pages
          v-list-item-title Pages
        v-list-item(to='/comments')
          v-list-item-action: v-icon question_answer
          v-list-item-title Comments

    v-content
      transition(name='profile-router')
        router-view

    nav-footer
    notify
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
