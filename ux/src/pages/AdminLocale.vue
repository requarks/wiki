<template lang='pug'>
q-page.admin-locale
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-language.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.locale.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.locale.subtitle') }}
    .col-auto.flex
      q-btn.q-mr-md(
        icon='las la-download'
        :label='t(`admin.locale.downloadNew`)'
        unelevated
        color='primary'
        :disabled='state.loading > 0'
        @click='installNewLocale'
      )
      q-separator.q-mr-md(vertical)
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        href='https://docs.js.wiki/admin/locale'
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
    .col-12.col-lg-7
      //- -----------------------
      //- Locale Options
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.locale.settings')}}
        q-item
          blueprint-icon(icon='translation')
          q-item-section
            q-item-label {{state.namespacing ? t(`admin.locale.base.labelWithNS`) : t(`admin.locale.base.label`)}}
            q-item-label(caption) {{t(`admin.locale.base.hint`)}}
          q-item-section
            q-select(
              outlined
              v-model='state.selectedLocale'
              :options='installedLocales'
              option-value='code'
              option-label='name'
              emit-value
              map-options
              dense
              :aria-label='t(`admin.locale.base.label`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='unit')
          q-item-section
            q-item-label {{t(`admin.locale.namespaces.label`)}}
            q-item-label(caption) {{t(`admin.locale.namespaces.hint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.namespacing'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.locale.namespaces.label`)'
              )
        q-item
          q-item-section
            q-card.bg-info.text-white.rounded-borders(flat)
              q-card-section.items-center(horizontal)
                q-card-section.col-auto.q-pr-none
                  q-icon(name='las la-info-circle', size='sm')
                q-card-section
                  span {{ t('admin.locale.namespacingPrefixWarning.title', { langCode: state.selectedLocale }) }}
                  .text-caption.text-yellow-1 {{ t('admin.locale.namespacingPrefixWarning.subtitle') }}

    .col-12.col-lg-5
      //- -----------------------
      //- Namespacing
      //- -----------------------
      q-card.shadow-1.q-pb-sm(v-if='state.namespacing')
        q-card-section
          .text-subtitle1 {{t('admin.locale.activeNamespaces')}}

        q-item(
          v-for='(lc, idx) of installedLocales'
          :key='lc.code'
          :tag='lc.code !== state.selectedLocale ? `label` : null'
          )
          blueprint-icon(:text='lc.code')
          q-item-section
            q-item-label {{lc.name}}
            q-item-label(caption) {{lc.nativeName}}
          q-item-section(avatar)
            q-toggle(
              :disable='lc.code === state.selectedLocale'
              v-model='state.namespaces'
              :val='lc.code'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='lc.name'
              )

        //- q-separator.q-my-sm(inset)
        //- q-item
        //-   blueprint-icon(icon='test-passed')
        //-   q-item-section
        //-     q-item-label {{t(`admin.locale.activeNamespaces.label`)}}
        //-     q-item-label(caption) {{t(`admin.locale.activeNamespaces.hint`)}}
        //-   q-item-section
        //-     q-select(
        //-       outlined
        //-       :disable='!namespacing'
        //-       v-model='namespaces'
        //-       :options='installedLocales'
        //-       multiple
        //-       use-chips
        //-       option-value='code'
        //-       option-label='name'
        //-       emit-value
        //-       map-options
        //-       dense
        //-       :aria-label='t(`admin.locale.activeNamespaces.label`)'
        //-       )

</template>

<script setup>
import gql from 'graphql-tag'
import filter from 'lodash/filter'
import _get from 'lodash/get'
import cloneDeep from 'lodash/cloneDeep'

import LocaleInstallDialog from '../components/LocaleInstallDialog.vue'

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, watch } from 'vue'

import { useAdminStore } from 'src/stores/admin'
import { useSiteStore } from 'src/stores/site'
import { useDataStore } from 'src/stores/data'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()
const dataStore = useDataStore()

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
  selectedLocale: 'en',
  namespacing: false,
  namespaces: []
})

// COMPUTED

const installedLocales = computed(() => {
  return filter(state.locales, ['isInstalled', true])
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

function installNewLocale () {
  $q.dialog({
    component: LocaleInstallDialog
  }).onOk(() => {
    this.load()
  })
}

async function load () {
  state.loading++
  $q.loading.show()
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query getLocales ($siteId: UUID!) {
        locales {
          availability
          code
          createdAt
          isInstalled
          installDate
          isRTL
          name
          nativeName
          updatedAt
        }
        siteById(
          id: $siteId
        ) {
          id
          locale
          localeNamespacing
          localeNamespaces
        }
      }
    `,
    variables: {
      siteId: adminStore.currentSiteId
    },
    fetchPolicy: 'network-only'
  })
  state.locales = cloneDeep(resp?.data?.locales)
  state.selectedLocale = cloneDeep(resp?.data?.siteById?.locale)
  state.namespacing = cloneDeep(resp?.data?.siteById?.localeNamespacing)
  state.namespaces = cloneDeep(resp?.data?.siteById?.localeNamespaces)
  if (!state.namespaces.includes(state.selectedLocale)) {
    state.namespaces.push(state.selectedLocale)
  }
  $q.loading.hide()
  state.loading--
}

async function download (lc) {
  lc.isDownloading = true
  const respRaw = await APOLLO_CLIENT.mutate({
    mutation: gql`
      mutation downloadLocale ($locale: String!) {
        localization {
          downloadLocale (locale: $locale) {
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
      locale: lc.code
    }
  })
  const resp = _get(respRaw, 'data.localization.downloadLocale.responseResult', {})
  if (resp.succeeded) {
    lc.isDownloading = false
    lc.isInstalled = true
    lc.updatedAt = new Date().toISOString()
    lc.installDate = lc.updatedAt
    $q.notify({
      message: `Locale ${lc.name} has been installed successfully.`,
      type: 'positive'
    })
  } else {
    $q.notify({
      type: 'negative',
      message: resp.message
    })
  }
  state.isDownloading = false
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
  const resp = _get(respRaw, 'data.localization.updateLocale.responseResult', {})
  if (resp.succeeded) {
    // Change UI language
    this.$i18n.locale = state.selectedLocale

    $q.notify({
      type: 'positive',
      message: 'Locale settings updated successfully.'
    })

    setTimeout(() => {
      window.location.reload(true)
    }, 1000)
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
