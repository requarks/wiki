<template lang='pug'>
  v-dialog(v-model='isShown', width='90vw', max-width='1200')
    .dialog-header
      span Live Console
      v-spacer
      .caption.blue--text.text--lighten-3.mr-3 Streaming...
      v-progress-circular(
        indeterminate
        color='blue lighten-3'
        :size='20'
        :width='2'
        )
    .consoleTerm(ref='consoleContainer')
    v-toolbar(flat, color='grey darken-3', dark)
      v-spacer
      v-btn(outline, @click='clear')
        v-icon(left) cancel_presentation
        span Clear
      v-btn(outline, @click='close')
        v-icon(left) close
        span Close
</template>

<script>
import _ from 'lodash'
import { Terminal } from 'xterm'
import * as fit from 'xterm/lib/addons/fit/fit'

Terminal.applyAddon(fit)

export default {
  term: null,
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    }
  },
  watch: {
    value(newValue, oldValue) {
      if (newValue) {
        _.delay(() => {
          this.term = new Terminal()
          this.term.open(this.$refs.consoleContainer)
          this.term.writeln('Connecting to \x1B[1;3;31mconsole output\x1B[0m...')
        }, 100)
      } else {
        this.term.dispose()
        this.term = null
      }
    }
  },
  mounted() {
    this.term = new Terminal()
    this.term.open(this.$refs.consoleContainer)
  },
  methods: {
    clear() {
      this.term.clear()
    },
    close() {
      this.isShown = false
    }
  }
}
</script>

<style lang='scss'>

.consoleTerm {
  background-color: #000;
  padding: 16px;
  width: 100%;
  height: 415px;
}

</style>
