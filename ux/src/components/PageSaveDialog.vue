<template lang="pug">
q-card.page-save-dialog(style='width: 860px; max-width: 90vw;')
  q-toolbar.bg-primary.text-white
    .text-subtitle2 {{$t('editor.pageSave.title')}}
  page-browser
  q-card-section
    q-input(
      v-model='reason'
      label='Reason for change'
      dense
      outlined
    )
  q-card-actions.card-actions
    q-space
    q-btn.acrylic-btn(
      icon='las la-times'
      :label='$t(`common.actions.cancel`)'
      color='grey-7'
      padding='xs md'
      v-close-popup
      flat
    )
    q-btn(
      icon='las la-check'
      :label='$t(`common.actions.save`)'
      unelevated
      color='primary'
      padding='xs md'
      @click=''
      v-close-popup
    )
</template>

<script>
import PageBrowser from './PageBrowser.vue'

export default {
  components: {
    PageBrowser
  },
  data () {
    return {
      reason: ''
    }
  },
  computed: {
  },
  mounted () {
  },
  methods: {
  }
}
</script>

<style lang="scss">

</style>
