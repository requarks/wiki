<template lang='pug'>
q-page.admin-locale
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-language.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.locale.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.locale.subtitle') }}
    .col-auto.flex
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/admin/localisation`'
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
    .col-12.col-lg-7
      //- -----------------------
      //- Locale Options
      //- -----------------------
      q-card.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.locale.settings')}}
        q-item
          blueprint-icon(icon='translation')
          q-item-section
            q-item-label {{t(`admin.locale.primary`)}}
            q-item-label(caption) {{t(`admin.locale.primaryHint`)}}
          q-item-section
            q-select(
              outlined
              v-model='state.primary'
              :options='state.locales'
              option-value='code'
              option-label='name'
              emit-value
              map-options
              dense
              :aria-label='t(`admin.locale.primary`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='close-pane')
          q-item-section
            q-item-label {{t(`admin.locale.forcePrefix`)}}
            q-item-label(caption) {{t(`admin.locale.forcePrefixHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.forcePrefix'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.locale.forcePrefixHint`)'
              )

      //- -----------------------
      //- Active Locales
      //- -----------------------
      q-card.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.locale.active')}}
          .text-caption(:class='$q.dark.isActive ? `text-grey-4` : `text-grey-7`') Select the locales that can be used on this site.

        q-item(
          v-for='lc of state.locales'
          :key='lc.code'
          :tag='lc.code !== state.selectedLocale ? `label` : null'
          )
          blueprint-icon(:text='lc.language')
          q-item-section
            q-item-label {{lc.nativeName}}
            q-item-label(caption) {{lc.name}} ({{lc.code}})
          q-item-section(avatar)
            q-toggle(
              :disable='lc.code === state.primary'
              v-model='state.active'
              :val='lc.code'
              :color='lc.code === state.primary ? `secondary` : `primary`'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='lc.name'
              )

    .col-12.col-lg-5
      .q-pa-md.text-center
        img(src='/_assets/illustrations/undraw_world.svg', style='width: 80%;')

</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep, sortBy } from 'lodash-es'

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
  title: t('admin.locale.title')
})

// DATA

const state = reactive({
  loading: 0,
  locales: [],
  primary: 'en',
  forcePrefix: false,
  active: []
})

// WATCHERS

watch(() => adminStore.currentSiteId, (newValue) => {
  load()
})
watch(() => state.selectedLocale, (newValue) => {
  if (!state.namespaces.includes(newValue)) {
    state.namespaces.push(newValue)
  }
})

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query getLocales ($siteId: UUID!) {
        locales {
          completeness
          code
          createdAt
          isRTL
          language
          name
          nativeName
          region
          script
          updatedAt
        }
        siteById(
          id: $siteId
        ) {
          id
          locales {
            primary
            active {
              code
            }
          }
        }
      }
    `,
    variables: {
      siteId: adminStore.currentSiteId
    },
    fetchPolicy: 'network-only'
  })
  state.locales = sortBy(cloneDeep(resp?.data?.locales), ['nativeName', 'name'])
  state.primary = cloneDeep(resp?.data?.siteById?.locales?.primary)
  state.active = cloneDeep(resp?.data?.siteById?.locales?.active ?? []).map(l => l.code)
  if (!state.active.includes(state.primary)) {
    state.active.push(state.primary)
  }
  $q.loading.hide()
  state.loading--
}

async function save () {
  state.loading = true
  const respRaw = await APOLLO_CLIENT.mutate({
    mutation: gql`
      mutation saveLocaleSettings (
        $locale: String!
        $autoUpdate: Boolean!
        $namespacing: Boolean!
        $namespaces: [String]!
        ) {
        localization {
          updateLocale(
            locale: $locale
            autoUpdate: $autoUpdate
            namespacing: $namespacing
            namespaces: $namespaces
            ) {
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
      locale: state.selectedLocale,
      autoUpdate: state.autoUpdate,
      namespacing: state.namespacing,
      namespaces: state.namespaces
    }
  })
  const resp = respRaw?.data?.localization?.updateLocale?.responseResult || {}
  if (resp.succeeded) {
    $q.notify({
      type: 'positive',
      message: 'Locale settings updated successfully.'
    })
  } else {
    $q.notify({
      type: 'negative',
      message: resp.message
    })
  }
  state.loading = false
}

// MOUNTED

onMounted(() => {
  if (adminStore.currentSiteId) {
    load()
  }
})
</script>
