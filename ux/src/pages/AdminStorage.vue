<template lang='pug'>
q-page.admin-storage
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-ssd.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.storage.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.storage.subtitle') }}
    .col-auto.flex
      q-spinner-tail.q-mr-md(
        v-show='state.loading > 0'
        color='accent'
        size='sm'
      )
      q-btn-toggle.q-mr-md(
        v-model='state.displayMode'
        push
        no-caps
        toggle-color='black'
        :options=`[
          { label: t('admin.storage.targets'), value: 'targets' },
          { label: t('admin.storage.deliveryPaths'), value: 'delivery' }
        ]`
      )
      q-separator.q-mr-md(vertical)
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        href='https://docs.js.wiki/admin/storage'
        target='_blank'
        type='a'
        )
      q-btn(
        unelevated
        icon='fa-solid fa-check'
        :label='t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :loading='state.loading > 0'
      )
  q-separator(inset)

  //- ==========================================
  //- TARGETS
  //- ==========================================

  .row.q-pa-md.q-col-gutter-md(v-if='state.displayMode === `targets`')
    .col-auto
      q-card.rounded-borders.bg-dark
        q-list(
          style='min-width: 350px;'
          padding
          dark
          )
          q-item(
            v-for='tgt of state.targets'
            :key='tgt.key'
            active-class='bg-primary text-white'
            :active='state.selectedTarget === tgt.id'
            :to='`/_admin/` + adminStore.currentSiteId + `/storage/` + tgt.id'
            clickable
            )
            q-item-section(side)
              q-icon(
                :name='`img:` + tgt.icon'
              )
            q-item-section
              q-item-label {{tgt.title}}
              q-item-label(caption, :class='getTargetSubtitleColor(tgt)') {{getTargetSubtitle(tgt)}}
            q-item-section(side)
              q-spinner-rings(:color='tgt.isEnabled ? `positive` : `negative`', size='sm')
    .col(v-if='state.target')
      //- -----------------------
      //- Content Types
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.storage.contentTypes')}}
          .text-body2.text-grey {{ t('admin.storage.contentTypesHint') }}
        q-item(tag='label')
          q-item-section(avatar)
            q-checkbox(
              v-model='state.target.contentTypes.activeTypes'
              :color='state.target.module === `db` ? `grey` : `primary`'
              val='pages'
              :aria-label='t(`admin.storage.contentTypePages`)'
              :disable='state.target.module === `db`'
              )
          q-item-section
            q-item-label {{t(`admin.storage.contentTypePages`)}}
            q-item-label(caption) {{t(`admin.storage.contentTypePagesHint`)}}
        q-item(tag='label')
          q-item-section(avatar)
            q-checkbox(
              v-model='state.target.contentTypes.activeTypes'
              color='primary'
              val='images'
              :aria-label='t(`admin.storage.contentTypeImages`)'
              )
          q-item-section
            q-item-label {{t(`admin.storage.contentTypeImages`)}}
            q-item-label(caption) {{t(`admin.storage.contentTypeImagesHint`)}}
        q-item(tag='label')
          q-item-section(avatar)
            q-checkbox(
              v-model='state.target.contentTypes.activeTypes'
              color='primary'
              val='documents'
              :aria-label='t(`admin.storage.contentTypeDocuments`)'
              )
          q-item-section
            q-item-label {{t(`admin.storage.contentTypeDocuments`)}}
            q-item-label(caption) {{t(`admin.storage.contentTypeDocumentsHint`)}}
        q-item(tag='label')
          q-item-section(avatar)
            q-checkbox(
              v-model='state.target.contentTypes.activeTypes'
              color='primary'
              val='others'
              :aria-label='t(`admin.storage.contentTypeOthers`)'
              )
          q-item-section
            q-item-label {{t(`admin.storage.contentTypeOthers`)}}
            q-item-label(caption) {{t(`admin.storage.contentTypeOthersHint`)}}
        q-item(tag='label')
          q-item-section(avatar)
            q-checkbox(
              v-model='state.target.contentTypes.activeTypes'
              color='primary'
              val='large'
              :aria-label='t(`admin.storage.contentTypeLargeFiles`)'
              )
          q-item-section
            q-item-label {{t(`admin.storage.contentTypeLargeFiles`)}}
            q-item-label(caption) {{t(`admin.storage.contentTypeLargeFilesHint`)}}
            q-item-label.text-deep-orange(v-if='state.target.module === `db`', caption) {{t(`admin.storage.contentTypeLargeFilesDBWarn`)}}
          q-item-section(side)
            q-input(
              outlined
              :label='t(`admin.storage.contentTypeLargeFilesThreshold`)'
              v-model='state.target.contentTypes.largeThreshold'
              style='min-width: 150px;'
              dense
            )

      //- -----------------------
      //- Content Delivery
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.storage.assetDelivery')}}
          .text-body2.text-grey {{ t('admin.storage.assetDeliveryHint') }}
        q-item(:tag='state.target.assetDelivery.isStreamingSupported ? `label` : null')
          q-item-section(avatar)
            q-checkbox(
              v-model='state.target.assetDelivery.streaming'
              :color='state.target.module === `db` || !state.target.assetDelivery.isStreamingSupported ? `grey` : `primary`'
              :aria-label='t(`admin.storage.contentTypePages`)'
              :disable='state.target.module === `db` || !state.target.assetDelivery.isStreamingSupported'
              )
          q-item-section
            q-item-label {{t(`admin.storage.assetStreaming`)}}
            q-item-label(caption) {{t(`admin.storage.assetStreamingHint`)}}
            q-item-label.text-deep-orange(v-if='!state.target.assetDelivery.isStreamingSupported', caption) {{t(`admin.storage.assetStreamingNotSupported`)}}
        q-item(:tag='state.target.assetDelivery.isDirectAccessSupported ? `label` : null')
          q-item-section(avatar)
            q-checkbox(
              v-model='state.target.assetDelivery.directAccess'
              :color='!state.target.assetDelivery.isDirectAccessSupported ? `grey` : `primary`'
              :aria-label='t(`admin.storage.contentTypePages`)'
              :disable='!state.target.assetDelivery.isDirectAccessSupported'
              )
          q-item-section
            q-item-label {{t(`admin.storage.assetDirectAccess`)}}
            q-item-label(caption) {{t(`admin.storage.assetDirectAccessHint`)}}
            q-item-label.text-deep-orange(v-if='!state.target.assetDelivery.isDirectAccessSupported', caption) {{t(`admin.storage.assetDirectAccessNotSupported`)}}

      //- -----------------------
      //- Setup
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md(v-if='state.target.setup && state.target.setup.handler && state.target.setup.state !== `configured`')
        q-card-section
          .text-subtitle1 {{t('admin.storage.setup')}}
          .text-body2.text-grey {{ t('admin.storage.setupHint') }}
        template(v-if='state.target.setup.handler === `github` && state.target.setup.state === `notconfigured`')
          q-item
            blueprint-icon(icon='test-account')
            q-item-section
              q-item-label GitHub Account Type
              q-item-label(caption) Whether to use an organization or personal GitHub account during setup.
            q-item-section.col-auto
              q-btn-toggle(
                v-model='state.target.setup.values.accountType'
                push
                glossy
                no-caps
                toggle-color='primary'
                :options=`[
                  { label: t('admin.storage.githubAccTypeOrg'), value: 'org' },
                  { label: t('admin.storage.githubAccTypePersonal'), value: 'personal' }
                ]`
              )
          q-separator.q-my-sm(inset)
          template(v-if='state.target.setup.values.accountType === `org`')
            q-item
              blueprint-icon(icon='github')
              q-item-section
                q-item-label {{ t('admin.storage.githubOrg') }}
                q-item-label(caption) {{ t('admin.storage.githubOrgHint') }}
              q-item-section
                q-input(
                  outlined
                  v-model='state.target.setup.values.org'
                  dense
                  :aria-label='t(`admin.storage.githubOrg`)'
                  )
            q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='dns')
            q-item-section
              q-item-label {{ t('admin.storage.githubPublicUrl') }}
              q-item-label(caption) {{ t('admin.storage.githubPublicUrlHint') }}
            q-item-section
              q-input(
                outlined
                v-model='state.target.setup.values.publicUrl'
                dense
                :aria-label='t(`admin.storage.githubPublicUrl`)'
                )
          q-card-section.q-pt-sm.text-right
            form(
              ref='githubSetupForm'
              method='POST'
              :action='setupCfg.action'
              )
              input(
                type='hidden'
                name='manifest'
                :value='setupCfg.manifest'
              )
              q-btn(
                unelevated
                icon='las la-angle-double-right'
                :label='t(`admin.storage.startSetup`)'
                color='secondary'
                @click='setupGitHub'
                :loading='setupCfg.loading'
              )
        template(v-else-if='state.target.setup.handler === `github` && state.target.setup.state === `pendinginstall`')
          q-card-section.q-py-none
            q-banner(
              rounded
              :class='$q.dark.isActive ? `bg-teal-9 text-white` : `bg-teal-1 text-teal-9`'
              ) {{t('admin.storage.githubFinish')}}
          q-card-section.q-pt-sm.text-right
            q-btn.q-mr-sm(
              unelevated
              icon='las la-times-circle'
              :label='t(`admin.storage.cancelSetup`)'
              color='negative'
              @click='setupDestroy'
            )
            q-btn(
              unelevated
              icon='las la-angle-double-right'
              :label='t(`admin.storage.finishSetup`)'
              color='secondary'
              @click='setupGitHubStep(`verify`)'
              :loading='setupCfg.loading'
            )
      q-card.shadow-1.q-pb-sm.q-mt-md(v-if='state.target.setup && state.target.setup.handler && state.target.setup.state === `configured`')
        q-card-section
          .text-subtitle1 {{t('admin.storage.setup')}}
          .text-body2.text-grey {{ t('admin.storage.setupConfiguredHint') }}
        q-item
          blueprint-icon.self-start(icon='matches', :hue-rotate='140')
          q-item-section
            q-item-label Uninstall
            q-item-label(caption) Delete the active configuration and start over the setup process.
            q-item-label.text-red(caption): strong This action cannot be undone!
          q-item-section(side)
            q-btn.acrylic-btn(
              flat
              icon='las la-arrow-circle-right'
              color='negative'
              @click='setupDestroy'
              :label='t(`admin.storage.uninstall`)'
            )

      //- -----------------------
      //- Configuration
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.storage.config')}}
          q-banner.q-mt-md(
            v-if='!state.target.config || Object.keys(state.target.config).length < 1'
            rounded
            :class='$q.dark.isActive ? `bg-negative text-white` : `bg-grey-2 text-grey-7`'
            ) {{t('admin.storage.noConfigOption')}}
        template(
          v-for='(cfg, cfgKey, idx) in state.target.config'
          )
          template(
            v-if='configIfCheck(cfg.if)'
            )
            q-separator.q-my-sm(inset, v-if='idx > 0')
            q-item(v-if='cfg.type === `Boolean`', tag='label')
              blueprint-icon(:icon='cfg.icon', :hue-rotate='cfg.readOnly ? -45 : 0')
              q-item-section
                q-item-label {{cfg.title}}
                q-item-label(caption) {{cfg.hint}}
              q-item-section(avatar)
                q-toggle(
                  v-model='cfg.value'
                  color='primary'
                  checked-icon='las la-check'
                  unchecked-icon='las la-times'
                  :aria-label='t(`admin.general.allowComments`)'
                  :disable='cfg.readOnly'
                  )
            q-item(v-else)
              blueprint-icon(:icon='cfg.icon', :hue-rotate='cfg.readOnly ? -45 : 0')
              q-item-section
                q-item-label {{cfg.title}}
                q-item-label(caption) {{cfg.hint}}
              q-item-section(
                :style='cfg.type === `Number` ? `flex: 0 0 150px;` : ``'
                :class='{ "col-auto": cfg.enum && cfg.enumDisplay === `buttons` }'
                )
                q-btn-toggle(
                  v-if='cfg.enum && cfg.enumDisplay === `buttons`'
                  v-model='cfg.value'
                  push
                  glossy
                  no-caps
                  toggle-color='primary'
                  :options=`cfg.enum`
                  :disable='cfg.readOnly'
                )
                q-select(
                  v-else-if='cfg.enum'
                  outlined
                  v-model='cfg.value'
                  :options='cfg.enum'
                  emit-value
                  map-options
                  dense
                  options-dense
                  :aria-label='cfg.title'
                  :disable='cfg.readOnly'
                )
                q-input(
                  v-else
                  outlined
                  v-model='cfg.value'
                  dense
                  :type='cfg.multiline ? `textarea` : `input`'
                  :aria-label='cfg.title'
                  :disable='cfg.readOnly'
                  )

      //- -----------------------
      //- Sync
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md(v-if='state.target.sync && Object.keys(state.target.sync).length > 0')
        q-card-section
          .text-subtitle1 {{t('admin.storage.sync')}}
          q-banner.q-mt-md(
            rounded
            :class='$q.dark.isActive ? `bg-negative text-white` : `bg-grey-2 text-grey-7`'
            ) {{t('admin.storage.noSyncModes')}}

      //- -----------------------
      //- Actions
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.storage.actions')}}
          q-banner.q-mt-md(
            v-if='!state.target.actions || state.target.actions.length < 1'
            rounded
            :class='$q.dark.isActive ? `bg-negative text-white` : `bg-grey-2 text-grey-7`'
            ) {{t('admin.storage.noActions')}}
          q-banner.q-mt-md(
            v-else-if='!state.target.isEnabled'
            rounded
            :class='$q.dark.isActive ? `bg-negative text-white` : `bg-grey-2 text-grey-7`'
            ) {{t('admin.storage.actionsInactiveWarn')}}

        template(
          v-if='state.target.isEnabled'
          v-for='(act, idx) in state.target.actions'
          )
          q-separator.q-my-sm(inset, v-if='idx > 0')
          q-item
            blueprint-icon.self-start(:icon='act.icon', :hue-rotate='45')
            q-item-section
              q-item-label {{act.label}}
              q-item-label(caption) {{act.hint}}
              q-item-label.text-red(v-if='act.warn', caption): strong {{act.warn}}
            q-item-section(side)
              q-btn.acrylic-btn(
                flat
                icon='las la-arrow-circle-right'
                color='primary'
                @click=''
                :label='t(`common.actions.proceed`)'
              )

    .col-auto(v-if='state.target')
      //- -----------------------
      //- Infobox
      //- -----------------------
      q-card.rounded-borders.q-pb-md(style='width: 350px;')
        q-card-section
          .text-subtitle1 {{state.target.title}}
          q-img.q-mt-sm.rounded-borders(
            :src='target.banner'
            fit='cover'
            no-spinner
          )
          .text-body2.q-mt-md {{state.target.description}}
        q-separator.q-mb-sm(inset)
        q-item
          q-item-section
            q-item-label.text-grey {{t(`admin.storage.vendor`)}}
            q-item-label {{state.target.vendor}}
        q-separator.q-my-sm(inset)
        q-item
          q-item-section
            q-item-label.text-grey {{t(`admin.storage.vendorWebsite`)}}
            q-item-label: a(:href='state.target.website', target='_blank', rel='noreferrer') {{state.target.website}}

      //- -----------------------
      //- Status
      //- -----------------------
      q-card.rounded-borders.q-pb-md.q-mt-md(style='width: 350px;')
        q-card-section
          .text-subtitle1 Status
        template(v-if='state.target.module !== `db` && !(state.target.setup && state.target.setup.handler && state.target.setup.state !== `configured`)')
          q-item(tag='label')
            q-item-section
              q-item-label {{t(`admin.storage.enabled`)}}
              q-item-label(caption) {{t(`admin.storage.enabledHint`)}}
              q-item-label.text-deep-orange(v-if='state.target.module === `db`', caption) {{t(`admin.storage.enabledForced`)}}
            q-item-section(avatar)
              q-toggle(
                v-model='state.target.isEnabled'
                :disable='state.target.module === `db` || (state.target.setup && state.target.setup.handler && state.target.setup.state !== `configured`)'
                color='primary'
                checked-icon='las la-check'
                unchecked-icon='las la-times'
                :aria-label='t(`admin.general.allowSearch`)'
                )
          q-separator.q-my-sm(inset)
        q-item
          q-item-section
            q-item-label.text-grey {{t(`admin.storage.currentState`)}}
            q-item-label.text-positive No issues detected.

      //- -----------------------
      //- Versioning
      //- -----------------------
      q-card.rounded-borders.q-pb-md.q-mt-md(style='width: 350px;')
        q-card-section
          .text-subtitle1 {{t(`admin.storage.versioning`)}}
          .text-body2.text-grey {{t(`admin.storage.versioningHint`)}}
        q-item(:tag='state.target.versioning.isSupported ? `label` : null')
          q-item-section
            q-item-label {{t(`admin.storage.useVersioning`)}}
            q-item-label(caption) {{t(`admin.storage.useVersioningHint`)}}
            q-item-label.text-deep-orange(v-if='!state.target.versioning.isSupported', caption) {{t(`admin.storage.versioningNotSupported`)}}
            q-item-label.text-deep-orange(v-if='state.target.versioning.isForceEnabled', caption) {{t(`admin.storage.versioningForceEnabled`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.target.versioning.enabled'
              :disable='!state.target.versioning.isSupported || state.target.versioning.isForceEnabled'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.storage.useVersioning`)'
              )

  //- ==========================================
  //- DELIVERY PATHS
  //- ==========================================

  .row.q-pa-md.q-col-gutter-md(v-if='state.displayMode === `delivery`')
    .col
      q-card.rounded-borders
        q-card-section.flex.items-center
          .text-caption.q-mr-sm {{ t('admin.storage.deliveryPathsLegend') }}
          q-chip(square, dense, color='blue-1', text-color='blue-8')
            q-avatar(icon='las la-ellipsis-h', color='blue', text-color='white')
            span.text-caption.q-px-sm {{ t('admin.storage.deliveryPathsUserRequest') }}
          q-chip(square, dense, color='teal-1', text-color='teal-8')
            q-avatar(icon='las la-ellipsis-h', color='positive', text-color='white')
            span.text-caption.q-px-sm {{ t('admin.storage.deliveryPathsPushToOrigin') }}
          q-chip(square, dense, color='red-1', text-color='red-8')
            q-avatar(icon='las la-minus', color='negative', text-color='white')
            span.text-caption.q-px-sm {{ t('admin.storage.missingOrigin') }}
        q-separator
        v-network-graph(
          :zoom-level='2'
          :configs='state.deliveryConfig'
          :nodes='state.deliveryNodes'
          :edges='state.deliveryEdges'
          :paths='state.deliveryPaths'
          :layouts='state.deliveryLayouts'
          style='height: 600px;'
          )
          template(#override-node='{ nodeId, scale, config, ...slotProps }')
            rect(
              :rx='config.borderRadius * scale'
              :x='-config.radius * scale'
              :y='-config.radius * scale'
              :width='config.radius * scale * 2'
              :height='config.radius * scale * 2'
              :fill='config.color'
              v-bind='slotProps'
              )
            image(
              v-if='state.deliveryNodes[nodeId].icon && state.deliveryNodes[nodeId].icon.endsWith(`.svg`)'
              :x='(-config.radius + 5) * scale'
              :y='(-config.radius + 5) * scale'
              :width='(config.radius - 5) * scale * 2'
              :height='(config.radius - 5) * scale * 2'
              :xlink:href='state.deliveryNodes[nodeId].icon'
            )
            text(
              v-if='state.deliveryNodes[nodeId].icon && state.deliveryNodes[nodeId].iconText'
              :class='state.deliveryNodes[nodeId].icon'
              :font-size='22 * scale'
              fill='#ffffff'
              text-anchor='middle'
              dominant-baseline='central'
              v-html='state.deliveryNodes[nodeId].iconText'
            )

  //-             .overline.my-5 {{t('admin.storage.syncDirection')}}
  //-             .body-2.ml-3 {{t('admin.storage.syncDirectionSubtitle')}}
  //-             .pr-3.pt-3
  //-               v-radio-group.ml-3.py-0(v-model='target.mode')
  //-                 v-radio(
  //-                   :label='t(`admin.storage.syncDirBi`)'
  //-                   color='primary'
  //-                   value='sync'
  //-                   :disabled='target.supportedModes.indexOf(`sync`) < 0'
  //-                 )
  //-                 v-radio(
  //-                   :label='t(`admin.storage.syncDirPush`)'
  //-                   color='primary'
  //-                   value='push'
  //-                   :disabled='target.supportedModes.indexOf(`push`) < 0'
  //-                 )
  //-                 v-radio(
  //-                   :label='t(`admin.storage.syncDirPull`)'
  //-                   color='primary'
  //-                   value='pull'
  //-                   :disabled='target.supportedModes.indexOf(`pull`) < 0'
  //-                 )
  //-             .body-2.ml-3
  //-               strong {{t('admin.storage.syncDirBi')}} #[em.red--text.text--lighten-2(v-if='target.supportedModes.indexOf(`sync`) < 0') {{t('admin.storage.unsupported')}}]
  //-               .pb-3 {{t('admin.storage.syncDirBiHint')}}
  //-               strong {{t('admin.storage.syncDirPush')}} #[em.red--text.text--lighten-2(v-if='target.supportedModes.indexOf(`push`) < 0') {{t('admin.storage.unsupported')}}]
  //-               .pb-3 {{t('admin.storage.syncDirPushHint')}}
  //-               strong {{t('admin.storage.syncDirPull')}} #[em.red--text.text--lighten-2(v-if='target.supportedModes.indexOf(`pull`) < 0') {{t('admin.storage.unsupported')}}]
  //-               .pb-3 {{t('admin.storage.syncDirPullHint')}}

  //-             template(v-if='target.hasSchedule')
  //-               v-divider.mt-3
  //-               .overline.my-5 {{t('admin.storage.syncSchedule')}}
  //-               .body-2.ml-3 {{t('admin.storage.syncScheduleHint')}}
  //-               .pa-3
  //-                 duration-picker(v-model='target.syncInterval')
  //-                 i18next.caption.mt-3(path='admin.storage.syncScheduleCurrent', tag='div')
  //-                   strong(place='schedule') {{getDefaultSchedule(target.syncInterval)}}
  //-                 i18next.caption(path='admin.storage.syncScheduleDefault', tag='div')
  //-                   strong(place='schedule') {{getDefaultSchedule(target.syncIntervalDefault)}}

</template>

<script setup>
import find from 'lodash/find'
import cloneDeep from 'lodash/cloneDeep'
import gql from 'graphql-tag'
import transform from 'lodash/transform'
import * as VNetworkGraph from 'v-network-graph'

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useAdminStore } from 'src/stores/admin'
import { useSiteStore } from 'src/stores/site'
import { useDataStore } from 'src/stores/data'

import GithubSetupInstallDialog from '../components/GithubSetupInstallDialog.vue'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()
const dataStore = useDataStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.storage.title')
})

// DATA

const state = reactive({
  loading: 0,
  displayMode: 'targets',
  runningAction: false,
  runningActionHandler: '',
  selectedTarget: '',
  desiredTarget: '',
  target: null,
  targets: [],
  setupCfg: {
    action: '',
    manifest: '',
    loading: false
  },
  deliveryNodes: {},
  deliveryEdges: {},
  deliveryLayouts: {
    nodes: {}
  },
  deliveryPaths: [],
  deliveryConfig: VNetworkGraph.defineConfigs({
    view: {
      layoutHandler: new VNetworkGraph.GridLayout({ grid: 15 }),
      fit: true,
      mouseWheelZoomEnabled: false,
      grid: {
        visible: true,
        interval: 2.5,
        thickIncrements: 0
      }
    },
    node: {
      draggable: false,
      selectable: true,
      normal: {
        type: 'rect',
        color: node => node.color || '#1976D2',
        borderRadius: node => node.borderRadius || 5
      },
      label: {
        margin: 8
      }
    },
    edge: {
      normal: {
        width: 3,
        dasharray: edge => edge.animate === false ? 20 : 3,
        animate: edge => !(edge.animate === false),
        animationSpeed: edge => edge.animationSpeed || 50,
        color: edge => edge.color || '#1976D2'
      },
      type: 'straight',
      gap: 7,
      margin: 4,
      marker: {
        source: {
          type: 'none'
        },
        target: {
          type: 'none'
        }
      }
    },
    path: {
      visible: true,
      end: 'edgeOfNode',
      margin: 4,
      path: {
        width: 7,
        color: p => p.color,
        linecap: 'square'
      }
    }
  })
})

// REFS

const githubSetupForm = ref(null)

// WATCHERS

watch(() => adminStore.currentSiteId, async (newValue) => {
  await load()
  nextTick(() => {
    router.replace(`/_admin/${newValue}/storage/${state.selectedTarget}`)
  })
})
watch(() => state.displayMode, (newValue) => {
  if (newValue === 'delivery') {
    generateGraph()
  }
})
watch(() => state.selectedTarget, (newValue) => {
  state.target = find(state.targets, ['id', newValue]) || null
})
watch(() => state.targets, (newValue) => {
  if (newValue && newValue.length > 0) {
    if (state.desiredTarget) {
      state.selectedTarget = state.desiredTarget
      state.desiredTarget = ''
    } else {
      state.selectedTarget = find(state.targets, ['module', 'db'])?.id || null
      if (!route.params.id) {
        router.replace(`/_admin/${adminStore.currentSiteId}/storage/${state.selectedTarget}`)
      }
    }
    handleSetupCallback()
  }
})
watch(() => route, (to, from) => {
  if (!to.params.id) {
    return
  }
  if (state.targets.length < 1) {
    state.desiredTarget = to.params.id
  } else {
    state.selectedTarget = to.params.id
  }
})

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query getStorageTargets (
          $siteId: UUID!
        ) {
        storageTargets (
          siteId: $siteId
        ) {
          id
          isEnabled
          module
          title
          description
          icon
          banner
          vendor
          website
          contentTypes
          assetDelivery
          versioning
          sync
          status
          setup
          config
          actions
        }
      }`,
      variables: {
        siteId: adminStore.currentSiteId
      },
      fetchPolicy: 'network-only'
    })
    state.targets = cloneDeep(resp?.data?.storageTargets)
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to load storage configuration.',
      caption: err.message,
      timeout: 20000
    })
  }
  $q.loading.hide()
  state.loading--
}

