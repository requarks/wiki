<template lang="pug">
  .has-collapsable-nav
    ul.collapsable-nav(v-for='treeItem in tree', :class='{ "has-children": treeItem.hasChildren }', v-cloak)
      li(v-for='page in treeItem.pages', :class='{ "is-active": page.isActive }')
        a(v-on:click='mainAction(page)')
          template(v-if='page._id !== "home"')
            i(:class='{ "icon-folder2": page.isDirectory, "icon-file-text-o": !page.isDirectory }')
            span {{ page.title }}
          template(v-else)
            i.icon-home
            span {{ $t('nav.home') }}
        a.is-pagelink(v-if='page.isDirectory && page.isEntry', v-on:click='goto(page._id)')
          i.icon-file-text-o
          i.icon-arrow-right2
</template>

<script>
  export default {
    name: 'tree',
    data () {
      return {
        tree: []
      }
    },
    methods: {
      fetch (basePath) {
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
      goto (entryPath) {
        window.location.assign(siteRoot + '/' + entryPath)
      },
      unfold (entryPath) {
        let self = this
        let lastIndex = 0
        self._.forEach(self.tree, branch => {
          lastIndex++
          if (self._.find(branch.pages, { _id: entryPath }) !== undefined) {
            return false
          }
        })
        self.tree = self._.slice(self.tree, 0, lastIndex)
        let branch = self._.last(self.tree)
        branch.hasChildren = false
        branch.pages.forEach(page => {
          page.isActive = false
        })
      },
      mainAction (page) {
        let self = this
        if (page.isActive) {
          self.unfold(page._id)
        } else if (page.isDirectory) {
          self.fetch(page._id)
        } else {
          self.goto(page._id)
        }
      }
    },
    mounted () {
      let basePath = window.location.pathname.slice(0, -4)
      if (basePath.length > 1) {
        basePath = basePath.slice(1)
      }
      this.fetch(basePath)
    }
  }
</script>
