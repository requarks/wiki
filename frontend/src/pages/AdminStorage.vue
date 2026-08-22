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
            { label: t('admin.storage.delivery'), value: 'delivery' },
            { label: t('admin.storage.config'), value: 'config' }
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
                <status-light :color="targetLight(tgt).color" :pulse="targetLight(tgt).pulse" />
              </w-item-section>
            </w-item>
          </w-list>
        </w-card>
      </div>
      <div class="min-w-0 flex-1" v-if="state.target">
        <!--
          The settings and the infobox beside them, the same shape as the list and this panel above:
          the infobox is 300px wide and the settings take what is left, both dropping onto their own
          row when there is no room. A 12-column grid could not say that -- `col-span-12` on the
          settings took a whole row of it, which is what put the infobox underneath.
        -->
        <div class="flex flex-wrap gap-4">
          <div class="min-w-0 flex-1">
            <!-- ----------------------- -->
            <!-- Content Types -->
            <!-- ----------------------- -->
            <w-card class="pb-2">
              <w-card-header>
                {{ t('admin.storage.contentTypes') }}
                <template #hint>{{ t('admin.storage.contentTypesHint') }}</template>
              </w-card-header>
              <w-item :tag="state.target.module === `db` ? null : `label`">
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
                  <!-- -> Only where it explains a control that cannot be used: on the database
                       target the checkbox is locked on, and that is worth saying. Anywhere else
                       storing pages is an ordinary choice with nothing to warn about. -->
                  <w-item-label
                    class="text-deep-orange"
                    v-if="state.target.module === `db`"
                    caption
                    >{{ t(`admin.storage.contentTypePagesSource`) }}</w-item-label
                  >
                </w-item-section>
              </w-item>
              <template v-for="ct in assetContentTypes" :key="ct.key">
                <w-item tag="label">
                  <w-item-section avatar>
                    <w-checkbox
                      v-model="state.target.contentTypes.activeTypes"
                      color="primary"
                      :val="ct.key"
                      :aria-label="t(ct.label)" />
                  </w-item-section>
                  <w-item-section>
                    <w-item-label>{{ t(ct.label) }}</w-item-label>
                    <w-item-label caption>{{ t(ct.hint) }}</w-item-label>
                    <w-item-label
                      class="text-deep-orange"
                      v-if="ct.key === `large` && state.target.module === `db`"
                      caption
                      >{{ t(`admin.storage.contentTypeLargeFilesDBWarn`) }}</w-item-label
                    >
                  </w-item-section>
                </w-item>
              </template>
            </w-card>
            <!-- ----------------------- -->
            <!-- Target Configuration -->
            <!-- ----------------------- -->
            <!-- -> Its own string rather than `config`, which the Configuration tab and its tab
                 label also use: the two cards are both "Configuration" until one of them has to say
                 which of the two it configures, and this is the one that does. -->
            <w-card class="pb-2 mt-4">
              <w-card-header>{{ t('admin.storage.targetConfig') }}</w-card-header>
              <!--
                The condition belongs on the section, not on the banner inside it: a section is a
                padded band whether or not anything renders in it, so leaving it unconditional put
                32px of empty space between the header and the first setting.
              -->
              <w-card-section
                v-if="!state.target.config || Object.keys(state.target.config).length < 1">
                <div class="text-body2 text-grey">{{ t('admin.storage.noConfigOption') }}</div>
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
            <!-- Content Delivery Configuration -->
            <!-- ----------------------- -->
            <!-- -> Only for a module that can actually sign a URL. The rest have no second way to
                 answer a request, so a card offering the choice would be offering nothing. -->
            <w-card class="pb-2 mt-4" v-if="state.target.assetDelivery.isDirectAccessSupported">
              <w-card-header>
                {{ t('admin.storage.deliveryConfig') }}
                <template #hint>{{ t('admin.storage.deliveryConfigHint') }}</template>
              </w-card-header>
              <w-item tag="label">
                <blueprint-icon class="self-start" icon="download-from-cloud" />
                <w-item-section>
                  <w-item-label>{{ t(`admin.storage.deliveryModeStreaming`) }}</w-item-label>
                  <w-item-label caption>{{
                    t(`admin.storage.deliveryModeStreamingHint`)
                  }}</w-item-label>
                </w-item-section>
                <w-item-section avatar>
                  <w-radio
                    v-model="state.target.assetDelivery.mode"
                    val="streaming"
                    :aria-label="t(`admin.storage.deliveryModeStreaming`)" />
                </w-item-section>
              </w-item>
              <w-separator class="my-2" inset />
              <w-item tag="label">
                <blueprint-icon class="self-start" icon="lightning-bolt" />
                <w-item-section>
                  <w-item-label>{{ t(`admin.storage.deliveryModeDirect`) }}</w-item-label>
                  <w-item-label caption>{{
                    t(`admin.storage.deliveryModeDirectHint`)
                  }}</w-item-label>
                </w-item-section>
                <w-item-section avatar>
                  <w-radio
                    v-model="state.target.assetDelivery.mode"
                    val="direct"
                    :aria-label="t(`admin.storage.deliveryModeDirect`)" />
                </w-item-section>
              </w-item>
              <template v-if="state.target.assetDelivery.mode === `direct`">
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon class="self-start" icon="dns" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.storage.deliveryBaseUrl`) }}</w-item-label>
                    <w-item-label caption>{{
                      t(`admin.storage.deliveryBaseUrlHint`)
                    }}</w-item-label>
                  </w-item-section>
                  <w-item-section side style="min-width: 280px">
                    <w-input
                      outlined
                      dense
                      v-model="state.target.assetDelivery.baseUrl"
                      placeholder="https://files.example.com"
                      :aria-label="t(`admin.storage.deliveryBaseUrl`)" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon class="self-start" icon="timer" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.storage.deliveryExpiration`) }}</w-item-label>
                    <w-item-label caption>{{
                      t(`admin.storage.deliveryExpirationHint`)
                    }}</w-item-label>
                  </w-item-section>
                  <w-item-section side style="min-width: 150px">
                    <w-input
                      outlined
                      dense
                      v-model="state.target.assetDelivery.linkExpiration"
                      :aria-label="t(`admin.storage.deliveryExpiration`)" />
                  </w-item-section>
                </w-item>
                <w-card-section>
                  <w-banner
                    :class="dark.isActive ? `bg-orange-9 text-white` : `bg-orange-1 text-orange-9`"
                    >{{ t('admin.storage.deliveryDirectWarn') }}</w-banner
                  >
                </w-card-section>
              </template>
            </w-card>
            <!-- ----------------------- -->
            <!-- Actions -->
            <!-- ----------------------- -->
            <w-card class="pb-2 mt-4">
              <w-card-header>{{ t('admin.storage.actions') }}</w-card-header>
              <!-- -> Same as the configuration card above: the band is only there when it says
                   something, otherwise it is padding above the first action -->
              <w-card-section v-if="actionsNotice">
                <div class="text-body2 text-grey">{{ actionsNotice }}</div>
              </w-card-section>
              <!-- -> `savedEnabled`, not `state.target.isEnabled`: an action runs on the server
                   against the configuration the server has, so offering one for a target that is
                   only enabled in this form would be offering something that cannot work -->
              <template v-if="savedEnabled" v-for="(act, idx) in state.target.actions">
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
          <div class="flex-none" style="width: 300px">
            <!-- ----------------------- -->
            <!-- Enable / Disable -->
            <!-- ----------------------- -->
            <!--
              A button that saves, rather than the toggle this used to be inside the status card
              below. The toggle only changed the form: a target switched on and left unapplied
              already showed its actions and a "storing content" status for something it was not
              doing yet. Turning a target on and writing that down are one step here, so what the
              two cards report cannot drift from what the server holds.

              Absent on the database target rather than disabled, since it is not a choice that
              exists: the content types card already says pages are always served from there, and a
              greyed-out button invites a click that could never do anything.
            -->
            <w-btn
              v-if="state.target.module !== `db`"
              class="w-full"
              unelevated
              :icon="savedEnabled ? `mdi:highlight-off` : `mdi:power`"
              :label="savedEnabled ? t(`common.actions.disable`) : t(`common.actions.enable`)"
              :color="savedEnabled ? `negative` : `positive`"
              :loading="state.loading > 0"
              @click="promptToggleEnabled" />
            <!-- ----------------------- -->
            <!-- Infobox -->
            <!-- ----------------------- -->
            <!-- -> No `pb-4`: the card ends in a section, which pads itself -->
            <w-card class="rounded" :class="{ 'mt-4': state.target.module !== `db` }">
              <w-card-header>{{ state.target.title }}</w-card-header>
              <w-card-section>
                <img class="w-full object-cover rounded" :src="state.target.banner" />
                <div class="text-body2 mt-4">{{ state.target.description }}</div>
              </w-card-section>
            </w-card>
            <!-- ----------------------- -->
            <!-- Status -->
            <!-- ----------------------- -->
            <!--
              `pb-2`, arrived at rather than picked: the row centres its own line of text in a 48px
              box, so it contributes 14px above and below it either way. What is NOT symmetric is
              the heading, which ends in a hairline 2px past its own box and then 8px of trailing
              margin -- 22px over the status. `pb-4` overshot that by 8px, and nothing at all
              undershot by the same, so the card's own bottom edge owes it exactly the 8px the
              heading spends on its margin.
            -->
            <w-card class="rounded pb-2 mt-4">
              <w-card-header>
                {{ t('admin.storage.status') }}
                <!-- -> Nothing pushes a status to this page: it is written server-side as the wiki
                     uses the target, so an administrator watching a sync or an export finish has no
                     way to see the outcome without asking again. -->
                <template #action>
                  <w-btn
                    class="acrylic-btn"
                    icon="la:redo-alt"
                    flat
                    size="sm"
                    color="secondary"
                    :loading="state.refreshingState"
                    :aria-label="t(`common.actions.refresh`)"
                    @click="refreshState">
                    <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
                  </w-btn>
                </template>
              </w-card-header>
              <w-item>
                <w-item-section>
                  <!-- -> A dot, not the `status-light` bar the target list uses: that one is a rule
                       drawn down the full height of its row, which suits a list of targets and not a
                       single line of text.

                       Inside the label rather than in a leading section of its own, which is what
                       sets the spacing: a flanking section carries a 16px gutter meant for a 24px
                       icon, far too much air for a 10px dot. -->
                  <w-item-label class="flex items-center gap-2" :class="currentState.text">
                    <span
                      class="size-2.5 shrink-0 rounded-full"
                      :class="[currentState.dot, currentState.flash && `status-dot--alert`]" />
                    {{ currentState.label }}
                  </w-item-label>
                  <!-- -> What actually went wrong, which is the whole use of the two unhealthy
                       states: "Error" on its own only sends an administrator to the server log.

                       The captions carry their own top margins rather than the section carrying a
                       gap: a gap belongs to `WItemSection`, which every item in the admin area uses
                       for the tight label-and-hint pairing that wants no space at all. Only the two
                       unhealthy states set either of these, and they set both, so a one-line card
                       never ends up with a margin hanging off it.

                       Uneven on purpose. The wider gap under the status separates the heading from
                       the detail, and the narrow one keeps the message and the moment it happened
                       reading as the one thing they are. -->
                  <w-item-label caption class="mt-3" v-if="currentState.message">
                    {{ currentState.message }}
                  </w-item-label>
                  <w-item-label caption class="mt-1" v-if="currentState.since">
                    {{ relativeDate(currentState.since) }}
                  </w-item-label>
                </w-item-section>
              </w-item>
            </w-card>
          </div>
        </div>
      </div>
    </div>
    <!-- ========================================== -->
    <!-- CONTENT DELIVERY -->
    <!-- ========================================== -->
    <div class="flex flex-wrap p-4 gap-4" v-if="state.displayMode === `delivery`">
      <div class="min-w-0 flex-1">
        <w-card class="pb-2">
          <w-card-header>
            {{ t('admin.storage.delivery') }}
            <template #hint>{{ t('admin.storage.deliveryHint') }}</template>
          </w-card-header>
          <w-item>
            <blueprint-icon class="self-start" icon="new-document" />
            <w-item-section>
              <w-item-label>{{ t(`admin.storage.contentTypePages`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.storage.deliveryPagesHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side style="min-width: 240px">
              <w-select
                outlined
                dense
                options-dense
                emit-value
                map-options
                :model-value="dbTargetId"
                :options="[{ label: dbTargetTitle, value: dbTargetId }]"
                :aria-label="t(`admin.storage.contentTypePages`)"
                disable />
            </w-item-section>
          </w-item>
          <template v-for="ct in assetContentTypes" :key="ct.key">
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon class="self-start" :icon="ct.icon" />
              <w-item-section>
                <w-item-label>{{ t(ct.label) }}</w-item-label>
                <w-item-label caption>{{ t(ct.hint) }}</w-item-label>
                <w-item-label
                  class="text-deep-orange"
                  v-if="!sourceOptions(ct.key).length"
                  caption
                  >{{ t(`admin.storage.deliveryNoTarget`) }}</w-item-label
                >
              </w-item-section>
              <w-item-section side style="min-width: 240px">
                <w-select
                  outlined
                  dense
                  options-dense
                  emit-value
                  map-options
                  :model-value="sourceFor(ct.key)"
                  :options="sourceOptions(ct.key)"
                  :disable="!sourceOptions(ct.key).length"
                  :aria-label="t(ct.label)"
                  @update:model-value="setSource(ct.key, $event)" />
              </w-item-section>
            </w-item>
          </template>
          <w-card-section>
            <w-banner :class="dark.isActive ? `bg-teal-9 text-white` : `bg-teal-1 text-teal-9`">{{
              t('admin.storage.deliveryRelationHint')
            }}</w-banner>
          </w-card-section>
        </w-card>
      </div>
    </div>
    <!-- ========================================== -->
    <!-- CONFIGURATION -->
    <!-- ========================================== -->
    <div class="flex flex-wrap p-4 gap-4" v-if="state.displayMode === `config`">
      <div class="min-w-0 flex-1">
        <w-card class="pb-2">
          <w-card-header>
            {{ t('admin.storage.config') }}
            <template #hint>{{ t('admin.storage.configHint') }}</template>
          </w-card-header>
          <w-item>
            <blueprint-icon class="self-start" icon="open-box" />
            <w-item-section>
              <w-item-label>{{ t(`admin.storage.largeThreshold`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.storage.largeThresholdHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side style="min-width: 150px">
              <w-input
                outlined
                dense
                v-model="state.largeThreshold"
                :aria-label="t(`admin.storage.largeThreshold`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon class="self-start" icon="schedule" />
            <w-item-section>
              <w-item-label>{{ t(`admin.storage.syncInterval`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.storage.syncIntervalHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side style="min-width: 150px">
              <w-input
                outlined
                dense
                v-model="state.syncInterval"
                :aria-label="t(`admin.storage.syncInterval`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon class="self-start" icon="website" />
            <w-item-section>
              <w-item-label>{{ t(`admin.storage.sitePrefix`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.storage.sitePrefixHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle v-model="state.sitePrefix" :aria-label="t(`admin.storage.sitePrefix`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon class="self-start" icon="translation" />
            <w-item-section>
              <w-item-label>{{ t(`admin.storage.localePrefix`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.storage.localePrefixHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.localePrefix"
                :aria-label="t(`admin.storage.localePrefix`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon class="self-start" icon="disconnected" />
            <w-item-section>
              <w-item-label>{{ t(`admin.storage.directAccessFallback`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.storage.directAccessFallbackHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side style="min-width: 240px">
              <w-select
                outlined
                dense
                options-dense
                emit-value
                map-options
                v-model="state.directAccessFallback"
                :options="directAccessFallbackOptions"
                :aria-label="t(`admin.storage.directAccessFallback`)" />
            </w-item-section>
          </w-item>
          <w-card-section>
            <w-banner :class="dark.isActive ? `bg-teal-9 text-white` : `bg-teal-1 text-teal-9`">{{
              t('admin.storage.pathLayoutHint')
            }}</w-banner>
          </w-card-section>
        </w-card>
      </div>
    </div>
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
import { confirm } from '@/composables/dialog'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

import { apiErrorMessage } from '@/helpers/apiError'
import { relativeDate } from '@/helpers/datetime'

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
  refreshingState: false,
  selectedTarget: '',
  desiredTarget: '',
  target: null,
  targets: [],
  /** Site-wide, hence not on a target: the three of them are the Configuration tab. */
  largeThreshold: '',
  syncInterval: '',
  directAccessFallback: 'stream',
  sitePrefix: false,
  localePrefix: true
})

// CONSTANTS

/**
 * The content types an asset can fall into, in the order both forms list them.
 *
 * Pages are not among them. They are stored wherever a target asks to keep a copy, like anything
 * else, but they are always *read* from the database — so the sources form shows that row fixed and
 * the per-target form keeps its own checkbox.
 */
const assetContentTypes = [
  {
    key: 'images',
    icon: 'image',
    label: 'admin.storage.contentTypeImages',
    hint: 'admin.storage.contentTypeImagesHint'
  },
  {
    key: 'documents',
    icon: 'data-sheet',
    label: 'admin.storage.contentTypeDocuments',
    hint: 'admin.storage.contentTypeDocumentsHint'
  },
  {
    key: 'others',
    icon: 'binary-file',
    label: 'admin.storage.contentTypeOthers',
    hint: 'admin.storage.contentTypeOthersHint'
  },
  {
    key: 'large',
    icon: 'open-box',
    label: 'admin.storage.contentTypeLargeFiles',
    hint: 'admin.storage.contentTypeLargeFilesHint'
  }
]

// COMPUTED

/**
 * What the selected target is doing right now, as opposed to how it is configured.
 *
 * Two questions in one line, in the order they matter. **Configuration** first, because it is a
 * precondition: a target that is off, or on but claiming no content type, is not doing anything, and
 * how it would behave if asked is beside the point. Only past that does the target's own reported
 * **health** get a say — `state`, which the server writes as it dispatches to the module, and the one
 * thing here not derived from the form. A disk that has filled up is otherwise invisible: the upload
 * it refused reported itself to whoever was uploading, and a page copy it could not write reported
 * itself to the server log alone.
 *
 * The configuration half reflects the SAVED form, not the unapplied edits in front of it. The health
 * half has no such distinction — it is an observation, and only a reload brings a newer one.
 *
 * Each state carries its own two class names in full rather than a palette name the template
 * interpolates: Tailwind generates a utility only where it can see it written, so `bg-${color}` would
 * produce a dot with no colour at all.
 */
const currentState = computed(() => {
  const saved = state.target?.saved
  if (!saved?.isEnabled) {
    return { label: t('admin.storage.stateInactive'), text: 'text-grey', dot: 'bg-grey-5' }
  }
  if (saved.activeTypes.length < 1) {
    return {
      label: t('admin.storage.stateNoContentTypes'),
      text: 'text-negative',
      dot: 'bg-negative'
    }
  }
  const health = state.target.state ?? {}
  if (health.status === 'error') {
    return {
      label: t('admin.storage.stateError'),
      text: 'text-negative',
      dot: 'bg-negative',
      flash: true,
      message: health.message,
      since: health.updatedAt
    }
  }
  if (health.status === 'warning') {
    return {
      label: t('admin.storage.stateWarning'),
      text: 'text-warning',
      dot: 'bg-warning',
      flash: true,
      message: health.message,
      since: health.updatedAt
    }
  }
  return { label: t('admin.storage.stateActive'), text: 'text-positive', dot: 'bg-positive' }
})

/** Whether the selected target is enabled *as saved* — see `savedSnapshot`. */
const savedEnabled = computed(() => state.target?.saved?.isEnabled === true)

/**
 * What the actions card says when it has nothing to offer, or null when it is listing actions.
 *
 * The two reasons read as one line rather than as two branches in the template, and the card's own
 * section keys off the same value — the condition for showing the band and the conditions for each
 * message inside it were otherwise the same thing written twice.
 */
const actionsNotice = computed(() => {
  if (!state.target?.actions || state.target.actions.length < 1) {
    return t('admin.storage.noActions')
  }
  return savedEnabled.value ? null : t('admin.storage.actionsInactiveWarn')
})

/**
 * What a site can do when a target set to hand out direct links cannot sign one.
 *
 * Computed rather than a constant so the labels follow the interface language.
 */
const directAccessFallbackOptions = computed(() => [
  { value: 'stream', label: t('admin.storage.directAccessFallbackStream') },
  { value: 'error', label: t('admin.storage.directAccessFallbackError') }
])

/** The database target, which pages are always read from. */
const dbTarget = computed(() => state.targets.find((tgt) => tgt.module === 'db') ?? null)
const dbTargetId = computed(() => dbTarget.value?.id ?? null)
const dbTargetTitle = computed(() => dbTarget.value?.title ?? '')

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
 * The targets that may be nominated to serve a content type.
 *
 * Only the ones that are turned on and are configured to *store* it: serving is reading back what
 * was written here, so a target that never receives the content has nothing to answer with. This is
 * the whole of the relationship between the two tabs — ticking a content type on a target's own
 * panel is what makes it appear here.
 */
function sourceOptions(type) {
  return state.targets
    .filter(
      (tgt) =>
        tgt.isEnabled &&
        tgt.contentTypes.activeTypes.includes(type) &&
        // -> A target may hold a content type without being somewhere to read it back from. SFTP is
        //    the one: every image on every page would be an SSH round trip, so it is a copy of the
        //    site's content rather than a source for it, and the server refuses the nomination too.
        tgt.assetDelivery.isDeliverySupported !== false
    )
    .map((tgt) => ({ label: tgt.title, value: tgt.id }))
}

/**
 * Which target a content type is served from today, read the same way the server reads it.
 *
 * A type nobody has been nominated for is answered from the **database**, and this form says so.
 * Never from whichever other target happens to be enabled: enabling a target is a statement about
 * where content is written, and letting it quietly become the delivery source as well would move
 * every reader's request onto a target that was not chosen for it — and, since a target enabled
 * after an upload holds none of the existing files, onto one that mostly has to fall through anyway.
 * Moving a content type is what the select next to it is for.
 *
 * The database only loses that role by not holding the type at all, in which case it is not among the
 * options and the first target that does hold it answers.
 */
function sourceFor(type) {
  const nominated = state.targets.find(
    (tgt) =>
      tgt.isEnabled &&
      tgt.contentTypes.activeTypes.includes(type) &&
      tgt.assetDelivery.isDeliverySupported !== false &&
      (tgt.assetDelivery.servedTypes ?? []).includes(type)
  )
  if (nominated) {
    return nominated.id
  }
  const options = sourceOptions(type)
  return (options.find((opt) => opt.value === dbTargetId.value) ?? options[0])?.value ?? null
}

/**
 * Nominate one target to serve a content type, and take the nomination off every other.
 *
 * Exclusive because the question is singular: a file is read from one place. It says nothing about
 * where the file is *written* — that is the target's own content types, and unticking one there is
 * what removes it from this form's options.
 */
function setSource(type, targetId) {
  for (const tgt of state.targets) {
    const served = tgt.assetDelivery.servedTypes ?? []
    tgt.assetDelivery.servedTypes =
      tgt.id === targetId ? [...new Set([...served, type])] : served.filter((t) => t !== type)
  }
}

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

/**
 * What the server holds for a target, as far as the status and the actions cards are concerned.
 *
 * Both of them report what a target is *doing*, which is a question about the saved configuration
 * rather than about the form — an unticked content type is a plan until it is applied. Only the two
 * fields that answer it are kept: everything else in the panel describes how a target is set up,
 * where showing the edit as it is made is the point.
 */
function savedSnapshot(tgt) {
  return {
    isEnabled: tgt.isEnabled,
    activeTypes: [...(tgt.contentTypes?.activeTypes ?? [])]
  }
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

async function load() {
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.get(`sites/${adminStore.currentSiteId}/storage`).json()
    state.largeThreshold = resp?.largeThreshold ?? ''
    state.syncInterval = resp?.syncInterval ?? ''
    state.directAccessFallback = resp?.directAccessFallback ?? 'stream'
    state.sitePrefix = resp?.sitePrefix ?? false
    state.localePrefix = resp?.localePrefix ?? true
    state.targets = (resp?.targets ?? []).map((tgt) => ({
      ...tgt,
      config: buildConfigEditor(tgt.props, tgt.config),
      saved: savedSnapshot(tgt)
    }))
    adminStore.applyStorageTargets(state.targets)
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.storage.loadFailed'),
      caption: apiErrorMessage(err),
      timeout: 20000
    })
  }
  loading.hide()
  state.loading--
}

/**
 * Read every target's health back from the server, and nothing else.
 *
 * Deliberately not `load()`. What the Status card shows is the one part of this page the server
 * writes on its own — `recordState`, as an upload is refused or a sync finishes — so that is the only
 * part worth asking about again. Reloading the whole form would also throw away whatever content
 * types or configuration the administrator has changed and not yet saved, which is a steep price for
 * looking at a status line.
 *
 * `state.target` is a member of `state.targets` rather than a copy of one, so patching the array is
 * what puts the new status in the card.
 */
async function refreshState() {
  if (state.refreshingState) {
    return
  }
  state.refreshingState = true
  try {
    const resp = await API_CLIENT.get(`sites/${adminStore.currentSiteId}/storage`).json()
    for (const fresh of resp?.targets ?? []) {
      const tgt = state.targets.find((item) => item.id === fresh.id)
      if (tgt) {
        tgt.state = fresh.state
      }
    }
    adminStore.applyStorageTargets(state.targets)
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.storage.loadFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.refreshingState = false
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
      activeTypes: tgt.contentTypes.activeTypes
    },
    assetDelivery: {
      mode: tgt.assetDelivery.mode,
      baseUrl: tgt.assetDelivery.baseUrl ?? '',
      linkExpiration: tgt.assetDelivery.linkExpiration ?? '',
      // -> Kept in step with the content types on the way out: a target that stopped storing a kind
      //    cannot go on being the source for it, and the server refuses the pair outright
      servedTypes: (tgt.assetDelivery.servedTypes ?? []).filter((type) =>
        tgt.contentTypes.activeTypes.includes(type)
      )
    },
    config
  }
}

/**
 * Save the whole storage configuration at once, the way the API takes it — a target is only
 * meaningful next to the others, e.g. which of them holds a given content type, and the site-wide
 * settings decide what each of them is offered.
 *
 * Returns whether it succeeded, which `setEnabled` needs: a target must not be left flagged as
 * enabled by a write that never landed.
 */
async function save() {
  let saved = false
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}/storage`, {
      json: {
        largeThreshold: state.largeThreshold,
        syncInterval: state.syncInterval,
        directAccessFallback: state.directAccessFallback,
        sitePrefix: state.sitePrefix,
        localePrefix: state.localePrefix,
        targets: state.targets.map(payloadFor)
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    // -> The form is now what the server has, so the status and actions cards may report it
    for (const tgt of state.targets) {
      tgt.saved = savedSnapshot(tgt)
    }
    notify({
      type: 'positive',
      message: t('admin.storage.saveSuccess')
    })
    saved = true
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.storage.saveFailed'),
      caption: apiErrorMessage(err)
    })
  }
  loading.hide()
  state.loading--
  return saved
}

/**
 * Turn the selected target on or off, as one step with saving it.
 *
 * The whole page is written either way — there is one endpoint for the site's storage configuration
 * and a target only means anything beside the others — so anything else the administrator has
 * changed goes with it, which is what the confirmation says.
 */
function promptToggleEnabled() {
  const enabling = !savedEnabled.value
  confirm({
    title: enabling ? t('common.actions.enable') : t('common.actions.disable'),
    message: enabling ? t('admin.storage.confirmEnable') : t('admin.storage.confirmDisable'),
    caption: t('admin.storage.confirmToggleHint'),
    cancel: true,
    color: enabling ? 'positive' : 'negative',
    okLabel: t('common.actions.confirm'),
    cancelLabel: t('common.actions.discard')
  }).onOk(() => setEnabled(enabling))
}

async function setEnabled(isEnabled) {
  const target = state.target
  const previous = target.isEnabled
  const previouslyServed = target.assetDelivery.servedTypes ?? []
  target.isEnabled = isEnabled
  // -> Turning a target off gives up whatever it was serving, which the Content Delivery tab then
  //    shows as the database again. The server enforces the same thing for any other client, but it
  //    has to happen here too: leaving the nomination on the form would send it back and hand the
  //    content type over again the moment the target was re-enabled.
  if (!isEnabled) {
    target.assetDelivery.servedTypes = []
  }
  if (!(await save())) {
    // -> Nothing was written, so neither may be left claiming otherwise
    target.isEnabled = previous
    target.assetDelivery.servedTypes = previouslyServed
  }
}

/**
 * The light beside a target in the list.
 *
 * Three states, and the first two are about configuration rather than health: a target that is off
 * is dark and still, and an enabled one pulses to say it is in use. The third is the reason this is a
 * function and not a ternary — an enabled target that last failed at something turns amber, so the
 * list says which target to go and look at without every row having to be opened.
 *
 * Amber for `error` as well as `warning`, matching the sidebar: what failed was something the wiki
 * tried to do, and the wiki is still serving. A dark red light here means "switched off", which is a
 * different thing entirely and already has this colour.
 */
function targetLight(target) {
  if (!target.isEnabled) {
    return { color: 'negative', pulse: false }
  }
  if (['warning', 'error'].includes(target.state?.status)) {
    return { color: 'warning', pulse: true }
  }
  return { color: 'positive', pulse: true }
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
        message: t('admin.storage.actionSuccess', { action: act.label }),
        // -> What an action reports is a count of what it did, which is the only way to tell a run
        //    that moved a thousand files from one that found nothing to move
        caption: resp.message,
        timeout: 10000
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('admin.storage.actionFailed', { action: act.label }),
        caption: apiErrorMessage(err)
      })
    }
    state.runningAction = false
    state.runningActionHandler = ''
    // -> An action is the heaviest thing a target is ever asked to do and the likeliest to change how
    //    it is behaving, either way round: this is where a failure appears, and where one clears
    await refreshState()
  }

  // -> An action that declares a warning destroys something, so it is never run on a single click
  if (act.warn) {
    confirm({
      title: act.label,
      message: act.warn,
      persistent: true,
      cancel: true,
      color: 'negative',
      okLabel: t('common.actions.proceed')
    }).onOk(run)
  } else {
    await run()
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
})
</script>

<style lang="scss" scoped>
.admin-storage-logo {
  border-radius: 5px;
}

/*
  The dot fades away and back rather than growing a halo. Nothing about its size or position changes,
  so it does not nudge the label beside it, and fading reads as a signal on a 10px dot in a way a 3px
  glow could not -- the halo was competing with the coloured fill it sat around.

  Never quite to nothing: a dot that disappears reads as one that has gone out, and half of the time
  the card would be showing a status with no colour against it.
*/
.status-dot--alert {
  animation: status-dot-alert 1.5s ease-in-out infinite;
}

@keyframes status-dot-alert {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.2;
  }
}

/*
  A flashing dot is the one thing on this page that moves on its own, so it is also the one thing
  that has to stop when the reader has asked for less of that. Nothing is lost by holding still: the
  colour and the word beside it say the same thing.
*/
@media (prefers-reduced-motion: reduce) {
  .status-dot--alert {
    animation: none;
  }
}
</style>
