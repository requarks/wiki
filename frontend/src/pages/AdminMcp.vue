<template>
  <w-page class="admin-mcp">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-ai.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">{{ t('admin.mcp.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.mcp.subtitle') }}
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center">
          <template v-if="state.enabled">
            <w-signal class="mr-2" color="green" size="md" />
            <div class="text-caption text-green">{{ t('admin.mcp.enabled') }}</div>
          </template>
          <template v-else>
            <w-signal class="mr-2" color="red" size="md" />
            <div class="text-caption text-red">{{ t('admin.mcp.disabled') }}</div>
          </template>
        </div>
      </div>
      <div class="flex-none flex items-center">
        <w-btn-toggle
          class="ml-4 mr-4"
          v-model="state.displayMode"
          push
          no-caps
          :toggle-color="dark.isActive ? `white` : `black`"
          :toggle-text-color="dark.isActive ? `black` : `white`"
          :text-color="dark.isActive ? `white` : `black`"
          :color="dark.isActive ? `dark-1` : `white`"
          :options="[
            { label: t('admin.mcp.config'), value: 'config' },
            { label: t('admin.mcp.history'), value: 'history' }
          ]" />
        <w-separator class="mr-4" vertical />
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/dev/mcp`"
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
          :label="!state.enabled ? t(`admin.mcp.enableButton`) : t(`admin.mcp.disableButton`)"
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
    <div v-if="state.displayMode === `config`" class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- Endpoint -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.mcp.endpoint') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="link" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.mcp.endpointUrl`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mcp.endpointUrlHint`) }}</w-item-label>
              <!-- -> Boxed and with its copy button beside it, as the SCIM tenant URL is: it is a
                   value to be pasted into a client, not prose to be read -->
              <div class="mt-2 flex items-center gap-2">
                <div
                  class="text-caption font-robotomono min-w-0 flex-1 break-all rounded border border-black/12 bg-black/4 px-3 py-2 dark:border-white/15 dark:bg-white/6">
                  {{ endpointUrl }}
                </div>
                <w-btn
                  class="acrylic-btn shrink-0"
                  icon="la:copy"
                  flat
                  dense
                  color="secondary"
                  :aria-label="t(`common.actions.copy`)"
                  @click="copy(endpointUrl)">
                  <w-tooltip>{{ t(`common.actions.copy`) }}</w-tooltip>
                </w-btn>
              </div>
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="key" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.mcp.auth`) }}</w-item-label>
              <w-item-label caption>
                <i18n-t keypath="admin.mcp.authHint" scope="global">
                  <template #scope><strong class="font-robotomono">mcp</strong></template>
                  <template #permission>
                    <strong class="font-robotomono">use:mcp</strong>
                  </template>
                </i18n-t>
              </w-item-label>
              <div class="text-caption mt-3">{{ t('admin.mcp.connectClients') }}</div>
              <mcp-connect-snippets class="mt-2" />
              <div class="mt-3">
                <w-btn
                  unelevated
                  dense
                  padding="xs md"
                  color="primary"
                  icon="la:external-link-alt"
                  :label="t(`admin.mcp.goToTokens`)"
                  to="/_profile/tokens" />
              </div>
            </w-item-section>
          </w-item>
        </w-card>

        <!-- ----------------------- -->
        <!-- Tools -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>
            {{ t('admin.mcp.tools') }}
            <template #hint>{{ t('admin.mcp.toolsHint') }}</template>
          </w-card-header>
          <template v-for="(group, index) of toolGroups" :key="group.key">
            <w-separator v-if="index > 0" class="my-2" inset />
            <w-item tag="label">
              <blueprint-icon :icon="group.icon" top />
              <w-item-section>
                <w-item-label>
                  {{ t(`admin.mcp.group.${group.key}`) }}
                  <span class="text-caption font-robotomono text-grey ml-2">{{
                    group.scopes
                  }}</span>
                </w-item-label>
                <w-item-label caption>{{ t(`admin.mcp.groupHint.${group.key}`) }}</w-item-label>
                <w-item-label
                  v-if="group.key === `destructive` && state.config.tools.destructive"
                  class="text-caption text-negative mt-1 flex items-start">
                  <w-icon class="mr-1 mt-px" name="la:exclamation-triangle" size="xs" />
                  <span>{{ t('admin.mcp.destructiveWarning') }}</span>
                </w-item-label>
              </w-item-section>
              <w-item-section side>
                <w-toggle
                  v-model="state.config.tools[group.key]"
                  :color="group.key === `destructive` ? `negative` : `primary`"
                  :aria-label="t(`admin.mcp.group.${group.key}`)" />
              </w-item-section>
            </w-item>
          </template>
        </w-card>

        <!-- ----------------------- -->
        <!-- Guidance -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>
            {{ t('admin.mcp.guidance') }}
            <template #hint>{{ t('admin.mcp.guidanceHint') }}</template>
          </w-card-header>
          <w-item>
            <blueprint-icon icon="rules" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.mcp.guidelinesPath`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mcp.guidelinesPathHint`) }}</w-item-label>
              <div class="mt-2 flex items-center gap-2">
                <w-input
                  class="min-w-0 flex-1"
                  outlined
                  dense
                  v-model="state.site.guidelinesPath"
                  :prefix="`/`"
                  :placeholder="t(`admin.mcp.guidelinesPathPlaceholder`)"
                  :aria-label="t(`admin.mcp.guidelinesPath`)" />
                <!-- -> Opens the page, or the editor to write it: naming a page that does not exist
                     yet is the expected first step, not a mistake -->
                <w-btn
                  v-if="state.site.savedPath"
                  class="acrylic-btn shrink-0"
                  flat
                  dense
                  padding="xs md"
                  color="primary"
                  :icon="state.site.exists ? `la:external-link-alt` : `la:pen`"
                  :label="
                    state.site.exists
                      ? t(`admin.mcp.guidelinesOpen`)
                      : t(`admin.mcp.guidelinesWrite`)
                  "
                  :href="guidelinesHref"
                  target="_blank" />
              </div>
              <div
                v-if="state.site.savedPath && !state.site.exists"
                class="text-caption text-grey mt-1">
                {{ t('admin.mcp.guidelinesMissing') }}
              </div>
            </w-item-section>
          </w-item>
        </w-card>
      </div>

      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- Prerequisites -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>
            {{ t('admin.mcp.prerequisites') }}
            <template #hint>{{ t('admin.mcp.prerequisitesHint') }}</template>
          </w-card-header>
          <w-item v-for="item of prerequisites" :key="item.key">
            <w-item-section side>
              <w-icon
                :name="item.ok ? 'la:check-circle' : 'la:exclamation-circle'"
                :class="item.ok ? 'text-positive' : 'text-negative'" />
            </w-item-section>
            <w-item-section>
              <w-item-label>{{ t(`admin.mcp.prereq.${item.key}`) }}</w-item-label>
              <w-item-label caption>
                {{ t(`admin.mcp.prereq.${item.key}${item.ok ? 'Ok' : 'Missing'}`) }}
              </w-item-label>
            </w-item-section>
            <w-item-section side v-if="!item.ok && item.to">
              <w-btn flat dense color="primary" icon="la:arrow-right" :to="item.to">
                <w-tooltip>{{ t('admin.mcp.prereqGoTo') }}</w-tooltip>
              </w-btn>
            </w-item-section>
          </w-item>
        </w-card>

        <!-- ----------------------- -->
        <!-- Access -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>
            {{ t('admin.mcp.access') }}
            <template #hint>{{ t('admin.mcp.accessHint') }}</template>
          </w-card-header>
          <w-item>
            <blueprint-icon icon="user-groups" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.mcp.useMcp`) }}</w-item-label>
              <w-item-label caption>
                <i18n-t keypath="admin.mcp.useMcpHint" scope="global">
                  <template #permission>
                    <strong class="font-robotomono">use:mcp</strong>
                  </template>
                </i18n-t>
              </w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                dense
                padding="xs md"
                color="primary"
                icon="la:users"
                :label="t(`admin.mcp.goToGroups`)"
                to="/_admin/groups" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="test-account" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.mcp.allowAnonymous`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mcp.allowAnonymousHint`) }}</w-item-label>
              <w-item-label
                v-if="state.config.allowAnonymous"
                class="text-caption text-deep-orange mt-1 flex items-start">
                <w-icon class="mr-1 mt-px" name="la:exclamation-triangle" size="xs" />
                <span>{{ t('admin.mcp.allowAnonymousWarning') }}</span>
              </w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-toggle
                v-model="state.config.allowAnonymous"
                color="primary"
                :aria-label="t(`admin.mcp.allowAnonymous`)" />
            </w-item-section>
          </w-item>
        </w-card>

        <!-- ----------------------- -->
        <!-- Safety -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.mcp.safety') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="new-document" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.mcp.newPagePublishState`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mcp.newPagePublishStateHint`) }}</w-item-label>
              <div class="mt-3 flex gap-6">
                <w-radio
                  v-model="state.config.newPagePublishState"
                  val="published"
                  :label="t(`admin.mcp.publishStatePublished`)" />
                <w-radio
                  v-model="state.config.newPagePublishState"
                  val="draft"
                  :label="t(`admin.mcp.publishStateDraft`)" />
              </div>
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="width" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mcp.maxResultChars`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mcp.maxResultCharsHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section style="flex: 0 0 200px">
              <w-input
                outlined
                dense
                v-model.number="state.config.maxResultChars"
                :suffix="t(`admin.mcp.charsSuffix`)"
                :aria-label="t(`admin.mcp.maxResultChars`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="filtration" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mcp.rateLimitBurst`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mcp.rateLimitBurstHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section style="flex: 0 0 200px">
              <w-input
                outlined
                dense
                v-model.number="state.config.rateLimitBurst"
                :suffix="t(`admin.mcp.callsSuffix`)"
                :aria-label="t(`admin.mcp.rateLimitBurst`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="timer" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mcp.rateLimitPerMinute`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mcp.rateLimitPerMinuteHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section style="flex: 0 0 200px">
              <w-input
                outlined
                dense
                v-model.number="state.config.rateLimitPerMinute"
                :suffix="t(`admin.mcp.perMinuteSuffix`)"
                :aria-label="t(`admin.mcp.rateLimitPerMinute`)" />
            </w-item-section>
          </w-item>
        </w-card>

        <!-- ----------------------- -->
        <!-- Display -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.mcp.display') }}</w-card-header>
          <w-item tag="label">
            <blueprint-icon icon="bot" top />
            <w-item-section>
              <w-item-label>{{ t(`admin.mcp.showAiBadge`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mcp.showAiBadgeHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-toggle
                v-model="state.config.showAiBadge"
                color="primary"
                :aria-label="t(`admin.mcp.showAiBadge`)" />
            </w-item-section>
          </w-item>
        </w-card>
      </div>
    </div>
    <div v-else class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- OAuth Clients -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>
            {{ t('admin.mcp.oauthClients') }}
            <template #hint>{{ t('admin.mcp.oauthClientsHint') }}</template>
          </w-card-header>
          <w-card-section v-if="state.clients.length < 1" class="text-caption text-grey pt-2 pb-4">
            {{ t('admin.mcp.oauthClientsNone') }}
          </w-card-section>
          <w-list v-else dense>
            <w-item v-for="client of state.clients" :key="client.id">
              <w-item-section>
                <w-item-label>{{ client.name }}</w-item-label>
                <w-item-label caption>
                  {{
                    t('admin.mcp.oauthClientInfo', {
                      date: userStore.formatDateTime(t, client.createdAt),
                      count: client.grants,
                      hosts: redirectHosts(client)
                    })
                  }}
                </w-item-label>
              </w-item-section>
              <w-item-section side>
                <w-btn
                  class="acrylic-btn"
                  flat
                  dense
                  color="negative"
                  icon="la:trash-alt"
                  :aria-label="t('admin.mcp.oauthClientDelete')"
                  @click="deleteClient(client)">
                  <w-tooltip>{{ t('admin.mcp.oauthClientDelete') }}</w-tooltip>
                </w-btn>
              </w-item-section>
            </w-item>
          </w-list>
        </w-card>
      </div>
      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- Contributions -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>
            {{ t('admin.mcp.contributions') }}
            <template #hint>{{ t('admin.mcp.contributionsHint') }}</template>
          </w-card-header>
          <w-card-section
            v-if="state.contributions.length < 1"
            class="text-caption text-grey pt-2 pb-4">
            {{ t('admin.mcp.contributionsNone') }}
          </w-card-section>
          <w-list v-else separator>
            <w-item
              v-for="entry of state.contributions"
              :key="entry.id"
              clickable
              :href="versionHref(entry)"
              target="_blank">
              <w-item-section>
                <w-item-label class="truncate">{{ entry.title }}</w-item-label>
                <w-item-label caption class="truncate">
                  {{ siteTitleOf(entry) }} ·
                  <span class="font-robotomono">{{ entry.url }}</span>
                </w-item-label>
                <w-item-label caption class="mt-1">
                  {{ t('admin.mcp.contributionFor', { name: entry.authorName || '?' }) }}
                </w-item-label>
                <w-item-label v-if="entry.reason" caption class="italic mt-1">
                  {{ entry.reason }}
                </w-item-label>
              </w-item-section>
              <!-- -> What it did and when, kept to the right so the left reads as the page -->
              <w-item-section side top class="gap-1">
                <w-badge :color="actionColor(entry.action)" rounded>
                  {{ actionLabel(entry.action) }}
                </w-badge>
                <span class="text-caption text-grey whitespace-nowrap">
                  {{ userStore.formatDateTime(t, entry.versionDate) }}
                </span>
              </w-item-section>
            </w-item>
          </w-list>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive, watch } from 'vue'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { confirm } from '@/composables/dialog'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'
import { apiErrorMessage } from '@/helpers/apiError'
import { copyToClipboard } from '@/helpers/clipboard'
import { mcpEndpointUrl } from '@/helpers/mcpClients'

import McpConnectSnippets from '@/components/McpConnectSnippets.vue'

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// COMPOSABLES

const dark = useDark()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('admin.mcp.title')
}))

