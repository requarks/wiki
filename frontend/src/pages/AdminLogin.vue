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
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/admin/auth`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        :aria-label='t(`common.actions.refresh`)'
        @click='load'
        )
        q-tooltip {{ t(`common.actions.refresh`) }}
      q-btn(
        unelevated
        icon='mdi-check'
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
      q-card.q-pb-sm
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
              v-model='state.config.autoLogin'
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
              v-model='state.config.bypassUnauthorized'
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
      q-card.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.login.providers')}}
        q-card-section.admin-login-providers.q-pt-none
          sortable(
            class='q-list'
            :list='state.providers'
            item-key='id'
            :options='sortableOptions'
            @end='updateAuthPosition'
            )
            template(#item='{element}')
              q-item
                q-item-section(side)
                  q-icon.handle(name='mdi-drag-horizontal')
                q-item-section(side)
                  q-icon(:name='`img:` + element.activeStrategy.strategy.icon')
                q-item-section
                  q-item-label {{element.activeStrategy.displayName}}
                  q-item-label(caption) {{element.activeStrategy.strategy.title}}
                q-item-section(side)
                  q-toggle(
                    v-model='element.isVisible'
                    color='primary'
                    checked-icon='las la-check'
                    unchecked-icon='las la-times'
                    label='Visible'
                    :aria-label='element.activeStrategy.displayName'
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
import { toMerged } from 'es-toolkit/object'

import { Sortable } from 'sortablejs-vue3'

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { onMounted, reactive, watch } from 'vue'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

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

/**
 * Fallbacks for keys a site may not have stored yet, so that every control renders with a defined
 * value. Must mirror the `auth` defaults used by the backend when creating a site.
 */
function defaultConfig () {
  return {
    autoLogin: false,
    bypassUnauthorized: false,
    hideLocal: false,
    loginRedirect: '/',
    welcomeRedirect: '/',
    logoutRedirect: '/'
  }
}

const state = reactive({
  invalidCharsRegex: /^[^<>"]+$/,
  loading: 0,
  config: defaultConfig(),
  providers: []
})

const sortableOptions = {
  handle: '.handle',
  animation: 150
}

// WATCHERS

watch(() => adminStore.currentSiteId, (newValue) => {
  load()
})

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  try {
    const [site, providers] = await Promise.all([
      API_CLIENT.get(`sites/${adminStore.currentSiteId}?strict=true`).json(),
      API_CLIENT.get(`sites/${adminStore.currentSiteId}/auth/strategies`, {
        searchParams: { visibleOnly: false }
      }).json()
    ])
    state.config = toMerged(defaultConfig(), site?.auth ?? {})
    state.providers = providers ?? []
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('admin.login.loadFailed'),
      caption: err.message
    })
  }
  $q.loading.hide()
  state.loading--
}

async function save () {
  state.loading++
  try {
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}`, {
      json: {
        auth: {
          autoLogin: state.config.autoLogin ?? false,
          bypassUnauthorized: state.config.bypassUnauthorized ?? false,
          hideLocal: state.config.hideLocal ?? false,
          loginRedirect: state.config.loginRedirect ?? '/',
          welcomeRedirect: state.config.welcomeRedirect ?? '/',
          logoutRedirect: state.config.logoutRedirect ?? '/'
        },
        // -> Order comes from the current position in the drag-sortable list
        authStrategies: state.providers.map((provider, index) => ({
          id: provider.id,
          order: index,
          isVisible: provider.isVisible ?? false
        }))
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(t(`admin.login.${resp?.error}`, resp?.message || 'An unexpected error occured.'))
    }
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

function updateAuthPosition (ev) {
  const item = state.providers.splice(ev.oldIndex, 1)[0]
  state.providers.splice(ev.newIndex, 0, item)
}

function uploadBg () {
  // TODO: needs a multipart upload endpoint for site assets, which does not exist yet — the same
  // blocker as the logo and favicon uploads in the general view.
  $q.notify({
    type: 'warning',
    message: t('admin.login.bgUploadUnavailable')
  })
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
