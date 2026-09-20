<template>
  <w-page class="admin-scim">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-scim.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">
          {{ t('admin.scim.title') }}
        </div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.scim.subtitle') }}
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center">
          <template v-if="state.enabled">
            <w-signal class="mr-2" color="green" size="md" />
            <div class="text-caption text-green">{{ t('admin.scim.enabled') }}</div>
          </template>
          <template v-else>
            <w-signal class="mr-2" color="red" size="md" />
            <div class="text-caption text-red">{{ t('admin.scim.disabled') }}</div>
          </template>
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 ml-4 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/scim`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="acrylic-btn mr-2"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="refresh">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2"
          unelevated
          icon="la:power-off"
          :label="!state.enabled ? t(`common.actions.activate`) : t(`common.actions.deactivate`)"
          :color="!state.enabled ? `positive` : `negative`"
          @click="globalSwitch"
          :loading="state.isToggleLoading"
          :disabled="state.loading > 0" />
        <w-btn
          unelevated
          icon="mdi:check"
          :label="t(`common.actions.apply`)"
          color="secondary"
          @click="save"
          :loading="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- Configuration -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.scim.configuration') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="trash" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.scim.deleteAction`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.scim.deleteActionHint`) }}</w-item-label>
              <div class="mt-3 flex flex-col gap-3">
                <div>
                  <w-radio
                    v-model="state.config.deleteAction"
                    val="deactivate"
                    :label="t(`admin.scim.deleteActionDeactivate`)" />
                  <div class="pl-7 text-caption text-grey">
                    {{ t('admin.scim.deleteActionDeactivateHint') }}
                  </div>
                </div>
                <div>
                  <w-radio
                    v-model="state.config.deleteAction"
                    val="delete"
                    color="negative"
                    :label="t(`admin.scim.deleteActionDelete`)" />
                  <!-- -> Under the option rather than in the hint above: losing every page's
                       authorship is the cost of this choice specifically -->
                  <div class="pl-7 text-caption text-negative flex items-start">
                    <w-icon class="mr-1 mt-px" name="la:exclamation-triangle" size="xs" />
                    <span>{{ t('admin.scim.deleteActionDeleteWarning') }}</span>
                  </div>
                </div>
              </div>
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="email" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.scim.emailSource`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.scim.emailSourceHint`) }}</w-item-label>
              <div class="mt-3 flex flex-col gap-3">
                <w-radio
                  v-model="state.config.emailSource"
                  val="userName"
                  :label="t(`admin.scim.emailSourceUserName`)" />
                <w-radio
                  v-model="state.config.emailSource"
                  val="emails"
                  :label="t(`admin.scim.emailSourceEmails`)" />
              </div>
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <!-- -> `tag="label"` makes the whole row operate the toggle, the way the editor config
               rows do: the browser forwards the click to the labelable control inside, so the label
               and its hint are part of the target rather than text beside one. -->
          <w-item tag="label">
            <blueprint-icon icon="user-groups" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.scim.allowGroupCreate`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.scim.allowGroupCreateHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-toggle
                v-model="state.config.allowGroupCreate"
                color="primary"
                :aria-label="t(`admin.scim.allowGroupCreate`)" />
            </w-item-section>
          </w-item>
        </w-card>

        <!-- ----------------------- -->
        <!-- Access -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>
            {{ t('admin.scim.access') }}
            <template #hint>{{ t('admin.scim.accessHint') }}</template>
          </w-card-header>
          <w-item tag="label">
            <blueprint-icon icon="filtration" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.scim.rateLimitEnabled`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.scim.rateLimitEnabledHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-toggle
                v-model="state.config.rateLimitEnabled"
                color="primary"
                :aria-label="t(`admin.scim.rateLimitEnabled`)" />
            </w-item-section>
          </w-item>
          <!-- -> The three numbers only mean anything while the limit is on, so they are not shown
               greyed out beside it; the Security screen's own limit does the same. -->
          <template v-if="state.config.rateLimitEnabled">
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="pin-pad" />
              <w-item-section>
                <w-item-label>{{ t(`admin.scim.rateLimitMax`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.scim.rateLimitMaxHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section style="flex: 0 0 200px">
                <w-input
                  outlined
                  dense
                  v-model.number="state.config.rateLimitMax"
                  :suffix="t(`admin.scim.rateLimitMaxSuffix`)"
                  :aria-label="t(`admin.scim.rateLimitMax`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="timer" />
              <w-item-section>
                <w-item-label>{{ t(`admin.scim.rateLimitWindow`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.scim.rateLimitWindowHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section style="flex: 0 0 200px">
                <w-input
                  outlined
                  dense
                  v-model="state.config.rateLimitWindow"
                  :placeholder="t(`admin.scim.durationPlaceholder`)"
                  :aria-label="t(`admin.scim.rateLimitWindow`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="denied" />
              <w-item-section>
                <w-item-label>{{ t(`admin.scim.rateLimitBan`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.scim.rateLimitBanHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section style="flex: 0 0 200px">
                <w-input
                  outlined
                  dense
                  v-model="state.config.rateLimitBan"
                  :placeholder="t(`admin.scim.durationPlaceholder`)"
                  :aria-label="t(`admin.scim.rateLimitBan`)" />
              </w-item-section>
            </w-item>
          </template>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="firewall" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.scim.ipAllowList`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.scim.ipAllowListHint`) }}</w-item-label>
              <!-- -> An address only means what it looks like when the proxy headers are trusted,
                   so a list written against the directory's published egress ranges would refuse
                   everybody. Same warning the Metrics screen carries over its address classes. -->
              <w-item-label
                v-if="!state.trustProxy"
                class="text-caption text-deep-orange mt-2 flex items-start">
                <w-icon class="mr-1 mt-px" name="la:exclamation-triangle" size="xs" />
                <span>{{ t('admin.scim.proxyWarning') }}</span>
              </w-item-label>
              <w-input
                class="mt-2"
                outlined
                dense
                type="textarea"
                :rows="4"
                v-model="state.ipAllowListText"
                :placeholder="t(`admin.scim.ipAllowListPlaceholder`)"
                :aria-label="t(`admin.scim.ipAllowList`)" />
              <!-- -> Says which of the two states the box is currently in, because an empty box
                   meaning "everybody" is the opposite of what an empty allow list usually means -->
              <div class="text-caption text-grey mt-1">
                {{
                  ipAllowListEntries.length > 0
                    ? t('admin.scim.ipAllowListRestricted', { count: ipAllowListEntries.length })
                    : t('admin.scim.ipAllowListOpen')
                }}
              </div>
            </w-item-section>
          </w-item>
        </w-card>
      </div>

      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- Reference -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.scim.reference') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="link" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.scim.tenantUrl`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.scim.tenantUrlHint`) }}</w-item-label>
              <!--
                -> Drawn as a read-only field rather than as a line of text: this is a value to be
                   taken away and pasted somewhere else, and a box says "select me" where a paragraph
                   does not. The fill is the one `WInput` gives its filled variant and the border the
                   pair the rest of the library draws its edges with, so it sits in the card as an
                   input would without being one.

                -> The copy button belongs to the BOX, so it lives in this row rather than in a
                   `side` section of the item: a side section is centred against the whole row --
                   label, hint and box together -- which left the button floating opposite the hint
                   instead of opposite the value it copies. `min-w-0` is what lets the box wrap
                   inside the flex row rather than push the button off the end.
              -->
              <div class="mt-2 flex items-center gap-2">
                <div
                  class="text-caption font-robotomono min-w-0 flex-1 break-all rounded border border-black/12 bg-black/4 px-3 py-2 dark:border-white/15 dark:bg-white/6">
                  {{ tenantUrl }}
                </div>
                <w-btn
                  class="acrylic-btn shrink-0"
                  icon="la:copy"
                  flat
                  dense
                  color="secondary"
                  :aria-label="t(`common.actions.copy`)"
                  @click="copyTenantUrl">
                  <w-tooltip>{{ t(`common.actions.copy`) }}</w-tooltip>
                </w-btn>
              </div>
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="key" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.scim.auth`) }}</w-item-label>
              <w-item-label caption>
                <i18n-t keypath="admin.scim.authHint" scope="global">
                  <template #permission>
                    <strong class="font-robotomono">manage:scim</strong>
                  </template>
                </i18n-t>
              </w-item-label>
              <div class="text-caption mt-2">
                <i18n-t keypath="admin.scim.authApiKey" scope="global">
                  <template #headerName>
                    <strong class="font-robotomono">Authorization</strong>
                  </template>
                  <template #tokenType><strong class="font-robotomono">Bearer</strong></template>
                </i18n-t>
              </div>
              <!-- -> Boxed like the tenant URL above, and for the same reason: it is a literal to
                   be copied into a connector's configuration rather than prose to be read. -->
              <div
                class="text-caption font-robotomono mt-2 break-all rounded border border-black/12 bg-black/4 px-3 py-2 dark:border-white/15 dark:bg-white/6">
                Authorization: Bearer API-KEY-VALUE
              </div>
              <div class="mt-3">
                <!--
                  -> Solid: minting the key is the one thing this card asks somebody to go and do, so
                     it is an action rather than a link out. `WBtn` gives a solid button white text on
                     its own, so no `text-color` is needed.

                  -> `dense` sets one padding for both axes (Quasar's 0.285em), which leaves the icon
                     and the label flush against the ends. The override keeps the dense height and
                     puts the standard 16px back on the sides, as the dialog action buttons do.
                -->
                <w-btn
                  unelevated
                  dense
                  padding="xs md"
                  color="primary"
                  icon="la:external-link-alt"
                  :label="t(`admin.scim.authGoToKeys`)"
                  to="/_admin/api" />
              </div>
            </w-item-section>
          </w-item>
        </w-card>

        <!-- ----------------------- -->
        <!-- Status -->
        <!-- ----------------------- -->
        <w-card class="mt-4">
          <w-card-header>
            {{ t('admin.scim.status') }}
            <template #hint>{{ t('admin.scim.statusHint') }}</template>
          </w-card-header>
          <w-card-section class="pt-0">
            <div class="flex gap-8">
              <div>
                <div class="text-h5">{{ state.status.users }}</div>
                <div class="text-caption text-grey">{{ t('admin.scim.provisionedUsers') }}</div>
              </div>
              <div>
                <div class="text-h5">{{ state.status.groups }}</div>
                <div class="text-caption text-grey">{{ t('admin.scim.provisionedGroups') }}</div>
              </div>
            </div>
            <w-separator class="my-3" />
            <div class="text-caption text-grey">{{ t('admin.scim.lastRequest') }}</div>
            <div v-if="!state.status.lastRequest" class="text-caption mt-1">
              {{ t('admin.scim.lastRequestNone') }}
            </div>
            <template v-else>
              <div class="text-caption font-robotomono mt-1 break-all">
                {{ state.status.lastRequest.method }} {{ state.status.lastRequest.path }}
              </div>
              <div class="text-caption mt-1 flex items-center">
                <w-icon
                  class="mr-1"
                  size="xs"
                  :name="lastRequestOk ? 'la:check-circle' : 'la:exclamation-circle'"
                  :class="lastRequestOk ? 'text-positive' : 'text-negative'" />
                <span :class="lastRequestOk ? 'text-positive' : 'text-negative'">
                  {{ state.status.lastRequest.status }}
                </span>
                <span class="text-grey ml-2">{{ humanizeDate(state.status.lastRequest.at) }}</span>
              </div>
              <div v-if="state.status.lastRequest.message" class="text-caption text-grey mt-1">
                {{ state.status.lastRequest.message }}
              </div>
            </template>
            <!--
              -> Every API key is refused outright while the REST API is switched off, SCIM's
                 included, and a connector reports that only as a 401 it cannot explain. It belongs
                 in Status rather than beside the settings: nothing above is wrong, the endpoint
                 simply cannot answer anybody until that switch is on.

              -> The same solid red the Security screen uses for the two things that decide whether
                 the settings around them do what they look like they do. This is one of those.
            -->
            <w-card v-if="!state.apiEnabled" class="bg-negative text-white mt-3 rounded" flat>
              <w-card-section class="items-center" horizontal>
                <w-card-section class="flex-none pr-0">
                  <w-icon name="la:exclamation-triangle" size="lg" />
                </w-card-section>
                <w-card-section class="text-caption">
                  <div>{{ t('admin.scim.authApiDisabled') }}</div>
                </w-card-section>
              </w-card-section>
            </w-card>
          </w-card-section>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive } from 'vue'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'
