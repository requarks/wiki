<template lang="pug">
  div
    .pa-3.d-flex(
      v-if='navMode === `MIXED`'
      :class='dark ? colors.surfaceDark.black : colors.surfaceLight.white'
      )
      v-btn.hover-btn(
        depressed
        :color='colors.actionLight.highlightOnLite'
        style='min-width:0;'
        @click='goHome'
        :aria-label='$t(`common:header.home`)'
        )
        v-icon(
          size='20'
          :color='colors.textLight.primary'
          ) mdi-home
      v-btn.ml-3.hover-btn(
        v-if='currentMode === `custom`'
        depressed
        :color='colors.actionLight.highlightOnLite'
        style='flex: 1 1 100%;'
        @click='switchMode(`browse`)'
        )
        v-icon(
          left
          :color='colors.textLight.primary'
          ) mdi-file-tree
        .body-2.text-none(:style='"color:" + colors.textLight.primary') {{$t('common:sidebar.browse')}}
      v-btn.ml-3.hover-btn(
        v-else-if='currentMode === `browse`'
        depressed
        :color='colors.actionLight.highlightOnLite'
        :style='"flex: 1 1 100%; color:" + colors.textLight.primary'
        @click='switchMode(`custom`)'
        )
        v-icon(
          left
          :color='colors.textLight.primary'
          ) mdi-navigation
        .body-2.text-none(:style='"color:" + colors.textLight.primary') {{$t('common:sidebar.mainMenu')}}
    v-divider
    //-> Custom Navigation
    v-list.py-2(
      v-if='currentMode === `custom`'
      dense
      rounded
      :class='dark ? `dark ` + color : color'
      :dark='dark'
      )
      template(v-for='item of items' )
        v-list-item(
          v-if='item.k === `link`'
          :href='item.t'
          :target='item.y === `externalblank` ? `_blank` : `_self`'
          :rel='item.y === `externalblank` ? `noopener` : ``'
          )
          v-list-item-avatar(size='24', tile)
            v-icon(
              v-if='item.c.match(/fa[a-z] fa-/)'
              :color='dark ? `white` : colors.textLight.primary'
              size='19'
              ) {{ item.c }}
            v-icon(
              v-else
              :color='dark ? `white` : colors.textLight.primary'
              ) {{ item.c }}
          v-list-item-title {{ item.l }}
        v-divider.my-2(v-else-if='item.k === `divider`')
        v-subheader.pl-4(v-else-if='item.k === `header`') {{ item.l }}
    //-> Browse
    v-list.py-2(
      v-else-if='currentMode === `browse`'
      dense
      rounded
      :class='dark ? `dark ` + color : color'
      :dark='dark'
      )
      //- Tree branch from root to current directory
      template(v-if='currentParent.id > 0 || isParentPage')
        v-list-item(
          v-for='(item, idx) of parents'
          :href='getHref(item)'
          :key='`parent-` + item.id'
          style='min-height: 30px;'
          )
          v-list-item-avatar(
            size='18'
            :style='`padding-left: ` + (idx * 8) + `px; width: auto; margin: 0 5px 0 0;`'
            )
            v-icon(small :color='dark ? `white` : colors.textLight.primary') mdi-folder-open
          v-list-item-title {{ item.title }}
        v-divider.mt-2
        v-list-item.mt-2(
          v-if='currentParent.pageId > 0'
          :href='`/` + sitePath + `/` + currentParent.locale + `/` + currentParent.path'
          :key='`directorypage-` + currentParent.id'
          :input-value='path === currentParent.path'
          )
          v-list-item-avatar(size='24')
            v-icon(:color='dark ? `white` : colors.textLight.primary') mdi-text-box
          v-list-item-title {{ currentParent.title }}
      //- Current directory items
      template(
        v-for='item of itemList'
        )
        v-list-item(
          v-if='item.isFolder'
          :href='getHref(item)'
          :key='`childfolder-` + item.id'
          :color='dark ? `white` : colors.textLight.primary'
          :style='getListItemStyles()'
          )
          v-list-item-avatar(size='24')
            v-icon(:color='dark ? `white` : colors.textLight.primary') mdi-folder
          v-list-item-title {{ item.title }}
        v-list-item(
          v-else
          :href='getHref(item)'
          :key='`childpage-` + item.id'
          :input-value='path === item.path'
          :style='getListItemStyles()'
          )
          v-list-item-avatar(size='24')
            v-icon(:color='dark ? `white` : colors.textLight.primary') mdi-text-box
          v-list-item-title {{ item.title }}
