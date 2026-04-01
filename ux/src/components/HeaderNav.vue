<template lang="pug">
q-header.site-header(
  height-hint='56'
  bordered
  )
  q-toolbar(style='height: 56px; max-width: 1400px; margin: 0 auto; width: 100%;')
    q-btn.q-mr-sm.lt-lg(
      dense
      flat
      round
      icon='las la-bars'
      @click='$emit(`toggle-sidebar`)'
      )
    q-btn(
      dense
      flat
      no-caps
      to='/'
      style='gap: 10px;'
      )
      img(:src='`/_site/logo`' style='height: 28px;')
      span.text-weight-bold.text-body1(v-if='siteStore.logoText' style='letter-spacing: -0.3px;') {{siteStore.title}}
    q-space
    header-search
    q-space
    q-btn.q-ml-sm(
      v-if='userStore.can(`write:pages`)'
      flat
      dense
      no-caps
      icon='las la-plus'
      label='New'
      size='sm'
      style='border-radius: 8px; padding: 4px 12px;'
      )
      new-menu
    q-btn.q-ml-sm(
      v-if='userStore.can(`access:admin`)'
      flat
      dense
      round
      icon='las la-cog'
      size='sm'
      to='/_admin'
      )
    account-menu.q-ml-sm(v-if='userStore.authenticated')
    q-btn.q-ml-sm(
      v-else
      flat
      dense
      no-caps
      icon='las la-sign-in-alt'
      :label='$t(`common.actions.login`)'
      to='/login'
      size='sm'
      style='border-radius: 8px;'
    )
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useCommonStore } from '@/stores/common'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import AccountMenu from '@/components/AccountMenu.vue'
import NewMenu from '@/components/PageNewMenu.vue'
import HeaderSearch from '@/components/HeaderSearch.vue'

const $q = useQuasar()
const commonStore = useCommonStore()
const siteStore = useSiteStore()
const userStore = useUserStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
</script>

<style lang="scss">
.site-header {
  background: white !important;
  border-bottom: 1px solid #E2E8F0 !important;
  box-shadow: none !important;

  .q-toolbar {
    color: #19191C;
  }

  .q-btn {
    color: #4B4B53;

    &:hover {
      color: #006FEE;
      background: #E6F1FE;
    }
  }

  @at-root .body--dark & {
    background: $dark-5 !important;
    border-bottom-color: $dark-3 !important;

    .q-toolbar { color: #E2E8F0; }
    .q-btn {
      color: #9CA3AF;
      &:hover { color: #5BA7FF; background: rgba(0,111,238,0.1); }
    }
  }
}
</style>
