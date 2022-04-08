<template lang="pug">
q-card.page-data-dialog(style='width: 750px;')
  q-toolbar.bg-primary.text-white.flex
    .text-subtitle2 {{$t('editor.pageData.title')}}
    q-space
    q-btn(
      icon='las la-times'
      dense
      flat
      v-close-popup
    )
  q-card-section.page-data-dialog-selector
    //- .text-overline.text-white {{$t('editor.pageData.template')}}
    .flex.q-gutter-sm
      q-select(
        dark
        v-model='templateId'
        :label='$t(`editor.pageData.template`)'
        :aria-label='$t(`editor.pageData.template`)'
        :options='templates'
        option-value='id'
        map-options
        emit-value
        standout
        dense
        style='flex: 1 0 auto;'
      )
      q-btn.acrylic-btn(
        dark
        icon='las la-pen'
        :label='$t(`common.actions.manage`)'
        unelevated
        no-caps
        color='deep-orange-9'
        @click='editTemplates'
      )
  q-tabs.alt-card(
    v-model='mode'
    inline-label
    no-caps
    )
    q-tab(
      name='visual'
      label='Visual'
      )
    q-tab(
      name='code'
      label='YAML'
      )
  q-scroll-area(
    :thumb-style='thumbStyle'
    :bar-style='barStyle'
    style='height: calc(100% - 50px - 75px - 48px);'
    )
    q-card-section(v-if='mode === `visual`')
      .q-gutter-sm
        q-input(
          label='Attribute Text'
          dense
          outlined
          )
          template(v-slot:before)
            q-icon(name='las la-font', color='primary')
        q-input(
          label='Attribute Number'
          dense
          outlined
          type='number'
          )
          template(v-slot:before)
            q-icon(name='las la-infinity', color='primary')
        .q-py-xs
          q-checkbox(
            label='Attribute Boolean'
            color='primary'
            dense
            size='lg'
            )
    q-no-ssr(v-else, :placeholder='$t(`common.loading`)')
      codemirror.admin-theme-cm(
        ref='cmData'
        v-model='content'
        :options='{ mode: `text/yaml` }'
      )

  q-dialog(
    v-model='showDataTemplateDialog'
    )
    page-data-template-dialog
</template>

<script>
import { get } from 'vuex-pathify'

import PageDataTemplateDialog from './PageDataTemplateDialog.vue'

export default {
  components: {
    PageDataTemplateDialog
  },
  data () {
    return {
      showDataTemplateDialog: false,
      templateId: '',
      content: '',
      mode: 'visual'
    }
  },
  computed: {
    thumbStyle: get('site/thumbStyle', false),
    barStyle: get('site/barStyle', false),
    templates () {
      return [
        {
          id: '',
          label: 'None',
          data: []
        },
        ...this.$store.get('site/pageDataTemplates'),
        {
          id: 'basic',
          label: 'Basic',
          data: []
        }
      ]
    }
  },
  methods: {
    editTemplates () {
      this.showDataTemplateDialog = !this.showDataTemplateDialog
    }
  }
}
</script>

<style lang="scss">
.page-data-dialog {
  &-selector {
    @at-root .body--light & {
      background-color: $dark-3;
      box-shadow: inset 0px 1px 0 0 rgba(0,0,0,.75), inset 0px -1px 0 0 rgba(0,0,0,.75), 0 -1px 0 0 rgba(255,255,255,.1);
      border-bottom: 1px solid #FFF;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      box-shadow: inset 0px 1px 0 0 rgba(0,0,0, 0.75), inset 0px -1px 0 0 rgba(0,0,0,.75), 0 -1px 0 0 rgba(255,255,255,.1);
      border-bottom: 1px solid lighten($dark-3, 10%);
    }
  }
}
</style>