function configIfCheck (ifs) {
  if (!ifs || ifs.length < 1) { return true }
  return ifs.every(s => state.target.config[s.key]?.value === s.eq)
}

async function refresh () {
  await load()
  $q.notify({
    type: 'positive',
    message: 'List of storage targets has been refreshed.'
  })
}

async function save ({ silent }) {
  let saveSuccess = false
  if (!silent) { $q.loading.show() }
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation (
          $siteId: UUID!
          $targets: [StorageTargetInput]!
          ) {
          updateStorageTargets(
            siteId: $siteId
            targets: $targets
          ) {
            status {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        siteId: adminStore.currentSiteId,
        targets: state.targets.map(tgt => ({
          id: tgt.id,
          module: tgt.module,
          isEnabled: tgt.isEnabled,
          contentTypes: tgt.contentTypes.activeTypes,
          largeThreshold: tgt.contentTypes.largeThreshold,
          assetDeliveryFileStreaming: tgt.assetDelivery.streaming,
          assetDeliveryDirectAccess: tgt.assetDelivery.directAccess,
          useVersioning: tgt.versioning.enabled,
          config: transform(tgt.config, (r, v, k) => { r[k] = v.value }, {})
        }))
      }
    })
    if (resp?.data?.updateStorageTargets?.status?.succeeded) {
      saveSuccess = true
      if (!silent) {
        $q.notify({
          type: 'positive',
          message: t('admin.storage.saveSuccess')
        })
      }
    } else {
      throw new Error(resp?.data?.updateStorageTargets?.status?.message || 'Unexpected error')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('admin.storage.saveFailed'),
      caption: err.message
    })
  }
  if (!silent) { $q.loading.hide() }
  return saveSuccess
}

