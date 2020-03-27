<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-triangle-arrow.svg', alt='Navigation', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('navigation.title')}}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s {{$t('navigation.subtitle')}}
          v-spacer
          v-btn.animated.fadeInDown.wait-p2s.mr-3(outlined, color='grey', @click='refresh', large)
            v-icon mdi-refresh
          v-btn.animated.fadeInDown(color='success', depressed, @click='save', large)
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}
        v-container.pa-0.mt-3(fluid, grid-list-lg)
          v-layout(row)
            v-flex(style='flex: 0 0 350px;')
              v-card.animated.fadeInUp
                v-list.py-2(dense, nav, dark, :class='navTree.length < 1 ? "grey lighten-4" : "primary"')
                  v-list-item(v-if='navTree.length < 1')
                    v-list-item-avatar(size='24'): v-icon(color='grey') explore_off
                    v-list-item-content
                      .caption.grey--text {{$t('navigation.emptyList')}}
                  draggable(v-model='navTree')
                    template(v-for='navItem in navTree')
                      v-list-item(
                        v-if='navItem.kind === "link"'
                        :key='navItem.id'
                        :class='(navItem === current) ? "blue" : ""'
                        @click='selectItem(navItem)'
                        )
                        v-list-item-avatar(size='24'): v-icon {{navItem.icon}}
                        v-list-item-title {{navItem.label}}
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
                    template(v-slot:activator='{ on }')
                      v-btn(v-on='on', color='primary', depressed, block)
                        v-icon(left) mdi-plus
                        span {{$t('common:actions.add')}}
                    v-list
                      v-list-item(@click='addItem("link")')
                        v-list-item-avatar(size='24'): v-icon mdi-link
                        v-list-item-title {{$t('navigation.link')}}
                      v-list-item(@click='addItem("header")')
                        v-list-item-avatar(size='24'): v-icon mdi-format-title
                        v-list-item-title {{$t('navigation.header')}}
                      v-list-item(@click='addItem("divider")')
                        v-list-item-avatar(size='24'): v-icon mdi-minus
                        v-list-item-title {{$t('navigation.divider')}}
            v-flex.animated.fadeInUp.wait-p2s
              v-card.wiki-form(v-if='current.kind === "link"')
                v-toolbar(dense, color='blue', flat, dark).subtitle-1 {{$t('navigation.edit', { kind: $t('navigation.link') })}}
                v-card-text
                  v-text-field(
                    outlined
                    :label='$t("navigation.label")'
                    prepend-icon='mdi-format-title'
                    v-model='current.label'
                    counter='255'
                  )
                  v-text-field(
                    outlined
                    :label='$t("navigation.icon")'
                    prepend-icon='mdi-dice-5'
                    v-model='current.icon'
                    hide-details
                  )
                  .caption.pt-3.pl-5 The default icon set is #[strong Material Design Icons]. In order to use another icon set, you must first select it in the Theme administration section.
                  .caption.pt-3.pl-5: strong Material Design Icons
                  .caption.pl-5 Refer to the #[a(href='https://materialdesignicons.com/', target='_blank') Material Design Icons Reference] for the list of all possible values. You must prefix all values with #[code mdi-], e.g. #[code mdi-home]
                  .caption.pt-3.pl-5: strong Font Awesome 5
                  .caption.pl-5 Refer to the #[a(href='https://fontawesome.com/icons?d=gallery&m=free', target='_blank') Font Awesome 5 Reference] for the list of all possible values. You must prefix all values with #[code fas fa-], e.g. #[code fas fa-home]. Note that some icons use different prefixes (e.g. #[code fab], #[code fad], #[code fal], #[code far]).
                  .caption.pt-3.pl-5: strong Font Awesome 4
                  .caption.pl-5 Refer to the #[a(href='https://fontawesome.com/v4.7.0/icons/', target='_blank') Font Awesome 4 Reference] for the list of all possible values. You must prefix all values with #[code fa fa-], e.g. #[code fa fa-home]
                  v-select.mt-4(
                    outlined
                    :label='$t("navigation.targetType")'
                    prepend-icon='mdi-near-me'
                    :items='navTypes'
                    v-model='current.targetType'
                  )
                  v-text-field(
                    v-if='current.targetType === `external`'
                    outlined
                    :label='$t("navigation.target")'
                    prepend-icon='mdi-near-me'
                    v-model='current.target'
                  )
                  v-btn(
                    v-else-if='current.targetType === "page"'
                    color='indigo'
                    :dark='false'
                    disabled
                    @click='selectPage'
                    )
                    v-icon(left) mdi-search
                    span Select Page...
                  v-text-field(
                    v-else-if='current.targetType === `search`'
                    outlined
                    :label='$t("navigation.navType.searchQuery")'
                    prepend-icon='search'
                    v-model='current.target'
                  )

                v-card-chin
                  v-spacer
                  v-btn.px-5(color='red', outlined, @click='deleteItem(current)')
                    v-icon(left) mdi-delete
                    span {{$t('navigation.delete', { kind: $t('navigation.link') })}}
              v-card(v-else-if='current.kind === "header"')
                v-toolbar(dense, color='blue', flat, dark)
                  .subtitle-1 {{$t('navigation.edit', { kind: $t('navigation.header') })}}
                v-card-text
                  v-text-field(
                    outlined
                    :label='$t("navigation.label")'
                    prepend-icon='mdi-format-title'
                    v-model='current.label'
                  )
                v-card-chin
                  v-spacer
                  v-btn.px-5(color='red', outlined, @click='deleteItem(current)')
                    v-icon(left) mdi-delete
                    span {{$t('navigation.delete', { kind: $t('navigation.header') })}}
              div(v-else-if='current.kind === "divider"')
                v-btn.mt-0.px-5(color='red', outlined, @click='deleteItem(current)')
                  v-icon(left) mdi-delete
                  span {{$t('navigation.delete', { kind: $t('navigation.divider') })}}
              v-card(v-else)
                v-card-text.grey--text(v-if='navTree.length > 0') {{$t('navigation.noSelectionText')}}
                v-card-text.grey--text(v-else) {{$t('navigation.noItemsText')}}
</template>

<script>
import _ from 'lodash'
import { v4 as uuid } from 'uuid'

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
        // { text: this.$t('navigation.navType.external'), value: 'external' },
        { text: this.$t('navigation.navType.home'), value: 'home' },
        { text: 'Internal Path / External Link', value: 'external' }
        // { text: this.$t('navigation.navType.page'), value: 'page' }
        // { text: this.$t('navigation.navType.searchQuery'), value: 'search' }
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
            icon: 'mdi-chevron-right',
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
    selectPage() {
      window.alert(`Coming soon. Use External Link for now (you can still specify internal links).`)
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
        this.$store.commit('pushGraphError', err)
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
