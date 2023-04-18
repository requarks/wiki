<template lang="pug">
q-page.q-py-md(:style-fn='pageStyle')
  .text-header {{t('profile.avatar')}}
  .row.q-gutter-lg.q-mt-xl
    .col.text-center
      q-avatar.profile-avatar-circ(
        size='180px'
        :color='userStore.hasAvatar ? `dark-1` : `primary`'
        text-color='white'
        :class='userStore.hasAvatar ? `is-image` : ``'
        )
        img(
          v-if='userStore.hasAvatar',
          :src='`/_user/` + userStore.id + `/avatar?` + state.assetTimestamp'
          )
        q-icon(
          v-else,
          name='las la-user'
          )
    .col.self-center(v-if='canEdit')
      .text-body1 {{ t('profile.avatarUploadTitle') }}
      .text-caption {{ t('profile.avatarUploadHint') }}
      .q-mt-md
        q-btn(
          icon='las la-upload'
          unelevated
          :label='t(`profile.uploadNewAvatar`)'
          color='primary'
          @click='uploadImage'
        )
      .q-mt-md
        q-btn.q-mr-sm(
          icon='las la-times'
          outline
          :label='t(`common.actions.clear`)'
          color='primary'
          @click='clearImage'
          :disable='!userStore.hasAvatar'
        )
    .col.self-center(v-else)
      .text-caption.text-negative {{ t('profile.avatarUploadDisabled') }}

  q-inner-loading(:showing='state.loading > 0')
</template>

<script setup>
import gql from 'graphql-tag'

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, reactive } from 'vue'

import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

// QUASAR

const $q = useQuasar()

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
  assetTimestamp: (new Date()).toISOString()
})

const canEdit = computed(() => siteStore.features?.profile)

// METHODS

function pageStyle (offset, height) {
  return {
    'min-height': `${height - 100 - offset}px`
  }
}

async function uploadImage () {
  const input = document.createElement('input')
  input.type = 'file'

  input.onchange = async e => {
    state.loading++
    try {
      const resp = await APOLLO_CLIENT.mutate({
        mutation: gql`
          mutation uploadUserAvatar (
            $id: UUID!
            $image: Upload!
          ) {
            uploadUserAvatar (
              id: $id
              image: $image
            ) {
              operation {
                succeeded
                message
              }
            }
          }
        `,
        variables: {
          id: userStore.id,
          image: e.target.files[0]
        }
      })
      if (resp?.data?.uploadUserAvatar?.operation?.succeeded) {
        $q.notify({
          type: 'positive',
          message: t('profile.avatarUploadSuccess')
        })
        state.assetTimestamp = (new Date()).toISOString()
        userStore.$patch({
          hasAvatar: true
        })
      } else {
        throw new Error(resp?.data?.uploadUserAvatar?.operation?.message || 'An unexpected error occured.')
      }
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: t('profile.avatarUploadFailed'),
        caption: err.message
      })
    }
    state.loading--
  }

  input.click()
}

async function clearImage () {
  state.loading++
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation clearUserAvatar (
          $id: UUID!
        ) {
          clearUserAvatar (
            id: $id
          ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: userStore.id
      }
    })
    if (resp?.data?.clearUserAvatar?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('profile.avatarClearSuccess')
      })
      state.assetTimestamp = (new Date()).toISOString()
      userStore.$patch({
        hasAvatar: false
      })
    } else {
      throw new Error(resp?.data?.uploadUserAvatar?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
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
  box-shadow: 2px 2px 15px -5px var(--q-primary), -2px -2px 15px -5px var(--q-primary), inset 0 0 2px 8px rgba(255,255,255,.15);

  &.is-image {
    box-shadow: 0 0 0 5px rgba(0,0,0,.1);
  }
}
</style>
