<template lang="pug">
q-card.page-relation-dialog(style='width: 500px;')
  q-toolbar.bg-primary.text-white
    .text-subtitle2(v-if='isEditMode') {{$t('editor.pageRel.titleEdit')}}
    .text-subtitle2(v-else) {{$t('editor.pageRel.title')}}
  q-card-section
    .text-overline {{$t('editor.pageRel.position')}}
    q-form.q-gutter-md.q-pt-md
      div
        q-btn-toggle(
          v-model='pos'
          push
          glossy
          no-caps
          toggle-color='primary'
          :options=`[
            { label: $t('editor.pageRel.left'), value: 'left' },
            { label: $t('editor.pageRel.center'), value: 'center' },
            { label: $t('editor.pageRel.right'), value: 'right' }
          ]`
        )
      .text-overline {{$t('editor.pageRel.button')}}
      q-input(
        ref='iptRelLabel'
        outlined
        dense
        :label='$t(`editor.pageRel.label`)'
        v-model='label'
        )
      template(v-if='pos !== `center`')
        q-input(
          outlined
          dense
          :label='$t(`editor.pageRel.caption`)'
          v-model='caption'
          )
      q-btn.rounded-borders(
        :label='$t(`editor.pageRel.selectIcon`)'
        color='primary'
        outline
        )
        q-menu(content-class='shadow-7')
          icon-picker-dialog(v-model='icon')
      .text-overline {{$t('editor.pageRel.target')}}
      q-btn.rounded-borders(
        :label='$t(`editor.pageRel.selectPage`)'
        color='primary'
        outline
        )
      .text-overline {{$t('editor.pageRel.preview')}}
      q-btn(
        v-if='pos === `left`'
        padding='sm md'
        outline
        :icon='icon'
        no-caps
        color='primary'
        )
        .column.text-left.q-pl-md
          .text-body2: strong {{label}}
          .text-caption {{caption}}
      q-btn.full-width(
        v-else-if='pos === `center`'
        :label='label'
        color='primary'
        flat
        no-caps
        :icon='icon'
      )
      q-btn(
        v-else-if='pos === `right`'
        padding='sm md'
        outline
        :icon-right='icon'
        no-caps
        color='primary'
        )
        .column.text-left.q-pr-md
          .text-body2: strong {{label}}
          .text-caption {{caption}}
  q-card-actions.card-actions
    q-space
    q-btn.acrylic-btn(
      icon='las la-times'
      :label='$t(`common.actions.discard`)'
      color='grey-7'
      padding='xs md'
      v-close-popup
      flat
    )
    q-btn(
      v-if='isEditMode'
      :disabled='!canSubmit'
      icon='las la-check'
      :label='$t(`common.actions.save`)'
      unelevated
      color='primary'
      padding='xs md'
      @click='persist'
      v-close-popup
    )
    q-btn(
      v-else
      :disabled='!canSubmit'
      icon='las la-plus'
      :label='$t(`common.actions.create`)'
      unelevated
      color='primary'
      padding='xs md'
      @click='create'
      v-close-popup
    )
</template>

<script>
import { v4 as uuid } from 'uuid'
import find from 'lodash/find'
import cloneDeep from 'lodash/cloneDeep'

import IconPickerDialog from './IconPickerDialog.vue'

export default {
  components: {
    IconPickerDialog
  },
  props: {
    editId: {
      type: String,
      default: null
    }
  },
  data () {
    return {
      pos: 'left',
      label: '',
      caption: '',
      icon: 'las la-arrow-left',
      target: ''
    }
  },
  computed: {
    canSubmit () {
      return this.label.length > 0
    },
    isEditMode () {
      return Boolean(this.editId)
    }
  },
  watch: {
    pos (newValue) {
      switch (newValue) {
        case 'left': {
          this.icon = 'las la-arrow-left'
          break
        }
        case 'center': {
          this.icon = 'las la-book'
          break
        }
        case 'right': {
          this.icon = 'las la-arrow-right'
          break
        }
      }
    }
  },
  mounted () {
    if (this.editId) {
      const rel = find(this.$store.get('page/relations'), ['id', this.editId])
      if (rel) {
        this.pos = rel.position
        this.label = rel.label
        this.caption = rel.caption || ''
        this.icon = rel.icon
        this.target = rel.target
      }
    }
    this.$nextTick(() => {
      this.$refs.iptRelLabel.focus()
    })
  },
  methods: {
    create () {
      this.$store.set('page/relations', [
        ...this.$store.get('page/relations'),
        {
          id: uuid(),
          position: this.pos,
          label: this.label,
          ...(this.pos !== 'center' ? { caption: this.caption } : {}),
          icon: this.icon,
          target: this.target
        }
      ])
    },
    persist () {
      const rels = cloneDeep(this.$store.get('page/relations'))
      for (const rel of rels) {
        if (rel.id === this.editId) {
          rel.position = this.pos
          rel.label = this.label
          rel.caption = this.caption
          rel.icon = this.icon
          rel.target = this.target
        }
      }
      this.$store.set('page/relations', rels)
    }
  }
}
</script>
