<template lang='pug'>
  v-list.radius-0(dense, nav)
    v-list-item(to='/dashboard', color='primary', @click='onNavigate')
      v-list-item-avatar(size='24', tile): v-icon mdi-view-dashboard-variant
      v-list-item-title {{ $t('admin:dashboard.title') }}
    template(v-if='hasPermission([`manage:system`, `manage:navigation`, `write:pages`, `manage:pages`, `delete:pages`])')
      v-divider.my-2
      v-subheader.pl-4 {{ $t('admin:nav.site') }}
      v-list-item(to='/general', color='primary', v-if='hasPermission(`manage:system`)', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-widgets
        v-list-item-title {{ $t('admin:general.title') }}
      v-list-item(to='/locale', color='primary', v-if='hasPermission(`manage:system`)', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-web
        v-list-item-title {{ $t('admin:locale.title') }}
      v-list-item(to='/navigation', color='primary', v-if='hasPermission([`manage:system`, `manage:navigation`])', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-near-me
        v-list-item-title {{ $t('admin:navigation.title') }}
      v-list-item(to='/pages', color='primary', v-if='hasPermission([`manage:system`, `write:pages`, `manage:pages`, `delete:pages`])', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-file-document-outline
        v-list-item-title {{ $t('admin:pages.title') }}
        v-list-item-action(style='min-width:auto;')
          v-chip(x-small, :color='$vuetify.theme.dark ? `grey darken-3-d4` : `grey lighten-5`')
            .caption.grey--text {{ info.pagesTotal }}
      v-list-item(to='/tags', v-if='hasPermission([`manage:system`])', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-tag-multiple
        v-list-item-title {{ $t('admin:tags.title') }}
        v-list-item-action(style='min-width:auto;')
          v-chip(x-small, :color='$vuetify.theme.dark ? `grey darken-3-d4` : `grey lighten-5`')
            .caption.grey--text {{ info.tagsTotal }}
      v-list-item(to='/theme', color='primary', v-if='hasPermission([`manage:system`, `manage:theme`])', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-palette-outline
        v-list-item-title {{ $t('admin:theme.title') }}
    template(v-if='hasPermission([`manage:system`, `manage:groups`, `write:groups`, `manage:users`, `write:users`])')
      v-divider.my-2
      v-subheader.pl-4 {{ $t('admin:nav.users') }}
      v-list-item(to='/groups', color='primary', v-if='hasPermission([`manage:system`, `manage:groups`, `write:groups`])', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-account-group
        v-list-item-title {{ $t('admin:groups.title') }}
        v-list-item-action(style='min-width:auto;')
          v-chip(x-small, :color='$vuetify.theme.dark ? `grey darken-3-d4` : `grey lighten-4`')
            .caption.grey--text {{ info.groupsTotal }}
      v-list-item(to='/users', color='primary', v-if='hasPermission([`manage:system`, `manage:groups`, `write:groups`, `manage:users`, `write:users`])', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-account-box
        v-list-item-title {{ $t('admin:users.title') }}
        v-list-item-action(style='min-width:auto;')
          v-chip(x-small, :color='$vuetify.theme.dark ? `grey darken-3-d4` : `grey lighten-4`')
            .caption.grey--text {{ info.usersTotal }}
    template(v-if='hasPermission(`manage:system`)')
      v-divider.my-2
      v-subheader.pl-4 {{ $t('admin:nav.modules') }}
      v-list-item(to='/analytics', color='primary', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-chart-timeline-variant
        v-list-item-title {{ $t('admin:analytics.title') }}
      v-list-item(to='/auth', color='primary', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-lock-outline
        v-list-item-title {{ $t('admin:auth.title') }}
      v-list-item(to='/comments', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-comment-text-outline
        v-list-item-title {{ $t('admin:comments.title') }}
      v-list-item(to='/page-navigation', color='primary', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-swap-horizontal
        v-list-item-title Page Navigation
      v-list-item(to='/rendering', color='primary', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-cogs
        v-list-item-title {{ $t('admin:rendering.title') }}
      v-list-item(to='/search', color='primary', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-cloud-search-outline
        v-list-item-title {{ $t('admin:search.title') }}
      v-list-item(to='/storage', color='primary', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-harddisk
        v-list-item-title {{ $t('admin:storage.title') }}
    template(v-if='hasPermission([`manage:system`, `manage:api`])')
      v-divider.my-2
      v-subheader.pl-4 {{ $t('admin:nav.system') }}
      v-list-item(to='/api', v-if='hasPermission([`manage:system`, `manage:api`])', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-call-split
        v-list-item-title {{ $t('admin:api.title') }}
      v-list-item(to='/mail', color='primary', v-if='hasPermission(`manage:system`)', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-email-multiple-outline
        v-list-item-title {{ $t('admin:mail.title') }}
      v-list-item(to='/security', v-if='hasPermission(`manage:system`)', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-lock-check
        v-list-item-title {{ $t('admin:security.title') }}
      v-list-item(to='/ssl', v-if='hasPermission(`manage:system`)', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-cloud-lock-outline
        v-list-item-title {{ $t('admin:ssl.title') }}
      v-list-item(to='/system', color='primary', v-if='hasPermission(`manage:system`)', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-tune
        v-list-item-title {{ $t('admin:system.title') }}
      v-list-item(to='/utilities', color='primary', v-if='hasPermission(`manage:system`)', @click='onNavigate')
        v-list-item-avatar(size='24', tile): v-icon mdi-wrench-outline
        v-list-item-title {{ $t('admin:utilities.title') }}
      v-list-group(
        to='/dev'
        no-action
        v-if='hasPermission([`manage:system`, `manage:api`])'
        )
        v-list-item(slot='activator')
          v-list-item-avatar(size='24', tile): v-icon mdi-dev-to
          v-list-item-title {{ $t('admin:dev.title') }}

        v-list-item(to='/dev-flags', color='primary', @click='onNavigate')
          v-list-item-title {{ $t('admin:dev.flags.title') }}
        v-list-item(href='/graphql', color='primary', @click='onNavigate')
          v-list-item-title GraphQL
      v-divider.my-2
    v-list-item(to='/contribute', color='primary', @click='onNavigate')
      v-list-item-avatar(size='24', tile): v-icon mdi-heart-outline
      v-list-item-title {{ $t('admin:contribute.title') }}
</template>

<script>
import _ from 'lodash'
import { get, sync } from 'vuex-pathify'

export default {
  i18nOptions: { namespaces: 'admin' },
  computed: {
    info: sync('admin/info'),
    permissions: get('user/permissions')
  },
  methods: {
    onNavigate () {
      this.$emit('navigate')
    },
    hasPermission (prm) {
      if (_.isArray(prm)) {
        return _.some(prm, p => _.includes(this.permissions, p))
      }
      return _.includes(this.permissions, prm)
    }
  }
}
</script>
