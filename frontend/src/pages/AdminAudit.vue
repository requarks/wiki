<template>
  <w-page class="admin-audit">
    <div class="flex flex-wrap items-center p-4">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-event-log.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">{{ t('admin.audit.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.audit.subtitle') }}
        </div>
      </div>
      <div class="flex flex-none items-center">
        <!--
          Ahead of the utility buttons and fenced off from them: this is the one control here that
          takes something away with it, where the three beside it read documentation, reload the
          screen, or open a setting.
        -->
        <w-btn
          class="mr-2 acrylic-btn"
          flat
          icon="la:file-download"
          :color="dark.isActive ? `indigo-4` : `indigo`"
          :label="t(`admin.audit.export`)"
          :loading="state.exporting"
          @click="exportLog" />
        <w-separator vertical class="mr-2 h-6 self-center" />
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/audit`"
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
          @click="refresh">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <!--
          Reading the log and deciding how long it is kept are different authorities: shortening the
          retention destroys evidence. The endpoint behind this needs `manage:system`, so the button
          is only offered to somebody who holds it.
        -->
        <w-btn
          v-if="canManageRetention"
          unelevated
          icon="la:hourglass-half"
          color="secondary"
          :label="t(`admin.audit.retention`)">
          <audit-retention-menu />
        </w-btn>
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 gap-4 p-4">
      <div class="col-span-12">
        <w-card>
          <!--
            Every child is now one control on one line, so they align on their own box rather than on
            a taller neighbour's.
          -->
          <w-card-section class="flex flex-wrap items-center gap-3">
            <!--
              The user filter is a picker rather than a dropdown: an instance can have more accounts
              than a select should ever hold, and the search dialog already exists for exactly this.
              It carries its own label inline, since a button has no floating-label chrome to put one
              in and a caption line above it would stand this column a line taller than the four
              beside it.

              `my-2` matches what an outlined WInput/WSelect gives its own control (see
              `controlClasses` there) to leave room for the floated label. Without it a bare button
              in this row bottom-aligns 8px below the fields, which is exactly what it did.

              The colour is per theme because `primary-light` is a 60% primary / 40% white mix: it
              reads at 6.9:1 on the dark card and 2.4:1 on the white one, where it is a pale blue on
              white. Full `primary` carries the light theme, as it does for every other flat button
              on a card.
            -->
            <div class="my-2 flex min-w-[220px] flex-1 items-center gap-2">
              <w-btn
                class="acrylic-btn"
                flat
                no-caps
                icon="la:user"
                :color="dark.isActive ? `primary-light` : `primary`"
                :label="userFilterLabel"
                @click="pickUser" />
              <w-btn
                v-if="state.filterUsers.length > 0"
                class="acrylic-btn"
                flat
                dense
                icon="la:times"
                color="grey"
                :aria-label="t('common.actions.clear')"
                @click="clearUser" />
            </div>
            <div class="min-w-[160px] flex-1">
              <w-select
                outlined
                dense
                v-model="state.filterKind"
                :options="kindOptions"
                emit-value
                map-options
                :label="t('admin.audit.field.kind')" />
            </div>
            <div class="min-w-[220px] flex-1">
              <w-select
                outlined
                dense
                v-model="state.filterAction"
                :options="actionOptions"
                emit-value
                map-options
                :label="t('admin.audit.field.action')" />
            </div>
            <!--
              `datetime-local`, so the two bounds are entered in the reader's own clock and converted
              on the way out. The API takes instants; a wall-clock string would be ambiguous the
              moment two administrators sat in different time zones.
            -->
            <div class="min-w-[200px] flex-1">
              <w-input
                outlined
                dense
                type="datetime-local"
                v-model="state.filterFrom"
                :label="t('admin.audit.field.from')" />
            </div>
            <div class="min-w-[200px] flex-1">
              <w-input
                outlined
                dense
                type="datetime-local"
                v-model="state.filterTo"
                :label="t('admin.audit.field.to')" />
            </div>
            <!-- -> Same `my-2` as the user button above, for the same reason -->
            <div class="my-2 flex-none">
              <w-btn
                class="acrylic-btn"
                flat
                no-caps
                icon="la:eraser"
                color="grey"
                :label="t('admin.audit.clearFilters')"
                :disable="!hasFilters"
                @click="clearFilters" />
            </div>
          </w-card-section>
        </w-card>
      </div>
      <div class="col-span-12">
        <w-banner
          v-if="state.entries.length < 1 && state.loading < 1"
          rounded
          :class="dark.isActive ? `bg-dark-3 text-grey-4` : `bg-grey-2 text-grey-8`">
          {{ hasFilters ? t('admin.audit.noneMatching') : t('admin.audit.none') }}
        </w-banner>
        <w-card v-else>
          <w-table
            :rows="state.entries"
            :columns="headers"
            row-key="id"
            flat
            :loading="state.loading > 0">
            <template #body-cell-ts="props">
              <w-td :props="props">
                <div>{{ userStore.formatDateTime(t, props.value) }}</div>
                <small class="text-grey">{{ relativeDate(props.value) }}</small>
              </w-td>
            </template>
            <template #body-cell-user="props">
              <w-td :props="props">
                <!--
                  Read off `meta.actor`, which is the copy taken when the entry was written. An
                  account that has since been deleted keeps its name here, which is the whole reason
                  that copy exists.
                -->
                <div>
                  <strong>{{ props.row.meta?.actor?.name || t('admin.audit.anonymous') }}</strong>
                  <w-icon
                    v-if="!props.row.userId && props.row.meta?.actor?.email"
                    class="ml-1"
                    name="la:user-slash"
                    color="grey"
                    size="xs">
                    <w-tooltip>{{ t('admin.audit.accountGone') }}</w-tooltip>
                  </w-icon>
                </div>
                <small class="text-grey" v-if="props.row.meta?.actor?.email">
                  {{ props.row.meta.actor.email }}
                </small>
              </w-td>
            </template>
            <template #body-cell-kind="props">
              <w-td :props="props">
                <w-chip
                  square
                  size="sm"
                  dense
                  :color="kindStyle(props.value).color"
                  :text-color="kindStyle(props.value).textColor">
                  {{ t(`admin.audit.kinds.${props.value}`, props.value) }}
                </w-chip>
              </w-td>
            </template>
            <template #body-cell-action="props">
              <w-td :props="props">
                <div>{{ t(`admin.audit.actions.${props.value}`, props.value) }}</div>
                <small class="text-grey font-mono">{{ props.value }}</small>
              </w-td>
            </template>
            <template #body-cell-clientIP="props">
              <w-td :props="props">
                <span class="font-mono">{{ props.value || '---' }}</span>
              </w-td>
            </template>
            <template #body-cell-details="props">
              <w-td :props="props">
                <w-btn
                  class="acrylic-btn"
                  flat
                  no-caps
                  icon="la:search-plus"
                  :color="dark.isActive ? `indigo-4` : `indigo`"
                  :label="t('admin.audit.viewDetails')"
                  @click="showEntry(props.row)" />
              </w-td>
            </template>
          </w-table>
        </w-card>
        <div class="mt-6 flex items-center justify-center" v-if="state.totalPages > 1">
          <w-pagination
            v-model="state.currentPage"
            :max="state.totalPages"
            :max-pages="9"
            boundary-numbers
            direction-links />
        </div>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { computed, onMounted, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { dialog } from '@/composables/dialog'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { fileSave } from 'browser-fs-access'

import { relativeDate } from '@/helpers/datetime'
import { apiErrorMessage } from '@/helpers/apiError'

import AuditEntryDialog from '@/components/AuditEntryDialog.vue'
import AuditRetentionMenu from '@/components/AuditRetentionMenu.vue'
import UserSearchDialog from '@/components/UserSearchDialog.vue'

// COMPOSABLES

const dark = useDark()

// STORES

const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('admin.audit.title')
}))

// DATA

const state = reactive({
  entries: [],
  /** Every action key the server records, by area — what the action filter is built from. */
  actionsByKind: [],
  loading: 0,
  exporting: false,
  /*
    A list, because the picker behind it selects a set — it has checkboxes. Taking only the first of
    what somebody chose and labelling the button with that one name told them the other selections
    had been applied when they had been thrown away.
  */
  filterUsers: [],
  filterKind: null,
  filterAction: null,
  filterFrom: '',
  filterTo: '',
  currentPage: 1,
  pageSize: 25,
  totalPages: 1
})

/*
  A computed, not a plain array: the locale strings are fetched after the app mounts
  (`App.vue` → `applyLocale`), so a `t()` called once during `setup()` can resolve before they land
  and leave the header row showing raw keys for the life of the page. Inside a computed it
  re-evaluates when `setLocaleMessage` fills them in.
*/
const headers = computed(() => [
  {
    label: t('admin.audit.field.timestamp'),
    align: 'left',
    field: 'ts',
    name: 'ts',
    sortable: false,
    style: 'width: 200px'
  },
  {
    label: t('admin.audit.field.user'),
    align: 'left',
    field: 'user',
    name: 'user',
    sortable: false,
    style: 'width: 260px'
  },
  {
    label: t('admin.audit.field.kind'),
    align: 'left',
    field: 'kind',
    name: 'kind',
    sortable: false,
    style: 'width: 110px'
  },
  {
    label: t('admin.audit.field.action'),
    align: 'left',
    field: 'action',
    name: 'action',
    sortable: false
  },
  {
    label: t('admin.audit.field.clientIP'),
    align: 'left',
    field: 'clientIP',
    name: 'clientIP',
    sortable: false,
    style: 'width: 160px'
  },
  {
    label: '',
    align: 'right',
    field: 'details',
    name: 'details',
    sortable: false,
    style: 'width: 140px'
  }
])

/*
  One colour per area, so a kind is recognisable before its label is read.

  The text colour travels with it rather than being a fixed `white` on the chip: amber is light
  enough that white on it is around 1.9:1, so that one carries its own dark ink. Anything added here
  needs the same check — the badge is the only thing distinguishing five areas at a glance, and one
  that cannot be read is worse than no badge.
*/
const KIND_STYLES = {
  page: { color: 'blue', textColor: 'white' },
  asset: { color: 'teal', textColor: 'white' },
  auth: { color: 'amber', textColor: 'grey-10' },
  profile: { color: 'purple', textColor: 'white' },
  admin: { color: 'red', textColor: 'white' }
}

const DEFAULT_KIND_STYLE = { color: 'grey', textColor: 'white' }

// COMPUTED

const canManageRetention = computed(() => userStore.can('manage:system'))

const kindOptions = computed(() => [
  { label: t('admin.audit.allKinds'), value: null },
  ...state.actionsByKind.map(({ kind }) => ({
    label: t(`admin.audit.kinds.${kind}`, kind),
    value: kind
  }))
])

/*
  Narrowed by the selected kind, since an action belongs to exactly one area: picking `page` and then
  `updateSite` would match nothing, and offering the pair is offering an empty result.
*/
const actionOptions = computed(() => {
  const groups = state.filterKind
    ? state.actionsByKind.filter(({ kind }) => kind === state.filterKind)
    : state.actionsByKind
  return [
    { label: t('admin.audit.allActions'), value: null },
    ...groups
      .flatMap(({ actions }) => actions)
      .map((action) => ({ label: t(`admin.audit.actions.${action}`, action), value: action }))
      .toSorted((a, b) => a.label.localeCompare(b.label))
  ]
})

/*
  One name when one account is picked, a count when several are — a row of names would outgrow the
  button and truncate, which is the same "shows you part of what you chose" problem as before.
*/
const userFilterLabel = computed(() => {
  if (state.filterUsers.length === 1) {
    return t('admin.audit.userFilter', { name: state.filterUsers[0].name })
  }
  if (state.filterUsers.length > 1) {
    return t('admin.audit.userFilterMany', { count: state.filterUsers.length })
  }
  return t('admin.audit.userFilter', { name: t('admin.audit.anyUser') })
})

const hasFilters = computed(
  () =>
    state.filterUsers.length > 0 ||
    Boolean(state.filterKind) ||
    Boolean(state.filterAction) ||
    Boolean(state.filterFrom) ||
    Boolean(state.filterTo)
)

// WATCHERS

watch(
  () => [state.filterUsers, state.filterKind, state.filterAction, state.filterFrom, state.filterTo],
  () => {
    // -> Back to the first page: page 7 of the old filter is meaningless under the new one
    state.currentPage = 1
    load({ page: 1 })
  }
)

watch(
  () => state.currentPage,
  (newValue) => {
    load({ page: newValue })
  }
)

/*
  An action that no longer belongs to the selected kind cannot match anything, so it is dropped
  rather than left showing a filter that returns nothing.
*/
watch(
  () => state.filterKind,
  (kind) => {
    if (!kind || !state.filterAction) {
      return
    }
    const group = state.actionsByKind.find((g) => g.kind === kind)
    if (!group?.actions.includes(state.filterAction)) {
      state.filterAction = null
    }
  }
)

// METHODS

/**
 * A `datetime-local` value as an instant the API can compare against.
 *
 * The input gives a wall-clock string with no zone, which is the reader's own clock — `Date` parses
 * it in exactly that zone, so this is the conversion rather than a reinterpretation.
 */
function boundaryToInstant(value) {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/**
 * The filters as the API takes them.
 *
 * One function for the table and the export, so a download can never quietly cover a different set
 * of entries than the screen it was taken from.
 */
function filterParams() {
  const from = boundaryToInstant(state.filterFrom)
  const to = boundaryToInstant(state.filterTo)
  return {
    ...(state.filterUsers.length > 0
      ? { userId: state.filterUsers.map((u) => u.id).join(',') }
      : {}),
    ...(state.filterKind ? { kind: state.filterKind } : {}),
    ...(state.filterAction ? { action: state.filterAction } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {})
  }
}

/**
 * Download everything matching the current filters as JSONL.
 *
 * The whole result, not the page on screen — a filtered export that stopped at 25 rows would be a
 * quietly wrong file. The server streams it, so what is held here is the finished download rather
 * than the query behind it.
 */
async function exportLog() {
  state.exporting = true
  try {
    const blob = await API_CLIENT.get('audit/export', { searchParams: filterParams() }).blob()
    const stamp = Temporal.Now.instant().toString({ smallestUnit: 'second' }).replaceAll(':', '-')
    await fileSave(blob, {
      fileName: `audit-log-${stamp}.jsonl`,
      extensions: ['.jsonl']
    })
  } catch (err) {
    // -> Dismissing the save picker is not a failure, as in the other exports on this app
    if (err.name !== 'AbortError') {
      notify({
        type: 'negative',
        message: t('admin.audit.exportFailed'),
        caption: apiErrorMessage(err)
      })
    }
  }
  state.exporting = false
}

async function load({ page } = {}) {
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.get('audit', {
      searchParams: {
        ...filterParams(),
        page: page ?? state.currentPage ?? 1,
        limit: state.pageSize
      }
    }).json()
    state.entries = resp?.entries ?? []
    state.totalPages = Math.max(1, Math.ceil((resp?.total ?? 0) / state.pageSize))
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.audit.loadFailed'),
      caption: apiErrorMessage(err)
    })
  }
  loading.hide()
  state.loading--
}

async function loadActions() {
  try {
    state.actionsByKind = await API_CLIENT.get('audit/actions').json()
  } catch (err) {
    // -> The log itself still reads; only the action filter is left empty
    notify({
      type: 'negative',
      message: t('admin.audit.loadActionsFailed'),
      caption: apiErrorMessage(err)
    })
  }
}

function refresh() {
  load()
}

function kindStyle(kind) {
  return KIND_STYLES[kind] ?? DEFAULT_KIND_STYLE
}

function pickUser() {
  dialog({
    component: UserSearchDialog,
    componentProps: {
      title: t('admin.audit.pickUserTitle')
    }
  }).onOk((users) => {
    // -> Replaces rather than adds: the dialog opens with nothing ticked, so what comes back is the
    //    whole of what was just chosen
    state.filterUsers = users ?? []
  })
}

function clearUser() {
  state.filterUsers = []
}

function clearFilters() {
  state.filterUsers = []
  state.filterKind = null
  state.filterAction = null
  state.filterFrom = ''
  state.filterTo = ''
}

function showEntry(entry) {
  dialog({
    component: AuditEntryDialog,
    componentProps: { entry }
  })
}

// MOUNTED

onMounted(() => {
  loadActions()
  load({ page: 1 })
})
</script>
