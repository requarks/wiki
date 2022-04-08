<template lang="pug">
.q-gutter-xs
  template(v-if='tags && tags.length > 0')
    q-chip(
      square
      color='secondary'
      text-color='white'
      dense
      clickable
      :removable='edit'
      @remove='removeTag(tag)'
      v-for='tag of tags'
      :key='`tag-` + tag'
      )
      q-icon.q-mr-xs(name='las la-tag', size='14px')
      span.text-caption {{tag}}
    q-chip(
      v-if='!edit && tags.length > 1'
      square
      color='secondary'
      text-color='white'
      dense
      clickable
      )
      q-icon(name='las la-tags', size='14px')
  q-input.q-mt-md(
    v-if='edit'
    outlined
    v-model='newTag'
    dense
    placeholder='Add new tag...'
  )
</template>

<script>
import { sync } from 'vuex-pathify'

export default {
  props: {
    edit: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      newTag: ''
    }
  },
  computed: {
    tags: sync('page/tags', false)
  },
  methods: {
    removeTag (tag) {
      this.tags = this.tags.filter(t => t !== tag)
    }
  }
}
</script>
