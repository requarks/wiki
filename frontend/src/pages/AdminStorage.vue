<template>
  <w-page class="admin-storage">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-ssd-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.storage.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.storage.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex">
        <w-spinner class="mr-4" v-show="state.loading > 0" color="accent" size="sm" />
        <w-btn-toggle
          class="mr-4"
          v-model="state.displayMode"
          push
          no-caps
          :toggle-color="dark.isActive ? `white` : `black`"
          :toggle-text-color="dark.isActive ? `black` : `white`"
          :text-color="dark.isActive ? `white` : `black`"
          :color="dark.isActive ? `dark-1` : `white`"
          :options="[
            { label: t('admin.storage.targets'), value: 'targets' },
            { label: t('admin.storage.deliveryPaths'), value: 'delivery' }
          ]" />
        <w-separator class="mr-4" vertical />
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/storage`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          unelevated
          icon="mdi:check"
          :label="t(`common.actions.apply`)"
          color="secondary"
          @click="save()"
          :loading="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <!-- ========================================== -->
    <!-- TARGETS -->
    <!-- ========================================== -->
    <div class="flex flex-wrap p-4 gap-4" v-if="state.displayMode === `targets`">
      <div class="flex-none">
        <w-card class="rounded bg-dark">
          <w-list style="min-width: 300px" padding dark>
            <w-item
              v-for="tgt of state.targets"
              :key="tgt.id"
              active-class="bg-primary text-white"
              :active="state.selectedTarget === tgt.id"
              :to="`/_admin/` + adminStore.currentSiteId + `/storage/` + tgt.id"
              clickable>
              <w-item-section side><w-icon :name="`img:` + tgt.icon" /></w-item-section>
              <w-item-section>
                <w-item-label>{{ tgt.title }}</w-item-label>
                <w-item-label caption :class="getTargetSubtitleColor(tgt)">{{
                  getTargetSubtitle(tgt)
                }}</w-item-label>
              </w-item-section>
              <w-item-section side>
                <status-light
                  :color="tgt.isEnabled ? `positive` : `negative`"
                  :pulse="tgt.isEnabled" />
              </w-item-section>
            </w-item>
          </w-list>
        </w-card>
      </div>
      <div class="min-w-0 flex-1" v-if="state.target">
        <div class="grid grid-cols-12 gap-4">
          <div class="col-span-12">
            <!-- ----------------------- -->
            <!-- Setup -->
            <!-- ----------------------- -->
            <w-card
              class="pb-2 mb-4"
              v-if="
                state.target.setup &&
                state.target.setup.handler &&
                state.target.setup.state !== `configured`
              ">
              <w-card-header>
                {{ t('admin.storage.setup') }}
                <template #hint>{{ t('admin.storage.setupHint') }}</template>
              </w-card-header>
              <template
                v-if="
                  state.target.setup.handler === `github` &&
                  state.target.setup.state === `notconfigured`
                ">
                <w-item>
                  <blueprint-icon icon="test-account" />
                  <w-item-section>
                    <w-item-label>GitHub Account Type</w-item-label>
                    <w-item-label caption
                      >Whether to use an organization or personal GitHub account during
                      setup.</w-item-label
                    >
                  </w-item-section>
                  <w-item-section class="flex-none">
                    <w-btn-toggle
                      v-model="state.target.setup.values.accountType"
                      push
                      glossy
                      no-caps
                      toggle-color="primary"
                      :options="[
                        { label: t('admin.storage.githubAccTypeOrg'), value: 'org' },
                        { label: t('admin.storage.githubAccTypePersonal'), value: 'personal' }
                      ]" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <template v-if="state.target.setup.values.accountType === `org`">
                  <w-item>
                    <blueprint-icon icon="github" />
                    <w-item-section>
                      <w-item-label>{{ t('admin.storage.githubOrg') }}</w-item-label>
                      <w-item-label caption>{{ t('admin.storage.githubOrgHint') }}</w-item-label>
                    </w-item-section>
                    <w-item-section>
                      <w-input
                        outlined
                        v-model="state.target.setup.values.org"
                        dense
                        :aria-label="t(`admin.storage.githubOrg`)" />
                    </w-item-section>
                  </w-item>
                  <w-separator class="my-2" inset />
                </template>
                <w-item>
                  <blueprint-icon icon="dns" />
                  <w-item-section>
                    <w-item-label>{{ t('admin.storage.githubPublicUrl') }}</w-item-label>
                    <w-item-label caption>{{
                      t('admin.storage.githubPublicUrlHint')
                    }}</w-item-label>
                  </w-item-section>
                  <w-item-section>
                    <w-input
                      outlined
                      v-model="state.target.setup.values.publicUrl"
                      dense
                      :aria-label="t(`admin.storage.githubPublicUrl`)" />
                  </w-item-section>
                </w-item>
                <w-card-section class="pt-2 text-right">
                  <form ref="githubSetupForm" method="POST" :action="state.setupCfg.action">
                    <input type="hidden" name="manifest" :value="state.setupCfg.manifest" />
                    <w-btn
                      unelevated
                      icon="la:angle-double-right"
                      :label="t(`admin.storage.startSetup`)"
                      color="secondary"
                      @click="setupGitHub"
                      :loading="state.setupCfg.loading" />
                  </form>
                </w-card-section>
              </template>
              <template
                v-else-if="
                  state.target.setup.handler === `github` &&
                  state.target.setup.state === `pendinginstall`
                ">
                <w-card-section class="py-0">
                  <w-banner
                    :class="dark.isActive ? `bg-teal-9 text-white` : `bg-teal-1 text-teal-9`"
                    >{{ t('admin.storage.githubFinish') }}</w-banner
                  >
                </w-card-section>
                <w-card-section class="pt-2 text-right">
                  <w-btn
                    class="mr-2"
                    unelevated
                    icon="la:times-circle"
                    :label="t(`admin.storage.cancelSetup`)"
                    color="negative"
                    @click="setupDestroy" />
                  <w-btn
                    unelevated
                    icon="la:angle-double-right"
                    :label="t(`admin.storage.finishSetup`)"
                    color="secondary"
                    @click="setupGitHubStep(`verify`)"
                    :loading="state.setupCfg.loading" />
                </w-card-section>
              </template>
            </w-card>
            <w-card
              class="pb-2 mb-4"
              v-if="
                state.target.setup &&
                state.target.setup.handler &&
                state.target.setup.state === `configured`
              ">
              <w-card-header>
                {{ t('admin.storage.setup') }}
                <template #hint>{{ t('admin.storage.setupConfiguredHint') }}</template>
              </w-card-header>
              <w-item>
                <blueprint-icon class="self-start" icon="matches" :hue-rotate="140" />
                <w-item-section>
                  <w-item-label>Uninstall</w-item-label>
                  <w-item-label caption
                    >Delete the active configuration and start over the setup process.</w-item-label
                  >
                  <w-item-label class="text-red" caption>
                    <strong>This action cannot be undone!</strong>
                  </w-item-label>
                </w-item-section>
                <w-item-section side>
                  <w-btn
                    class="acrylic-btn"
                    flat
                    icon="la:arrow-circle-right"
                    color="negative"
                    @click="setupDestroy"
                    :label="t(`admin.storage.uninstall`)" />
                </w-item-section>
              </w-item>
            </w-card>
            <!-- ----------------------- -->
            <!-- Content Types -->
            <!-- ----------------------- -->
            <w-card class="pb-2">
              <w-card-header>
                {{ t('admin.storage.contentTypes') }}
                <template #hint>{{ t('admin.storage.contentTypesHint') }}</template>
              </w-card-header>
              <w-item tag="label">
                <w-item-section avatar>
                  <w-checkbox
                    v-model="state.target.contentTypes.activeTypes"
                    :color="state.target.module === `db` ? `grey` : `primary`"
                    val="pages"
                    :aria-label="t(`admin.storage.contentTypePages`)"
                    :disable="state.target.module === `db`" />
                </w-item-section>
                <w-item-section>
                  <w-item-label>{{ t(`admin.storage.contentTypePages`) }}</w-item-label>
                  <w-item-label caption>{{ t(`admin.storage.contentTypePagesHint`) }}</w-item-label>
                </w-item-section>
              </w-item>
              <w-item tag="label">
                <w-item-section avatar>
                  <w-checkbox
                    v-model="state.target.contentTypes.activeTypes"
                    color="primary"
                    val="images"
                    :aria-label="t(`admin.storage.contentTypeImages`)" />
                </w-item-section>
                <w-item-section>
                  <w-item-label>{{ t(`admin.storage.contentTypeImages`) }}</w-item-label>
                  <w-item-label caption>{{
                    t(`admin.storage.contentTypeImagesHint`)
                  }}</w-item-label>
                </w-item-section>
              </w-item>
              <w-item tag="label">
                <w-item-section avatar>
                  <w-checkbox
                    v-model="state.target.contentTypes.activeTypes"
                    color="primary"
                    val="documents"
                    :aria-label="t(`admin.storage.contentTypeDocuments`)" />
                </w-item-section>
                <w-item-section>
                  <w-item-label>{{ t(`admin.storage.contentTypeDocuments`) }}</w-item-label>
                  <w-item-label caption>{{
                    t(`admin.storage.contentTypeDocumentsHint`)
                  }}</w-item-label>
                </w-item-section>
              </w-item>
              <w-item tag="label">
                <w-item-section avatar>
                  <w-checkbox
                    v-model="state.target.contentTypes.activeTypes"
                    color="primary"
                    val="others"
                    :aria-label="t(`admin.storage.contentTypeOthers`)" />
                </w-item-section>
                <w-item-section>
                  <w-item-label>{{ t(`admin.storage.contentTypeOthers`) }}</w-item-label>
                  <w-item-label caption>{{
                    t(`admin.storage.contentTypeOthersHint`)
                  }}</w-item-label>
                </w-item-section>
              </w-item>
              <w-item tag="label">
                <w-item-section avatar>
                  <w-checkbox
                    v-model="state.target.contentTypes.activeTypes"
                    color="primary"
                    val="large"
                    :aria-label="t(`admin.storage.contentTypeLargeFiles`)" />
                </w-item-section>
                <w-item-section>
                  <w-item-label>{{ t(`admin.storage.contentTypeLargeFiles`) }}</w-item-label>
                  <w-item-label caption>{{
                    t(`admin.storage.contentTypeLargeFilesHint`)
                  }}</w-item-label>
                  <w-item-label
                    class="text-deep-orange"
                    v-if="state.target.module === `db`"
                    caption
                    >{{ t(`admin.storage.contentTypeLargeFilesDBWarn`) }}</w-item-label
                  >
                </w-item-section>
                <w-item-section side>
                  <w-input
                    outlined
                    :label="t(`admin.storage.contentTypeLargeFilesThreshold`)"
                    v-model="state.target.contentTypes.largeThreshold"
                    style="min-width: 150px"
                    dense />
                </w-item-section>
              </w-item>
            </w-card>
            <!-- ----------------------- -->
            <!-- Content Delivery -->
            <!-- ----------------------- -->
            <w-card class="pb-2 mt-4">
              <w-card-header>
                {{ t('admin.storage.assetDelivery') }}
                <template #hint>{{ t('admin.storage.assetDeliveryHint') }}</template>
              </w-card-header>
              <w-item :tag="state.target.assetDelivery.isStreamingSupported ? `label` : null">
                <w-item-section avatar>
                  <w-checkbox
                    v-model="state.target.assetDelivery.streaming"
                    :color="
                      state.target.module === `db` ||
                      !state.target.assetDelivery.isStreamingSupported
                        ? `grey`
                        : `primary`
                    "
                    :aria-label="t(`admin.storage.contentTypePages`)"
                    :disable="
                      state.target.module === `db` ||
                      !state.target.assetDelivery.isStreamingSupported
                    " />
                </w-item-section>
                <w-item-section>
                  <w-item-label>{{ t(`admin.storage.assetStreaming`) }}</w-item-label>
                  <w-item-label caption>{{ t(`admin.storage.assetStreamingHint`) }}</w-item-label>
                  <w-item-label
                    class="text-deep-orange"
                    v-if="!state.target.assetDelivery.isStreamingSupported"
                    caption
                    >{{ t(`admin.storage.assetStreamingNotSupported`) }}</w-item-label
                  >
                </w-item-section>
              </w-item>
              <w-item :tag="state.target.assetDelivery.isDirectAccessSupported ? `label` : null">
                <w-item-section avatar>
                  <w-checkbox
                    v-model="state.target.assetDelivery.directAccess"
                    :color="
                      !state.target.assetDelivery.isDirectAccessSupported ? `grey` : `primary`
                    "
                    :aria-label="t(`admin.storage.contentTypePages`)"
                    :disable="!state.target.assetDelivery.isDirectAccessSupported" />
                </w-item-section>
                <w-item-section>
                  <w-item-label>{{ t(`admin.storage.assetDirectAccess`) }}</w-item-label>
                  <w-item-label caption>{{
                    t(`admin.storage.assetDirectAccessHint`)
                  }}</w-item-label>
                  <w-item-label
                    class="text-deep-orange"
                    v-if="!state.target.assetDelivery.isDirectAccessSupported"
                    caption
                    >{{ t(`admin.storage.assetDirectAccessNotSupported`) }}</w-item-label
                  >
                </w-item-section>
              </w-item>
            </w-card>
            <!-- ----------------------- -->
            <!-- Configuration -->
            <!-- ----------------------- -->
            <w-card class="pb-2 mt-4">
              <w-card-header>{{ t('admin.storage.config') }}</w-card-header>
              <w-card-section>
                <w-banner
                  class="mt-4"
                  v-if="!state.target.config || Object.keys(state.target.config).length < 1"
                  :class="dark.isActive ? `bg-negative text-white` : `bg-grey-2 text-grey-7`"
                  >{{ t('admin.storage.noConfigOption') }}</w-banner
                >
              </w-card-section>
              <template v-for="(cfg, cfgKey, idx) in state.target.config">
                <template v-if="configIfCheck(cfg.if)">
                  <w-separator class="my-2" inset v-if="idx > 0" />
                  <w-item v-if="cfg.type === `boolean`" tag="label">
                    <blueprint-icon :icon="cfg.icon" :hue-rotate="cfg.readOnly ? -45 : 0" />
                    <w-item-section>
                      <w-item-label>{{ cfg.title }}</w-item-label>
                      <w-item-label caption>{{ cfg.hint }}</w-item-label>
                    </w-item-section>
                    <w-item-section avatar>
                      <w-toggle
                        v-model="cfg.value"
                        :aria-label="t(`admin.general.allowComments`)"
                        :disable="cfg.readOnly" />
                    </w-item-section>
                  </w-item>
                  <w-item v-else>
                    <blueprint-icon :icon="cfg.icon" :hue-rotate="cfg.readOnly ? -45 : 0" />
                    <w-item-section>
                      <w-item-label>{{ cfg.title }}</w-item-label>
                      <w-item-label caption>{{ cfg.hint }}</w-item-label>
                    </w-item-section>
                    <w-item-section
                      :style="cfg.type === `number` ? `flex: 0 0 150px;` : ``"
                      :class="{ 'col-auto': cfg.enum && cfg.enumDisplay === `buttons` }">
                      <w-btn-toggle
                        v-if="cfg.enum && cfg.enumDisplay === `buttons`"
                        v-model="cfg.value"
                        push
                        glossy
                        no-caps
                        toggle-color="primary"
                        :options="cfg.enum"
                        :disable="cfg.readOnly" />
                      <w-select
                        v-else-if="cfg.enum"
                        outlined
                        v-model="cfg.value"
                        :options="cfg.enum"
                        emit-value
                        map-options
                        dense
                        options-dense
                        :aria-label="cfg.title"
                        :disable="cfg.readOnly" />
                      <w-input
                        v-else
                        outlined
                        v-model="cfg.value"
                        dense
                        :type="inputTypeFor(cfg)"
                        :aria-label="cfg.title"
                        :disable="cfg.readOnly" />
                    </w-item-section>
                  </w-item>
                </template>
              </template>
            </w-card>
            <!-- ----------------------- -->
            <!-- Sync -->
            <!-- ----------------------- -->
            <w-card
              class="pb-2 mt-4"
              v-if="state.target.sync && Object.keys(state.target.sync).length > 0">
              <w-card-header>{{ t('admin.storage.sync') }}</w-card-header>
              <w-card-section>
                <w-banner
                  class="mt-4"
                  :class="dark.isActive ? `bg-negative text-white` : `bg-grey-2 text-grey-7`"
                  >{{ t('admin.storage.noSyncModes') }}</w-banner
                >
              </w-card-section>
            </w-card>
            <!-- ----------------------- -->
            <!-- Actions -->
            <!-- ----------------------- -->
            <w-card class="pb-2 mt-4">
              <w-card-header>{{ t('admin.storage.actions') }}</w-card-header>
              <w-card-section>
                <w-banner
                  class="mt-4"
                  v-if="!state.target.actions || state.target.actions.length < 1"
                  :class="dark.isActive ? `bg-negative text-white` : `bg-grey-2 text-grey-7`"
                  >{{ t('admin.storage.noActions') }}</w-banner
                >
                <w-banner
                  class="mt-4"
                  v-else-if="!state.target.isEnabled"
                  :class="dark.isActive ? `bg-negative text-white` : `bg-grey-2 text-grey-7`"
                  >{{ t('admin.storage.actionsInactiveWarn') }}</w-banner
                >
              </w-card-section>
              <template v-if="state.target.isEnabled" v-for="(act, idx) in state.target.actions">
                <w-separator class="my-2" inset v-if="idx > 0" />
                <w-item>
                  <blueprint-icon class="self-start" :icon="act.icon" :hue-rotate="45" />
                  <w-item-section>
                    <w-item-label>{{ act.label }}</w-item-label>
                    <w-item-label caption>{{ act.hint }}</w-item-label>
                    <w-item-label class="text-red" v-if="act.warn" caption>
                      <strong>{{ act.warn }}</strong>
                    </w-item-label>
                  </w-item-section>
                  <w-item-section side>
                    <w-btn
                      class="acrylic-btn"
                      flat
                      icon="la:arrow-circle-right"
                      color="primary"
                      @click="executeAction(act)"
                      :label="t(`common.actions.proceed`)"
                      :disable="state.runningAction"
                      :loading="state.runningActionHandler === act.handler" />
                  </w-item-section>
                </w-item>
              </template>
            </w-card>
          </div>
          <div class="col-span-12 lg:col-auto">
            <!-- ----------------------- -->
            <!-- Infobox -->
            <!-- ----------------------- -->
            <w-card class="rounded pb-4" style="width: 300px">
              <w-card-header>{{ state.target.title }}</w-card-header>
              <w-card-section>
                <img class="w-full object-cover rounded" :src="state.target.banner" />
                <div class="text-body2 mt-4">{{ state.target.description }}</div>
              </w-card-section>
              <w-separator class="mb-2" inset />
              <w-item>
                <w-item-section>
                  <w-item-label class="text-grey">{{ t(`admin.storage.vendor`) }}</w-item-label>
                  <w-item-label>{{ state.target.vendor }}</w-item-label>
                </w-item-section>
              </w-item>
              <w-separator class="my-2" inset />
              <w-item>
                <w-item-section>
                  <w-item-label class="text-grey">{{
                    t(`admin.storage.vendorWebsite`)
                  }}</w-item-label>
                  <w-item-label>
                    <a :href="state.target.website" target="_blank" rel="noreferrer">{{
                      state.target.website
                    }}</a>
                  </w-item-label>
                </w-item-section>
              </w-item>
            </w-card>
            <!-- ----------------------- -->
            <!-- Status -->
            <!-- ----------------------- -->
            <w-card class="rounded pb-4 mt-4" style="width: 300px">
              <w-card-header>{{ t('admin.storage.status') }}</w-card-header>
              <template v-if="state.target.module !== `db`">
                <w-item tag="label">
                  <w-item-section>
                    <w-item-label>{{ t(`admin.storage.enabled`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.storage.enabledHint`) }}</w-item-label>
                    <w-item-label
                      class="text-deep-orange"
                      v-if="state.target.module === `db`"
                      caption
                      >{{ t(`admin.storage.enabledForced`) }}</w-item-label
                    >
                  </w-item-section>
                  <w-item-section avatar>
                    <w-toggle
                      v-model="state.target.isEnabled"
                      :disable="state.target.module === `db` || isSetupNeeded"
                      :aria-label="t(`admin.storage.enabled`)" />
                  </w-item-section>
                  <w-inner-loading :showing="isSetupNeeded">
                    <w-icon name="la:exclamation-triangle" size="sm" color="negative" />
                    <div class="text-body2 text-negative">
                      {{ t('admin.storage.setupRequired') }}
                    </div>
                  </w-inner-loading>
                </w-item>
                <w-separator class="my-2" inset />
              </template>
              <w-item>
                <w-item-section>
                  <w-item-label class="text-grey">{{
                    t(`admin.storage.currentState`)
                  }}</w-item-label>
                  <w-item-label class="text-positive">No issues detected.</w-item-label>
                </w-item-section>
              </w-item>
            </w-card>
            <!-- ----------------------- -->
            <!-- Versioning -->
            <!-- ----------------------- -->
            <w-card class="rounded pb-4 mt-4" style="width: 300px">
              <w-card-header>
                {{ t(`admin.storage.versioning`) }}
                <template #hint>{{ t(`admin.storage.versioningHint`) }}</template>
              </w-card-header>
              <w-item :tag="state.target.versioning.isSupported ? `label` : null">
                <w-item-section>
                  <w-item-label>{{ t(`admin.storage.useVersioning`) }}</w-item-label>
                  <w-item-label caption>{{ t(`admin.storage.useVersioningHint`) }}</w-item-label>
                  <w-item-label
                    class="text-deep-orange"
                    v-if="!state.target.versioning.isSupported"
                    caption
                    >{{ t(`admin.storage.versioningNotSupported`) }}</w-item-label
                  >
                  <w-item-label
                    class="text-deep-orange"
                    v-if="state.target.versioning.isForceEnabled"
                    caption
                    >{{ t(`admin.storage.versioningForceEnabled`) }}</w-item-label
                  >
                </w-item-section>
                <w-item-section avatar>
                  <w-toggle
                    v-model="state.target.versioning.enabled"
                    :disable="
                      !state.target.versioning.isSupported || state.target.versioning.isForceEnabled
                    "
                    :aria-label="t(`admin.storage.useVersioning`)" />
                </w-item-section>
              </w-item>
            </w-card>
          </div>
        </div>
      </div>
    </div>
    <!-- ========================================== -->
    <!-- DELIVERY PATHS -->
    <!-- ========================================== -->
    <div class="flex flex-wrap p-4 gap-4" v-if="state.displayMode === `delivery`">
      <div class="min-w-0 flex-1">
        <w-card class="rounded">
          <w-card-section class="flex items-center">
            <div class="text-caption mr-2">{{ t('admin.storage.deliveryPathsLegend') }}</div>
            <w-chip square dense color="blue-1" text-color="blue-8">
              <w-avatar icon="la:ellipsis-h" color="blue" text-color="white" />
              <span class="text-caption px-2">{{
                t('admin.storage.deliveryPathsUserRequest')
              }}</span>
            </w-chip>
            <w-chip square dense color="teal-1" text-color="teal-8">
              <w-avatar icon="la:ellipsis-h" color="positive" text-color="white" />
              <span class="text-caption px-2">{{
                t('admin.storage.deliveryPathsPushToOrigin')
              }}</span>
            </w-chip>
            <w-chip square dense color="red-1" text-color="red-8">
              <w-avatar icon="la:minus" color="negative" text-color="white" />
              <span class="text-caption px-2">{{ t('admin.storage.missingOrigin') }}</span>
            </w-chip>
          </w-card-section>
          <w-separator />
          <v-network-graph
            :zoom-level="2"
            :configs="state.deliveryConfig"
            :nodes="state.deliveryNodes"
            :edges="state.deliveryEdges"
            :paths="state.deliveryPaths"
            :layouts="state.deliveryLayouts"
            style="height: 600px; background-color: #fff">
            <template #override-node="{ nodeId, scale, config, ...slotProps }">
              <rect
                :rx="config.borderRadius * scale"
                :x="-config.radius * scale"
                :y="-config.radius * scale"
                :width="config.radius * scale * 2"
                :height="config.radius * scale * 2"
                :fill="config.color"
                v-bind="slotProps" />
              <image
                v-if="
                  state.deliveryNodes[nodeId].icon &&
                  state.deliveryNodes[nodeId].icon.endsWith(`.svg`)
                "
                :x="(-config.radius + 5) * scale"
                :y="(-config.radius + 5) * scale"
                :width="(config.radius - 5) * scale * 2"
                :height="(config.radius - 5) * scale * 2"
                :xlink:href="state.deliveryNodes[nodeId].icon" />
              <text
                v-if="state.deliveryNodes[nodeId].icon && state.deliveryNodes[nodeId].iconText"
                :class="state.deliveryNodes[nodeId].icon"
                :font-size="22 * scale"
                fill="#ffffff"
                text-anchor="middle"
                dominant-baseline="central"
                v-html="state.deliveryNodes[nodeId].iconText" />
            </template>
          </v-network-graph>
        </w-card>
      </div>
    </div>
    <!-- .overline.my-5 {{t('admin.storage.syncDirection')}} -->
    <!-- .body-2.ml-3 {{t('admin.storage.syncDirectionSubtitle')}} -->
    <!-- .pr-3.pt-3 -->
    <!-- v-radio-group.ml-3.py-0(v-model='target.mode') -->
    <!-- v-radio( -->
    <!-- :label='t(`admin.storage.syncDirBi`)' -->
    <!-- color='primary' -->
    <!-- value='sync' -->
    <!-- :disabled='target.supportedModes.indexOf(`sync`) < 0' -->
    <!-- ) -->
    <!-- v-radio( -->
    <!-- :label='t(`admin.storage.syncDirPush`)' -->
    <!-- color='primary' -->
    <!-- value='push' -->
    <!-- :disabled='target.supportedModes.indexOf(`push`) < 0' -->
    <!-- ) -->
    <!-- v-radio( -->
    <!-- :label='t(`admin.storage.syncDirPull`)' -->
    <!-- color='primary' -->
    <!-- value='pull' -->
    <!-- :disabled='target.supportedModes.indexOf(`pull`) < 0' -->
    <!-- ) -->
    <!-- .body-2.ml-3 -->
    <!-- strong {{t('admin.storage.syncDirBi')}} #[em.red--text.text--lighten-2(v-if='target.supportedModes.indexOf(`sync`) < 0') {{t('admin.storage.unsupported')}}] -->
    <!-- .pb-3 {{t('admin.storage.syncDirBiHint')}} -->
    <!-- strong {{t('admin.storage.syncDirPush')}} #[em.red--text.text--lighten-2(v-if='target.supportedModes.indexOf(`push`) < 0') {{t('admin.storage.unsupported')}}] -->
    <!-- .pb-3 {{t('admin.storage.syncDirPushHint')}} -->
    <!-- strong {{t('admin.storage.syncDirPull')}} #[em.red--text.text--lighten-2(v-if='target.supportedModes.indexOf(`pull`) < 0') {{t('admin.storage.unsupported')}}] -->
    <!-- .pb-3 {{t('admin.storage.syncDirPullHint')}} -->
    <!-- template(v-if='target.hasSchedule') -->
    <!-- v-divider.mt-3 -->
    <!-- .overline.my-5 {{t('admin.storage.syncSchedule')}} -->
    <!-- .body-2.ml-3 {{t('admin.storage.syncScheduleHint')}} -->
    <!-- .pa-3 -->
    <!-- duration-picker(v-model='target.syncInterval') -->
    <!-- i18next.caption.mt-3(path='admin.storage.syncScheduleCurrent', tag='div') -->
    <!-- strong(place='schedule') {{getDefaultSchedule(target.syncInterval)}} -->
    <!-- i18next.caption(path='admin.storage.syncScheduleDefault', tag='div') -->
    <!-- strong(place='schedule') {{getDefaultSchedule(target.syncIntervalDefault)}} -->
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { dialog } from '@/composables/dialog'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