</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'
import colors from '@/themes/default/js/color-scheme'

import pageTreeQuery from '@/graph/common/common-pages-query-tree.gql'
import pageByPathQuery from '@/graph/common/common-pages-query-page-by-path.gql'
import childPagesQuery from '@/graph/common/common-pages-query-child-pages.gql'

/* global siteLangs */

export default {
  props: {
    color: {
      type: String,
      default: 'primary'
    },
    dark: {
      type: Boolean,
      default: true
    },
    items: {
      type: Array,
      default: () => []
    },
    navMode: {
      type: String,
      default: 'MIXED'
    }
  },
  data() {
    return {
      currentMode: 'custom',
      topLevelPageItems: [],
      currentParent: {
        id: 0,
        title: '/ (root)'
      },
      parents: [],
      childPageItems: [],
      hasFetchedChildren: false,
      loadedCache: [],
      colors: colors
    }
  },
  computed: {
    pageId: get('page/id'),
    path: get('page/path'),
    locale: get('page/locale'),
    sitePath: get('page/sitePath'),
    siteId: get('page/siteId'),
    isParentPage: get('page/hasChildren'),
    isReadyToFetchPageChildren() {
      return this.pageId && typeof this.pageId === 'number' &&
        this.locale && typeof this.locale === 'string' &&
        this.siteId && typeof this.siteId === 'string' &&
        this.isParentPage
    },
    itemList() {
      return this.isParentPage ? this.childPageItems : this.topLevelPageItems
    }
  },
  methods: {
    switchMode(mode) {
      this.currentMode = mode
      window.localStorage.setItem('navPref', mode)
      if (mode === `browse` && this.loadedCache.length < 1) {
        this.loadFromCurrentPath()
      }
    },
    getHref(item) {
      return item.path ? `/${this.sitePath}/${item.locale}/${item.path}` : `/${this.sitePath}/`
    },
    async fetchPageTree() {
      const pageTreeResp = await this.$apollo.query({
        query: pageTreeQuery,
        fetchPolicy: 'cache-first',
        variables: {
          path: this.path,
          mode: 'ALL',
          locale: this.locale,
          includeAncestors: true,
          siteId: this.siteId
        }
      })
      const items = _.get(pageTreeResp, 'data.tree', [])

      return items.filter((item) => item.siteId === this.siteId)
    },
    extractInvertedAncestors(pageTreeItems, curPage) {
      let curParentId = curPage.parent
      let invertedAncestors = []
      while (curParentId) {
        const curParent = _.find(pageTreeItems, ['id', curParentId])
        if (!curParent) {
          break
        }
        invertedAncestors.push(curParent)
        curParentId = curParent.parent
      }
      return invertedAncestors
    },
    async updateRootParentWithActualData() {
      const homePageResp = await this.$apollo.query({
        query: pageByPathQuery,
        fetchPolicy: 'cache-first',
        variables: {
          path: 'home',
          locale: this.locale,
          siteId: this.siteId
        }
      })
      this.currentParent = _.get(homePageResp, 'data.pageByPath', {
        id: 0,
        pageId: 0,
        title: '/ (root)'
      })
      this.currentParent = {
        ...this.currentParent,
        // In this context, id represents the pageTree id, not the page id.
        // Therefore, we explicitly set it to 0 to avoid conflict with the page id (the id received from the pageById query).
        id: 0
      }
    },
    updateParents(curPage, invertedAncestors) {
      this.parents = [this.currentParent, ...invertedAncestors.reverse()]
      this.currentParent = _.last(this.parents)
      this.parents = (this.parents.length > 1 && !curPage.isFolder) ?
        this.parents.slice(0, this.parents.length - 1) :
        this.parents
      this.$store.commit('page/SET_HAS_CHILDREN', curPage.isFolder)
    },
    async loadFromCurrentPath() {
      this.$store.commit(`loadingStart`, 'browse-load')

      const pageTreeItems = await this.fetchPageTree()
      const curPage = _.find(pageTreeItems, [
        'pageId',
        this.$store.get('page/id')
      ])

      const invertedAncestors = this.extractInvertedAncestors(pageTreeItems, curPage)

      if (invertedAncestors.length > 0 || curPage.isFolder) {
        await this.updateRootParentWithActualData()
      }

      this.updateParents(curPage, invertedAncestors)

      this.loadedCache = [curPage.parent]
      this.topLevelPageItems = _.filter(pageTreeItems, ['parent', curPage.parent])

      this.$store.commit(`loadingStop`, 'browse-load')
    },
    goHome() {
      if (siteLangs.length > 0) {
        window.location.assign(`/${this.sitePath}/${this.locale}`)
      } else {
        window.location.assign(`/${this.sitePath}`)
      }
    },
    getListItemStyles() {
      let styles = ''
      if (this.currentParent.pageId > 0) {
        styles = 'padding-left: 48px; '
      }
      if (this.dark) {
        return styles + 'background-color' + this.colors.surfaceDark.primaryBlueLite + '!important;'
      }
      return styles + 'background-color' + this.colors.neutral[100] + '!important;'
    },
    async fetchChildPageItems() {
      this.$store.commit(`loadingStart`, 'browse-load')

      if (!this.isParentPage) {
        return []
      }

      this.currentParent = {
        path: this.path,
        title: this.$store.get('page/title'),
        isFolder: true,
        pageId: this.pageId,
        locale: this.locale,
        sitePath: this.sitePath
      }

      const resp = await this.$apollo.query({
        query: childPagesQuery,
        fetchPolicy: 'cache-first',
        variables: {
          pageId: this.pageId,
          locale: this.locale,
          siteId: this.siteId
        }
      })
      this.childPageItems = _.get(resp, 'data.childPages', [])

      this.$store.commit(`loadingStop`, 'browse-load')
    }
  },
  watch: {
    isReadyToFetchPageChildren(newVal) {
      if (newVal && !this.hasFetchedChildren) {
        this.hasFetchedChildren = true
        this.fetchChildPageItems()
      }
    }
  },
  mounted() {
    this.currentParent.title = `/ ${this.$t('common:sidebar.root')}`
    if (this.navMode === 'TREE') {
      this.currentMode = 'browse'
    } else if (this.navMode === 'STATIC') {
      this.currentMode = 'custom'
    } else {
      this.currentMode = window.localStorage.getItem('navPref') || 'custom'
    }
    if (this.currentMode === 'browse') {
      this.loadFromCurrentPath()
    }
    if (this.isReadyToFetchPageChildren && !this.hasFetchedChildren) {
      this.fetchChildPageItems()
    }
  }
}
</script>

<style lang="scss" scoped>
  .dark .v-list-item {
    & > .v-list-item__title {
      color: white !important;
      &:hover {
        color: mc('text-dark', 'brand-primary') !important;
        text-decoration: underline mc('text-dark', 'brand-primary');
      }
    }
  }

  .v-list-item {
    & > .v-list-item__title {
      color: mc('text-light', 'primary') !important;
      &:hover {
        color: mc('text-light', 'brand-primary') !important;
        text-decoration: underline mc('text-light', 'brand-primary');
      }
    }
  }

  #curDir {
    color: mc('text-light', 'primary') !important;
  }
  .dark #curDir {
    color: white !important;
  }

  .v-list-item.v-list-item--link.v-list-item--active > .v-list-item__title {
    font-size: .9rem !important;
    color: mc('text-light', 'brand-tertiary') !important;
  }

  .dark .v-list-item.v-list-item--link.v-list-item--active > .v-list-item__title {
  color: mc('text-dark', 'brand-primary') !important;
  }

  .v-btn {
    &.hover-btn {
      border-radius: 20px;

      &:hover {
        background-color: mc('action-dark', 'highlight-on-lite') !important;
      }
    }
  }
</style>
