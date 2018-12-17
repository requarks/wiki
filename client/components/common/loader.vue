<template lang='pug'>
  v-dialog(v-model='value', persistent, max-width='350')
    v-card.loader-dialog.radius-7(:color='color', dark)
      v-card-text.text-xs-center.py-4
        atom-spinner.is-inline(
          :animation-duration='1000'
          :size='60'
          color='#FFF'
          )
        .subheading {{ title }}
        .caption {{ subtitle }}
</template>

<script>
import { AtomSpinner } from 'epic-spinners'

export default {
  components: {
    AtomSpinner
  },
  props: {
    value: {
      type: Boolean,
      default: false
    },
    color: {
      type: String,
      default: 'blue darken-3'
    },
    title: {
      type: String,
      default: 'Working...'
    },
    subtitle: {
      type: String,
      default: 'Please wait'
    }
  }
}
</script>

<style lang='scss'>
  .loader-dialog {
    .atom-spinner.is-inline {
      display: inline-block;
    }
    .caption {
      color: rgba(255,255,255,.7);
    }
  }
</style>