import { apiErrorMessage } from '@/helpers/apiError'
import { copyToClipboard } from '@/helpers/clipboard'

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('admin.scim.title')
}))

// DATA

const state = reactive({
  enabled: false,
  loading: 0,
  isToggleLoading: false,
  // -> Read only, and only to warn: an API key authenticates nothing while the REST API is off
  apiEnabled: true,
  // -> Read only, and only to warn: with the proxy headers untrusted every request carries the
  //    proxy's address, so an allow list would be matched against the wrong thing
  trustProxy: true,
  config: {
    deleteAction: 'deactivate',
    emailSource: 'userName',
    allowGroupCreate: true,
    rateLimitEnabled: true,
    rateLimitMax: 600,
    rateLimitWindow: '1m',
    rateLimitBan: '1m'
  },
  /*
    The allow list is edited as text, one entry per line, and stored as an array. Kept outside
    `config` for that reason: what the box holds is not what is saved, and a half-typed line must
    not disappear the moment it is not yet a valid address.
  */
  ipAllowListText: '',
  status: {
    users: 0,
    groups: 0,
    lastRequest: null
  }
})

// COMPUTED

/*
  Built from the browser's own origin rather than from anything stored: the wiki has no single
  canonical hostname — a site may be bound to the catch-all — and the URL an administrator needs is
  the one their identity provider can actually reach, which is the one they are looking at.
*/
const tenantUrl = computed(() => `${window.location.origin}/_scim/v2`)

