<template lang='pug'>
q-page.admin-api
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-rest-api-animated.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.api.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.api.subtitle') }}
    .col
      .flex.items-center
        template(v-if='state.enabled')
          q-spinner-rings.q-mr-sm(color='green')
          .text-caption.text-green {{t('admin.api.enabled')}}
        template(v-else)
          q-spinner-rings.q-mr-sm(color='red', size='md')
          .text-caption.text-red {{t('admin.api.disabled')}}
    .col-auto
      q-btn.q-mr-sm.q-ml-md.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        href='https://docs.js.wiki/admin/api'
        target='_blank'
        type='a'
        )
      q-btn.acrylic-btn.q-mr-sm(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        @click='load'
        )
      q-btn.q-mr-sm(
        unelevated
        icon='las la-power-off'
        :label='!state.enabled ? t(`admin.api.enableButton`) : t(`admin.api.disableButton`)'
        :color='!state.enabled ? `positive` : `negative`'
        @click='globalSwitch'
        :disabled='state.loading > 0'
      )
      q-btn(
        unelevated
        icon='las la-plus'
        :label='t(`admin.api.newKeyButton`)'
        color='primary'
        @click='newKey'
        :disabled='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12.col-lg-7
      q-card.shadow-1

//- v-container(fluid, grid-list-lg)
//-   v-layout(row, wrap)
//-     v-flex(xs12)
//-       .admin-header
//-         img.animated.fadeInUp(src='/_assets/svg/icon-rest-api.svg', alt='API', style='width: 80px;')
//-         .admin-header-title
//-           .headline.primary--text.animated.fadeInLeft {{$t('admin.api.title')}}
//-           .subtitle-1.grey--text.animated.fadeInLeft {{$t('admin.api.subtitle')}}
//-         v-spacer
//-         template(v-if='enabled')
//-           status-indicator.mr-3(positive, pulse)
//-           .caption.green--text.animated.fadeInLeft {{$t('admin.api.enabled')}}
//-         template(v-else)
//-           status-indicator.mr-3(negative, pulse)
//-           .caption.red--text.animated.fadeInLeft {{$t('admin.api.disabled')}}
//-         v-spacer
//-         v-btn.mr-3.animated.fadeInDown.wait-p2s(outlined, color='grey', icon, @click='refresh')
//-           v-icon mdi-refresh
//-         v-btn.mr-3.animated.fadeInDown.wait-p1s(:color='enabled ? `red` : `green`', depressed, @click='globalSwitch', dark, :loading='isToggleLoading')
//-           v-icon(left) mdi-power
//-           span(v-if='!enabled') {{$t('admin.api.enableButton')}}
//-           span(v-else) {{$t('admin.api.disableButton')}}
//-         v-btn.animated.fadeInDown(color='primary', depressed, large, @click='newKey', dark)
//-           v-icon(left) mdi-plus
//-           span {{$t('admin.api.newKeyButton')}}
//-       v-card.mt-3.animated.fadeInUp
//-         v-simple-table(v-if='keys && keys.length > 0')
//-           template(v-slot:default)
//-             thead
//-               tr.grey(:class='$vuetify.theme.dark ? `darken-4-d5` : `lighten-5`')
//-                 th {{$t('admin.api.headerName')}}
//-                 th {{$t('admin.api.headerKeyEnding')}}
//-                 th {{$t('admin.api.headerExpiration')}}
//-                 th {{$t('admin.api.headerCreated')}}
//-                 th {{$t('admin.api.headerLastUpdated')}}
//-                 th(width='100') {{$t('admin.api.headerRevoke')}}
//-             tbody
//-               tr(v-for='key of keys', :key='`key-` + key.id')
//-                 td
//-                   strong(:class='key.isRevoked ? `red--text` : ``') {{ key.name }}
//-                   em.caption.ml-1.red--text(v-if='key.isRevoked') (revoked)
//-                 td.caption {{ key.keyShort }}
//-                 td(:style='key.isRevoked ? `text-decoration: line-through;` : ``') {{ key.expiration | moment('LL') }}
//-                 td {{ key.createdAt | moment('calendar') }}
//-                 td {{ key.updatedAt | moment('calendar') }}
//-                 td: v-btn(icon, @click='revoke(key)', :disabled='key.isRevoked'): v-icon(color='error') mdi-cancel
//-         v-card-text(v-else)
//-           v-alert.mb-0(icon='mdi-information', :value='true', outlined, color='info') {{$t('admin.api.noKeyInfo')}}

//-   create-api-key(v-model='isCreateDialogShown', @refresh='refresh(false)')

//-   v-dialog(v-model='isRevokeConfirmDialogShown', max-width='500', persistent)
//-     v-card
//-       .dialog-header.is-red {{$t('admin.api.revokeConfirm')}}
//-       v-card-text.pa-4
//-         i18next(tag='span', path='admin.api.revokeConfirmText')
//-           strong(place='name') {{ current.name }}
//-       v-card-actions
//-         v-spacer
//-         v-btn(text, @click='isRevokeConfirmDialogShown = false', :disabled='revokeLoading') {{$t('common.actions.cancel')}}
//-         v-btn(color='red', dark, @click='revokeConfirm', :loading='revokeLoading') {{$t('admin.api.revoke')}}
</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, watch } from 'vue'

