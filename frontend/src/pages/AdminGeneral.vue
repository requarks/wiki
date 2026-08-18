<template>
  <w-page class="admin-general">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-web.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.general.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.general.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/general`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="load">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          unelevated
          icon="mdi:check"
          :label="t(`common.actions.apply`)"
          color="secondary"
          @click="save"
          :disabled="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12 lg:col-span-7">
        <!-- ----------------------- -->
        <!-- Site Info -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.general.siteInfo') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="home" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.siteTitle`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.siteTitleHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                v-model="state.config.title"
                dense
                :rules="rulesTitle"
                hide-bottom-space
                :aria-label="t(`admin.general.siteTitle`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="select-all" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.siteDescription`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.siteDescriptionHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                v-model="state.config.description"
                dense
                :aria-label="t(`admin.general.siteDescription`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="dns" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.siteHostname`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.siteHostnameHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                v-model="state.config.hostname"
                dense
                :rules="rulesHostname"
                hide-bottom-space
                :aria-label="t(`admin.general.siteHostname`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- Footer / Copyright -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.general.footerCopyright') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="building" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.companyName`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.companyNameHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                v-model="state.config.company"
                dense
                :aria-label="t(`admin.general.companyName`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="copyright" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.contentLicense`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.contentLicenseHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-select
                outlined
                v-model="state.config.contentLicense"
                :options="contentLicenses"
                option-value="value"
                option-label="text"
                emit-value
                map-options
                dense
                :aria-label="t(`admin.general.contentLicense`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="subtitles" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.footerExtra`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.footerExtraHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                v-model="state.config.footerExtra"
                dense
                :aria-label="t(`admin.general.footerExtra`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- FEATURES -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.general.features') }}</w-card-header>
          <w-item tag="label">
            <blueprint-icon icon="tree-structure" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.allowBrowse`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.allowBrowseHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.features.browse"
                :aria-label="t(`admin.general.allowBrowse`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="user-typing-using-typewriter" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.allowCollaborativeEditing`) }}</w-item-label>
              <w-item-label caption>
                {{ t(`admin.general.allowCollaborativeEditingHint`) }}
              </w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.features.collaborativeEditing"
                :aria-label="t(`admin.general.allowCollaborativeEditing`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="discussion-forum" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.allowComments`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.allowCommentsHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.features.comments"
                :aria-label="t(`admin.general.allowComments`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="administrator-male" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.allowProfile`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.allowProfileHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.features.profile"
                :aria-label="t(`admin.general.allowProfile`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="star-half-empty" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.allowRatings`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.allowRatingsHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section class="flex-none">
              <w-btn-toggle
                v-model="state.config.features.ratingsMode"
                push
                glossy
                no-caps
                toggle-color="primary"
                :options="ratingsModes" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="search" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.allowSearch`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.allowSearchHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.features.search"
                :aria-label="t(`admin.general.allowSearch`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="confusion" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.reasonForChange`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.reasonForChangeHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-btn-toggle
                v-model="state.config.features.reasonForChange"
                push
                glossy
                no-caps
                toggle-color="primary"
                :options="reasonForChangeModes" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- Defaults -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4" v-if="state.config.defaults">
          <w-card-header>{{ t('admin.general.defaults') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="depth" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.defaultTocDepth`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.defaultTocDepthHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section class="flex-none pl-2" style="min-width: 180px">
              <div class="text-caption">
                {{ t('editor.props.tocMinMaxDepth') }}
                <strong
                  >(H{{ state.config.defaults.tocDepth.min }} &rarr; H{{
                    state.config.defaults.tocDepth.max
                  }})</strong
                >
              </div>
              <w-range
                v-model="state.config.defaults.tocDepth"
                :min="1"
                :max="6"
                color="primary"
                :left-label-value="`H` + state.config.defaults.tocDepth.min"
                :right-label-value="`H` + state.config.defaults.tocDepth.max"
                label
                markers />
            </w-item-section>
          </w-item>
        </w-card>
      </div>
      <div class="col-span-12 lg:col-span-5">
        <!-- ----------------------- -->
        <!-- Logo -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.general.logo') }}</w-card-header>
          <w-item>
            <blueprint-icon
              class="self-start"
              icon="butterfly"
              indicator
              :indicator-text="t(`admin.extensions.requiresSharp`)" />
            <w-item-section>
              <div class="flex">
                <w-item-section>
                  <w-item-label>{{ t(`admin.general.logoUpl`) }}</w-item-label>
                  <w-item-label caption>{{ t(`admin.general.logoUplHint`) }}</w-item-label>
                </w-item-section>
                <w-item-section class="flex-none">
                  <div class="flex gap-2">
                    <w-btn
                      :label="t(`common.actions.upload`)"
                      unelevated
                      icon="la:upload"
                      color="primary"
                      text-color="white"
                      @click="uploadLogo" />
                    <w-btn
                      :label="t(`common.actions.clear`)"
                      outline
                      icon="la:times"
                      color="primary"
                      :disable="!state.hasLogo"
                      @click="clearLogo" />
                  </div>
                </w-item-section>
              </div>
              <w-toolbar class="bg-header mt-4 rounded text-white" style="height: 64px">
                <w-btn dense flat v-if="adminStore.currentSiteId">
                  <w-avatar v-if="state.config.logoText" size="34px" square>
                    <img
                      :src="
                        `/_site/` + adminStore.currentSiteId + `/logo?` + state.assetTimestamp
                      " />
                  </w-avatar>
                  <img
                    v-else
                    :src="`/_site/` + adminStore.currentSiteId + `/logo?` + state.assetTimestamp"
                    style="height: 34px" />
                </w-btn>
                <w-toolbar-title class="text-h6" v-if="state.config.logoText">{{
                  state.config.title
                }}</w-toolbar-title>
              </w-toolbar>
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="information" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.displaySiteTitle`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.displaySiteTitleHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.logoText"
                :aria-label="t(`admin.general.displaySiteTitle`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon
              class="self-start"
              icon="starfish"
              indicator
              :indicator-text="t(`admin.extensions.requiresSharp`)" />
            <w-item-section>
              <div class="flex">
                <w-item-section>
                  <w-item-label>{{ t(`admin.general.favicon`) }}</w-item-label>
                  <w-item-label caption>{{ t(`admin.general.faviconHint`) }}</w-item-label>
                </w-item-section>
                <w-item-section class="flex-none">
                  <div class="flex gap-2">
                    <w-btn
                      :label="t(`common.actions.upload`)"
                      unelevated
                      icon="la:upload"
                      color="primary"
                      text-color="white"
                      @click="uploadFavicon" />
                    <w-btn
                      :label="t(`common.actions.clear`)"
                      outline
                      icon="la:times"
                      color="primary"
                      :disable="!state.hasFavicon"
                      @click="clearFavicon" />
                  </div>
                </w-item-section>
              </div>
              <div class="admin-general-favicontabs mt-4">
                <div>
                  <w-avatar v-if="adminStore.currentSiteId" size="24px" square>
                    <img
                      :src="
                        `/_site/` + adminStore.currentSiteId + `/favicon?` + state.assetTimestamp
                      " />
                  </w-avatar>
                  <div class="text-caption ml-2">{{ state.config.title }}</div>
                </div>
                <div>
                  <w-icon name="la:otter" size="24px" color="grey" />
                  <div class="text-caption ml-2">Lorem ipsum</div>
                </div>
                <div>
                  <w-icon name="la:mountain" size="24px" color="grey" />
                  <div class="text-caption ml-2">Dolor sit amet...</div>
                </div>
              </div>
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- Site-wide Banner -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.general.banner') }}</w-card-header>
          <w-item tag="label">
            <blueprint-icon icon="flag-filled" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.bannerEnabled`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.bannerEnabledHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.banner.isEnabled"
                :aria-label="t(`admin.general.bannerEnabled`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="typography" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.bannerTitle`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.bannerTitleHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                v-model="state.config.banner.title"
                dense
                :aria-label="t(`admin.general.bannerTitle`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="markdown" class="self-start" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.bannerContent`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.bannerContentHint`) }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-item>
            <w-item-section>
              <util-code-editor
                v-model="state.config.banner.content"
                language="markdown"
                :aria-label="t(`admin.general.bannerContent`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- Discovery -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.general.discovery') }}</w-card-header>
          <w-item tag="label">
            <blueprint-icon icon="cellular-network" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.discoverable`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.discoverableHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.discoverable"
                :aria-label="t(`admin.general.discoverable`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- Uploads -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4" v-if="state.config.uploads">
          <w-card-header>{{ t('admin.general.uploads') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="merge-files" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.uploadConflictBehavior`) }}</w-item-label>
              <w-item-label caption>{{
                t(`admin.general.uploadConflictBehaviorHint`)
              }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-select
                outlined
                v-model="state.config.uploads.conflictBehavior"
                :options="uploadConflictBehaviors"
                option-value="value"
                option-label="label"
                emit-value
                map-options
                dense
                options-dense
                :aria-label="t(`admin.general.uploadConflictBehavior`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- URL Handling -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.general.urlHandling') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="sort-by-follow-up-date" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.pageExtensions`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.pageExtensionsHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                v-model="state.config.pageExtensions"
                dense
                :aria-label="t(`admin.general.pageExtensions`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- SEO -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4" v-if="state.config.robots">
          <w-card-header>SEO</w-card-header>
          <w-item tag="label">
            <blueprint-icon icon="bot" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.searchAllowIndexing`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.searchAllowIndexingHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.robots.index"
                :aria-label="t(`admin.general.searchAllowIndexing`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="polyline" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.searchAllowFollow`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.searchAllowFollowHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.robots.follow"
                :aria-label="t(`admin.general.searchAllowFollow`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="genealogy" />
            <w-item-section>
              <w-item-label>{{ t(`admin.general.sitemap`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.sitemapHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle v-model="state.config.sitemap" :aria-label="t(`admin.general.sitemap`)" />
            </w-item-section>
          </w-item>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, reactive, watch } from 'vue'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

import UtilCodeEditor from '@/components/UtilCodeEditor.vue'

import {
  clearSiteImage,
  isAcceptedSiteImage,
  pickSiteImage,
  uploadSiteImage
} from '@/helpers/siteImages'

import { toMerged } from 'es-toolkit/object'

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

/**
 * Fallbacks for config keys a site may not have stored yet, so that every control renders with a
 * defined value. Must mirror the defaults used by the backend when creating a site.
 */
function defaultConfig() {
  return {
    hostname: '',
    title: '',
    description: '',
    company: '',
    contentLicense: '',
    footerExtra: '',
    banner: {
      isEnabled: false,
      title: '',
      content: ''
    },
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
      reasonForChange: 'required',
      profile: false
    },
    discoverable: false,
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
}

const state = reactive({
  loading: 0,
  assetTimestamp: new Date().toISOString(),
  // -> Whether this site has a logo / favicon of its own, i.e. whether there is anything to clear.
  //    The previews always render: without one they show the default that is served instead.
  hasLogo: false,
  hasFavicon: false,
  config: defaultConfig()
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
const reasonForChangeModes = [
  { value: 'off', label: t('admin.general.reasonForChangeOff') },
  { value: 'optional', label: t('admin.general.reasonForChangeOptional') },
  { value: 'required', label: t('admin.general.reasonForChangeRequired') }
]
const uploadConflictBehaviors = [
  { value: 'overwrite', label: t('admin.general.uploadConflictBehaviorOverwrite') },
  { value: 'reject', label: t('admin.general.uploadConflictBehaviorReject') },
  { value: 'new', label: t('admin.general.uploadConflictBehaviorNew') }
]

const rulesTitle = [(val) => /^[^<>"]+$/.test(val) || t('admin.general.siteTitleInvalidChars')]
const rulesHostname = [
  (val) => /^(([a-z0-9.-]+)|([*]{1}))$/.test(val) || t('admin.general.siteHostnameInvalid')
]

// WATCHERS

watch(
  () => adminStore.currentSiteId,
  (newValue) => {
    load()
  }
)

// METHODS

async function load() {
  state.loading++
  loading.show()
  const resp = await API_CLIENT.get(`sites/${adminStore.currentSiteId}?strict=true`).json()
  state.config = toMerged(defaultConfig(), {
    ...resp,
    pageExtensions: resp.pageExtensions.join(',')
  })
  state.hasLogo = resp?.assets?.logo ?? false
  state.hasFavicon = resp?.assets?.favicon ?? false
  loading.hide()
  state.loading--
}

/**
 * The form holds page extensions as a comma-separated string, while the API expects an array.
 */
function parsePageExtensions(value) {
  const extensions = Array.isArray(value) ? value : String(value ?? '').split(',')
  return [
    ...new Set(extensions.map((ext) => ext.trim().toLowerCase()).filter((ext) => ext.length > 0))
  ]
}

async function save() {
  state.loading++
  try {
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}`, {
      json: {
        hostname: state.config.hostname ?? '',
        title: state.config.title ?? '',
        description: state.config.description ?? '',
        company: state.config.company ?? '',
        contentLicense: state.config.contentLicense ?? '',
        footerExtra: state.config.footerExtra ?? '',
        banner: {
          isEnabled: state.config.banner?.isEnabled ?? false,
          title: state.config.banner?.title ?? '',
          content: state.config.banner?.content ?? ''
        },
        pageExtensions: parsePageExtensions(state.config.pageExtensions),
        logoText: state.config.logoText ?? false,
        sitemap: state.config.sitemap ?? false,
        uploads: {
          conflictBehavior: state.config.uploads?.conflictBehavior ?? 'overwrite'
        },
        robots: {
          index: state.config.robots?.index ?? false,
          follow: state.config.robots?.follow ?? false
        },
        features: {
          browse: state.config.features?.browse ?? false,
          comments: state.config.features?.comments ?? false,
          ratingsMode: state.config.features?.ratingsMode ?? 'off',
          profile: state.config.features?.profile ?? false,
          reasonForChange: state.config.features?.reasonForChange ?? 'required',
          search: state.config.features?.search ?? false
        },
        discoverable: state.config.discoverable ?? false,
        defaults: {
          tocDepth: {
            min: state.config.defaults?.tocDepth?.min ?? 1,
            max: state.config.defaults?.tocDepth?.max ?? 2
          }
        }
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(
        t(`admin.general.${resp?.error}`, resp?.message || 'An unexpected error occured.')
      )
    }
    notify({
      type: 'positive',
      message: t('admin.general.saveSuccess')
    })
    await adminStore.fetchSites()
    if (adminStore.currentSiteId === siteStore.id) {
      siteStore.loadSite(window.location.hostname)
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to save site configuration.',
      caption: err.message
    })
  }
  state.loading--
}

async function uploadLogo() {
  const file = await pickSiteImage()
  if (!file) {
    return
  }
  if (!isAcceptedSiteImage(file)) {
    notify({
      type: 'negative',
      message: t('admin.general.logoUploadFailed'),
      caption: t('admin.general.imageUploadInvalidType')
    })
    return
  }
  state.loading++
  try {
    await uploadSiteImage(adminStore.currentSiteId, 'logo', file)
    notify({
      type: 'positive',
      message: t('admin.general.logoUploadSuccess')
    })
    state.hasLogo = true
    state.assetTimestamp = new Date().toISOString()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.general.logoUploadFailed'),
      caption: err.message
    })
  }
  state.loading--
}

async function clearLogo() {
  state.loading++
  try {
    await clearSiteImage(adminStore.currentSiteId, 'logo')
    notify({
      type: 'positive',
      message: t('admin.general.logoClearSuccess')
    })
    state.hasLogo = false
    state.assetTimestamp = new Date().toISOString()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.general.logoClearFailed'),
      caption: err.message
    })
  }
  state.loading--
}

async function uploadFavicon() {
  const file = await pickSiteImage()
  if (!file) {
    return
  }
  if (!isAcceptedSiteImage(file)) {
    notify({
      type: 'negative',
      message: t('admin.general.faviconUploadFailed'),
      caption: t('admin.general.imageUploadInvalidType')
    })
    return
  }
  state.loading++
  try {
    await uploadSiteImage(adminStore.currentSiteId, 'favicon', file)
    notify({
      type: 'positive',
      message: t('admin.general.faviconUploadSuccess')
    })
    state.hasFavicon = true
    state.assetTimestamp = new Date().toISOString()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.general.faviconUploadFailed'),
      caption: err.message
    })
  }
  state.loading--
}

async function clearFavicon() {
  state.loading++
  try {
    await clearSiteImage(adminStore.currentSiteId, 'favicon')
    notify({
      type: 'positive',
      message: t('admin.general.faviconClearSuccess')
    })
    state.hasFavicon = false
    state.assetTimestamp = new Date().toISOString()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.general.faviconClearFailed'),
      caption: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  if (adminStore.currentSiteId) {
    load()
  }
})
</script>

<style lang="scss">
.admin-general {
  &-favicontabs {
    overflow: hidden;
    border-radius: 5px;
    display: flex;
    padding: 5px 5px 0 12px;

    @at-root .body--light & {
      background-color: rgba(0, 0, 0, 0.1);
    }

    @at-root .body--dark & {
      background-color: rgba(255, 255, 255, 0.1);
    }

    > div {
      display: flex;
      padding: 4px 12px;
      position: relative;
      align-items: center;

      &:first-child {
        border: 1px solid #fff;
        border-bottom: none;
        border-radius: 7px 7px 0 0;
        box-shadow: 0 0 5px 0 rgba(0, 0, 0, 0.2);

        @at-root .body--light & {
          background: linear-gradient(to top, #fff, rgba(255, 255, 255, 0.75));
          border-color: #fff;
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
