<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/_assets/svg/icon-web-design.svg', alt='Editor', style='width: 80px;')
          .admin-header-title
            .headline.primary--text {{ $t('admin:editor.title') }}
            .subtitle-1.grey--text {{ $t('admin:editor.subtitle') }} #[v-chip(label, color='primary', small).white--text {{ $t('admin:comming_soon') }}]
          v-spacer
          v-btn.animated.fadeInDown.wait-p2s.mx-3( color='grey', outlined, @click='refresh', icon)
            v-icon mdi-refresh
          v-btn(color='success', @click='save', depressed, large)
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}

        v-card.mt-3
          v-tabs(color='grey darken-2', fixed-tabs, slider-color='white', show-arrows, dark)
            v-tab(key='settings')
              v-btn()
                v-icon(left) mdi-cog-outline
                span {{ $t('admin:settings') }}
            v-tab(key='code')
              v-btn()
                v-icon(left) mdi-pen
                span {{ $t('admin:markdown') }}

            v-tab-item(key='settings', :transition='false', :reverse-transition='false')
              v-card.pa-3(flat, tile)
                .body-2.grey--text.text--darken-1 {{ $t('admin:editor.which_editors.title') }}
                .caption.grey--text.pb-2 {{ $t('admin:editor.which_editors.subtitle') }}
                v-form
                  v-checkbox.my-0(
                    v-for='editor in editors'
                    v-model='editor.isEnabled'
                    :key='editor.key'
                    :label='editor.title'
                    color='primary'
                    disabled
                    hide-details
                  )
            v-tab-item(key='code', :transition='false', :reverse-transition='false')
              v-card.wiki-form.pa-3(flat, tile)
                v-form
                  v-subheader {{ $t('admin:editor.configuration.title') }}
                  .body-1.ml-3 {{ $t('admin:editor.configuration.subtitle') }}
</template>

<script>
export default {
  data() {
    return {
      editors: [
        { title: 'API Docs', key: 'api', isEnabled: false },
        { title: 'Code', key: 'code', isEnabled: true },
        { title: 'Markdown', key: 'markdown', isEnabled: true },
        { title: 'Tabular', key: 'tabular', isEnabled: false },
        { title: 'Visual Builder', key: 'visual', isEnabled: false },
        { title: 'WikiText', key: 'wikitext', isEnabled: false }
      ]
    }
  },
  methods: {
    save() {},
    refresh() {}
  }
}
</script>

<style lang='scss'>

</style>