// DATA

/**
 * The tool groups, in the order the backend declares them (`MCP_TOOL_GROUPS` in
 * `backend/models/mcp.ts`), with the scopes a token needs for each.
 */
const toolGroups = [
  { key: 'discover', icon: 'search', scopes: 'mcp:read + pages:read' },
  { key: 'pages', icon: 'parchment', scopes: 'mcp:read + pages:read' },
  { key: 'history', icon: 'historical', scopes: 'mcp:read + pages:read' },
  { key: 'glossary', icon: 'index', scopes: 'mcp:* + glossary:*' },
  { key: 'comments', icon: 'discussion-forum', scopes: 'mcp:* + comments:*' },
  { key: 'suggest', icon: 'merge-files', scopes: 'mcp:write + approvals:write' },
  { key: 'edit', icon: 'pen', scopes: 'mcp:write + pages:write' },
  { key: 'assets', icon: 'add-image', scopes: 'mcp:* + assets:*' },
  { key: 'destructive', icon: 'trash', scopes: 'mcp:write + pages:write' }
]

const state = reactive({
  // -> `config` for the settings, `history` for what has used them: the OAuth clients and contributions
  displayMode: 'config',
  enabled: false,
  loading: 0,
  isToggleLoading: false,
  config: {
    allowAnonymous: false,
    tools: Object.fromEntries(toolGroups.map((group) => [group.key, false])),
    newPagePublishState: 'published',
    maxResultChars: 50000,
    rateLimitBurst: 60,
    rateLimitPerMinute: 300,
    showAiBadge: true
  },
  /*
    The one setting that belongs to the site being looked at rather than to the instance, saved with
    the rest by Apply. `savedPath` is what is stored, which the open/write button follows: the box may
    hold a path that is still being typed.
  */
  site: {
    guidelinesPath: '',
    savedPath: '',
    exists: false
  },
  // -> What assistants wrote on every site in the last week, off page history
  contributions: [],
  // -> The MCP clients that registered to sign in through OAuth, with their grant counts
  clients: [],
  status: {
    isApiEnabled: true,
    arePersonalTokensAllowed: true,
    isRendererAvailable: true
  }
})