function getTargetSubtitle (target) {
  if (!target.isEnabled) {
    return t('admin.storage.inactiveTarget')
  }
  const hasPages = target.contentTypes?.activeTypes?.includes('pages')
  const hasAssets = target.contentTypes?.activeTypes?.filter(c => c !== 'pages')?.length > 0
  if (hasPages && hasAssets) {
    return t('admin.storage.pagesAndAssets')
  } else if (hasPages) {
    return t('admin.storage.pagesOnly')
  } else if (hasAssets) {
    return t('admin.storage.assetsOnly')
  } else {
    return t('admin.storage.notConfigured')
  }
}

function getTargetSubtitleColor (target) {
  if (state.selectedTarget === target.id) {
    return 'text-blue-2'
  } else if (target.isEnabled) {
    return 'text-positive'
  } else {
    return 'text-grey-7'
  }
}

function getDefaultSchedule (val) {
  if (!val) { return 'N/A' }
  return '' // moment.duration(val).format('y [years], M [months], d [days], h [hours], m [minutes]')
}

async function executeAction (targetKey, handler) {
  // this.$store.commit('loadingStart', 'admin-storage-executeaction')
  // this.runningAction = true
  // this.runningActionHandler = handler
  // try {
  //   await this.$apollo.mutate({
  //     mutation: gql`{}`,
  //     variables: {
  //       targetKey,
  //       handler
  //     }
  //   })
  //   this.$store.commit('showNotification', {
  //     message: 'Action completed.',
  //     style: 'success',
  //     icon: 'check'
  //   })
  // } catch (err) {
  //   console.warn(err)
  // }
  // this.runningAction = false
  // this.runningActionHandler = ''
  // this.$store.commit('loadingStop', 'admin-storage-executeaction')
}

