<template>
  <w-layout view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/ultraviolet-database-restore.svg" left size="md" />
      <div>
        <span>{{ t('admin.utilities.importWikijs2') }}</span>
        <div class="text-caption">{{ t('admin.utilities.wikijs2Import.subtitle') }}</div>
      </div>
      <w-space />
      <w-btn
        class="mr-2"
        flat
        rounded
        color="white"
        :aria-label="t(`common.actions.viewDocs`)"
        icon="la:question-circle"
        :href="siteStore.docsBase + `/admin/utilities`"
        target="_blank"
        type="a" />
      <w-btn-group push>
        <w-btn
          push
          color="white"
          text-color="grey-7"
          :label="t(`common.actions.close`)"
          :aria-label="t(`common.actions.close`)"
          icon="la:times"
          @click="close" />
      </w-btn-group>
    </w-header>
    <w-page-container>
      <w-page class="p-4">
        <div class="grid grid-cols-12 gap-4 items-start">
          <!-- ----------------------- -->
          <!-- What to import -->
          <!-- ----------------------- -->
          <div class="col-span-12 lg:col-span-5 flex flex-col gap-4">
            <w-card class="pb-2">
              <w-card-header>{{ t('admin.utilities.wikijs2Import.source') }}</w-card-header>
              <w-item>
                <blueprint-icon icon="website" />
                <w-item-section>
                  <w-item-label>{{ t('admin.utilities.wikijs2Import.targetSite') }}</w-item-label>
                  <w-item-label caption>{{
                    t('admin.utilities.wikijs2Import.targetSiteHint')
                  }}</w-item-label>
                </w-item-section>
                <w-item-section side>
                  <w-select
                    outlined
                    dense
                    emit-value
                    map-options
                    style="min-width: 200px"
                    v-model="state.siteId"
                    :options="siteOptions"
                    :aria-label="t('admin.utilities.wikijs2Import.targetSite')" />
                </w-item-section>
              </w-item>
            </w-card>

            <w-card class="pb-2">
              <w-card-header>
                {{ t('admin.utilities.wikijs2Import.whatToImport') }}
                <template #hint>{{ t('admin.utilities.wikijs2Import.whatToImportHint') }}</template>
              </w-card-header>
              <!--
                A compact checklist rather than `w-item` rows: eight of those stand 450px tall and
                push the Start Import button below the fold, which is the one control on this panel
                that has to be in front of the reader. Flat rather than a real tree, too -- only
                `pages` has children, so the indent on the two that depend on it says what a tree
                widget would.
              -->
              <div class="grid grid-cols-2 gap-x-4 px-4 pt-1 pb-3">
                <div
                  v-for="(column, idx) of contentColumns"
                  :key="`content-col-` + idx"
                  class="flex flex-col gap-3">
                  <div
                    v-for="entry of column"
                    :key="entry.key"
                    :class="[
                      entry.parent ? 'content-child' : '',
                      entry.isLastChild ? 'content-child--last' : ''
                    ]">
                    <w-checkbox
                      v-model="state.content[entry.key]"
                      color="primary"
                      :label="entry.label"
                      :disabled="entry.parent ? !state.content[entry.parent] : false" />
                  </div>
                </div>
              </div>
            </w-card>

            <w-card class="pb-2">
              <w-card-header>{{ t('admin.utilities.wikijs2Import.options') }}</w-card-header>
              <w-item tag="label">
                <blueprint-icon icon="duplicate" />
                <w-item-section>
                  <w-item-label>{{ t('admin.utilities.wikijs2Import.overwrite') }}</w-item-label>
                  <w-item-label caption>{{
                    t('admin.utilities.wikijs2Import.overwriteHint')
                  }}</w-item-label>
                  <!--
                    Permanent, and stated whichever way the switch is set: what it warns about is
                    what turning it on would do, so it has to be readable before that happens.
                  -->
                  <w-item-label caption class="text-deep-orange-9 dark:text-deep-orange-4">{{
                    t('admin.utilities.wikijs2Import.overwriteWarning')
                  }}</w-item-label>
                </w-item-section>
                <w-item-section avatar>
                  <w-toggle
                    v-model="state.overwrite"
                    color="negative"
                    checked-icon="la:check"
                    unchecked-icon="la:times"
                    :aria-label="t('admin.utilities.wikijs2Import.overwrite')" />
                </w-item-section>
              </w-item>
            </w-card>

            <w-card class="pb-2">
              <w-card-header>{{ t('admin.utilities.wikijs2Import.archive') }}</w-card-header>
              <w-item>
                <blueprint-icon icon="archive-folder" />
                <w-item-section>
                  <w-item-label>{{
                    state.archive
                      ? state.archive.name
                      : t('admin.utilities.wikijs2Import.noArchive')
                  }}</w-item-label>
                  <w-item-label caption>{{
                    state.archive
                      ? formatBytes(state.archive.size)
                      : t('admin.utilities.wikijs2Import.archiveHint')
                  }}</w-item-label>
                </w-item-section>
                <w-item-section side>
                  <w-btn
                    class="acrylic-btn"
                    flat
                    color="primary"
                    icon="la:file-upload"
                    :label="t('admin.utilities.wikijs2Import.selectArchive')"
                    @click="pickArchive" />
                </w-item-section>
              </w-item>
            </w-card>

            <!-- -> Below the cards rather than inside the last one: it acts on all four -->
            <w-btn
              unelevated
              size="lg"
              class="w-full"
              color="positive"
              text-color="white"
              icon="la:play-circle"
              :label="t('admin.utilities.wikijs2Import.start')"
              :disabled="!canStart"
              @click="startImport" />
          </div>

          <!-- ----------------------- -->
          <!-- Progress log -->
          <!-- ----------------------- -->
          <div class="col-span-12 lg:col-span-7">
            <w-card>
              <w-card-header>{{ t('admin.utilities.wikijs2Import.progress') }}</w-card-header>
              <div class="p-4 pt-0">
                <div class="import-log" :class="dark.isActive ? `import-log--dark` : ``">
                  <div v-if="state.log.length < 1" class="import-log__empty">
                    {{ t('admin.utilities.wikijs2Import.progressEmpty') }}
                  </div>
                  <div
                    v-for="(entry, idx) of state.log"
                    :key="`log-` + idx"
                    class="import-log__line"
                    :class="`import-log__line--` + entry.level">
                    <span class="import-log__ts">{{ entry.ts }}</span>
                    <span class="import-log__msg">{{ entry.message }}</span>
                  </div>
                </div>
              </div>
            </w-card>
          </div>
        </div>
      </w-page>
    </w-page-container>

    <!-- -> Hidden native input, as the block package upload in `AdminBlocks` uses -->
    <input
      type="file"
      ref="archiveIpt"
      accept=".wkbackup"
      style="display: none"
      @change="onArchivePicked" />
  </w-layout>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDark } from '@/composables/dark'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

