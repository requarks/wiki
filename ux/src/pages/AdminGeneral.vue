<template lang='pug'>
q-page.admin-general
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-web.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.general.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.general.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :href='siteStore.docsBase + `/admin/sites`'
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
      //- Site Info
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.general.siteInfo')}}
        q-item
          blueprint-icon(icon='home')
          q-item-section
            q-item-label {{t(`admin.general.siteTitle`)}}
            q-item-label(caption) {{t(`admin.general.siteTitleHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.title'
              dense
              :rules='rulesTitle'
              hide-bottom-space
              :aria-label='t(`admin.general.siteTitle`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='select-all')
          q-item-section
            q-item-label {{t(`admin.general.siteDescription`)}}
            q-item-label(caption) {{t(`admin.general.siteDescriptionHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.description'
              dense
              :aria-label='t(`admin.general.siteDescription`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='dns')
          q-item-section
            q-item-label {{t(`admin.general.siteHostname`)}}
            q-item-label(caption) {{t(`admin.general.siteHostnameHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.hostname'
              dense
              :rules='rulesHostname'
              hide-bottom-space
              :aria-label='t(`admin.general.siteHostname`)'
              )

      //- -----------------------
      //- Footer / Copyright
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.general.footerCopyright')}}
        q-item
          blueprint-icon(icon='building')
          q-item-section
            q-item-label {{t(`admin.general.companyName`)}}
            q-item-label(caption) {{t(`admin.general.companyNameHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.company'
              dense
              :aria-label='t(`admin.general.companyName`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='copyright')
          q-item-section
            q-item-label {{t(`admin.general.contentLicense`)}}
            q-item-label(caption) {{t(`admin.general.contentLicenseHint`)}}
          q-item-section
            q-select(
              outlined
              v-model='state.config.contentLicense'
              :options='contentLicenses'
              option-value='value'
              option-label='text'
              emit-value
              map-options
              dense
              :aria-label='t(`admin.general.contentLicense`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='subtitles')
          q-item-section
            q-item-label {{t(`admin.general.footerExtra`)}}
            q-item-label(caption) {{t(`admin.general.footerExtraHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.footerExtra'
              dense
              :aria-label='t(`admin.general.footerExtra`)'
              )

      //- -----------------------
      //- FEATURES
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.general.features')}}
        q-item(tag='label')
          blueprint-icon(icon='discussion-forum')
          q-item-section
            q-item-label {{t(`admin.general.allowComments`)}}
            q-item-label(caption) {{t(`admin.general.allowCommentsHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.features.comments'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.general.allowComments`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='pen')
          q-item-section
            q-item-label {{t(`admin.general.allowContributions`)}}
            q-item-label(caption) {{t(`admin.general.allowContributionsHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.features.contributions'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.general.allowContributions`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='administrator-male')
          q-item-section
            q-item-label {{t(`admin.general.allowProfile`)}}
            q-item-label(caption) {{t(`admin.general.allowProfileHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.features.profile'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.general.allowProfile`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='star-half-empty')
          q-item-section
            q-item-label {{t(`admin.general.allowRatings`)}}
            q-item-label(caption) {{t(`admin.general.allowRatingsHint`)}}
          q-item-section.col-auto
            q-btn-toggle(
              v-model='state.config.features.ratingsMode'
              push
              glossy
              no-caps
              toggle-color='primary'
              :options='ratingsModes'
            )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='search')
          q-item-section
            q-item-label {{t(`admin.general.allowSearch`)}}
            q-item-label(caption) {{t(`admin.general.allowSearchHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.features.search'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.general.allowSearch`)'
              )

      //- -----------------------
      //- URL Handling
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.general.urlHandling')}}
        q-item
          blueprint-icon(icon='sort-by-follow-up-date')
          q-item-section
            q-item-label {{t(`admin.general.pageExtensions`)}}
            q-item-label(caption) {{t(`admin.general.pageExtensionsHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.pageExtensions'
              dense
              :aria-label='t(`admin.general.pageExtensions`)'
              )

    .col-12.col-lg-5
      //- -----------------------
      //- Logo
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.general.logo')}}
        q-item
          blueprint-icon.self-start(icon='butterfly', indicator, :indicator-text='t(`admin.extensions.requiresSharp`)')
          q-item-section
            .flex
              q-item-section
                q-item-label {{t(`admin.general.logoUpl`)}}
                q-item-label(caption) {{t(`admin.general.logoUplHint`)}}
              q-item-section.col-auto
                q-btn(
                  label='Upload'
                  unelevated
                  icon='las la-upload'
                  color='primary'
                  text-color='white'
                  @click='uploadLogo'
                )
            q-toolbar.bg-header.q-mt-md.rounded-borders.text-white(
              dark
              style='height: 64px;'
              )
              q-btn(dense, flat, v-if='adminStore.currentSiteId')
                q-avatar(
                  v-if='state.config.logoText'
                  size='34px'
                  square
                  )
                  img(:src='`/_site/` + adminStore.currentSiteId + `/logo?` + state.assetTimestamp')
                img(
                  v-else
                  :src='`/_site/` + adminStore.currentSiteId + `/logo?` + state.assetTimestamp'
                  style='height: 34px;'
                  )
              q-toolbar-title.text-h6(v-if='state.config.logoText') {{state.config.title}}
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='information')
          q-item-section
            q-item-label {{t(`admin.general.displaySiteTitle`)}}
            q-item-label(caption) {{t(`admin.general.displaySiteTitleHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.logoText'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.general.displaySiteTitle`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon.self-start(icon='starfish', indicator, :indicator-text='t(`admin.extensions.requiresSharp`)')
          q-item-section
            .flex
              q-item-section
                q-item-label {{t(`admin.general.favicon`)}}
                q-item-label(caption) {{t(`admin.general.faviconHint`)}}
              q-item-section.col-auto
                q-btn(
                  label='Upload'
                  unelevated
                  icon='las la-upload'
                  color='primary'
                  text-color='white'
                  @click='uploadFavicon'
                )
            .admin-general-favicontabs.q-mt-md
              div
                q-avatar(
                  v-if='adminStore.currentSiteId'
                  size='24px'
                  square
                  )
                  img(:src='`/_site/` + adminStore.currentSiteId + `/favicon?` + state.assetTimestamp')
                .text-caption.q-ml-sm {{state.config.title}}
              div
                q-icon(name='las la-otter', size='24px', color='grey')
                .text-caption.q-ml-sm Lorem ipsum
              div
                q-icon(name='las la-mountain', size='24px', color='grey')
                .text-caption.q-ml-sm Dolor sit amet...

      //- -----------------------
      //- Defaults
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md(v-if='state.config.defaults')
        q-card-section
          .text-subtitle1 {{t('admin.general.defaults')}}
        q-item
          blueprint-icon(icon='timezone')
          q-item-section
            q-item-label {{t(`admin.general.defaultTimezone`)}}
            q-item-label(caption) {{t(`admin.general.defaultTimezoneHint`)}}
          q-item-section
            q-select(
              outlined
              v-model='state.config.defaults.timezone'
              :options='timezones'
              option-value='value'
              option-label='text'
              emit-value
              map-options
              dense
              options-dense
              :virtual-scroll-slice-size='1000'
              :aria-label='t(`admin.general.defaultTimezone`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='calendar')
          q-item-section
            q-item-label {{t(`admin.general.defaultDateFormat`)}}
            q-item-label(caption) {{t(`admin.general.defaultDateFormatHint`)}}
          q-item-section
            q-select(
              outlined
              v-model='state.config.defaults.dateFormat'
              emit-value
              map-options
              dense
              :aria-label='t(`admin.general.defaultDateFormat`)'
              :options='dateFormats'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='clock')
          q-item-section
            q-item-label {{t(`admin.general.defaultTimeFormat`)}}
            q-item-label(caption) {{t(`admin.general.defaultTimeFormatHint`)}}
          q-item-section.col-auto
            q-btn-toggle(
              v-model='state.config.defaults.timeFormat'
              push
              glossy
              no-caps
              toggle-color='primary'
              :options='timeFormats'
            )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='depth')
          q-item-section
            q-item-label {{t(`admin.general.defaultTocDepth`)}}
            q-item-label(caption) {{t(`admin.general.defaultTocDepthHint`)}}
          q-item-section.col-auto.q-pl-sm(style='min-width: 180px;')
            .text-caption {{t('editor.props.tocMinMaxDepth')}} #[strong (H{{state.config.defaults.tocDepth.min}} &rarr; H{{state.config.defaults.tocDepth.max}})]
            q-range(
              v-model='state.config.defaults.tocDepth'
              :min='1'
              :max='6'
              color='primary'
              :left-label-value='`H` + state.config.defaults.tocDepth.min'
              :right-label-value='`H` + state.config.defaults.tocDepth.max'
              snap
              label
              markers
            )

      //- -----------------------
      //- SEO
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md(v-if='state.config.robots')
        q-card-section
          .text-subtitle1 SEO
        q-item(tag='label')
          blueprint-icon(icon='bot')
          q-item-section
            q-item-label {{t(`admin.general.searchAllowIndexing`)}}
            q-item-label(caption) {{t(`admin.general.searchAllowIndexingHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.robots.index'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.general.searchAllowIndexing`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='polyline')
          q-item-section
            q-item-label {{t(`admin.general.searchAllowFollow`)}}
            q-item-label(caption) {{t(`admin.general.searchAllowFollowHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.robots.follow'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.general.searchAllowFollow`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='genealogy')
          q-item-section
            q-item-label {{t(`admin.general.sitemap`)}}
            q-item-label(caption) {{t(`admin.general.sitemapHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.sitemap'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.general.sitemap`)'
              )

</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { onMounted, reactive, watch } from 'vue'

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
  title: t('admin.dashboard.title')
})

// DATA

const state = reactive({
  loading: 0,
  assetTimestamp: (new Date()).toISOString(),
  config: {
    hostname: '',
    title: '',
    description: '',
    company: '',
    contentLicense: '',
    footerExtra: '',
    pageExtensions: '',
    logoText: false,
    ratings: {
      index: false,
      follow: false
    },
    features: {
      ratings: false,
      ratingsMode: 'off',
      comments: false,
      contributions: false,
      profile: false
    },
    defaults: {
      timezone: '',
      dateFormat: '',
      timeFormat: '',
      tocDepth: {
        min: 1,
        max: 2
      }
    },
    robots: {
      index: false,
      follow: false
    },
    sitemap: false
  }
})

const contentLicenses = [
  { value: '', text: t('common.license.none') },
  { value: 'alr', text: t('common.license.alr') },
  { value: 'cc0', text: t('common.license.cc0') },
  { value: 'ccby', text: t('common.license.ccby') },
  { value: 'ccbysa', text: t('common.license.ccbysa') },
  { value: 'ccbynd', text: t('common.license.ccbynd') },
  { value: 'ccbync', text: t('common.license.ccbync') },
  { value: 'ccbyncsa', text: t('common.license.ccbyncsa') },
  { value: 'ccbyncnd', text: t('common.license.ccbyncnd') }
]
const ratingsModes = [
  { value: 'off', label: t('admin.general.ratingsOff') },
  { value: 'thumbs', label: t('admin.general.ratingsThumbs') },
  { value: 'stars', label: t('admin.general.ratingsStars') }
]
const dateFormats = [
  { value: '', label: t('profile.localeDefault') },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD' }
]
const timeFormats = [
  { value: '12h', label: t('admin.general.defaultTimeFormat12h') },
  { value: '24h', label: t('admin.general.defaultTimeFormat24h') }
]

const timezones = Intl.supportedValuesOf('timeZone')

const rulesTitle = [
  val => /^[^<>"]+$/.test(val) || t('admin.general.siteTitleInvalidChars')
]
const rulesHostname = [
  val => /^(([a-z0-9.-]+)|([*]{1}))$/.test(val) || t('admin.general.siteHostnameInvalid')
]

// WATCHERS

watch(() => adminStore.currentSiteId, (newValue) => {
  load()
})

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query getSite (
        $id: UUID!
      ) {
        siteById(
          id: $id
        ) {
          id
          hostname
          isEnabled
          title
          description
          company
          contentLicense
          footerExtra
          pageExtensions
          logoText
          sitemap
          robots {
            index
            follow
          }
          features {
            comments
            ratings
            ratingsMode
            contributions
            profile
            search
          }
          defaults {
            timezone
            dateFormat
            timeFormat
            tocDepth {
              min
              max
            }
          }
        }
      }
    `,
    variables: {
      id: adminStore.currentSiteId
    },
    fetchPolicy: 'network-only'
  })
  state.config = cloneDeep(resp?.data?.siteById)
  $q.loading.hide()
  state.loading--
}

async function save () {
  state.loading++
  try {
    await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation saveSite (
          $id: UUID!
          $patch: SiteUpdateInput!
        ) {
          updateSite (
            id: $id
            patch: $patch
          ) {
            operation {
              succeeded
              slug
              message
            }
          }
        }
      `,
      variables: {
        id: adminStore.currentSiteId,
        patch: {
          hostname: state.config.hostname ?? '',
          title: state.config.title ?? '',
          description: state.config.description ?? '',
          company: state.config.company ?? '',
          contentLicense: state.config.contentLicense ?? '',
          footerExtra: state.config.footerExtra ?? '',
          pageExtensions: state.config.pageExtensions ?? '',
          logoText: state.config.logoText ?? false,
          sitemap: state.config.sitemap ?? false,
          robots: {
            index: state.config.robots?.index ?? false,
            follow: state.config.robots?.follow ?? false
          },
          features: {
            comments: state.config.features?.comments ?? false,
            ratings: (state.config.features?.ratings || 'off') !== 'off',
            ratingsMode: state.config.features?.ratingsMode ?? 'off',
            contributions: state.config.features?.contributions ?? false,
            profile: state.config.features?.profile ?? false,
            search: state.config.features?.search ?? false
          },
          defaults: {
            timezone: state.config.defaults?.timezone ?? 'America/New_York',
            dateFormat: state.config.defaults?.dateFormat ?? 'YYYY-MM-DD',
            timeFormat: state.config.defaults?.timeFormat ?? '12h',
            tocDepth: {
              min: state.config.defaults?.tocDepth?.min ?? 1,
              max: state.config.defaults?.tocDepth?.max ?? 2
            }
          }
        }
      }
    })
    $q.notify({
      type: 'positive',
      message: t('admin.general.saveSuccess')
    })
    await adminStore.fetchSites()
    if (adminStore.currentSiteId === siteStore.id) {
      siteStore.$patch({
        title: state.config.title,
        description: state.config.description,
        company: state.config.company,
        contentLicense: state.config.contentLicense
      })
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save site configuration.',
      caption: err.message
    })
  }
  state.loading--
}

async function uploadLogo () {
  const input = document.createElement('input')
  input.type = 'file'

  input.onchange = async e => {
    state.loading++
    try {
      const resp = await APOLLO_CLIENT.mutate({
        mutation: gql`
          mutation uploadLogo (
            $id: UUID!
            $image: Upload!
          ) {
            uploadSiteLogo (
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
      if (resp?.data?.uploadSiteLogo?.operation?.succeeded) {
        $q.notify({
          type: 'positive',
          message: t('admin.general.logoUploadSuccess')
        })
        state.assetTimestamp = (new Date()).toISOString()
      } else {
        throw new Error(resp?.data?.uploadSiteLogo?.operation?.message || 'An unexpected error occured.')
      }
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: 'Failed to upload site logo.',
        caption: err.message
      })
    }
    state.loading--
  }

  input.click()
}

async function uploadFavicon () {
  const input = document.createElement('input')
  input.type = 'file'

  input.onchange = async e => {
    state.loading++
    try {
      const resp = await APOLLO_CLIENT.mutate({
        mutation: gql`
          mutation uploadFavicon (
            $id: UUID!
            $image: Upload!
          ) {
            uploadSiteFavicon (
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
      if (resp?.data?.uploadSiteFavicon?.operation?.succeeded) {
        $q.notify({
          type: 'positive',
          message: t('admin.general.faviconUploadSuccess')
        })
        state.assetTimestamp = (new Date()).toISOString()
      } else {
        throw new Error(resp?.data?.uploadSiteFavicon?.operation?.message || 'An unexpected error occured.')
      }
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: 'Failed to upload site favicon.',
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
.admin-general {

  &-favicontabs {
    overflow: hidden;
    border-radius: 5px;
    display: flex;
    padding: 5px 5px 0 12px;

    @at-root .body--light & {
      background-color: rgba(0,0,0,.1);
    }

    @at-root .body--dark & {
      background-color: rgba(255,255,255,.1);
    }

    > div {
      display: flex;
      padding: 4px 12px;
      position: relative;
      align-items: center;

      &:first-child {
        border: 1px solid #FFF;
        border-bottom: none;
        border-radius: 7px 7px 0 0;
        box-shadow: 0 0 5px 0 rgba(0,0,0,.2);

        @at-root .body--light & {
          background: linear-gradient(to top, #FFF, rgba(255,255,255,.75));
          border-color: #FFF;
        }

        @at-root .body--dark & {
          background: linear-gradient(to top, $dark-6, $dark-5);
          border-color: $dark-6;
        }
      }
    }
  }

}
</style>
