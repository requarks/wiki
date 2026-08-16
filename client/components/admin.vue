<template lang='pug'>
  v-app.admin
    nav-header
      template(slot='mid')
        v-spacer
        .overline.grey--text {{$t('admin:adminArea')}}
        v-spacer
    nav-mobile-drawer-host
    nav-drawer-shell(
      v-if='$vuetify.breakpoint.mdAndUp'
      v-model='adminDrawerShown'
      permanent
      category='admin'
      :width='300'
      )
      nav-drawer-content-admin

    v-main(:class='$vuetify.theme.dark ? "grey darken-5" : "grey lighten-5"')
      transition(name='admin-router')
        router-view

    nav-footer
    notify
    search-results
</template>

<script>
import VueRouter from 'vue-router'
import { sync } from 'vuex-pathify'

import statsQuery from 'gql/admin/dashboard/dashboard-query-stats.gql'

import adminStore from '../store/admin'

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
    { path: '/navigation', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-navigation.vue') },
    { path: '/pages', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-pages.vue') },
    { path: '/pages/:id(\\d+)', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-pages-edit.vue') },
    { path: '/pages/visualize', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-pages-visualize.vue') },
    { path: '/tags', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-tags.vue') },
    { path: '/theme', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-theme.vue') },
    { path: '/groups', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-groups.vue') },
    { path: '/groups/:id(\\d+)', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-groups-edit.vue') },
    { path: '/users', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-users.vue') },
    { path: '/users/:id(\\d+)', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-users-edit.vue') },
    { path: '/analytics', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-analytics.vue') },
    { path: '/auth', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-auth.vue') },
    { path: '/comments', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-comments.vue') },
    { path: '/page-navigation', redirect: '/page-customization' },
    { path: '/page-customization', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-page-navigation.vue') },
    { path: '/rendering', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-rendering.vue') },
    { path: '/editor', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-editor.vue') },
    { path: '/extensions', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-extensions.vue') },
    { path: '/logging', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-logging.vue') },
    { path: '/search', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-search.vue') },
    { path: '/storage', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-storage.vue') },
    { path: '/api', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-api.vue') },
    { path: '/mail', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-mail.vue') },
    { path: '/security', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-security.vue') },
    { path: '/ssl', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-ssl.vue') },
    { path: '/system', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-system.vue') },
    { path: '/utilities', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-utilities.vue') },
    { path: '/webhooks', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-webhooks.vue') },
    { path: '/dev-flags', component: () => import(/* webpackChunkName: "admin-dev" */ './admin/admin-dev-flags.vue') },
    { path: '/contribute', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-contribute.vue') }
  ]
})

export default {
  i18nOptions: { namespaces: 'admin' },
  components: {
    NavDrawerContentAdmin: () => import(/* webpackMode: "eager" */ './common/nav-drawer-content-admin.vue'),
    NavDrawerShell: () => import(/* webpackMode: "eager" */ './common/nav-drawer-shell.vue')
  },
  data() {
    return {
      adminDrawerShown: true
    }
  },
  computed: {
    info: sync('admin/info')
  },
  router,
  created() {
    this.$store.commit('page/SET_MODE', 'admin')
    this.$store.set('page/path', '')
    this.$store.set('page/locale', siteConfig.lang)
  },
  apollo: {
    info: {
      query: statsQuery,
      fetchPolicy: 'network-only',
      manual: true,
      result({ data, loading, networkStatus }) {
        this.info = data.system.info
      },
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-stats-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

.admin {
  &.theme--light .application--wrap {
    background-color: lighten(mc('grey', '200'), 2%);
  }
}

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

.admin-sidebar-mobile {
  padding-top: 0;
}

@media #{map-get($display-breakpoints, 'sm-and-down')} {
  .admin,
  .admin .v-main,
  .admin .v-main__wrap {
    overflow-x: hidden;
    max-width: 100vw;
  }

  body.has-mobile-bottom-nav .admin .v-main {
    padding-bottom: 56px !important;
  }
}

.admin-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;

  &__icon {
    width: 80px;
    height: auto;
    flex-shrink: 0;
  }

  &__brand {
    display: flex;
    align-items: center;
    flex: 1 1 280px;
    min-width: 0;
    max-width: 100%;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    width: 100%;
  }

  &__path {
    word-break: break-all;
    overflow-wrap: anywhere;
  }

  &__status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    flex: 1 1 auto;
  }

  &__status-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-left: auto;
    flex: 0 1 auto;
  }

  &-title {
    margin-left: 1rem;
    min-width: 0;
  }
}

@media #{map-get($display-breakpoints, 'sm-and-down')} {
  .admin-header {
    &__icon {
      width: 52px;
    }

    &__brand {
      flex: 1 1 100%;
      max-width: 100%;
    }

    &__status {
      flex: 1 1 100%;
    }

    &__actions {
      flex: 1 1 100%;
      margin-left: 0;
      justify-content: flex-start;
    }

    &-title {
      margin-left: 0.75rem;
    }

    .headline {
      font-size: 1.25rem !important;
      line-height: 1.3 !important;
    }
  }

}

.admin-providerlogo {
  width: 250px;
  height: 50px;
  float: right;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-left: 16px;

  img {
    max-width: 100%;
    max-height: 50px;
  }
}

.v-application.admin {
  code {
    box-shadow: none;
    font-family: 'Roboto Mono', monospace;
    color: mc('pink', '500');
  }
}

</style>
