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
        :href='siteStore.docsBase + `/system/flags`'
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
      q-card.q-py-sm.q-mt-md
        q-item
          blueprint-icon(icon='administrative-tools')
          q-item-section
            q-item-label {{t(`admin.flags.advanced.label`)}}
            q-item-label(caption) {{t(`admin.flags.advanced.hint`)}}
          q-item-section(avatar)
            q-btn(
              :label='t(`common.actions.edit`)'
              unelevated
              icon='las la-code'
              color='primary'
              text-color='white'
              @click=''
              disabled
            )

    .col-12.col-lg-5.gt-md
      .q-pa-md.text-center
        img(src='/_assets/illustrations/undraw_settings.svg', style='width: 80%;')
</template>

<script setup>
import gql from 'graphql-tag'
import { defineAsyncComponent, onMounted, reactive, ref } from 'vue'
import { cloneDeep, omit } from 'lodash-es'
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

import { useSiteStore } from 'src/stores/site'
import { useFlagsStore } from 'src/stores/flags'

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
  await flagsStore.load()
  state.flags = omit(cloneDeep(flagsStore.$state), ['loaded'])
  $q.loading.hide()
  state.loading--
}

async function save () {
  if (state.loading > 0) { return }

  state.loading++
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation updateFlags (
          $flags: JSON!
        ) {
          updateSystemFlags(
            flags: $flags
          ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        flags: state.flags
      }
    })
    if (resp?.data?.updateSystemFlags?.operation?.succeeded) {
      load()
      $q.notify({
        type: 'positive',
        message: t('admin.flags.saveSuccess')
      })
    } else {
      throw new Error(resp?.data?.updateSystemFlags?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(async () => {
  load()
})

</script>

<style lang='scss'>

</style>
