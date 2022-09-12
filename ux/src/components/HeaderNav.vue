<template lang="pug">
q-header.bg-header.text-white.site-header(
  height-hint='64'
  )
  .row.no-wrap
    q-toolbar(
      style='height: 64px;'
      dark
      )
      q-btn(
        dense
        flat
        to='/'
        )
        q-avatar(
          v-if='siteStore.logoText'
          size='34px'
          square
          )
          img(:src='`/_site/logo`')
        img(
          v-else
          :src='`/_site/logo`'
          style='height: 34px'
          )
      q-toolbar-title.text-h6(v-if='siteStore.logoText') {{siteStore.title}}
    q-toolbar.gt-sm(
      style='height: 64px;'
      dark
      )
      q-input(
        dark
        v-model='state.search'
        standout='bg-white text-dark'
        dense
        rounded
        ref='searchField'
        style='width: 100%;'
        label='Search...'
        )
        template(v-slot:prepend)
          q-icon(name='las la-search')
        template(v-slot:append)
          q-icon.cursor-pointer(
            name='las la-times'
            @click='state.search=``'
            v-if='state.search.length > 0'
            :color='$q.dark.isActive ? `blue` : `grey-4`'
            )
      q-btn.q-ml-md(
        flat
        round
        dense
        icon='las la-tags'
        color='grey'
        to='/_tags'
        )
    q-toolbar(
      style='height: 64px;'
      dark
      )
      q-space
      transition(name='syncing')
        q-spinner-tail(
          v-show='siteStore.routerLoading'
          color='accent'
          size='24px'
        )
      q-btn.q-ml-md(
        flat
        round
        dense
        icon='las la-plus-circle'
        color='blue-4'
        aria-label='Create New Page'
        )
        q-tooltip Create New Page
        new-menu
      q-btn.q-ml-md(
        flat
        round
        dense
        icon='las la-tools'
        color='secondary'
        to='/_admin'
        aria-label='Administration'
        )
        q-tooltip Administration
      account-menu
</template>

<script setup>
import AccountMenu from './AccountMenu.vue'
import NewMenu from './PageNewMenu.vue'

import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { reactive } from 'vue'

import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  search: ''
})
</script>

<style lang="scss">

</style>
