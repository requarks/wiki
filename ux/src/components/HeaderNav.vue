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
    header-search
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
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useCommonStore } from 'src/stores/common'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

import AccountMenu from 'src/components/AccountMenu.vue'
import NewMenu from 'src/components/PageNewMenu.vue'
import HeaderSearch from 'src/components/HeaderSearch.vue'

// QUASAR

const $q = useQuasar()

// STORES

const commonStore = useCommonStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// METHODS

function openFileManager () {
  siteStore.openFileManager()
}
</script>