// COMPUTED

// -> The browser's own origin, as the SCIM screen builds its tenant URL: the host the administrator is
//    looking at is the one the site they are configuring answers on
const endpointUrl = computed(() => mcpEndpointUrl())

// -> The page itself — or, while there is none, the missing-page screen there, which offers to create it
const guidelinesHref = computed(() => `/${state.site.savedPath}`)

const prerequisites = computed(() => [
  { key: 'api', ok: state.status.isApiEnabled, to: '/_admin/api' },
  { key: 'tokens', ok: state.status.arePersonalTokensAllowed, to: '/_admin/auth' },
  { key: 'renderer', ok: state.status.isRendererAvailable, to: '/_admin/extensions' }
])

// METHODS

/** The name of the site a contribution was made on, from the site list the admin layout has loaded. */
function siteTitleOf(entry) {
  return adminStore.sites.find((site) => site.id === entry.siteId)?.title ?? entry.hostname ?? ''
}

/**
 * The version a contribution made, on its own site's host: `/_version/<id>` is resolved against the
 * site the host answers for, so a version from another site has to be opened there. A site on the
 * catch-all has no host of its own (null), and is reached on this one — as on the Dashboard.
 */
function versionHref(entry) {
  const path = `/_version/${entry.id}`
  return !entry.hostname || entry.siteId === siteStore.id
    ? path
    : `${window.location.protocol}//${entry.hostname}${path}`
}

