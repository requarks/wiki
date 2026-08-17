<template lang='pug'>
  .v-pagination-bar(ref='container')
    v-pagination(
      v-model='internalValue'
      :length='length'
      :total-visible='totalVisible'
      v-bind='$attrs'
      v-on='$listeners'
    )
</template>

<script>
import { calcTotalVisible } from '../../helpers/pagination'

export default {
  inheritAttrs: false,
  props: {
    value: {
      type: Number,
      default: 0
    },
    length: {
      type: Number,
      default: 0
    }
  },
  data () {
    return {
      totalVisible: 7,
      resizeObserver: null
    }
  },
  computed: {
    internalValue: {
      get () {
        return this.value
      },
      set (nextValue) {
        this.$emit('input', nextValue)
      }
    }
  },
  watch: {
    length () {
      this.scheduleFit()
    },
    value () {
      this.scheduleFit()
    }
  },
  mounted () {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.fitPagination()
      })
      this.resizeObserver.observe(this.$refs.container)
    }

    this.scheduleFit()
  },
  beforeDestroy () {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }
  },
  methods: {
    scheduleFit () {
      this.$nextTick(this.fitPagination)
    },
    fitPagination () {
      const container = this.$refs.container

      if (!container) {
        return
      }

      this.totalVisible = calcTotalVisible(
        container.clientWidth,
        this.length,
        this.value || 1
      )
    }
  }
}
</script>

<style lang='scss'>
.v-pagination-bar {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
}
</style>