async function handleSetupCallback () {
  if (state.targets.length < 1 || !state.selectedTarget) { return }

  nextTick(() => {
    if (state.target?.setup?.handler === 'github' && route.query.code) {
      setupGitHubStep('connect', route.query.code)
    }
  })
}

async function setupDestroy () {
  $q.dialog({
    title: t('admin.storage.destroyConfirm'),
    message: t('admin.storage.destroyConfirmInfo'),
    cancel: true,
    persistent: true
  }).onOk(async () => {
    $q.loading.show({
      message: t('admin.storage.destroyingSetup')
    })

    try {
      const resp = await APOLLO_CLIENT.mutate({
        mutation: gql`
          mutation (
            $targetId: UUID!
            ) {
            destroyStorageTargetSetup(
              targetId: $targetId
            ) {
              status {
                succeeded
                message
              }
            }
          }
        `,
        variables: {
          targetId: state.selectedTarget
        }
      })
      if (resp?.data?.destroyStorageTargetSetup?.status?.succeeded) {
        state.target.setup.state = 'notconfigured'
        setTimeout(() => {
          $q.loading.hide()
          $q.notify({
            type: 'positive',
            message: t('admin.storage.githubSetupDestroySuccess')
          })
        }, 2000)
      } else {
        throw new Error(resp?.data?.destroyStorageTargetSetup?.status?.message || 'Unexpected error')
      }
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: t('admin.storage.githubSetupDestroyFailed'),
        caption: err.message
      })
      $q.loading.hide()
    }
  })
}