import * as VNG from 'v-network-graph'
import GithubSetupInstallDialog from '../components/GithubSetupInstallDialog.vue'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

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
  deliveryConfig: VNG.defineConfigs({
    view: {
      layoutHandler: new VNG.GridLayout({ grid: 15 }),
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
        color: (node) => node.color || '#1976D2',
        borderRadius: (node) => node.borderRadius || 5
      },
      label: {
        margin: 8
      }
    },
    edge: {
      normal: {
        width: 3,
        dasharray: (edge) => (edge.animate === false ? 20 : 3),
        animate: (edge) => !(edge.animate === false),
        animationSpeed: (edge) => edge.animationSpeed || 50,
        color: (edge) => edge.color || '#1976D2'
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
        color: (p) => p.color,
        linecap: 'square'
      }
    }
  })
})

// REFS

const githubSetupForm = ref(null)

// COMPUTED

const isSetupNeeded = computed(() => {
  return state.target?.setup?.handler && state.target.setup.state !== 'configured'
})

// WATCHERS

watch(
  () => adminStore.currentSiteId,
  async (newValue) => {
    await load()
    nextTick(() => {
      router.replace(`/_admin/${newValue}/storage/${state.selectedTarget}`)
    })
  }
)
watch(
  () => state.displayMode,
  (newValue) => {
    if (newValue === 'delivery') {
      generateGraph()
    }
  }
)
watch(
  () => state.selectedTarget,
  (newValue) => {
    state.target = state.targets.find((tgt) => tgt.id === newValue) || null
  }
)
watch(
  () => state.targets,
  (newValue) => {
    if (newValue && newValue.length > 0) {
      if (state.desiredTarget) {
        state.selectedTarget = state.desiredTarget
        state.desiredTarget = ''
      } else if (newValue.some((tgt) => tgt.id === state.selectedTarget)) {
        // -> Keep the current selection across a reload, since saving reloads the targets
        state.target = newValue.find((tgt) => tgt.id === state.selectedTarget)
      } else {
        state.selectedTarget = newValue.find((tgt) => tgt.module === 'db')?.id || null
        if (!route.params.id) {
          router.replace(`/_admin/${adminStore.currentSiteId}/storage/${state.selectedTarget}`)
        }
      }
      handleSetupCallback()
    }
  }
)
watch(
  () => route.params.id,
  (to, from) => {
    if (!to) {
      return
    }
    if (state.targets.length < 1) {
      state.desiredTarget = to
    } else {
      state.selectedTarget = to
    }
  }
)