/**
 * Import a 2.x backup into a site on this instance.
 *
 * UI only for now: nothing is uploaded and `startImport` does not exist yet on the backend. The two
 * columns are the shape the finished thing needs -- what to bring in on the left, what happened on
 * the right -- so the log panel is here and empty rather than added later.
 */

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// COMPOSABLES

const dark = useDark()

// I18N

const { t } = useI18n()

// DATA

const archiveIpt = ref(null)

const state = reactive({
  /** Defaults to whichever site the admin area is already pointed at. */
  siteId: adminStore.currentSiteId,
  /**
   * Everything on, because a backup is normally restored whole; the checkboxes are for the case
   * where it is not. `comments` and `history` hang off `pages` -- there is nothing to attach either
   * one to without the pages themselves.
   */
  content: {
    assets: true,
    pages: true,
    comments: true,
    history: true,
    groups: true,
    users: true,
    navigation: true,
    settings: true
  },
  overwrite: false,
  /** The `File` the picker handed back, kept whole so its name and size can be shown. */
  archive: null,
  /** `{ ts, level, message }`, appended as the import reports its progress. */
  log: []
})

// COMPUTED

const siteOptions = computed(() =>
  adminStore.sites.map((site) => ({ value: site.id, label: site.title }))
)

/**
 * The rows under *What to import*, with the two that depend on `pages` marked as such. Built here
 * rather than written out in the template so that the indent, the disabled state and the cascade
 * below all read from one list.
 */
const contentEntries = computed(() => [
  { key: 'assets', col: 1, label: t('admin.utilities.wikijs2Import.assets') },
  { key: 'pages', col: 1, label: t('admin.utilities.wikijs2Import.pages') },
  { key: 'comments', col: 1, parent: 'pages', label: t('admin.utilities.wikijs2Import.comments') },
  { key: 'history', col: 1, parent: 'pages', label: t('admin.utilities.wikijs2Import.history') },
  { key: 'groups', col: 2, label: t('admin.utilities.wikijs2Import.groups') },
  { key: 'users', col: 2, label: t('admin.utilities.wikijs2Import.users') },
  { key: 'navigation', col: 2, label: t('admin.utilities.wikijs2Import.navigation') },
  { key: 'settings', col: 2, label: t('admin.utilities.wikijs2Import.settings') }
])

