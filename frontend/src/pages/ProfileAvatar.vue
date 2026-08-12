<template>
  <w-page class="py-4">
    <div class="w-section-header">{{ t('profile.avatar') }}</div>
    <!--
      -> `min-w-*` on both columns is what lets `flex-wrap` actually wrap them: `flex-1` is
         `flex: 1 1 0%`, and an item whose basis is zero never overflows its line, so on a narrow screen
         the two just squeezed instead -- the 180px avatar spilling off the left edge and the upload
         column's text off the right. With a floor on each, two of them no longer fit side by side in a
         column this narrow and the second takes its own line.
    -->
    <!-- -> `px-4` only while stacked: beside the avatar this column has the card's width around it, but
            on its own line it starts at the very edge of the screen -->
    <div class="mt-10 flex flex-wrap gap-6 px-4 sm:px-0">
      <div class="min-w-60 flex-1 text-center">
        <w-avatar
          class="profile-avatar-circ"
          size="180px"
          :color="userStore.hasAvatar ? `dark-1` : `primary`"
          text-color="white"
          :class="userStore.hasAvatar ? `is-image` : ``">
          <img v-if="userStore.hasAvatar" :src="`/_user/current/avatar?` + state.assetTimestamp" />
          <w-icon v-else name="la:user" />
        </w-avatar>
      </div>
      <div v-if="canEdit" class="min-w-60 flex-1 self-center">
        <div class="text-body1">{{ t('profile.avatarUploadTitle') }}</div>
        <div class="text-caption">{{ t('profile.avatarUploadHint') }}</div>
        <div class="mt-4">
          <w-btn
            icon="la:upload"
            unelevated
            :label="t(`profile.uploadNewAvatar`)"
            color="primary"
            @click="uploadImage" />
        </div>
        <div class="mt-4">
          <w-btn
            class="mr-2"
            icon="la:times"
            outline
            :label="t(`common.actions.clear`)"
            color="primary"
            :disable="!userStore.hasAvatar"
            @click="clearImage" />
        </div>
      </div>
      <div v-else class="min-w-60 flex-1 self-center">
        <div class="text-caption text-negative">{{ t('profile.avatarUploadDisabled') }}</div>
      </div>
    </div>

    <w-inner-loading :showing="state.loading > 0" />
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { computed, reactive } from 'vue'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

// STORES

const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('profile.avatar')
})

// DATA

const state = reactive({
  loading: 0,
  assetTimestamp: new Date().toISOString()
})

/** What the upload endpoint accepts. */
const acceptedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

const canEdit = computed(() => siteStore.features?.profile)

// METHODS

async function uploadImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = acceptedTypes.join(',')

  input.onchange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }
    // -> The file picker's filter is a suggestion the user can override, and the server checks the
    //    bytes anyway; saying so here beats a 415 with nothing to explain it
    if (!acceptedTypes.includes(file.type)) {
      notify({
        type: 'negative',
        message: t('profile.avatarUploadFailed'),
        caption: t('profile.avatarUploadInvalidType')
      })
      return
    }
    state.loading++
    try {
      // -> The image is the request body itself: the endpoint takes the raw file, not a form
      const resp = await API_CLIENT.put('users/profile/avatar', {
        body: file,
        headers: {
          'content-type': file.type
        }
      }).json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      notify({
        type: 'positive',
        message: t('profile.avatarUploadSuccess')
      })
      state.assetTimestamp = new Date().toISOString()
      userStore.$patch({
        hasAvatar: true
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('profile.avatarUploadFailed'),
        caption: err.message
      })
    }
    state.loading--
  }

  input.click()
}

async function clearImage() {
  state.loading++
  try {
    const resp = await API_CLIENT.delete('users/profile/avatar').json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('profile.avatarClearSuccess')
    })
    state.assetTimestamp = new Date().toISOString()
    userStore.$patch({
      hasAvatar: false
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('profile.avatarClearFailed'),
      caption: err.message
    })
  }
  state.loading--
}
</script>

<style lang="scss">
.profile-avatar-circ {
  box-shadow:
    2px 2px 15px -5px var(--color-primary),
    -2px -2px 15px -5px var(--color-primary),
    inset 0 0 2px 8px rgba(255, 255, 255, 0.15);

  &.is-image {
    box-shadow: 0 0 0 5px rgba(0, 0, 0, 0.1);
  }
}
</style>
