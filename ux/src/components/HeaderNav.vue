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
      v-if='siteStore.features.search'
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
          q-badge.q-ml-sm(
            label='Ctrl+K'
            color='grey-7'
            outline
            @click='searchField.focus()'
            )
      //- q-btn.q-ml-md(
      //-   flat
      //-   round
      //-   dense
      //-   icon='las la-tags'
      //-   color='grey'
      //-   to='/_tags'
      //-   )
    q-toolbar(
      style='height: 64px;'
      dark
      )
      q-space
      transition(name='syncing')
        q-spinner-tail(
          v-show='commonStore.routerLoading'
          color='accent'
          size='24px'
        )
      q-btn.q-ml-md(
        v-if='userStore.can(`write:pages`)'
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
        v-if='userStore.can(`browse:fileman`)'
        flat
        round
        dense
        icon='las la-folder-open'
        color='positive'
        aria-label='File Manager'
        @click='openFileManager'
        )
        q-tooltip File Manager
      q-btn.q-ml-md(
        v-if='userStore.can(`access:admin`)'
        flat
        round
        dense
        icon='las la-tools'
        color='pink'
        to='/_admin'
        :aria-label='t(`common.header.admin`)'
        )
        q-tooltip {{ t('common.header.admin') }}

      //- USER BUTTON / DROPDOWN
      account-menu(v-if='userStore.authenticated')
      q-btn.q-ml-md(
        v-else
        flat
        rounded
        icon='las la-sign-in-alt'
        color='white'
        :label='$t(`common.actions.login`)'
        :aria-label='$t(`common.actions.login`)'
        to='/login'
        padding='sm'
        no-caps
      )
</template>

<script setup>
import AccountMenu from './AccountMenu.vue'
import NewMenu from './PageNewMenu.vue'

import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import { useCommonStore } from 'src/stores/common'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

// QUASAR

const $q = useQuasar()

// STORES

const commonStore = useCommonStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  search: ''
})

const searchField = ref(null)

// METHODS

function openFileManager () {
  siteStore.openFileManager()
}

function handleKeyPress (ev) {
  if (siteStore.features.search) {
    if (ev.ctrlKey && ev.key === 'k') {
      ev.preventDefault()
      searchField.value.focus()
    }
  }
}

// MOUNTED

onMounted(() => {
  if (process.env.CLIENT) {
    window.addEventListener('keydown', handleKeyPress)
  }
})
onBeforeUnmount(() => {
  if (process.env.CLIENT) {
    window.removeEventListener('keydown', handleKeyPress)
  }
})
</script>

<style lang="scss">

</style>