// QUASAR

const $q = useQuasar()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.api.title')
})

// DATA

const state = reactive({
  enabled: false,
  loading: 0,
  keys: [],
  isCreateDialogShown: false,
  isRevokeConfirmDialogShown: false,
  revokeLoading: false,
  current: {}
})

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query getHooks {
        apiKeys {
          id
          name
          keyShort
          expiration
          isRevoked
          createdAt
          updatedAt
        }
        apiState
      }
    `,
    fetchPolicy: 'network-only'
  })
  state.keys = cloneDeep(resp?.data?.apiKeys) ?? []
  state.enabled = resp?.data?.apiState === true
  $q.loading.hide()
  state.loading--
}

async function globalSwitch () {
  state.isToggleLoading = true
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation ($enabled: Boolean!) {
          authentication {
            setApiState (enabled: $enabled) {
              responseResult {
                succeeded
                errorCode
                slug
                message
              }
            }
          }
        }
      `,
      variables: {
        enabled: !state.enabled
      }
    })
    if (resp?.data?.setApiState?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: state.enabled ? t('admin.api.toggleStateDisabledSuccess') : t('admin.api.toggleStateEnabledSuccess')
      })
      await load()
    } else {
      throw new Error(resp?.data?.setApiState?.operation.message || 'An unexpected error occurred.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to switch API state.',
      caption: err.message
    })
  }
  state.isToggleLoading = false
}

async function newKey () {
  state.isCreateDialogShown = true
}

function revoke (key) {
  state.current = key
  state.isRevokeConfirmDialogShown = true
}

async function revokeConfirm () {
  state.revokeLoading = true
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation ($id: Int!) {
          authentication {
            revokeApiKey (id: $id) {
              responseResult {
                succeeded
                errorCode
                slug
                message
              }
            }
          }
        }
      `,
      variables: {
        id: state.current.id
      }
    })
    // if (_get(resp, 'data.authentication.revokeApiKey.responseResult.succeeded', false)) {
    //   this.$store.commit('showNotification', {
    //     style: 'success',
    //     message: this.$t('admin.api.revokeSuccess'),
    //     icon: 'check'
    //   })
    //   this.load()
    // } else {
    //   this.$store.commit('showNotification', {
    //     style: 'red',
    //     message: _get(resp, 'data.authentication.revokeApiKey.responseResult.message', 'An unexpected error occurred.'),
    //     icon: 'alert'
    //   })
    // }
  } catch (err) {
    // this.$store.commit('pushGraphError', err)
  }
  state.isRevokeConfirmDialogShown = false
  state.revokeLoading = false
}

// MOUNTED

onMounted(() => {
  load()
})

</script>

<style lang='scss'>

</style>