// METHODS

/**
 * Turn a module prop declaration and its stored value into the shape the config editor renders,
 * expanding `value|label` enum entries into options.
 */
function buildConfigEditor(props, values) {
  const config = {}
  for (const [key, prop] of Object.entries(props ?? {})) {
    config[key] = {
      ...prop,
      value: values?.[key] ?? prop.default,
      ...(prop.enum && {
        enum: prop.enum.map((entry) => {
          const [value, label] = entry.split('|')
          return { value, label: label ?? value }
        })
      })
    }
  }
  return config
}

function inputTypeFor(cfg) {
  if (cfg.multiline) {
    return 'textarea'
  }
  if (cfg.sensitive) {
    return 'password'
  }
  return cfg.type === 'number' ? 'number' : 'text'
}

/**
 * Read the API's own message off a failed request, since ky doesn't throw on 400
 */
async function apiMessage(err) {
  return (
    err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null) ?? err.message
  )
}

async function load() {
  state.loading++
  loading.show()
  try {
    const targets = await API_CLIENT.get(`sites/${adminStore.currentSiteId}/storage/targets`).json()
    state.targets = (targets ?? []).map((tgt) => ({
      ...tgt,
      config: buildConfigEditor(tgt.props, tgt.config)
    }))
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.storage.loadFailed'),
      caption: await apiMessage(err),
      timeout: 20000
    })
  }
  loading.hide()
  state.loading--
}

