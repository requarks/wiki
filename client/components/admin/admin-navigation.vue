<template lang='pug'>
  v-container(fluid, fill-height)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header-icon: v-icon(size='80', color='grey lighten-2') near_me
        .headline.primary--text {{$t('navigation.title')}}
        .subheading.grey--text {{$t('navigation.subtitle')}}
        v-container.pa-0.mt-3(fluid, grid-list-lg)
          v-layout(row)
            v-flex(style='flex: 0 0 350px;')
              v-card
                v-list.primary.py-2(dense, dark)
                  draggable(v-model='navTree')
                    template(v-for='navItem in navTree')
                      v-list-tile(
                        v-if='navItem.kind === "link"'
                        :key='navItem.id'
                        :class='(navItem === current) ? "blue" : ""'
                        @click='selectItem(navItem)'
                        )
                        v-list-tile-avatar: v-icon {{navItem.icon}}
                        v-list-tile-title {{navItem.label}}
                      .py-2.clickable(
                        v-else-if='navItem.kind === "divider"'
                        :key='navItem.id'
                        :class='(navItem === current) ? "blue" : ""'
                        @click='selectItem(navItem)'
                        )
                        v-divider
                      v-subheader.pl-4.clickable(
                        v-else-if='navItem.kind === "header"'
                        :key='navItem.id'
                        :class='(navItem === current) ? "blue" : ""'
                        @click='selectItem(navItem)'
                        ) {{navItem.label}}
                v-card-chin
                  v-menu(offset-y, bottom, min-width='200px', style='flex: 1 1;')
                    v-btn(slot='activator', color='primary', depressed, block)
                      v-icon(left) add
                      span {{$t('common:actions.add')}}
                    v-list
                      v-list-tile(@click='addItem("link")')
                        v-list-tile-avatar: v-icon link
                        v-list-tile-title {{$t('navigation.link')}}
                      v-list-tile(@click='addItem("header")')
                        v-list-tile-avatar: v-icon title
                        v-list-tile-title {{$t('navigation.header')}}
                      v-list-tile(@click='addItem("divider")')
                        v-list-tile-avatar: v-icon power_input
                        v-list-tile-title {{$t('navigation.divider')}}
                  v-btn.ml-2(color='success', depressed, block, @click='save')
                    v-icon(left) check
                    span {{$t('common:actions.save')}}
            v-flex
              v-card(v-if='current.kind === "link"')
                v-toolbar(dense, color='blue', flat, dark)
                  .subheading {{$t('navigation.edit', { kind: $t('navigation.link') })}}
                v-card-text
                  v-text-field(
                    outline
                    background-color='grey lighten-2'
                    :label='$t("navigation.label")'
                    prepend-icon='title'
                    v-model='current.label'
                  )
                  v-text-field(
                    outline
                    background-color='grey lighten-2'
                    :label='$t("navigation.icon")'
                    prepend-icon='casino'
                    v-model='current.icon'
                  )
                  v-select(
                    outline
                    background-color='grey lighten-2'
                    :label='$t("navigation.targetType")'
                    prepend-icon='near_me'
                    :items='navTypes'
                    v-model='current.targetType'
                  )
                  v-text-field(
                    v-if='current.targetType === "external"'
                    outline
                    background-color='grey lighten-2'
                    :label='$t("navigation.target")'
                    prepend-icon='near_me'
                    v-model='current.target'
                  )
                v-card-chin
                  v-spacer
                  v-btn(color='red', outline, @click='deleteItem(current)')
                    v-icon(left) delete
                    span {{$t('navigation.delete', { kind: $t('navigation.link') })}}
              v-card(v-else-if='current.kind === "header"')
                v-toolbar(dense, color='blue', flat, dark)
                  .subheading {{$t('navigation.edit', { kind: $t('navigation.header') })}}
                v-card-text
                  v-text-field(
                    outline
                    background-color='grey lighten-2'
                    :label='$t("navigation.label")'
                    prepend-icon='title'
                    v-model='current.label'
                  )
                v-card-chin
                  v-spacer
                  v-btn(color='red', outline, @click='deleteItem(current)')
                    v-icon(left) delete
                    span {{$t('navigation.delete', { kind: $t('navigation.header') })}}
              div(v-else-if='current.kind === "divider"')
                v-btn.mt-0(color='red', outline, @click='deleteItem(current)')
                  v-icon(left) delete
                  span {{$t('navigation.delete', { kind: $t('navigation.divider') })}}
              v-card(v-else)
                v-card-text.grey--text {{$t('navigation.noSelectionText')}}

</template>

<script>
import _ from 'lodash'
import uuid from 'uuid/v4'

import treeSaveMutation from 'gql/admin/navigation/navigation-mutation-save-tree.gql'
import treeQuery from 'gql/admin/navigation/navigation-query-tree.gql'

import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
  data() {
    return {
      navTree: [],
      current: {}
    }
  },
  computed: {
    navTypes() {
      return [
        { text: this.$t('navigation.navType.external'), value: 'external' },
        { text: this.$t('navigation.navType.home'), value: 'home' },
        { text: this.$t('navigation.navType.page'), value: 'page' },
        { text: this.$t('navigation.navType.searchQuery'), value: 'search' }
      ]
    }
  },
  methods: {
    addItem(kind) {
      let newItem = {
        id: uuid(),
        kind
      }
      switch (kind) {
        case 'link':
          newItem = {
            ...newItem,
            label: this.$t('navigation.untitled', { kind: this.$t(`navigation.link`) }),
            icon: 'chevron_right',
            targetType: 'home',
            target: '/'
          }
          break
        case 'header':
          newItem.label = this.$t('navigation.untitled', { kind: this.$t(`navigation.header`) })
          break
      }
      this.navTree.push(newItem)
      this.current = newItem
    },
    deleteItem(item) {
      this.navTree = _.pull(this.navTree, item)
      this.current = {}
    },
    selectItem(item) {
      this.current = item
    },
    async save() {
      this.$store.commit(`loadingStart`, 'admin-navigation-save')
      try {
        await this.$apollo.mutate({
          mutation: treeSaveMutation,
          variables: {
            tree: this.navTree
          }
        })
      } catch (err) {
        this.$store.commit('showNotification', {
          message: this.$t('navigation.saveSuccess'),
          style: 'success',
          icon: 'check'
        })
      }
      this.$store.commit(`loadingStop`, 'admin-navigation-save')
    }
  },
  apollo: {
    navTree: {
      query: treeQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.navigation.tree),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-navigation-tree')
      }
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