/** The colours the page history timeline gives each action (`ACTION_STYLES` in PageHistoryOverlay). */
const ACTION_COLORS = {
  created: 'positive',
  updated: 'blue-7',
  moved: 'warning',
  deleted: 'negative',
  restored: 'teal'
}

function actionColor(action) {
  return ACTION_COLORS[action] ?? 'grey-7'
}

function actionLabel(action) {
  return ACTION_COLORS[action] ? t(`history.action.${action}`) : action
}

async function load() {
  state.loading++
  loading.show()
  try {
    const [config, status, site, contributions] = await Promise.all([
      API_CLIENT.get('system/mcp').json(),
      API_CLIENT.get('system/mcp/status').json(),
      API_CLIENT.get(`sites/${adminStore.currentSiteId}/mcp`).json(),
      API_CLIENT.get('system/mcp/contributions').json()
    ])
    state.contributions = contributions ?? []
    state.clients = await API_CLIENT.get('system/mcp/clients').json()
    state.site = {
      guidelinesPath: site?.guidelinesPath ?? '',
      savedPath: site?.guidelinesPath ?? '',
      exists: site?.exists === true
    }
    state.enabled = config?.isEnabled === true
    state.config = {
      ...state.config,
      ...config,
      tools: { ...state.config.tools, ...config?.tools }
    }
    state.status = { ...state.status, ...status }
    // -> Keeps the sidebar light in step without another round trip
    adminStore.info.isMCPEnabled = state.enabled
    adminStore.info.isApiEnabled = state.status.isApiEnabled
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.mcp.loadFailed'),
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
    message: t('admin.mcp.refreshSuccess')
  })
}

