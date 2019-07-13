<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-maintenance.svg', alt='Utilities', style='width: 80px;')
          .admin-header-title
            .headline.primary--text {{$t('admin:utilities.title')}}
            .subheading.grey--text {{$t('admin:utilities.subtitle')}}

      v-flex(lg3, xs12)
        v-card.animated.fadeInUp
          v-toolbar(flat, color='primary', dark, dense)
            .subheading {{$t('admin:utilities.tools')}}
          v-list(two-line, dense).py-0
            template(v-for='(tool, idx) in tools')
              v-list-tile(:key='tool.key', @click='selectedTool = tool.key', :disabled='!tool.isAvailable')
                v-list-tile-avatar
                  v-icon(:color='!tool.isAvailable ? `grey lighten-1` : (selectedTool === tool.key ? `blue ` : `grey darken-1`)') {{ tool.icon }}
                v-list-tile-content
                  v-list-tile-title.body-2(:class='!tool.isAvailable ? `grey--text` : (selectedTool === tool.key ? `primary--text` : ``)') {{ $t('admin:utilities.' + tool.i18nKey + 'Title') }}
                  v-list-tile-sub-title.caption(:class='!tool.isAvailable ? `grey--text text--lighten-1` : (selectedTool === tool.key ? `blue--text ` : ``)') {{ $t('admin:utilities.' + tool.i18nKey + 'Subtitle') }}
                v-list-tile-avatar(v-if='selectedTool === tool.key')
                  v-icon.animated.fadeInLeft(color='primary') arrow_forward_ios
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
          icon: 'lock_outline',
          i18nKey: 'auth',
          isAvailable: true
        },
        {
          key: 'UtilityContent',
          icon: 'insert_drive_file',
          i18nKey: 'content',
          isAvailable: true
        },
        {
          key: 'UtilityCache',
          icon: 'invert_colors',
          i18nKey: 'cache',
          isAvailable: true
        },
        {
          key: 'UtilityGraphEndpoint',
          icon: 'settings_ethernet',
          i18nKey: 'graphEndpoint',
          isAvailable: false
        },
        {
          key: 'UtilityImportv1',
          icon: 'present_to_all',
          i18nKey: 'importv1',
          isAvailable: false
        },
        {
          key: 'UtilityTelemetry',
          icon: 'wifi_tethering',
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
