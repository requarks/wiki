<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.primary--text Rendering
        .subheading.grey--text Configure how content is rendered
        v-layout.mt-3(row wrap)
          v-flex(lg3 xs12)
            v-toolbar(
              color='primary'
              dense
              flat
              dark
              )
              v-icon.mr-2 line_weight
              .subheading Pipeline
            v-expansion-panel.adm-rendering-pipeline
              v-expansion-panel-content(
                hide-actions
                v-for='core in cores'
                :key='core.key'
                )
                v-toolbar(
                  slot='header'
                  color='blue'
                  dense
                  dark
                  flat
                  )
                  .body-2 {{core.input}}
                  v-icon.mx-2 arrow_forward
                  .caption {{core.output}}
                v-list(two-line, dense)
                  v-list-tile(
                    avatar
                    v-for='rdr in core.children'
                    :key='rdr.key'
                    )
                    v-list-tile-avatar
                      v-icon(color='grey') {{rdr.icon}}
                    v-list-tile-content
                      v-list-tile-title {{rdr.title}}
                      v-list-tile-sub-title {{rdr.description}}
                    v-list-tile-avatar
                      v-icon(color='green', small, v-if='rdr.isEnabled') lens
                      v-icon(color='red', small, v-else) trip_origin
                  v-divider.my-0

          v-flex(lg9 xs12)
            v-card
              v-toolbar(
                color='grey darken-1'
                dark
                flat
                dense
                )
                v-icon.mr-2 settings_applications
                .subheading Markdown
                v-icon chevron_right
                .subheading Core
                v-spacer
                v-btn(flat, disabled)
                  v-icon(left) wrap_text
                  span Bypass
                v-btn(flat, disabled)
                  v-icon(left) clear
                  span Remove
              v-card-text
                v-switch(
                  v-model='linkify'
                  label='Automatically convert links'
                  color='primary'
                  persistent-hint
                  hint='Links will automatically be converted to clickable links.'
                  )
                v-divider.mt-3
                v-switch(
                  v-model='linkify'
                  label='Automatically convert line breaks'
                  color='primary'
                  persistent-hint
                  hint='Add linebreaks within paragraphs.'
                  )
                v-divider.mt-3
                v-switch(
                  v-model='linkify'
                  label='Highlight code blocks'
                  color='primary'
                  persistent-hint
                  hint='Add syntax coloring to code blocks.'
                  )
                v-select.mt-3(
                  :items='["Light", "Dark"]'
                  v-model='codeTheme'
                  label='Code Color Theme'
                  outline
                  background-color='grey lighten-2'
                )
              v-card-chin
                v-btn(
                  color='primary'
                  )
                  v-icon(left) check
                  span Apply Configuration
</template>

<script>
import _ from 'lodash'

import renderersQuery from 'gql/admin/rendering/rendering-query-renderers.gql'

export default {
  data() {
    return {
      linkify: true,
      codeTheme: 'Light',
      renderers: []
    }
  },
  computed: {
    cores() {
      return _.filter(this.renderers, ['dependsOn', null]).map(core => {
        core.children = _.concat([_.cloneDeep(core)], _.filter(this.renderers, ['dependsOn', core.key]))
        return core
      })
    }
  },
  apollo: {
    renderers: {
      query: renderersQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.rendering.renderers).map(str => ({...str, config: str.config.map(cfg => ({...cfg, value: JSON.parse(cfg.value)}))})),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-rendering-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>
.adm-rendering-pipeline {
  border-top: 1px solid #FFF;

  .v-expansion-panel__header {
    padding: 0 0;
  }
}
</style>
