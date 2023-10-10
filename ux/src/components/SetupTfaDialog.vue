<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide', persistent)
  q-card.setup2fadialog(style='min-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-fingerprint.svg', left, size='sm')
      span {{t(`profile.authSetTfa`)}}
    template(v-if='!state.isInit')
      q-linear-progress(query, color='positive')
      q-card-section.text-center.text-grey {{t(`profile.authSetTfaLoading`)}}
    template(v-else)
      q-card-section.text-center
        p {{t('auth.tfaSetupInstrFirst')}}
        div(style='justify-content: center; display: flex;')
          div(v-html='state.tfaQRImage', style='width: 200px;')
        p.q-mt-sm {{t('auth.tfaSetupInstrSecond')}}
        .flex.justify-center
          v-otp-input(
            v-model:value='state.securityCode'
            :num-inputs='6'
            :should-auto-focus='true'
            input-classes='otp-input'
            input-type='number'
            separator=''
          )
        q-inner-loading(:showing='state.isLoading')
      q-card-actions.card-actions
        q-space
        q-btn.acrylic-btn(
          flat
          :label='t(`common.actions.cancel`)'
          color='grey'
          padding='xs md'
          @click='onDialogCancel'
          )
        q-btn(
          unelevated
          :label='t(`auth.tfa.verifyToken`)'
          color='primary'
          padding='xs md'
          @click='save'
          :loading='state.isLoading'
          )
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { onMounted, reactive } from 'vue'

import { useSiteStore } from 'src/stores/site'

import VOtpInput from 'vue3-otp-input'

// PROPS

const props = defineProps({
  strategyId: {
    type: String,
    required: true
  }
})

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  isInit: false,
  isLoading: false,
  securityCode: '',
  tfaQRImage: '',
  continuationToken: ''
})

// METHODS

async function load () {
  state.isInit = false
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation setupTfa (
          $strategyId: UUID!
          $siteId: UUID!
          ) {
            setupTFA (
              strategyId: $strategyId
              siteId: $siteId
            ) {
            operation {
              succeeded
              message
            }
            continuationToken
            tfaQRImage
          }
        }
      `,
      variables: {
        strategyId: props.strategyId,
        siteId: siteStore.id
      }
    })
    if (resp?.data?.setupTFA?.operation?.succeeded) {
      state.continuationToken = resp.data.setupTFA.continuationToken
      state.tfaQRImage = resp.data.setupTFA.tfaQRImage
      state.isInit = true
    } else {
      throw new Error(resp?.data?.setupTFA?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
    onDialogCancel()
  }
}

async function save () {
  state.isLoading = true
  try {
    if (!/^[0-9]{6}$/.test(state.securityCode)) {
      throw new Error(t('auth.errors.tfaMissing'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation(
          $continuationToken: String!
          $securityCode: String!
          $strategyId: UUID!
          $siteId: UUID!
          ) {
          loginTFA(
            continuationToken: $continuationToken
            securityCode: $securityCode
            strategyId: $strategyId
            siteId: $siteId
            setup: true
            ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        continuationToken: state.continuationToken,
        securityCode: state.securityCode,
        strategyId: props.strategyId,
        siteId: siteStore.id
      }
    })
    if (resp.data?.loginTFA?.operation?.succeeded) {
      state.continuationToken = ''
      state.securityCode = ''
      $q.notify({
        type: 'positive',
        message: t('auth.tfaSetupSuccess')
      })
      state.isLoading = false
      onDialogOK()
    } else {
      throw new Error(resp.data?.loginTFA?.operation?.message || t('auth.errors.loginError'))
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}

onMounted(() => {
  load()
})
</script>

<style lang="scss">
.setup2fadialog {
  .otp-input {
    width: 100%;
    height: 48px;
    padding: 5px;
    margin: 0 5px 7px;
    font-size: 20px;
    border-radius: 6px;
    text-align: center;

    @at-root .body--light & {
      border: 2px solid rgba(0, 0, 0, 0.2);
    }

    @at-root .body--dark & {
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    &:focus-visible {
      outline-color: $primary;
    }

    /* Background colour of an input field with value */
    &.is-complete {
      border-color: $positive;
      border-width: 2px;
    }

    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }
}
</style>
