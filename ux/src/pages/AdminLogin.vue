<template lang='pug'>
q-page.admin-login
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-bunch-of-keys.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.login.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.login.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :href='siteStore.docsBase + `/admin/auth`'
        target='_blank'
        type='a'
        )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        @click='load'
        )
      q-btn(
        unelevated
        icon='fa-solid fa-check'
        :label='t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :disabled='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12.col-lg-6
      //- -----------------------
      //- Experience
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.login.experience')}}
        q-item
          blueprint-icon(icon='full-image', indicator, :indicator-text='t(`admin.extensions.requiresSharp`)')
          q-item-section
            q-item-label {{t(`admin.login.background`)}}
            q-item-label(caption) {{t(`admin.login.backgroundHint`)}}
          q-item-section.col-auto
            q-btn(
              label='Upload'
              unelevated
              icon='las la-upload'
              color='primary'
              text-color='white'
              @click='uploadBg'
            )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='close-pane')
          q-item-section
            q-item-label {{t(`admin.login.bypassScreen`)}}
            q-item-label(caption) {{t(`admin.login.bypassScreenHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.authAutoLogin'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.login.bypassScreen`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='no-access')
          q-item-section
            q-item-label {{t(`admin.login.bypassUnauthorized`)}}
            q-item-label(caption) {{t(`admin.login.bypassUnauthorizedHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.authBypassUnauthorized'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.login.bypassUnauthorized`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='double-right')
          q-item-section
            q-item-label {{t(`admin.login.loginRedirect`)}}
            q-item-label(caption) {{t(`admin.login.loginRedirectHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.loginRedirect'
              dense
              :rules=`[
                val => state.invalidCharsRegex.test(val) || t('admin.login.loginRedirectInvalidChars')
              ]`
              hide-bottom-space
              :aria-label='t(`admin.login.loginRedirect`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='chevron-right')
          q-item-section
            q-item-label {{t(`admin.login.welcomeRedirect`)}}
            q-item-label(caption) {{t(`admin.login.welcomeRedirectHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.welcomeRedirect'
              dense
              :rules=`[
                val => state.invalidCharsRegex.test(val) || t('admin.login.welcomeRedirectInvalidChars')
              ]`
              hide-bottom-space
              :aria-label='t(`admin.login.welcomeRedirect`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='exit')
          q-item-section
            q-item-label {{t(`admin.login.logoutRedirect`)}}
            q-item-label(caption) {{t(`admin.login.logoutRedirectHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.logoutRedirect'
              dense
              :rules=`[
                val => state.invalidCharsRegex.test(val) || t('admin.login.logoutRedirectInvalidChars')
              ]`
              hide-bottom-space
              :aria-label='t(`admin.login.logoutRedirect`)'
              )

    .col-12.col-lg-6
      //- -----------------------
      //- Providers
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.login.providers')}}
        q-card-section.admin-login-providers.q-pt-none
          draggable(
            class='q-list rounded-borders'
            :list='state.providers'
            :animation='150'
            handle='.handle'
            @end='dragStarted = false'
            item-key='id'
            )
            template(#item='{element}')
              q-item
                q-item-section(side)
                  q-icon.handle(name='las la-bars')
                blueprint-icon(:icon='element.icon')
                q-item-section
                  q-item-label {{element.label}}
                  q-item-label(caption) {{element.provider}}
                q-item-section(side)
                  q-toggle(
                    v-model='element.isActive'
                    color='primary'
                    checked-icon='las la-check'
                    unchecked-icon='las la-times'
                    label='Visible'
                    :aria-label='element.label'
                  )
        q-item.q-pt-none
          q-item-section
            q-card.bg-info.text-white.rounded-borders(flat)
              q-card-section.items-center(horizontal)
                q-card-section.col-auto.q-pr-none
                  q-icon(name='las la-info-circle', size='sm')
                q-card-section.text-caption {{ t('admin.login.providersVisbleWarning') }}

</template>

<script setup>
import { cloneDeep } from 'lodash-es'
import gql from 'graphql-tag'
import draggable from 'vuedraggable'

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, watch } from 'vue'

import { useAdminStore } from 'src/stores/admin'
import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.login.title')
})

// DATA

const state = reactive({
  invalidCharsRegex: /^[^<>"]+$/,
  loading: 0,
  config: {
    authAutoLogin: false,
    authHideLocal: false,
    authBypassUnauthorized: false,
    loginRedirect: '/',
    welcomeRedirect: '/',
    logoutRedirect: '/'
  },
  providers: [
    { id: 'local', label: 'Local Authentication', provider: 'Username-Password', icon: 'database', isActive: true },
    { id: 'google', label: 'Google', provider: 'Google', icon: 'google', isActive: true },
    { id: 'slack', label: 'Slack', provider: 'Slack', icon: 'slack', isActive: false }
  ]
})

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  // const resp = await APOLLO_CLIENT.query({
  //   query: gql`
  //     query getSite (
  //       $id: UUID!
  //     ) {
  //       siteById(
  //         id: $id
  //       ) {
  //         id
  //       }
  //     }
  //   `,
  //   variables: {
  //     id: adminStore.currentSiteId
  //   },
  //   fetchPolicy: 'network-only'
  // })
  // this.config = cloneDeep(resp?.data?.siteById)
  $q.loading.hide()
  state.loading--
}

async function save () {
  state.loading++
  try {
    await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation saveLoginConfig (
          $id: UUID!
          $patch: SiteUpdateInput!
        ) {
          updateSite (
            id: $id
            patch: $patch
          ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: adminStore.currentSiteId,
        patch: {
          authAutoLogin: state.config.authAutoLogin ?? false,
          authEnforce2FA: state.config.authEnforce2FA ?? false
        }
      }
    })
    $q.notify({
      type: 'positive',
      message: t('admin.login.saveSuccess')
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save login configuration.',
      caption: err.message
    })
  }
  state.loading--
}

async function uploadBg () {
  const input = document.createElement('input')
  input.type = 'file'

  input.onchange = async e => {
    state.loading++
    try {
      const resp = await APOLLO_CLIENT.mutate({
        mutation: gql`
          mutation uploadLoginBg (
            $id: UUID!
            $image: Upload!
          ) {
            uploadSiteLoginBg (
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
          id: adminStore.currentSiteId,
          image: e.target.files[0]
        }
      })
      if (resp?.data?.uploadSiteLoginBg?.operation?.succeeded) {
        $q.notify({
          type: 'positive',
          message: t('admin.login.bgUploadSuccess')
        })
      } else {
        throw new Error(resp?.data?.uploadSiteLoginBg?.operation?.message || 'An unexpected error occured.')
      }
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: 'Failed to upload login background image.',
        caption: err.message
      })
    }
    state.loading--
  }

  input.click()
}

// MOUNTED

onMounted(() => {
  if (adminStore.currentSiteId) {
    load()
  }
})
</script>

<style lang='scss'>
.admin-login-providers {
  .q-item {
    border-radius: 5px;

    @at-root .body--light & {
      background-color: $grey-2;
    }
    @at-root .body--dark & {
      background-color: $dark-5;
    }

    & + .q-item {
      margin-top: 8px;
    }
  }

  .handle {
    cursor: ns-resize;
  }
}
</style>