/**
 * The same rows dealt into the two columns they are drawn in. Which column an entry belongs to is a
 * field on the entry rather than a slice of the list, so that a row added later lands where it is
 * put instead of wherever the halfway point moved to -- and `canStart` keeps reading the flat list,
 * since where a checkbox is drawn has nothing to do with what it means.
 */
const contentColumns = computed(() => {
  const entries = contentEntries.value
  const decorated = entries.map((entry, idx) => ({
    ...entry,
    // -> Where the elbow's trunk stops. Read off the flat list rather than hardcoded, so the day
    //    `pages` gains a third child the line runs down to it instead of stopping at `history`
    isLastChild: Boolean(entry.parent) && entries[idx + 1]?.parent !== entry.parent
  }))
  return [
    decorated.filter((entry) => entry.col === 1),
    decorated.filter((entry) => entry.col === 2)
  ]
})

/**
 * An import needs an archive, a site to put it in, and at least one thing to bring over. A child of
 * an unticked `pages` does not count, since it is not imported either.
 */
const canStart = computed(() => {
  if (!state.archive || !state.siteId) {
    return false
  }
  return contentEntries.value.some(
    (entry) => state.content[entry.key] && (!entry.parent || state.content[entry.parent])
  )
})

// WATCHERS

// -> Turning `pages` back on restores its children rather than leaving them silently off: the two
//    were ticked when it was unticked, and that is the state being returned to
watch(
  () => state.content.pages,
  (isOn) => {
    state.content.comments = isOn
    state.content.history = isOn
  }
)

// METHODS

function close() {
  adminStore.$patch({ overlay: '' })
}

function pickArchive() {
  archiveIpt.value?.click()
}

function onArchivePicked() {
  state.archive = archiveIpt.value?.files?.[0] ?? null
  // -> So that picking the same file twice in a row still fires `change`
  if (archiveIpt.value) {
    archiveIpt.value.value = null
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

/**
 * Not implemented yet — there is no endpoint behind this. The button is wired so that the form's
 * enabled state is exercised, and so that there is one place for the upload to go when it exists.
 */
function startImport() {
  window.alert('Not yet implemented')
}
</script>

<style scoped lang="scss">
/*
  The elbow that ties Comments and History to the Pages checkbox above them.

  The trunk sits on the centre of the PARENT's box -- 9px in, the box being 20px wide -- and the row
  is indented far enough for the branch to cross to it. Everything vertical is a percentage rather
  than a pixel count: the row is as tall as the label's line box, not as tall as the 20px box in it,
  so a figure measured once would drift the moment the caption's line height changed.

  The trunk starts 12px above the row -- the `gap-3` between them -- so each child's segment meets
  the one above it and the line reads as continuous down the group. The last child's stops halfway,
  at its own branch, rather than running on into the rows below.
*/
.content-child {
  --tree-line: rgb(0 0 0 / 0.16);

  position: relative;
  padding-left: 28px;

  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 9px;
    background-color: var(--tree-line);
  }

  &::before {
    top: -12px;
    width: 1px;
    height: calc(100% + 12px);
  }

  &::after {
    top: 50%;
    width: 13px;
    height: 1px;
  }
}

.content-child--last::before {
  height: calc(50% + 12px);
}

body.body--dark .content-child {
  --tree-line: rgb(255 255 255 / 0.2);
}

/*
  The log is a terminal, so it is monospaced, scrolls on its own and keeps a fixed height whether it
  holds two lines or two hundred -- a panel that grows with the import would move the form beside it
  on every message. `--font-mono` is the app's own, as `UtilCodeEditor` uses.
*/
.import-log {
  height: calc(100vh - 260px);
  min-height: 300px;
  overflow-y: auto;
  border-radius: 4px;
  padding: 12px;
  background-color: $grey-1;
  border: 1px solid $grey-4;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.6;

  &--dark {
    background-color: $dark-6;
    border-color: $dark-3;
  }

  &__empty {
    color: $grey-6;
    font-style: italic;
  }

  &__line {
    display: flex;
    gap: 8px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__ts {
    flex: none;
    color: $grey-6;
  }

  /*
    The full Material ramp is in `tailwind.css` as custom properties; `_palette.scss` carries only
    the steps its own stylesheets happened to need, and the two mid tones a log wants on a dark
    background are not among them.
  */
  &__line--warn .import-log__msg {
    color: var(--color-orange-9);
  }

  &__line--error .import-log__msg {
    color: var(--color-red-9);
  }
}

.import-log--dark {
  .import-log__line--warn .import-log__msg {
    color: var(--color-orange-4);
  }

  .import-log__line--error .import-log__msg {
    color: var(--color-red-4);
  }
}
</style>
