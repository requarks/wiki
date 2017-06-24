<template lang="pug">
  div {{ currentPath }}
</template>

<script>
export default {
  name: 'history',
  props: ['currentPath'],
  data() {
    return {
      tree: []
    }
  },
  methods: {
    fetch(basePath) {
      let self = this
      self.$store.dispatch('startLoading')
      self.$nextTick(() => {
        socket.emit('treeFetch', { basePath }, (data) => {
          if (self.tree.length > 0) {
            let branch = self._.last(self.tree)
            branch.hasChildren = true
            self._.find(branch.pages, { _id: basePath }).isActive = true
          }
          self.tree.push({
            hasChildren: false,
            pages: data
          })
          self.$store.dispatch('stopLoading')
        })
      })
    },
    goto(entryPath) {
      window.location.assign(siteRoot + '/' + entryPath)
    }
  },
  mounted() {

  }
}
</script>
