<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          v-icon(size='80', color='grey lighten-2') near_me
          .admin-header-title
            .headline.primary--text {{$t('navigation.title')}}
            .subheading.grey--text {{$t('navigation.subtitle')}}
          v-spacer
          v-btn(outline, color='grey', @click='refresh', large)
            v-icon refresh
          v-btn(color='success', depressed, @click='save', large)
            v-icon(left) check
            span {{$t('common:actions.apply')}}
        v-container.pa-0.mt-3(fluid, grid-list-lg)
          v-layout(row)
            v-flex(style='flex: 0 0 350px;')
              v-card
                v-list.py-2(dense, dark, :class='navTree.length < 1 ? "grey lighten-4" : "primary"')
                  v-list-tile(v-if='navTree.length < 1')
                    v-list-tile-avatar: v-icon(color='grey') explore_off
                    v-list-tile-content
                      .caption.grey--text {{$t('navigation.emptyList')}}
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
            v-flex
              v-card.wiki-form(v-if='current.kind === "link"')
                v-toolbar(dense, color='blue', flat, dark)
                  .subheading {{$t('navigation.edit', { kind: $t('navigation.link') })}}
                v-card-text
                  v-text-field(
                    outline
                    :label='$t("navigation.label")'
                    prepend-icon='title'
                    v-model='current.label'
                  )
                  v-text-field(
                    outline
                    :label='$t("navigation.icon")'
                    prepend-icon='casino'
                    v-model='current.icon'
                  )
                  v-select(
                    outline
                    :label='$t("navigation.targetType")'
                    prepend-icon='near_me'
                    :items='navTypes'
                    v-model='current.targetType'
                  )
                  v-text-field(
                    v-if='current.targetType === `external`'
                    outline
                    :label='$t("navigation.target")'
                    prepend-icon='near_me'
                    v-model='current.target'
                  )
                  v-btn(
                    v-else-if='current.targetType === "page"'
                    color='indigo'
                    dark
                    )
                    v-icon(left) search
                    span Select Page...
                  v-text-field(
                    v-else-if='current.targetType === `search`'
                    outline
                    :label='$t("navigation.navType.searchQuery")'
                    prepend-icon='search'
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
                v-card-text.grey--text(v-if='navTree.length > 0') {{$t('navigation.noSelectionText')}}
                v-card-text.grey--text(v-else) {{$t('navigation.noItemsText')}}
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
        const resp = await this.$apollo.mutate({
          mutation: treeSaveMutation,
          variables: {
            tree: this.navTree
          }
        })
        if (_.get(resp, 'data.navigation.updateTree.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            message: this.$t('navigation.saveSuccess'),
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(_.get(resp, 'data.navigation.updateTree.responseResult.message', 'An unexpected error occured.'))
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'red',
          icon: 'warning'
        })
      }
      this.$store.commit(`loadingStop`, 'admin-navigation-save')
    },
    async refresh() {
      await this.$apollo.queries.navTree.refetch()
      this.current = {}
      this.$store.commit('showNotification', {
        message: 'Navigation has been refreshed.',
        style: 'success',
        icon: 'cached'
      })
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