async function setupGitHub () {
  // -> Format values
  state.target.setup.values.publicUrl = state.target.setup.values.publicUrl.toLowerCase()

  // -> Basic input check
  if (state.target.setup.values.accountType === 'org' && state.target.setup.values.org.length < 1) {
    return $q.notify({
      type: 'negative',
      message: 'Invalid GitHub Organization',
      caption: 'Enter a valid github organization.'
    })
  }
  if (state.target.setup.values.publicUrl.length < 11 || !/^https?:\/\/.{4,}$/.test(state.target.setup.values.publicUrl)) {
    return $q.notify({
      type: 'negative',
      message: 'Invalid Wiki Public URL',
      caption: 'Enter a valid public URL for your wiki.'
    })
  }

  if (state.target.setup.values.publicUrl.endsWith('/')) {
    state.target.setup.values.publicUrl = state.target.setup.values.publicUrl.slice(0, -1)
  }

  // -> Generate manifest
  state.setupCfg.loading = true
  if (state.target.setup.values.accountType === 'org') {
    state.setupCfg.action = `https://github.com/organizations/${state.target.setup.values.org}/settings/apps/new`
  } else {
    state.setupCfg.action = 'https://github.com/settings/apps/new'
  }
  state.setupCfg.manifest = JSON.stringify({
    name: `Wiki.js - ${adminStore.currentSiteId.slice(-12)}`,
    description: 'Connects your Wiki.js to GitHub repositories and synchronize their contents.',
    url: state.target.setup.values.publicUrl,
    hook_attributes: {
      url: `${state.target.setup.values.publicUrl}/_github/${adminStore.currentSiteId}/events`
    },
    redirect_url: `${state.target.setup.values.publicUrl}/_admin/${adminStore.currentSiteId}/storage/${state.target.id}`,
    callback_urls: [
      `${state.target.setup.values.publicUrl}/_admin/${adminStore.currentSiteId}/storage/${state.target.id}`
    ],
    public: false,
    default_permissions: {
      contents: 'write',
      metadata: 'read',
      members: 'read'
    },
    default_events: [
      'create',
      'delete',
      'push'
    ]
  })
  $q.loading.show({
    message: t('admin.storage.githubPreparingManifest')
  })
  if (await save({ silent: true })) {
    githubSetupForm.value.submit()
  } else {
    state.setupCfg.loading = false
    $q.loading.hide()
  }
}

