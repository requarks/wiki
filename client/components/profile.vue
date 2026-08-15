<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark').profile
    nav-header
    nav-mobile-drawer-host
    v-navigation-drawer.pb-0.profile-sidebar(
      v-if='$vuetify.breakpoint.mdAndUp'
      v-model='profileDrawerShown'
      :app='true'
      fixed
      :clipped='true'
      :dark='profileDrawerDark'
      :right='$vuetify.rtl'
      permanent
      width='256'
      overlay-color='black'
      :overlay-opacity='0.55'
      :class='profileDrawerClass'
      )
      nav-drawer-content-profile

    v-content(:class='$vuetify.theme.dark ? "grey darken-4" : "grey lighten-5"')
      transition(name='profile-router')
        router-view

    nav-footer
    notify
    search-results
</template>

<script>
import VueRouter from 'vue-router'

/* global WIKI */

const router = new VueRouter({
  mode: 'history',
  base: '/p',
  routes: [
    { path: '/', redirect: '/profile' },
    { path: '/profile', component: () => import(/* webpackChunkName: "profile" */ './profile/profile.vue') },
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
  i18nOptions: { namespaces: 'profile' },
  components: {
    NavDrawerContentProfile: () => import(/* webpackMode: "eager" */ './common/nav-drawer-content-profile.vue')
  },
  data() {
    return {
      profileDrawerShown: true
    }
  },
  computed: {
    profileDrawerClass () {
      return ''
    },
    profileDrawerDark () {
      return this.$vuetify.theme.dark
    }
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

.profile-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;

  &-title {
    margin-left: 1rem;
  }
}

.profile-sidebar-mobile {
  padding-top: 0;
}

</style>
