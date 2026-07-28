<template>
  <w-btn class="account-avbtn ml-4" flat round dense color="custom-color">
    <w-icon v-if="!userStore.authenticated || !userStore.hasAvatar" name="la:user-circle" />
    <w-avatar v-else size="32px"><img :src="`/_user/current/avatar`" /></w-avatar>
    <w-menu class="translucent-menu" auto-close>
      <w-card flat style="width: 300px;" :dark="false">
        <w-card-section align="center">
          <div class="text-subtitle1 text-grey-7">{{userStore.name}}</div>
          <div class="text-caption text-grey-8">{{userStore.email}}</div>
        </w-card-section>
        <w-separator :dark="false" />
        <w-card-actions align="center">
          <w-btn
            flat
            :label="t(`common.header.profile`)"
            icon="la:user-alt"
            color="primary"
            to="/_profile"
            no-caps />
          <w-btn
            flat
            :label="t(`common.header.logout`)"
            icon="la:sign-out-alt"
            color="red"
            @click="userStore.logout()"
            no-caps />
        </w-card-actions>
      </w-card>
    </w-menu>
    <w-tooltip>{{ t('common.header.account') }}</w-tooltip>
  </w-btn>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { useUserStore } from '@/stores/user'

// STORES

const userStore = useUserStore()

// I18N

const { t } = useI18n()
</script>

<style lang="scss">
.account-avbtn {
  color: rgba(255, 255, 255, 0.6);
}
</style>