/** Where a client sends the browser back to, as hosts: what tells two clients of one name apart. */
function redirectHosts(client) {
  return [
    ...new Set(
      client.redirectUris.map((uri) => {
        try {
          return new URL(uri).host || uri
        } catch {
          return uri
        }
      })
    )
  ].join(', ')
}

function deleteClient(client) {
  confirm({
    title: t('common.actions.confirm'),
    message: t('admin.mcp.oauthClientDeleteConfirm', { name: client.name, count: client.grants }),
    cancel: true,
    color: 'negative',
    okLabel: t('admin.mcp.oauthClientDelete')
  }).onOk(async () => {
    try {
      await API_CLIENT.delete(`system/mcp/clients/${client.id}`).json()
      notify({ type: 'positive', message: t('admin.mcp.oauthClientDeleted') })
      await load()
    } catch (err) {
      notify({
        type: 'negative',
        message: t('admin.mcp.oauthClientDeleteFailed'),
        caption: apiErrorMessage(err)
      })
    }
  })
}

async function copy(text) {
  await copyToClipboard(text)
  notify({
    type: 'positive',
    message: t('admin.mcp.copied')
  })
}

async function save() {
  state.loading++
  try {
    const resp = await API_CLIENT.put('system/mcp', {
      json: {
        allowAnonymous: state.config.allowAnonymous,
        tools: state.config.tools,
        newPagePublishState: state.config.newPagePublishState,
        maxResultChars: state.config.maxResultChars,
        rateLimitBurst: state.config.rateLimitBurst,
        rateLimitPerMinute: state.config.rateLimitPerMinute,
        showAiBadge: state.config.showAiBadge
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occurred.')
    }
    if (state.site.guidelinesPath.trim() !== state.site.savedPath) {
      await API_CLIENT.put(`sites/${adminStore.currentSiteId}/mcp`, {
        json: { guidelinesPath: state.site.guidelinesPath.trim().replace(/^\/+/, '') }
      }).json()
    }
    notify({
      type: 'positive',
      message: t('admin.mcp.saveSuccess')
    })
    await load()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.mcp.saveFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading--
}

async function globalSwitch() {
  state.isToggleLoading = true
  const wanted = !state.enabled
  try {
    const resp = await API_CLIENT.put('system/mcp', {
      json: { isEnabled: wanted }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occurred.')
    }
    notify({
      type: 'positive',
      message: wanted
        ? t('admin.mcp.toggleStateEnabledSuccess')
        : t('admin.mcp.toggleStateDisabledSuccess')
    })
    await load()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.mcp.toggleStateFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.isToggleLoading = false
}

// WATCHERS

// -> The guidelines page is the site's, so a different site picked in the sidebar is a different page
watch(
  () => adminStore.currentSiteId,
  () => load()
)

// MOUNTED

onMounted(load)
</script>

<style lang="scss"></style>
