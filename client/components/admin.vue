<template lang='pug'>
  v-app(:dark='darkMode').admin
    nav-header
    v-navigation-drawer.pb-0.admin-sidebar(v-model='adminDrawerShown', app, fixed, clipped, left, permanent)
      vue-scroll(:ops='scrollStyle')
        v-list(dense)
          v-list-tile.pt-2(to='/dashboard')
            v-list-tile-avatar: v-icon dashboard
            v-list-tile-title {{ $t('admin:dashboard.title') }}
          template(v-if='hasPermission([`manage:system`, `manage:navigation`, `write:pages`, `manage:pages`, `delete:pages`])')
            v-divider.my-2
            v-subheader.pl-4 {{ $t('admin:nav.site') }}
            v-list-tile(to='/general', v-if='hasPermission(`manage:system`)')
              v-list-tile-avatar: v-icon widgets
              v-list-tile-title {{ $t('admin:general.title') }}
            v-list-tile(to='/locale', v-if='hasPermission(`manage:system`)')
              v-list-tile-avatar: v-icon language
              v-list-tile-title {{ $t('admin:locale.title') }}
            v-list-tile(to='/navigation', v-if='hasPermission([`manage:system`, `manage:navigation`])')
              v-list-tile-avatar: v-icon near_me
              v-list-tile-title {{ $t('admin:navigation.title') }}
            v-list-tile(to='/pages', v-if='hasPermission([`manage:system`, `write:pages`, `manage:pages`, `delete:pages`])')
              v-list-tile-avatar: v-icon insert_drive_file
              v-list-tile-title {{ $t('admin:pages.title') }}
              v-list-tile-action
                v-chip(small, disabled, :color='darkMode ? `grey darken-3-d4` : `grey lighten-4`')
                  .caption.grey--text {{ info.pagesTotal }}
            v-list-tile(to='/theme', v-if='hasPermission([`manage:system`, `manage:theme`])')
              v-list-tile-avatar: v-icon palette
              v-list-tile-title {{ $t('admin:theme.title') }}
          template(v-if='hasPermission([`manage:system`, `manage:groups`, `write:groups`, `manage:users`, `write:users`])')
            v-divider.my-2
            v-subheader.pl-4 {{ $t('admin:nav.users') }}
            v-list-tile(to='/groups', v-if='hasPermission([`manage:system`, `manage:groups`, `write:groups`])')
              v-list-tile-avatar: v-icon people
              v-list-tile-title {{ $t('admin:groups.title') }}
              v-list-tile-action
                v-chip(small, disabled, :color='darkMode ? `grey darken-3-d4` : `grey lighten-4`')
                  .caption.grey--text {{ info.groupsTotal }}
            v-list-tile(to='/users', v-if='hasPermission([`manage:system`, `manage:groups`, `write:groups`, `manage:users`, `write:users`])')
              v-list-tile-avatar: v-icon perm_identity
              v-list-tile-title {{ $t('admin:users.title') }}
              v-list-tile-action
                v-chip(small, disabled, :color='darkMode ? `grey darken-3-d4` : `grey lighten-4`')
                  .caption.grey--text {{ info.usersTotal }}
          template(v-if='hasPermission(`manage:system`)')
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
          template(v-if='hasPermission([`manage:system`, `manage:api`])')
            v-divider.my-2
            v-subheader.pl-4 {{ $t('admin:nav.system') }}
            v-list-tile(to='/api', v-if='hasPermission([`manage:system`, `manage:api`])')
              v-list-tile-avatar: v-icon call_split
              v-list-tile-title {{ $t('admin:api.title') }}
            v-list-tile(to='/mail', v-if='hasPermission(`manage:system`)')
              v-list-tile-avatar: v-icon email
              v-list-tile-title {{ $t('admin:mail.title') }}
            v-list-tile(to='/system', v-if='hasPermission(`manage:system`)')
              v-list-tile-avatar: v-icon tune
              v-list-tile-title {{ $t('admin:system.title') }}
            v-list-tile(to='/utilities', v-if='hasPermission(`manage:system`)', disabled)
              v-list-tile-avatar: v-icon(color='grey lighten-2') build
              v-list-tile-title {{ $t('admin:utilities.title') }}
            v-list-tile(to='/dev', v-if='hasPermission([`manage:system`, `manage:api`])')
              v-list-tile-avatar: v-icon weekend
              v-list-tile-title {{ $t('admin:dev.title') }}
            v-divider.my-2
          v-list-tile(to='/contribute')
            v-list-tile-avatar: v-icon favorite
            v-list-tile-title {{ $t('admin:contribute.title') }}

    v-content(:class='darkMode ? "grey darken-4" : ""')
      transition(name='admin-router')
        router-view

    nav-footer
</template>

<script>
import _ from 'lodash'
import VueRouter from 'vue-router'
import { get, sync } from 'vuex-pathify'

import statsQuery from 'gql/admin/dashboard/dashboard-query-stats.gql'

import adminStore from '@/store/admin'

/* global WIKI */

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
    { path: '/theme', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-theme.vue') },
    { path: '/groups', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-groups.vue') },
    { path: '/groups/:id', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-groups-edit.vue') },
    { path: '/users', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-users.vue') },
    { path: '/users/:id', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-users-edit.vue') },
    { path: '/auth', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-auth.vue') },
    { path: '/rendering', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-rendering.vue') },
    { path: '/editor', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-editor.vue') },
    { path: '/logging', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-logging.vue') },
    { path: '/search', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-search.vue') },
    { path: '/storage', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-storage.vue') },
    { path: '/api', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-api.vue') },
    { path: '/mail', component: () => import(/* webpackChunkName: "admin" */ './admin/admin-mail.vue') },
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
      adminDrawerShown: true,
      scrollStyle: {
        vuescroll: {},
        scrollPanel: {
          initialScrollY: 0,
          initialScrollX: 0,
          scrollingX: false,
          easing: 'easeOutQuad',
          speed: 1000
        },
        rail: {
          gutterOfEnds: '2px'
        },
        bar: {
          onlyShowBarOnScroll: false,
          background: '#CCC',
          hoverStyle: {
            background: '#999'
          }
        }
      }
    }
  },
  computed: {
    darkMode: get('site/dark'),
    info: sync('admin/info'),
    permissions: get('user/permissions')
  },
  router,
  created() {
    this.$store.commit('page/SET_MODE', 'admin')
  },
  methods: {
    hasPermission(prm) {
      if (_.isArray(prm)) {
        return _.some(prm, p => {
          return _.includes(this.permissions, p)
        })
      } else {
        return _.includes(this.permissions, prm)
      }
    }
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

.admin-sidebar {
  .v-list__tile--active {
    background-color: rgba(mc('theme', 'primary'), .1);

    .v-icon {
      color: mc('theme', 'primary');
    }
  }
}

.theme--dark {
  .admin-sidebar .v-list__tile--active {
    background-color: rgba(0,0,0, .2);
    color: mc('blue', '500') !important;

    .v-icon {
      color: mc('blue', '500');
    }
  }
}

.admin-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;

  &-title {
    margin-left: 1rem;
  }
}

</style>