async function setupGitHubStep (step, code) {
  $q.loading.show({
    message: t('admin.storage.githubVerifying')
  })

  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation (
          $targetId: UUID!
          $state: JSON!
          ) {
          setupStorageTarget(
            targetId: $targetId
            state: $state
          ) {
            status {
              succeeded
              message
            }
            state
          }
        }
      `,
      variables: {
        targetId: this.selectedTarget,
        state: {
          step,
          ...code && { code }
        }
      }
    })
    if (resp?.data?.setupStorageTarget?.status?.succeeded) {
      switch (resp.data.setupStorageTarget.state?.nextStep) {
        case 'installApp': {
          router.replace({ query: null })
          $q.loading.hide()

          $q.dialog({
            component: GithubSetupInstallDialog,
            persistent: true
          }).onOk(() => {
            $q.loading.show({
              message: t('admin.storage.githubRedirecting')
            })
            window.location.assign(resp.data.setupStorageTarget.state?.url)
          }).onCancel(() => {
            throw new Error('Setup was aborted prematurely.')
          })
          break
        }
        case 'completed': {
          this.target.isEnabled = true
          this.target.setup.state = 'configured'
          setTimeout(() => {
            $q.loading.hide()
            $q.notify({
              type: 'positive',
              message: t('admin.storage.githubSetupSuccess')
            })
          }, 2000)
          break
        }
        default: {
          throw new Error('Unknown Setup Step')
        }
      }
    } else {
      throw new Error(resp?.data?.setupStorageTarget?.status?.message || 'Unexpected error')
    }
  } catch (err) {
    $q.loading.hide()
    $q.notify({
      type: 'negative',
      message: t('admin.storage.githubSetupFailed'),
      caption: err.message
    })
  }
}

function generateGraph () {
  const types = [
    { key: 'images', label: t('admin.storage.contentTypeImages'), icon: 'las', iconText: '&#xf1c5;' },
    { key: 'documents', label: t('admin.storage.contentTypeDocuments'), icon: 'las', iconText: '&#xf1c1;' },
    { key: 'others', label: t('admin.storage.contentTypeOthers'), icon: 'las', iconText: '&#xf15b;' },
    { key: 'large', label: t('admin.storage.contentTypeLargeFiles'), icon: 'las', iconText: '&#xf1c6;' }
  ]

  // -> Create PagesNodes

  state.deliveryNodes = {
    user: { name: t('admin.storage.deliveryPathsUser'), borderRadius: 16, icon: '/_assets/icons/fluent-account.svg' },
    pages: { name: t('admin.storage.contentTypePages'), color: '#3f51b5', icon: 'las', iconText: '&#xf15c;' },
    pages_wiki: { name: 'Wiki.js', icon: '/_assets/logo-wikijs.svg', color: '#161b22' }
  }
  state.deliveryEdges = {
    user_pages: { source: 'user', target: 'pages' },
    pages_in: { source: 'pages', target: 'pages_wiki' },
    pages_out: { source: 'pages_wiki', target: 'pages' }
  }
  state.deliveryLayouts.nodes = {
    user: { x: -30, y: 30 },
    pages: { x: 0, y: 0 },
    pages_wiki: { x: 60, y: 0 }
  }
  state.deliveryPaths = []

  // -> Create Asset Nodes

  for (const [i, tp] of types.entries()) {
    state.deliveryNodes[tp.key] = { name: tp.label, color: '#3f51b5', icon: tp.icon, iconText: tp.iconText }
    state.deliveryEdges[`user_${tp.key}`] = { source: 'user', target: t.key }
    state.deliveryLayouts.nodes[tp.key] = { x: 0, y: (i + 1) * 15 }

    // -> Find target with direct access
    const dt = find(state.targets, tgt => {
      return tgt.module !== 'db' && tgt.contentTypes.activeTypes.includes(tp.key) && tgt.isEnabled && tgt.assetDelivery.isDirectAccessSupported && tgt.assetDelivery.directAccess
    })

    if (dt) {
      state.deliveryNodes[`${tp.key}_${dt.module}`] = { name: dt.title, icon: dt.icon }
      state.deliveryNodes[`${tp.key}_wiki`] = { name: 'Wiki.js', icon: '/_assets/logo-wikijs.svg', color: '#161b22' }
      state.deliveryLayouts.nodes[`${tp.key}_${dt.module}`] = { x: 60, y: (i + 1) * 15 }
      state.deliveryLayouts.nodes[`${tp.key}_wiki`] = { x: 120, y: (i + 1) * 15 }
      state.deliveryEdges[`${tp.key}_${dt.module}_in`] = { source: tp.key, target: `${tp.key}_${dt.module}` }
      state.deliveryEdges[`${tp.key}_${dt.module}_out`] = { source: `${tp.key}_${dt.module}`, target: tp.key }
      state.deliveryEdges[`${tp.key}_${dt.module}_wiki`] = { source: `${tp.key}_wiki`, target: `${tp.key}_${dt.module}`, color: '#02c39a', animationSpeed: 25 }
      continue
    }

    // -> Find target with streaming

    const st = find(state.targets, tgt => {
      return tgt.module !== 'db' && tgt.contentTypes.activeTypes.includes(tp.key) && tgt.isEnabled && tgt.assetDelivery.isStreamingSupported && tgt.assetDelivery.streaming
    })

    if (st) {
      state.deliveryNodes[`${tp.key}_${st.module}`] = { name: st.title, icon: st.icon }
      state.deliveryNodes[`${tp.key}_wiki`] = { name: 'Wiki.js', icon: '/_assets/logo-wikijs.svg', color: '#161b22' }
      state.deliveryLayouts.nodes[`${tp.key}_${st.module}`] = { x: 120, y: (i + 1) * 15 }
      state.deliveryLayouts.nodes[`${tp.key}_wiki`] = { x: 60, y: (i + 1) * 15 }
      state.deliveryEdges[`${tp.key}_wiki_in`] = { source: tp.key, target: `${tp.key}_wiki` }
      state.deliveryEdges[`${tp.key}_wiki_out`] = { source: `${tp.key}_wiki`, target: tp.key }
      state.deliveryEdges[`${tp.key}_${st.module}_out`] = { source: `${tp.key}_${st.module}`, target: `${tp.key}_wiki` }
      state.deliveryEdges[`${tp.key}_${st.module}_in`] = { source: `${tp.key}_wiki`, target: `${tp.key}_${st.module}` }
      state.deliveryEdges[`${tp.key}_${st.module}_wiki`] = { source: `${tp.key}_wiki`, target: `${tp.key}_${st.module}`, color: '#02c39a', animationSpeed: 25 }
      continue
    }

    // -> Check DB fallback

    const dbt = find(state.targets, ['module', 'db'])
    if (dbt.contentTypes.activeTypes.includes(tp.key)) {
      state.deliveryNodes[`${tp.key}_wiki`] = { name: 'Wiki.js', icon: '/_assets/logo-wikijs.svg', color: '#161b22' }
      state.deliveryLayouts.nodes[`${tp.key}_wiki`] = { x: 60, y: (i + 1) * 15 }
      state.deliveryEdges[`${tp.key}_db_in`] = { source: tp.key, target: `${tp.key}_wiki` }
      state.deliveryEdges[`${tp.key}_db_out`] = { source: `${tp.key}_wiki`, target: tp.key }
    } else {
      state.deliveryNodes[`${tp.key}_wiki`] = { name: t('admin.storage.missingOrigin'), color: '#f03a47', icon: 'las', iconText: '&#xf071;' }
      state.deliveryLayouts.nodes[`${tp.key}_wiki`] = { x: 60, y: (i + 1) * 15 }
      state.deliveryEdges[`${tp.key}_db_in`] = { source: tp.key, target: `${tp.key}_wiki`, color: '#f03a47', animate: false }
      state.deliveryPaths.push({ edges: [`${tp.key}_db_in`], color: '#f03a4755' })
    }
  }
}

// MOUNTED

onMounted(() => {
  if (!state.selectedTarget && route.params.id) {
    if (state.targets.length < 1) {
      state.desiredTarget = route.params.id
    } else {
      state.selectedTarget = route.params.id
    }
  }
  if (adminStore.currentSiteId) {
    load()
  }
  handleSetupCallback()
})

</script>

<style lang='scss' scoped>

.admin-storage-logo {
  border-radius: 5px;
}

</style>
