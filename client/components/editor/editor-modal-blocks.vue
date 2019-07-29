<template lang='pug'>
  v-card.editor-modal-blocks.animated.fadeInLeft(flat, tile)
    v-container.pa-3(grid-list-lg, fluid)
      v-layout(row, wrap)
        v-flex(xs12, lg4, xl3)
          v-card.radius-7(light)
            v-card-text
              .d-flex
                v-toolbar.radius-7(color='teal lighten-5', dense, flat, height='44')
                  .body-2.teal--text Blocks
              v-list(two-line)
                template(v-for='(item, idx) of blocks')
                  v-list-item(@click='selectBlock(item)')
                    v-list-item-avatar
                      v-avatar.radius-7(color='teal')
                        v-icon(dark) dashboard
                    v-list-item-content
                      v-list-item-title.body-2 {{item.title}}
                      v-list-item-sub-title {{item.description}}
                    v-list-item-avatar(v-if='block.key === item.key')
                      v-icon.animated.fadeInLeft(color='teal') arrow_forward_ios
                  v-divider(v-if='idx < blocks.length - 1')

        v-flex(xs3)
          v-card.radius-7.animated.fadeInLeft(light, v-if='block.key')
            v-card-text
              v-toolbar.radius-7(color='teal lighten-5', dense, flat)
                v-icon.mr-3(color='teal') dashboard
                .body-2.teal--text {{block.title}}
              .d-flex.mt-3
                v-toolbar.radius-7(flat, color='grey lighten-4', dense, height='44')
                  .body-2 Coming soon
                v-btn.ml-3.my-0.mr-0.radius-7(color='teal', large, @click='', disabled)
                  v-icon(left) save_alt
                  span Insert
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
        { key: 'hero', title: 'Hero', description: 'A large banner with a title.' },
        { key: 'toc', title: 'Table of Contents', description: 'A list of children pages.' }
        // { key: 'form', title: 'Form', description: '' }
      ],
      block: {
        key: false
      }
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
