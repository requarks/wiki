<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-maintenance.svg', alt='Utilities', style='width: 80px;')
          .admin-header-title
            .headline.primary--text {{$t('admin:utilities.title')}}
            .subtitle-1.grey--text {{$t('admin:utilities.subtitle')}}

      v-flex(lg3, xs12)
        v-card.animated.fadeInUp
          v-toolbar(flat, color='primary', dark, dense)
            .subtitle-1 {{$t('admin:utilities.tools')}}
          v-list(two-line, dense).py-0
            template(v-for='(tool, idx) in tools')
              v-list-item(:key='tool.key', @click='selectedTool = tool.key', :disabled='!tool.isAvailable')
                v-list-item-avatar
                  v-icon(:color='!tool.isAvailable ? `grey lighten-1` : (selectedTool === tool.key ? `blue ` : `grey darken-1`)') {{ tool.icon }}
                v-list-item-content
                  v-list-item-title.body-2(:class='!tool.isAvailable ? `grey--text` : (selectedTool === tool.key ? `primary--text` : ``)') {{ $t('admin:utilities.' + tool.i18nKey + 'Title') }}
                  v-list-item-subtitle: .caption(:class='!tool.isAvailable ? `grey--text text--lighten-1` : (selectedTool === tool.key ? `blue--text ` : ``)') {{ $t('admin:utilities.' + tool.i18nKey + 'Subtitle') }}
                v-list-item-avatar(v-if='selectedTool === tool.key')
                  v-icon.animated.fadeInLeft(color='primary', large) mdi-chevron-right
              v-divider(v-if='idx < tools.length - 1')

      v-flex.animated.fadeInUp.wait-p2s(xs12, lg9)
        transition(name='admin-router')
          component(:is='selectedTool')

</template>

<script>

export default {
  components: {
    UtilityAuth: () => import(/* webpackChunkName: "admin" */ './admin-utilities-auth.vue'),
    UtilityContent: () => import(/* webpackChunkName: "admin" */ './admin-utilities-content.vue'),
    UtilityCache: () => import(/* webpackChunkName: "admin" */ './admin-utilities-cache.vue'),
    UtilityImportv1: () => import(/* webpackChunkName: "admin" */ './admin-utilities-importv1.vue'),
    UtilityTelemetry: () => import(/* webpackChunkName: "admin" */ './admin-utilities-telemetry.vue')
  },
  data() {
    return {
      selectedTool: 'UtilityAuth',
      tools: [
        {
          key: 'UtilityAuth',
          icon: 'mdi-lock-open-outline',
          i18nKey: 'auth',
          isAvailable: true
        },
        {
          key: 'UtilityContent',
          icon: 'mdi-content-duplicate',
          i18nKey: 'content',
          isAvailable: true
        },
        {
          key: 'UtilityCache',
          icon: 'mdi-database-refresh',
          i18nKey: 'cache',
          isAvailable: true
        },
        {
          key: 'UtilityGraphEndpoint',
          icon: 'mdi-graphql',
          i18nKey: 'graphEndpoint',
          isAvailable: false
        },
        {
          key: 'UtilityImportv1',
          icon: 'mdi-database-import',
          i18nKey: 'importv1',
          isAvailable: true
        },
        {
          key: 'UtilityTelemetry',
          icon: 'mdi-math-compass',
          i18nKey: 'telemetry',
          isAvailable: true
        }
      ]
    }
  }
}
</script>

<style lang='scss'>

</style>
