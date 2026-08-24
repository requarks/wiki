<template>
  <w-card class="page-locale-relations" style="width: 620px; max-width: 92vw">
    <w-toolbar class="bg-primary text-white">
      <div class="text-subtitle2">{{ t('editor.localeRel.title') }}</div>
    </w-toolbar>
    <w-card-section>
      <div class="text-caption pb-4 text-black/60 dark:text-white/70">
        {{ t('editor.localeRel.intro') }}
      </div>
      <w-list class="rounded bg-white dark:bg-black/20" separator bordered>
        <w-item v-for="row of state.rows" :key="`loc-` + row.locale">
          <w-item-section side>
            <!-- -> The short code as an avatar, as the locale selector draws it, so a row here is
                    recognisable as the same locale the reader picks in the sidebar -->
            <w-avatar
              rounded
              :color="row.isSelf ? `secondary` : `primary`"
              text-color="white"
              size="sm">
              <div class="text-caption uppercase">
                <strong>{{ row.language }}</strong>
              </div>
            </w-avatar>
          </w-item-section>
          <w-item-section>
            <w-item-label
              ><strong>{{ row.displayName }}</strong></w-item-label
            >
            <!-- -> The page's own row says which slot it fills rather than offering to change it: it
                    IS the entry for its locale, and pointing that slot elsewhere would be a move -->
            <w-item-label caption v-if="row.isSelf">{{
              t('editor.localeRel.thisPage')
            }}</w-item-label>
            <w-item-label caption v-else-if="row.title">{{ row.title }}</w-item-label>
            <w-item-label caption v-else>{{ t('editor.localeRel.notSet') }}</w-item-label>
          </w-item-section>
          <w-item-section side>
            <div class="text-caption font-robotomono max-w-56 truncate">
              {{ row.path ? `/${row.path}` : '—' }}
            </div>
          </w-item-section>
          <w-item-section side v-if="!row.isSelf">
            <div class="flex flex-nowrap items-center gap-1">
              <w-btn
                :label="t(`editor.localeRel.selectPage`)"
                color="primary"
                outline
                dense
                no-caps
                padding="xs sm"
                :loading="state.checking === row.locale"
                @click="selectPage(row)" />
              <!-- -> Only where there is something to take away, so the control appears with the
                      relation it clears rather than sitting dead on every empty row -->
              <w-btn
                v-if="row.path"
                icon="la:times"
                dense
                flat
                padding="none"
                :aria-label="t(`editor.localeRel.clear`)"
                @click="clearRow(row)">
                <w-tooltip>{{ t('editor.localeRel.clear') }}</w-tooltip>
              </w-btn>
            </div>
          </w-item-section>
        </w-item>
      </w-list>
      <div class="text-caption pt-4 text-black/60 dark:text-white/70">
        {{ t('editor.localeRel.appliesOnSave') }}
      </div>
    </w-card-section>
    <w-card-actions class="card-actions">
      <w-space />
      <w-btn
        class="acrylic-btn"
        icon="la:times"
        :label="t(`common.actions.discard`)"
        color="grey-7"
        padding="xs md"
        flat
        @click="$emit('close')" />
      <w-btn
        icon="la:check"
        :label="t(`common.actions.apply`)"
        unelevated
        color="primary"
        padding="xs md"
        @click="saveAndClose" />
    </w-card-actions>
  </w-card>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, reactive } from 'vue'

import { dialog } from '@/composables/dialog'
import { notify } from '@/composables/notify'

import { apiErrorMessage } from '@/helpers/apiError'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import LinkPickerDialog from './LinkPickerDialog.vue'

/**
 * The set of pages this page belongs to: itself, and the same page written in the other locales.
 *
 * One row per active locale, because the question is asked of the locales a site HAS rather than of
 * the relations it happens to hold -- an empty row is a language this page has no counterpart in, and
 * is how one is added. The row for the page's own locale is the page itself and is not a choice.
 *
 * Nothing here writes to the server. The set is staged on the page store and goes up with the page,
 * so discarding the edit discards the relations with it -- which is what every other field in the
 * properties panel does. What IS asked of the server is whether a chosen page is free to be related:
 * see `selectPage`.
 */

// STORES

const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  /** One row per locale: `{ locale, language, displayName, isSelf, path, title }`. */
  rows: [],
  /** The locale whose row is waiting on the server, which is what puts that button in a spinner. */
  checking: null
})

// METHODS

/** The row for a locale, or undefined for a locale this site does not have. */
function rowFor(locale) {
  return state.rows.find((r) => r.locale === locale)
}

/**
 * Put a page in a locale's row.
 *
 * The picker is opened ON that locale and locked to it: a page from another language is not a
 * different answer to "which page is the French one", it is a wrong one.
 */
