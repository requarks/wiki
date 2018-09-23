<template lang='pug'>
  v-container(fluid, fill-height)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header-icon: v-icon(size='80', color='grey lighten-2') near_me
        .headline.primary--text {{$t('admin:navigation.title')}}
        .subheading.grey--text {{$t('admin:navigation.subtitle')}}
        v-container.pa-0.mt-3(fluid, grid-list-lg)
          v-layout(row)
            v-flex(style='flex: 0 0 350px;')
              v-card
                v-list.primary.py-2(dense, dark)
                  draggable
                    template(v-for='navItem in navTree')
                      v-list-tile(v-if='navItem.kind === "link"', :class='(navItem === current) ? "blue" : ""', @click='selectItem(navItem)')
                        v-list-tile-avatar: v-icon {{navItem.icon}}
                        v-list-tile-title {{navItem.label}}
                      .py-2.clickable(v-else-if='navItem.kind === "divider"', :class='(navItem === current) ? "blue" : ""', @click='selectItem(navItem)')
                        v-divider
                      v-subheader.pl-4.clickable(v-else-if='navItem.kind === "header"', :class='(navItem === current) ? "blue" : ""', @click='selectItem(navItem)') {{navItem.label}}
                v-card-chin
                  v-spacer
                  v-menu(offset-y, bottom, min-width='200px')
                    v-btn(slot='activator', color='primary', depressed)
                      v-icon(left) add
                      span Add
                    v-list
                      v-list-tile(@click='addItem("link")')
                        v-list-tile-avatar: v-icon link
                        v-list-tile-title Link
                      v-list-tile(@click='addItem("header")')
                        v-list-tile-avatar: v-icon title
                        v-list-tile-title Header
                      v-list-tile(@click='addItem("divider")')
                        v-list-tile-avatar: v-icon power_input
                        v-list-tile-title Divider
                  v-btn.ml-2(color='success', depressed)
                    v-icon(left) check
                    span Save
            v-flex
              v-card(v-if='current.kind === "link"')
                v-toolbar(dense, color='blue', flat, dark)
                  .subheading Edit Link
                v-card-text
                  v-text-field(
                    outline
                    background-color='grey lighten-2'
                    label='Label'
                    prepend-icon='title'
                    v-model='current.label'
                  )
                  v-text-field(
                    outline
                    background-color='grey lighten-2'
                    label='Icon'
                    prepend-icon='casino'
                    v-model='current.icon'
                  )
                  v-select(
                    outline
                    background-color='grey lighten-2'
                    label='Target Type'
                    prepend-icon='near_me'
                    :items='navTypes'
                    v-model='current.targetType'
                  )
                  v-text-field(
                    v-if='current.targetType === "external"'
                    outline
                    background-color='grey lighten-2'
                    label='Target'
                    prepend-icon='near_me'
                    v-model='current.target'
                  )
                v-card-chin
                  v-spacer
                  v-btn(color='red', outline)
                    v-icon(left) delete
                    span Delete Link
              v-card(v-else-if='current.kind === "header"')
                v-toolbar(dense, color='blue', flat, dark)
                  .subheading Edit Header
                v-card-text
                  v-text-field(
                    outline
                    background-color='grey lighten-2'
                    label='Label'
                    prepend-icon='title'
                    v-model='current.label'
                  )
                v-card-chin
                  v-spacer
                  v-btn(color='red', outline)
                    v-icon(left) delete
                    span Delete Header
              div(v-else-if='current.kind === "divider"')
                v-btn.mt-0(color='red', outline)
                  v-icon(left) delete
                  span Delete Divider
              v-card(v-else)
                v-card-text.grey--text Select a navigation item on the left.

</template>

<script>
import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
  data() {
    return {
      navTypes: [
        { text: 'External Link', value: 'external' },
        { text: 'Home', value: 'home' },
        { text: 'Page', value: 'page' },
        { text: 'Search Query', value: 'search' }
      ],
      navTree: [
        {
          kind: 'link',
          label: 'Home',
          icon: 'home',
          targetType: 'home',
          target: '/'
        }
      ],
      current: {}
    }
  },
  methods: {
    addItem(kind) {
      let newItem = {
        kind
      }
      switch (kind) {
        case 'link':
          newItem = {
            ...newItem,
            label: 'Untitled Link',
            icon: 'chevron_right',
            targetType: 'home',
            target: '/'
          }
          break
        case 'header':
          newItem.label = 'Untitled Header'
          break
      }
      this.navTree.push(newItem)
      this.current = newItem
    },
    selectItem(item) {
      this.current = item
    }
  }
}
</script>

<style lang='scss' scoped>

.clickable {
  cursor: pointer;

  &:hover {
    background-color: rgba(mc('blue', '500'), .25);
  }
}

</style>
