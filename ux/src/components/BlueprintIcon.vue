<template lang='pug'>
q-item-section(avatar)
  q-avatar.blueprint-icon(
    :color='avatarBgColor'
    :text-color='avatarTextColor'
    font-size='14px'
    rounded
    :style='hueRotate !== 0 ? `filter: hue-rotate(` + hueRotate + `deg)` : ``'
    )
    q-badge(
      v-if='indicatorDot'
      rounded
      :color='indicatorDot'
      floating
      )
      q-tooltip(v-if='indicatorText') {{indicatorText}}
    q-icon(
      v-if='!textMode'
      :name='`img:/_assets/icons/ultraviolet-` + icon + `.svg`'
      size='sm'
    )
    span.text-uppercase(v-else) {{text}}
</template>

<script>
export default {
  name: 'BlueprintIcon',
  props: {
    icon: {
      type: String,
      default: ''
    },
    dark: {
      type: Boolean,
      default: false
    },
    indicator: {
      type: String,
      default: null
    },
    indicatorText: {
      type: String,
      default: null
    },
    hueRotate: {
      type: Number,
      default: 0
    },
    text: {
      type: String,
      default: null
    }
  },
  data () {
    return {
      imgPath: null
    }
  },
  computed: {
    textMode () { return this.text !== null },
    avatarBgColor () { return this.$q.dark.isActive || this.dark ? 'dark-4' : 'blue-1' },
    avatarTextColor () { return this.$q.dark.isActive || this.dark ? 'white' : 'blue-7' },
    indicatorDot () {
      if (this.indicator === null) { return null }
      return (this.indicator === '') ? 'pink' : this.indicator
    }
  }
}
</script>