const lastRequestOk = computed(() => (state.status.lastRequest?.status ?? 500) < 400)

/** The textarea as the API wants it: trimmed, blanks dropped, one entry per line or comma. */
const ipAllowListEntries = computed(() =>
  state.ipAllowListText
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
)

// METHODS

function humanizeDate(val) {
  if (!val) {
    return '---'
  }
  return Temporal.Instant.from(val).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  })
}

async function load() {
  state.loading++
  loading.show()
  try {
    const [config, status, api, security] = await Promise.all([
      API_CLIENT.get('system/scim').json(),
      API_CLIENT.get('system/scim/status').json(),
      API_CLIENT.get('system/api').json(),
      API_CLIENT.get('system/security').json()
    ])
    state.enabled = config?.isEnabled === true
    state.config = { ...state.config, ...config }
    state.status = { ...state.status, ...status }
    state.apiEnabled = api?.isEnabled === true
    state.trustProxy = security?.trustProxy === true
    // -> Back into the box one per line; `config.ipAllowList` itself is not bound to anything
    state.ipAllowListText = (config?.ipAllowList ?? []).join('\n')
    /*
      Keeps the status light in the admin sidebar in step without another round trip, as the Metrics
      screen does for its own. Both flags, because the SCIM light reads them together: enabled with
      the API off is the orange state.
    */
    adminStore.info.isScimEnabled = state.enabled
    adminStore.info.isApiEnabled = state.apiEnabled
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.scim.loadFailed'),
      caption: apiErrorMessage(err)
    })
  }
  loading.hide()
  state.loading--
}