function configIfCheck(ifs) {
  if (!ifs || ifs.length < 1) {
    return true
  }
  return ifs.every((s) => state.target.config[s.key]?.value === s.eq)
}

/**
 * A target as the API expects it. Read-only props are left out: the server keeps whatever is stored
 * for them, so sending them back would be pretending they can be set.
 */
function payloadFor(tgt) {
  const config = {}
  for (const [key, cfg] of Object.entries(tgt.config ?? {})) {
    if (cfg.readOnly) {
      continue
    }
    config[key] = cfg.type === 'number' ? Number(cfg.value) : cfg.value
  }
  return {
    id: tgt.id,
    isEnabled: tgt.isEnabled,
    contentTypes: {
      activeTypes: tgt.contentTypes.activeTypes,
      largeThreshold: tgt.contentTypes.largeThreshold
    },
    assetDelivery: {
      streaming: tgt.assetDelivery.streaming,
      directAccess: tgt.assetDelivery.directAccess
    },
    versioning: {
      enabled: tgt.versioning.enabled
    },
    config
  }
}

/**
 * Save every target at once, the way the API takes them — a target is only meaningful next to the
 * others, e.g. which of them holds a given content type.
 *
 * @param silent Skip the loading overlay and the success notification, for a save made on the way to
 *   something else, such as the GitHub setup flow.
 */
