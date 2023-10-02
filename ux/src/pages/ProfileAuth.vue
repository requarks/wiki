<template lang="pug">
q-page.q-py-md(:style-fn='pageStyle')
  .text-header {{t('profile.auth')}}
  .q-pa-md
    .text-body2 {{ t('profile.authInfo') }}
    q-list.q-mt-lg(
      bordered
      separator
      )
      q-item(
        v-for='auth of state.authMethods'
        :key='auth.id'
        )
        q-item-section(avatar)
          q-avatar(
            color='dark-5'
            text-color='white'
            rounded
            )
            q-icon(:name='`img:` + auth.strategyIcon')
        q-item-section
          strong {{auth.authName}}
        template(v-if='auth.strategyKey === `local`')
          q-item-section(v-if='auth.config.isTfaSetup', side)
            q-btn(
              icon='las la-fingerprint'
              unelevated
              :label='t(`profile.authDisableTfa`)'
              color='negative'
              @click=''
            )
          q-item-section(v-else, side)
            q-btn(
              icon='las la-fingerprint'
              unelevated
              :label='t(`profile.authSetTfa`)'
              color='primary'
              @click=''
            )
          q-item-section(side)
            q-btn(
              icon='las la-key'
              unelevated
              :label='t(`profile.authChangePassword`)'
              color='primary'
              @click='changePassword(auth.authId)'
            )

  q-inner-loading(:showing='state.loading > 0')
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { onMounted, reactive } from 'vue'

import { useUserStore } from 'src/stores/user'

import ChangePwdDialog from 'src/components/ChangePwdDialog.vue'

// QUASAR

const $q = useQuasar()

// STORES

const userStore = useUserStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('profile.auth')
})

// DATA

const state = reactive({
  authMethods: [],
  loading: 0
})

// METHODS

function pageStyle (offset, height) {
  return {
    'min-height': `${height - 100 - offset}px`
  }
}

async function fetchAuthMethods () {
  state.loading++
  try {
    const respRaw = await APOLLO_CLIENT.query({
      query: gql`
        query getUserProfileAuthMethods (
          $id: UUID!
        ) {
          userById (
            id: $id
          ) {
            id
            auth {
              authId
              authName
              strategyKey
              strategyIcon
              config
            }
          }
        }
      `,
      variables: {
        id: userStore.id
      },
      fetchPolicy: 'network-only'
    })
    state.authMethods = respRaw.data?.userById?.auth ?? []
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('profile.authLoadingFailed'),
      caption: err.message
    })
  }
  state.loading--
}

function changePassword (strategyId) {
  $q.dialog({
    component: ChangePwdDialog,
    componentProps: {
      strategyId
    }
  })
}

// MOUNTED

onMounted(() => {
  fetchAuthMethods()
})

</script>
