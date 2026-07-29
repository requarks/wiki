<template>
  <w-btn class="account-avbtn ml-4" flat round dense>
    <w-icon v-if="!userStore.authenticated || !userStore.hasAvatar" name="la:user-circle" />
    <w-avatar v-else size="32px"><img :src="`/_user/current/avatar`" /></w-avatar>
    <w-menu class="translucent-menu" auto-close>
      <w-card flat style="width: 300px" :dark="false">
        <!--
          -> The two greys are pitched for the light menu and go muddy on the dark one, where the
             surface is nearly black: the name takes white and the address a light grey, keeping the
             same relationship between them -- the name reads first, the address supports it
        -->
        <w-card-section align="center">
          <div class="text-subtitle1 text-grey-7 dark:text-white">{{ userStore.name }}</div>
          <div class="text-caption text-grey-8 dark:text-grey-5">{{ userStore.email }}</div>
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
// -> Where the button gets its colour, so it carries no `color` prop: `WBtn` emits an inline
//    `color`, which would outrank this rule
.account-avbtn {
  color: rgba(255, 255, 255, 0.6);
}
</style>
