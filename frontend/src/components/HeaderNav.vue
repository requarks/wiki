<template>
  <div class="site-header bg-header text-white">
    <div class="flex flex-nowrap">
      <w-toolbar style="height: 64px">
        <w-btn dense flat to="/">
          <w-avatar v-if="siteStore.logoText" size="34px" square>
            <img :src="`/_site/current/logo`" />
          </w-avatar>
          <img v-else :src="`/_site/current/logo`" style="height: 34px" />
        </w-btn>
        <div v-if="siteStore.logoText" class="text-h6 min-w-0 flex-1 truncate">
          {{ siteStore.title }}
        </div>
      </w-toolbar>
      <header-search />
      <w-toolbar style="height: 64px">
        <w-space />
        <transition name="syncing">
          <w-spinner v-show="commonStore.routerLoading" size="24px" class="text-accent" />
        </transition>
        <w-btn
          v-if="userStore.can(`write:pages`)"
          class="ml-4"
          flat
          round
          dense
          icon="la:plus-circle"
          color="blue-4"
          aria-label="Create New Page">
          <w-tooltip>Create New Page</w-tooltip>
          <new-menu />
        </w-btn>
        <w-btn
          v-if="userStore.can(`browse:fileman`)"
          class="ml-4"
          flat
          round
          dense
          icon="la:folder-open"
          color="positive"
          aria-label="File Manager"
          @click="openFileManager">
          <w-tooltip>File Manager</w-tooltip>
        </w-btn>
        <w-btn
          v-if="userStore.can(`access:admin`)"
          class="ml-4"
          flat
          round
          dense
          icon="la:tools"
          color="pink"
          to="/_admin"
          :aria-label="t(`common.header.admin`)">
          <w-tooltip>{{ t('common.header.admin') }}</w-tooltip>
        </w-btn>

        <!-- USER BUTTON / DROPDOWN -->
        <account-menu v-if="userStore.authenticated" />
        <w-btn
          v-else
          class="ml-4"
          flat
          rounded
          icon="la:sign-in-alt"
          color="white"
          :label="$t(`common.actions.login`)"
          :aria-label="$t(`common.actions.login`)"
          to="/login"
          padding="sm"
          no-caps />
      </w-toolbar>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { useCommonStore } from '@/stores/common'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import AccountMenu from '@/components/AccountMenu.vue'
import NewMenu from '@/components/PageNewMenu.vue'
import HeaderSearch from '@/components/HeaderSearch.vue'

/**
 * Site header content.
 *
 * Content only, for the same reason as `FooterNav`: the enclosing layout supplies the header
 * element, so layouts sharing this component can migrate independently.
 */

// STORES

const commonStore = useCommonStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// METHODS

function openFileManager() {
  siteStore.openFileManager()
}
</script>
