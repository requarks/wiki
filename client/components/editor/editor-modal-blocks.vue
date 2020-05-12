<template lang='pug'>
  v-card.editor-modal-blocks.animated.fadeInLeft(flat, tile)
    v-container.pa-3(grid-list-lg, fluid)
      v-row(dense)
        v-col(
          v-for='(item, idx) of blocks'
          :key='`block-` + item.key'
          cols='12'
          lg='4'
          xl='3'
          )
          v-card.radius-7(light, flat, @click='selectBlock(item)')
            v-card-text
              .d-flex.align-center
                v-avatar.radius-7(color='teal')
                  v-icon(dark) {{item.icon}}
                .pl-3
                  .body-2: strong.teal--text {{item.title}}
                  .caption.grey--text {{item.description}}
</template>

<script>
import _ from 'lodash'
import { sync } from 'vuex-pathify'

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      blocks: [
        {
          key: 'childlist',
          title: 'List Children Pages',
          description: 'Display a links list of all children of this page.',
          icon: 'mdi-format-list-text'
        },
        {
          key: 'tabs',
          title: 'Tabs',
          description: 'Organize content within tabs.',
          icon: 'mdi-tab'
        }
      ]
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    activeModal: sync('editor/activeModal')
  },
  methods: {
    selectBlock (item) {
      this.block = _.cloneDeep(item)
    }
  }
}
</script>

<style lang='scss'>
.editor-modal-blocks {
    position: fixed;
    top: 112px;
    left: 64px;
    z-index: 10;
    width: calc(100vw - 64px - 17px);
    height: calc(100vh - 112px - 24px);
    background-color: rgba(darken(mc('grey', '900'), 3%), .9) !important;

    @include until($tablet) {
      left: 40px;
      width: calc(100vw - 40px);
    }
}
</style>