async function refresh() {
  await load()
  notify({
    type: 'positive',
    message: t('admin.scim.refreshSuccess')
  })
}

async function copyTenantUrl() {
  await copyToClipboard(tenantUrl.value)
  notify({
    type: 'positive',
    message: t('admin.scim.tenantUrlCopied')
  })
}

async function save() {
  state.loading++
  try {
    const resp = await API_CLIENT.put('system/scim', {
      json: {
        deleteAction: state.config.deleteAction,
        emailSource: state.config.emailSource,
        allowGroupCreate: state.config.allowGroupCreate,
        rateLimitEnabled: state.config.rateLimitEnabled,
        rateLimitMax: state.config.rateLimitMax,
        rateLimitWindow: state.config.rateLimitWindow,
        rateLimitBan: state.config.rateLimitBan,
        ipAllowList: ipAllowListEntries.value
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occurred.')
    }
    notify({
      type: 'positive',
      message: t('admin.scim.saveSuccess')
    })
    await load()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.scim.saveFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading--
}

async function globalSwitch() {
  state.isToggleLoading = true
  const wanted = !state.enabled
  try {
    const resp = await API_CLIENT.put('system/scim', {
      json: { isEnabled: wanted }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occurred.')
    }
    notify({
      type: 'positive',
      message: wanted
        ? t('admin.scim.toggleStateEnabledSuccess')
        : t('admin.scim.toggleStateDisabledSuccess')
    })
    await load()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.scim.toggleStateFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.isToggleLoading = false
}

// MOUNTED

onMounted(load)
</script>

<style lang="scss"></style>
