<template lang='pug'>
q-page.admin-flags
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-windsock.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.flags.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.flags.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/system/flags`'
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
        :loading='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12.col-lg-7
      q-card.q-py-sm
        q-item
          q-item-section
            q-card.bg-negative.text-white.rounded-borders(flat)
              q-card-section.items-center(horizontal)
                q-card-section.col-auto.q-pr-none
                  q-icon(name='las la-exclamation-triangle', size='sm')
                q-card-section
                  span {{ t('admin.flags.warn.label') }}
                  .text-caption.text-red-1 {{ t('admin.flags.warn.hint') }}
        q-item(tag='label')
          blueprint-icon(icon='flag-filled')
          q-item-section
            q-item-label {{t(`admin.flags.experimental.label`)}}
            q-item-label(caption) {{t(`admin.flags.experimental.hint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.flags.experimental'
              color='negative'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.flags.experimental.label`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='flag-filled')
          q-item-section
            q-item-label {{t(`admin.flags.authDebug.label`)}}
            q-item-label(caption) {{t(`admin.flags.authDebug.hint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.flags.authDebug'
              color='negative'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.flags.authDebug.label`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='flag-filled')
          q-item-section
            q-item-label {{t(`admin.flags.sqlLog.label`)}}
            q-item-label(caption) {{t(`admin.flags.sqlLog.hint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.flags.sqlLog'
              color='negative'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.flags.sqlLog.label`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          q-item-section(avatar)
            q-icon(name='las la-info-circle', color='grey')
          q-item-section
            q-item-label(caption) {{t(`admin.flags.serverLogNotice`)}}
      q-card.q-py-sm.q-mt-md
        q-item
          blueprint-icon(icon='administrative-tools')
          q-item-section
            q-item-label {{t(`admin.flags.advanced.label`)}}
            q-item-label(caption) {{t(`admin.flags.advanced.hint`)}}
            //- The editor was never built, and nothing reads custom keys — say so rather than leave
            //- a disabled button with no explanation
            q-item-label.text-orange(caption) {{t(`admin.flags.advanced.notImplemented`)}}
          q-item-section(avatar)
            q-btn(
              :label='t(`common.actions.edit`)'
              unelevated
              icon='las la-code'
              color='primary'
              text-color='white'
              disabled
            )

    .col-12.col-lg-5.gt-md
      .q-pa-md.text-center
        img(src='/_assets/illustrations/undraw_settings.svg', style='width: 80%;')
</template>

<script setup>

import { onMounted, reactive } from 'vue'
import { omit } from 'es-toolkit/object'
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

import { useSiteStore } from '@/stores/site'
import { useFlagsStore } from '@/stores/flags'

// QUASAR

const $q = useQuasar()

// STORES

const flagsStore = useFlagsStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.flags.title')
})

// DATA

const state = reactive({
  loading: 0,
  flags: {
    experimental: false,
    authDebug: false,
    sqlLog: false
  }
})

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  try {
    // -> Through the store, so that `experimental` is refreshed for the whole app at the same time
    await flagsStore.load()
    state.flags = omit(flagsStore.$state, ['loaded'])
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('admin.flags.loadFailed'),
      caption: err.message
    })
  }
  $q.loading.hide()
  state.loading--
}

async function save () {
  if (state.loading > 0) { return }

  state.loading++
  try {
    const resp = await API_CLIENT.put('system/flags', {
      json: state.flags
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    $q.notify({
      type: 'positive',
      message: t('admin.flags.saveSuccess')
    })
    await load()
  } catch (err) {
    // -> ky doesn't throw on 400, so the API's own message is on the response
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: t('admin.flags.saveFailed'),
      caption: apiMessage || err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(load)

</script>

<style lang='scss'>

</style>
