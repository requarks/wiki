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
              @click='disableTfa(auth.authId)'
              :disable='auth.config.isTfaRequired'
            )
          q-item-section(v-else, side)
            q-btn(
              icon='las la-fingerprint'
              unelevated
              :label='t(`profile.authSetTfa`)'
              color='primary'
              @click='setupTfa(auth.authId)'
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
import SetupTfaDialog from 'src/components/SetupTfaDialog.vue'

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

function disableTfa (strategyId) {
  $q.dialog({
    title: t('common.actions.confirm'),
    message: t('profile.authDisableTfaConfirm'),
    cancel: true
  }).onOk(async () => {
    $q.loading.show()
    try {
      const resp = await APOLLO_CLIENT.mutate({
        mutation: gql`
          mutation deactivateTfa (
            $strategyId: UUID!
          ) {
            deactivateTFA(
              strategyId: $strategyId
            ) {
              operation {
                succeeded
                message
              }
            }
          }
        `,
        variables: {
          strategyId
        }
      })
      if (resp?.data?.deactivateTFA?.operation?.succeeded) {
        $q.notify({
          type: 'positive',
          message: t('profile.authDisableTfaSuccess')
        })
      } else {
        throw new Error(resp?.data?.deactivateTFA?.operation?.message)
      }
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: t('profile.authDisableTfaFailed'),
        caption: err.message ?? 'An unexpected error occured.'
      })
    }
    await fetchAuthMethods()
    $q.loading.hide()
  })
}

function setupTfa (strategyId) {
  // $q.dialog({
  //   component: SetupTfaDialog,
  //   componentProps: {
  //     strategyId
  //   }
  // })
}

// MOUNTED

onMounted(() => {
  fetchAuthMethods()
})

</script>
