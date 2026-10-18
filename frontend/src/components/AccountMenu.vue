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
          <!--
            -> `.stop` keeps the menu open: it auto-closes on any click inside it, and the point of
               cycling through the three is to see each one land before picking
          -->
          <w-btn
            flat
            round
            dense
            :icon="appearanceIcon"
            color="primary"
            :aria-label="appearanceTooltip"
            @click.stop="cycleAppearance">
            <w-tooltip>{{ appearanceTooltip }}</w-tooltip>
          </w-btn>
          <w-separator vertical inset :dark="false" />
          <w-btn
            flat
            :label="t(`common.header.profile`)"
            icon="la:user-alt"
            color="primary"
            to="/_profile"
            no-caps />
          <w-separator vertical inset :dark="false" />
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { useUserStore } from '@/stores/user'

// STORES

const userStore = useUserStore()

// I18N

const { t } = useI18n()

// APPEARANCE

/*
  The same preference as Profile → Info's Site Appearance, in the order a click walks through it.
  Icons are literals so `scripts/generate-icons.mjs` inlines them.
*/
const APPEARANCES = [
  { value: 'site', icon: 'la:adjust', label: 'profile.appearanceDefault' },
  { value: 'dark', icon: 'la:moon', label: 'profile.appearanceDark' },
  { value: 'light', icon: 'la:sun', label: 'profile.appearanceLight' }
]

const currentAppearance = computed(
  () => APPEARANCES.find((a) => a.value === userStore.appearance) ?? APPEARANCES[0]
)
const appearanceIcon = computed(() => currentAppearance.value.icon)
const appearanceTooltip = computed(() =>
  t('common.header.appearance', { mode: t(currentAppearance.value.label) })
)

/**
 * Applied at once and saved behind it — `App.vue` watches `userStore.appearance`, so the theme flips
 * on the click rather than on the reply. A save that fails puts the previous choice back, so the
 * screen never shows a preference the next load will not.
 */
async function cycleAppearance() {
  const previous = userStore.appearance
  const idx = APPEARANCES.findIndex((a) => a.value === previous)
  const next = APPEARANCES[(idx + 1) % APPEARANCES.length].value
  userStore.appearance = next
  try {
    const resp = await API_CLIENT.put('users/profile', { json: { appearance: next } }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured')
    }
  } catch (err) {
    // -> Only if nothing else has changed it since: a second click already in flight wins
    if (userStore.appearance === next) {
      userStore.appearance = previous
    }
    notify({
      type: 'negative',
      message: t('profile.saveFailed'),
      caption: apiErrorMessage(err)
    })
  }
}
</script>

<style lang="scss">
// -> Where the button gets its colour, so it carries no `color` prop: `WBtn` emits an inline
//    `color`, which would outrank this rule
.account-avbtn {
  color: rgba(255, 255, 255, 0.6);
}
</style>
