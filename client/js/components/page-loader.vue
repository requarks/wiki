<template lang="pug">
  transition(name='page-loader')
    .page-loader(v-if='isShown')
      i
      span {{ msg }}
</template>

<script>
  export default {
    name: 'page-loader',
    props: ['text'],
    data () {
      return {}
    },
    computed: {
      msg () { return this.$store.state.pageLoader.msg },
      isShown () { return this.$store.state.pageLoader.shown }
    },
    mounted() {
      this.$store.commit('pageLoader/msgChange', this.text)
    }
  }
}
</script>