async function save({ silent = false } = {}) {
  let saveSuccess = false
  state.loading++
  if (!silent) {
    loading.show()
  }
  try {
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}/storage/targets`, {
      json: { targets: state.targets.map(payloadFor) }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    saveSuccess = true
    if (!silent) {
      notify({
        type: 'positive',
        message: t('admin.storage.saveSuccess')
      })
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.storage.saveFailed'),
      caption: await apiMessage(err)
    })
  }
  if (!silent) {
    loading.hide()
  }
  state.loading--
  return saveSuccess
}

function getTargetSubtitle(target) {
  if (!target.isEnabled) {
    return t('admin.storage.inactiveTarget')
  }
  const hasPages = target.contentTypes?.activeTypes?.includes('pages')
  const hasAssets = target.contentTypes?.activeTypes?.filter((c) => c !== 'pages')?.length > 0
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

function getTargetSubtitleColor(target) {
  if (state.selectedTarget === target.id) {
    return 'text-blue-2'
  } else if (target.isEnabled) {
    return 'text-positive'
  } else {
    return 'text-grey-7'
  }
}

async function executeAction(act) {
  const run = async () => {
    state.runningAction = true
    state.runningActionHandler = act.handler
    try {
      const resp = await API_CLIENT.post(
        `sites/${adminStore.currentSiteId}/storage/targets/${state.selectedTarget}/actions/${act.handler}`
      ).json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      notify({
        type: 'positive',
        message: t('admin.storage.actionSuccess', { action: act.label })
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('admin.storage.actionFailed', { action: act.label }),
        caption: await apiMessage(err)
      })
    }
    state.runningAction = false
    state.runningActionHandler = ''
  }

  // -> An action that declares a warning destroys something, so it is never run on a single click
  if (act.warn) {
    dialog({
      title: act.label,
      message: act.warn,
      persistent: true,
      ok: {
        label: t('common.actions.proceed'),
        color: 'negative',
        unelevated: true
      },
      cancel: {
        label: t('common.actions.cancel'),
        color: 'grey',
        flat: true
      }
    }).onOk(run)
  } else {
    await run()
  }
}

/**
 * Pick up a setup flow that took the administrator to a provider and back, the provider having
 * returned them here with a code in the query string.
 */
async function handleSetupCallback() {
  if (state.targets.length < 1 || !state.selectedTarget) {
    return
  }

  nextTick(() => {
    if (state.target?.setup?.handler === 'github' && route.query.code) {
      setupGitHubStep('connect', route.query.code)
    }
  })
}

async function setupDestroy() {
  dialog({
    title: t('admin.storage.destroyConfirm'),
    message: t('admin.storage.destroyConfirmInfo'),
    cancel: true,
    persistent: true
  }).onOk(async () => {
    loading.show({
      message: t('admin.storage.destroyingSetup')
    })

    try {
      const resp = await API_CLIENT.delete(
        `sites/${adminStore.currentSiteId}/storage/targets/${state.selectedTarget}/setup`
      ).json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      state.target.setup.state = 'notconfigured'
      // -> GitHub needs a moment to settle before the setup can be started over
      setTimeout(() => {
        loading.hide()
        notify({
          type: 'positive',
          message: t('admin.storage.githubSetupDestroySuccess')
        })
      }, 2000)
    } catch (err) {
      loading.hide()
      notify({
        type: 'negative',
        message: t('admin.storage.githubSetupDestroyFailed'),
        caption: await apiMessage(err)
      })
    }
  })
}

async function setupGitHub() {
  // -> Format values
  state.target.setup.values.publicUrl = state.target.setup.values.publicUrl.toLowerCase()

  // -> Basic input check
  if (state.target.setup.values.accountType === 'org' && state.target.setup.values.org.length < 1) {
    return notify({
      type: 'negative',
      message: 'Invalid GitHub Organization',
      caption: 'Enter a valid github organization.'
    })
  }
  if (
    state.target.setup.values.publicUrl.length < 11 ||
    !/^https?:\/\/.{4,}$/.test(state.target.setup.values.publicUrl)
  ) {
    return notify({
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
    default_events: ['create', 'delete', 'push']
  })
  loading.show({
    message: t('admin.storage.githubPreparingManifest')
  })
  // -> The values typed into the setup form are stored as config, since GitHub sends the
  //    administrator back here and the flow has to resume from them
  if (await save({ silent: true })) {
    githubSetupForm.value.submit()
  } else {
    state.setupCfg.loading = false
    loading.hide()
  }
}

async function setupGitHubStep(step, code) {
  loading.show({
    message: t('admin.storage.githubVerifying')
  })

  try {
    const resp = await API_CLIENT.post(
      `sites/${adminStore.currentSiteId}/storage/targets/${state.selectedTarget}/setup`,
      {
        json: {
          step,
          ...(code && { code })
        }
      }
    ).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    switch (resp.state?.nextStep) {
      case 'installApp': {
        router.replace({ query: null })
        loading.hide()

        dialog({
          component: GithubSetupInstallDialog,
          persistent: true
        })
          .onOk(() => {
            loading.show({
              message: t('admin.storage.githubRedirecting')
            })
            window.location.assign(resp.state?.url)
          })
          .onCancel(() => {
            throw new Error('Setup was aborted prematurely.')
          })
        break
      }
      case 'completed': {
        state.target.isEnabled = true
        state.target.setup.state = 'configured'
        setTimeout(() => {
          loading.hide()
          notify({
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
  } catch (err) {
    loading.hide()
    notify({
      type: 'negative',
      message: t('admin.storage.githubSetupFailed'),
      caption: await apiMessage(err)
    })
  }
}

function generateGraph() {
  const types = [
    {
      key: 'images',
      label: t('admin.storage.contentTypeImages'),
      icon: 'las',
      iconText: '&#xf1c5;'
    },
    {
      key: 'documents',
      label: t('admin.storage.contentTypeDocuments'),
      icon: 'las',
      iconText: '&#xf1c1;'
    },
    {
      key: 'others',
      label: t('admin.storage.contentTypeOthers'),
      icon: 'las',
      iconText: '&#xf15b;'
    },
    {
      key: 'large',
      label: t('admin.storage.contentTypeLargeFiles'),
      icon: 'las',
      iconText: '&#xf1c6;'
    }
  ]

  // -> Create PagesNodes

  state.deliveryNodes = {
    user: {
      name: t('admin.storage.deliveryPathsUser'),
      borderRadius: 16,
      icon: '/_assets/icons/fluent-account.svg'
    },
    pages: {
      name: t('admin.storage.contentTypePages'),
      color: '#3f51b5',
      icon: 'las',
      iconText: '&#xf15c;'
    },
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
    state.deliveryNodes[tp.key] = {
      name: tp.label,
      color: '#3f51b5',
      icon: tp.icon,
      iconText: tp.iconText
    }
    state.deliveryEdges[`user_${tp.key}`] = { source: 'user', target: tp.key }
    state.deliveryLayouts.nodes[tp.key] = { x: 0, y: (i + 1) * 15 }

    // -> Find target with direct access
    const dt = state.targets.find((tgt) => {
      return (
        tgt.module !== 'db' &&
        tgt.contentTypes.activeTypes.includes(tp.key) &&
        tgt.isEnabled &&
        tgt.assetDelivery.isDirectAccessSupported &&
        tgt.assetDelivery.directAccess
      )
    })

    if (dt) {
      state.deliveryNodes[`${tp.key}_${dt.module}`] = { name: dt.title, icon: dt.icon }
      state.deliveryNodes[`${tp.key}_wiki`] = {
        name: 'Wiki.js',
        icon: '/_assets/logo-wikijs.svg',
        color: '#161b22'
      }
      state.deliveryLayouts.nodes[`${tp.key}_${dt.module}`] = { x: 60, y: (i + 1) * 15 }
      state.deliveryLayouts.nodes[`${tp.key}_wiki`] = { x: 120, y: (i + 1) * 15 }
      state.deliveryEdges[`${tp.key}_${dt.module}_in`] = {
        source: tp.key,
        target: `${tp.key}_${dt.module}`
      }
      state.deliveryEdges[`${tp.key}_${dt.module}_out`] = {
        source: `${tp.key}_${dt.module}`,
        target: tp.key
      }
      state.deliveryEdges[`${tp.key}_${dt.module}_wiki`] = {
        source: `${tp.key}_wiki`,
        target: `${tp.key}_${dt.module}`,
        color: '#02c39a',
        animationSpeed: 25
      }
      continue
    }

    // -> Find target with streaming

    const st = state.targets.find((tgt) => {
      return (
        tgt.module !== 'db' &&
        tgt.contentTypes.activeTypes.includes(tp.key) &&
        tgt.isEnabled &&
        tgt.assetDelivery.isStreamingSupported &&
        tgt.assetDelivery.streaming
      )
    })

    if (st) {
      state.deliveryNodes[`${tp.key}_${st.module}`] = { name: st.title, icon: st.icon }
      state.deliveryNodes[`${tp.key}_wiki`] = {
        name: 'Wiki.js',
        icon: '/_assets/logo-wikijs.svg',
        color: '#161b22'
      }
      state.deliveryLayouts.nodes[`${tp.key}_${st.module}`] = { x: 120, y: (i + 1) * 15 }
      state.deliveryLayouts.nodes[`${tp.key}_wiki`] = { x: 60, y: (i + 1) * 15 }
      state.deliveryEdges[`${tp.key}_wiki_in`] = { source: tp.key, target: `${tp.key}_wiki` }
      state.deliveryEdges[`${tp.key}_wiki_out`] = { source: `${tp.key}_wiki`, target: tp.key }
      state.deliveryEdges[`${tp.key}_${st.module}_out`] = {
        source: `${tp.key}_${st.module}`,
        target: `${tp.key}_wiki`
      }
      state.deliveryEdges[`${tp.key}_${st.module}_in`] = {
        source: `${tp.key}_wiki`,
        target: `${tp.key}_${st.module}`
      }
      state.deliveryEdges[`${tp.key}_${st.module}_wiki`] = {
        source: `${tp.key}_wiki`,
        target: `${tp.key}_${st.module}`,
        color: '#02c39a',
        animationSpeed: 25
      }
      continue
    }

    // -> Check DB fallback

    const dbt = state.targets.find((tgt) => tgt.module === 'db')
    if (dbt?.contentTypes?.activeTypes?.includes(tp.key)) {
      state.deliveryNodes[`${tp.key}_wiki`] = {
        name: 'Wiki.js',
        icon: '/_assets/logo-wikijs.svg',
        color: '#161b22'
      }
      state.deliveryLayouts.nodes[`${tp.key}_wiki`] = { x: 60, y: (i + 1) * 15 }
      state.deliveryEdges[`${tp.key}_db_in`] = { source: tp.key, target: `${tp.key}_wiki` }
      state.deliveryEdges[`${tp.key}_db_out`] = { source: `${tp.key}_wiki`, target: tp.key }
    } else {
      state.deliveryNodes[`${tp.key}_wiki`] = {
        name: t('admin.storage.missingOrigin'),
        color: '#f03a47',
        icon: 'las',
        iconText: '&#xf071;'
      }
      state.deliveryLayouts.nodes[`${tp.key}_wiki`] = { x: 60, y: (i + 1) * 15 }
      state.deliveryEdges[`${tp.key}_db_in`] = {
        source: tp.key,
        target: `${tp.key}_wiki`,
        color: '#f03a47',
        animate: false
      }
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

<style lang="scss" scoped>
.admin-storage-logo {
  border-radius: 5px;
}
</style>
