<template lang='pug'>
q-page.admin-locale
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-language.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ $t('admin.locale.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ $t('admin.locale.subtitle') }}
    .col-auto.flex
      q-btn.q-mr-md(
        icon='las la-download'
        :label='$t(`admin.locale.downloadNew`)'
        unelevated
        color='primary'
        :disabled='loading > 0'
        @click='installNewLocale'
      )
      q-separator.q-mr-md(vertical)
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        href='https://docs.requarks.io/admin/locale'
        target='_blank'
        type='a'
        )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='loading > 0'
        @click='load'
        )
      q-btn(
        unelevated
        icon='mdi-check'
        :label='$t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :disabled='loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-7
      //- -----------------------
      //- Locale Options
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{$t('admin.locale.settings')}}
        q-item
          blueprint-icon(icon='translation')
          q-item-section
            q-item-label {{namespacing ? $t(`admin.locale.base.labelWithNS`) : $t(`admin.locale.base.label`)}}
            q-item-label(caption) {{$t(`admin.locale.base.hint`)}}
          q-item-section
            q-select(
              outlined
              v-model='selectedLocale'
              :options='installedLocales'
              option-value='code'
              option-label='name'
              emit-value
              map-options
              dense
              :aria-label='$t(`admin.locale.base.label`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='unit')
          q-item-section
            q-item-label {{$t(`admin.locale.namespaces.label`)}}
            q-item-label(caption) {{$t(`admin.locale.namespaces.hint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='namespacing'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.locale.namespaces.label`)'
              )
        q-item
          q-item-section
            q-card.bg-info.text-white.rounded-borders(flat)
              q-card-section.items-center(horizontal)
                q-card-section.col-auto.q-pr-none
                  q-icon(name='las la-info-circle', size='sm')
                q-card-section
                  span {{ $t('admin.locale.namespacingPrefixWarning.title', { langCode: selectedLocale }) }}
                  .text-caption.text-yellow-1 {{ $t('admin.locale.namespacingPrefixWarning.subtitle') }}

    .col-5
      //- -----------------------
      //- Namespacing
      //- -----------------------
      q-card.shadow-1.q-pb-sm(v-if='namespacing')
        q-card-section
          .text-subtitle1 {{$t('admin.locale.activeNamespaces')}}

        q-item(
          v-for='(lc, idx) of installedLocales'
          :key='lc.code'
          :tag='lc.code !== selectedLocale ? `label` : null'
          )
          blueprint-icon(:text='lc.code')
          q-item-section
            q-item-label {{lc.name}}
            q-item-label(caption) {{lc.nativeName}}
          q-item-section(avatar)
            q-toggle(
              :disable='lc.code === selectedLocale'
              v-model='namespaces'
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
        //-     q-item-label {{$t(`admin.locale.activeNamespaces.label`)}}
        //-     q-item-label(caption) {{$t(`admin.locale.activeNamespaces.hint`)}}
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
        //-       :aria-label='$t(`admin.locale.activeNamespaces.label`)'
        //-       )

</template>

<script>
import { get } from 'vuex-pathify'
import gql from 'graphql-tag'
import filter from 'lodash/filter'
import _get from 'lodash/get'
import cloneDeep from 'lodash/cloneDeep'
import { createMetaMixin } from 'quasar'

import LocaleInstallDialog from '../components/LocaleInstallDialog.vue'

export default {
  mixins: [
    createMetaMixin(function () {
      return {
        title: this.$t('admin.locale.title')
      }
    })
  ],
  data () {
    return {
      loading: 0,
      locales: [],
      selectedLocale: 'en',
      namespacing: false,
      namespaces: []
    }
  },
  computed: {
    currentSiteId: get('admin/currentSiteId', false),
    installedLocales () {
      return filter(this.locales, ['isInstalled', true])
    }
  },
  watch: {
    currentSiteId (newValue) {
      this.load()
    },
    selectedLocale (newValue) {
      if (!this.namespaces.includes(newValue)) {
        this.namespaces.push(newValue)
      }
    }
  },
  mounted () {
    if (this.currentSiteId) {
      this.load()
    }
  },
  methods: {
    installNewLocale () {
      this.$q.dialog({
        component: LocaleInstallDialog
      }).onOk(() => {
        this.load()
      })
    },
    async load () {
      this.loading++
      this.$q.loading.show()
      const resp = await this.$apollo.query({
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
          siteId: this.currentSiteId
        },
        fetchPolicy: 'network-only'
      })
      this.locales = cloneDeep(resp?.data?.locales)
      this.selectedLocale = cloneDeep(resp?.data?.siteById?.locale)
      this.namespacing = cloneDeep(resp?.data?.siteById?.localeNamespacing)
      this.namespaces = cloneDeep(resp?.data?.siteById?.localeNamespaces)
      if (!this.namespaces.includes(this.selectedLocale)) {
        this.namespaces.push(this.selectedLocale)
      }
      this.$q.loading.hide()
      this.loading--
    },
    async download (lc) {
      lc.isDownloading = true
      const respRaw = await this.$apollo.mutate({
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
        this.$store.commit('showNotification', {
          message: `Locale ${lc.name} has been installed successfully.`,
          style: 'success',
          icon: 'get_app'
        })
      } else {
        this.$q.notify({
          type: 'negative',
          message: resp.message
        })
      }
      this.isDownloading = false
    },
    async save () {
      this.loading = true
      const respRaw = await this.$apollo.mutate({
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
          locale: this.selectedLocale,
          autoUpdate: this.autoUpdate,
          namespacing: this.namespacing,
          namespaces: this.namespaces
        }
      })
      const resp = _get(respRaw, 'data.localization.updateLocale.responseResult', {})
      if (resp.succeeded) {
        // Change UI language
        this.$i18n.locale = this.selectedLocale

        this.$q.notify({
          type: 'positive',
          message: 'Locale settings updated successfully.'
        })

        setTimeout(() => {
          window.location.reload(true)
        }, 1000)
      } else {
        this.$q.notify({
          type: 'negative',
          message: resp.message
        })
      }
      this.loading = false
    }
  }
}
</script>