function selectPage(row) {
  dialog({
    component: LinkPickerDialog,
    componentProps: {
      title: t('editor.localeRel.pickerTitle', { locale: row.displayName }),
      okLabel: t('common.actions.select'),
      locale: row.locale,
      lockLocale: true,
      newTabOption: false,
      initialHref: row.path ? `/${row.path}` : ''
    }
  }).onOk(({ path, locale }) => {
    if (!path || locale !== row.locale) {
      return
    }
    adopt(row, path)
  })
}

/**
 * Take a chosen page, and with it whatever set it already belongs to.
 *
 * The server is asked before the row is filled in, because a page that is already some other page's
 * counterpart cannot become this one's: a page belongs to one set. Where the set it is in can be
 * joined, its other members are filled in here too -- they are the same page as well, and the author
 * should see what they are joining before they save rather than discover it afterwards.
 */
async function adopt(row, path) {
  state.checking = row.locale
  let group
  try {
    group = await API_CLIENT.get(`sites/${siteStore.id}/pages/locale-relations`, {
      searchParams: { path, locale: row.locale }
    }).json()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('editor.localeRel.checkFailed'),
      caption: apiErrorMessage(err)
    })
    return
  } finally {
    state.checking = null
  }

  /*
    Every page of the set being joined, checked against what this dialog already says before anything
    is changed: a set that cannot be joined must leave the rows as they were, or the author would be
    left holding a selection the save is going to refuse.
  */
  const joining = group?.relations ?? []
  for (const rel of joining) {
    if (rel.locale === pageStore.locale && rel.path !== pageStore.path) {
      // -> The case this check exists for: the chosen page is already the translation of another page
      //    in THIS page's language, so there is no slot here for this page to take
      notify({
        type: 'negative',
        message: t('editor.localeRel.conflictOwnLocale', {
          path: `/${path}`,
          locale: row.displayName,
          other: `/${rel.path}`
        })
      })
      return
    }
    const existing = rowFor(rel.locale)
    if (existing && !existing.isSelf && existing.path && existing.path !== rel.path) {
      notify({
        type: 'negative',
        message: t('editor.localeRel.conflictRow', {
          path: `/${path}`,
          locale: existing.displayName,
          other: `/${rel.path}`
        })
      })
      return
    }
  }

  row.path = path
  row.title = group?.page?.title ?? ''

  // -> The rest of the set, into the rows that have nothing in them. A locale the set covers and this
  //    site no longer has is left out: there is no row to put it in, and the save states rows.
  let adopted = 0
  for (const rel of joining) {
    const target = rowFor(rel.locale)
    if (!target || target.isSelf || target.path === rel.path) {
      continue
    }
    target.path = rel.path
    target.title = rel.title ?? ''
    adopted++
  }
  if (adopted > 0) {
    notify({
      type: 'info',
      message: t('editor.localeRel.joinedSet', { count: adopted })
    })
  }
}

function clearRow(row) {
  row.path = ''
  row.title = ''
}

/**
 * Hand the set to the page store, which is what the save sends.
 *
 * Every row that names a page, the page's own excepted: it occupies its own locale's slot by being the
 * page being saved, and sending it back would be sending the server its own answer.
 *
 * And the editor is told it has an unsaved change, which is not automatic: `hasPendingChanges` is what
 * enables Save Changes, and writing the store alone leaves that button disabled -- so the set was
 * staged, could not be saved, and was thrown away when the editor closed. The same two steps the icon
 * and the title take in `PageHeader`.
 */
function saveAndClose() {
  pageStore.localeRelations = state.rows
    .filter((row) => !row.isSelf && row.path)
    .map((row) => ({ locale: row.locale, path: row.path, title: row.title }))
  editorStore.lastChangeTimestamp = Temporal.Now.instant()
  emit('close')
}

// EMITS

const emit = defineEmits(['close'])

// MOUNTED

onMounted(() => {
  const held = pageStore.localeRelations ?? []
  const rows = siteStore.locales.active.map((locale) => {
    const relation = held.find((rel) => rel.locale === locale.code)
    const isSelf = locale.code === pageStore.locale
    return {
      locale: locale.code,
      language: locale.language,
      displayName: locale.displayName,
      isSelf,
      path: isSelf ? pageStore.path : (relation?.path ?? ''),
      title: isSelf ? pageStore.title : (relation?.title ?? '')
    }
  })
  /*
    And a relation to a locale the site no longer has active, which would otherwise be dropped by the
    save without anybody saying so -- the rows ARE the set. It gets a row like any other, so it can be
    seen and taken off deliberately.
  */
  for (const relation of held) {
    if (!rows.some((row) => row.locale === relation.locale)) {
      rows.push({
        locale: relation.locale,
        language: relation.locale.split('-')[0],
        displayName: relation.locale,
        isSelf: false,
        path: relation.path,
        title: relation.title ?? ''
      })
    }
  }
  state.rows = rows
})
</script>
