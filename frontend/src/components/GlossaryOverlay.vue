<template>
  <w-layout ref="rootEl" class="glossary" view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <!-- -> Below 900px the list and the term take turns; this is the way back to the list -->
      <w-btn
        v-if="!isWide && !state.listOpen"
        class="mr-2"
        icon="la:arrow-left"
        color="white"
        dense
        flat
        :aria-label="t(`glossary.backToList`)"
        @click="showList" />
      <w-icon name="img:/_assets/icons/ultraviolet-parchment.svg" left size="md" />
      <span>{{ t('glossary.title') }}</span>
      <w-space />
      <transition name="syncing">
        <w-spinner class="mr-4" v-show="state.loading > 0" color="accent" size="20px" />
      </transition>
      <!-- -> Only where there is a choice to make, as in the link picker -->
      <w-btn
        v-if="siteStore.locales.active.length > 1"
        class="acrylic-btn mr-4"
        flat
        dense
        padding="xs md"
        color="white"
        :label="siteStore.localeAlias(state.locale)"
        :aria-label="siteStore.localeAlias(state.locale)">
        <locale-selector-menu
          :selected="state.locale"
          :navigate="false"
          anchor="bottom right"
          self="top right"
          @select="switchLocale" />
      </w-btn>
      <!-- -> The pushed Close the File Manager and the editing overlays put themselves away with -->
      <w-btn-group>
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

    <!-- ----------------------------------------------------- -->
    <!-- LIST -->
    <!-- ----------------------------------------------------- -->
    <!--
      Never an overlaying drawer (`overlay-below` 0): that mode is `position: fixed` and sends its scrim
      to <body> under the dialog, so inside this overlay it covered the header and could not be
      dismissed. Below 900px the list and the panel take turns instead, the list spanning the full
      width while it is the one showing -- `glossary-sidebar--full`.
    -->
    <w-drawer
      class="glossary-sidebar"
      :class="{ 'glossary-sidebar--full': !isWide }"
      :model-value="isWide || state.listOpen"
      :width="320"
      :overlay-below="0">
      <div class="glossary-sidebar-inner">
        <div class="glossary-sidebar-tools">
          <w-btn
            v-if="canManage && !state.forbidden"
            class="w-full mb-3"
            unelevated
            color="primary"
            icon="la:plus"
            no-caps
            :label="t(`glossary.newTerm`)"
            @click="newTerm" />
          <w-input
            v-model="state.filter"
            outlined
            dense
            clearable
            hide-bottom-space
            :placeholder="t(`glossary.filter`)"
            :aria-label="t(`glossary.filter`)" />
          <w-btn-toggle
            class="glossary-toggle glossary-grouping mt-3"
            v-model="state.grouping"
            push
            no-caps
            toggle-color="primary"
            :options="groupingOptions"
            :aria-label="t(`glossary.grouping`)" />
        </div>
        <w-scroll-area class="glossary-sidebar-list">
          <div class="p-4 text-grey-6 text-body2" v-if="state.forbidden">
            {{ t('glossary.forbidden') }}
          </div>
          <div class="p-4 text-grey-6 text-body2" v-else-if="state.loadFailed">
            {{ t('glossary.loadFailed') }}
          </div>
          <div class="p-4 text-grey-6 text-body2" v-else-if="isListEmpty">
            {{ state.terms.length < 1 ? t('glossary.empty') : t('glossary.noMatch') }}
          </div>
          <w-list v-else dense padding>
            <template v-for="group of groups" :key="group.key">
              <w-item-label class="glossary-group" header :data-group="group.key">
                {{ group.label }}
              </w-item-label>
              <w-item
                v-for="term of group.terms"
                :key="term.id"
                clickable
                :active="term.id === state.selectedId"
                active-class="glossary-term-active"
                @click="selectTerm(term.id)">
                <w-item-section>
                  <w-item-label class="truncate">{{ term.term }}</w-item-label>
                  <w-item-label v-if="term.expansion" caption class="truncate">
                    {{ term.expansion }}
                  </w-item-label>
                </w-item-section>
              </w-item>
            </template>
          </w-list>
        </w-scroll-area>
      </div>
    </w-drawer>

    <!-- ----------------------------------------------------- -->
    <!-- MAIN PANEL -->
    <!-- ----------------------------------------------------- -->
    <w-page-container v-show="isWide || !state.listOpen">
      <w-page class="glossary-main">
        <!-- EMPTY -->
        <div v-if="state.mode === `empty`" class="glossary-empty">
          <w-icon name="img:/_assets/icons/ultraviolet-parchment.svg" size="64px" />
          <div class="text-body1 text-grey-7 mt-4">
            {{ canManage ? t('glossary.pickTermManage') : t('glossary.pickTerm') }}
          </div>
        </div>

        <!-- VIEW -->
        <article v-else-if="state.mode === `view` && state.term" class="glossary-panel">
          <div class="flex items-start gap-4">
            <div class="min-w-0 flex-1">
              <h2 class="glossary-term-name">{{ state.term.term }}</h2>
              <div v-if="state.term.expansion" class="glossary-term-expansion">
                {{ state.term.expansion }}
              </div>
            </div>
            <template v-if="canManage">
              <w-btn
                flat
                round
                dense
                icon="la:pen"
                color="primary"
                :aria-label="t(`common.actions.edit`)"
                @click="editTerm">
                <w-tooltip>{{ t('common.actions.edit') }}</w-tooltip>
              </w-btn>
              <w-btn
                flat
                round
                dense
                icon="la:trash"
                color="negative"
                :aria-label="t(`common.actions.delete`)"
                @click="deleteTerm">
                <w-tooltip>{{ t('common.actions.delete') }}</w-tooltip>
              </w-btn>
            </template>
          </div>

          <!--
            -> Safe to hand to v-html: `renderers/glossary.js` renders with raw HTML disabled, and
               nothing stored is HTML. See `renderers/comment.js`, where that is the whole boundary.
          -->
          <div
            v-if="state.term.definition"
            class="glossary-definition mt-6"
            v-html="renderedDefinition" />
          <div v-else class="text-grey-6 mt-6">{{ t('glossary.noDefinition') }}</div>

          <dl class="glossary-facts">
            <template v-if="state.term.aliases.length > 0">
              <dt>{{ t('glossary.alsoKnownAs') }}</dt>
              <dd class="flex flex-wrap gap-1">
                <w-chip v-for="alias of state.term.aliases" :key="alias" dense :label="alias" />
              </dd>
            </template>
            <template v-if="state.term.relatedTerms.length > 0">
              <dt>{{ t('glossary.related') }}</dt>
              <dd class="flex flex-wrap gap-1">
                <w-chip
                  v-for="related of state.term.relatedTerms"
                  :key="related.id"
                  dense
                  clickable
                  color="primary"
                  text-color="white"
                  :label="related.term"
                  @click="selectTerm(related.id)" />
              </dd>
            </template>
            <template v-if="state.term.documentation">
              <dt>{{ t('glossary.documentation') }}</dt>
              <dd>
                <a
                  v-if="state.term.documentation.exists"
                  class="glossary-link"
                  :href="documentationHref"
                  @click.prevent="openDocumentation">
                  <w-icon name="la:book-open" size="xs" class="mr-1" />
                  {{ state.term.documentation.label || t('glossary.readMore') }}
                </a>
                <span v-else class="text-grey-6">
                  {{ t('glossary.documentationMissing', { path: state.term.documentation.path }) }}
                </span>
              </dd>
            </template>
            <template v-if="state.term.references.length > 0">
              <dt>{{ t('glossary.references') }}</dt>
              <dd>
                <ul class="glossary-references">
                  <li v-for="(ref, idx) of state.term.references" :key="idx">
                    <a class="glossary-link" :href="ref.url" target="_blank" rel="noopener">
                      {{ ref.label || ref.url }}
                      <w-icon name="la:external-link-alt" size="xs" class="ml-1" />
                    </a>
                  </li>
                </ul>
              </dd>
            </template>
            <template v-if="state.term.category">
              <dt>{{ t('glossary.category') }}</dt>
              <dd>
                <w-chip
                  dense
                  clickable
                  icon="la:tag"
                  :label="state.term.category"
                  @click="showCategory(state.term.category)" />
              </dd>
            </template>
          </dl>

          <!--
            -> Who edited it only where the site shows that for pages (General → Features, "Last Edited
               By"); the date either way. Decided here, as the page view decides it in `Index.vue`.
          -->
          <div class="glossary-meta mt-8">
            {{
              showAuthor
                ? t('glossary.lastEdited', {
                    name: state.term.author.name,
                    date: userStore.formatDateTime(t, state.term.updatedAt)
                  })
                : t('glossary.lastEditedNoAuthor', {
                    date: userStore.formatDateTime(t, state.term.updatedAt)
                  })
            }}
          </div>
        </article>

        <!-- FORM -->
        <div v-else-if="state.mode === `form`" class="glossary-panel glossary-panel--form">
          <h2 class="glossary-term-name mb-6">
            {{ state.editingId ? t('glossary.editTermTitle') : t('glossary.newTermTitle') }}
          </h2>

          <!-- -> Somebody saved this term while it was open here; spec §5.2 -->
          <w-banner v-if="state.stale" class="glossary-stale mb-6" rounded>
            <template #avatar>
              <w-icon name="la:exclamation-triangle" class="text-warning" />
            </template>
            <div class="font-bold">{{ t('glossary.form.staleTitle') }}</div>
            <div class="text-body2">
              {{
                state.stale.author
                  ? t('glossary.form.staleMessage', {
                      name: state.stale.author.name,
                      date: userStore.formatDateTime(t, state.stale.updatedAt)
                    })
                  : t('glossary.form.staleMessageNoAuthor', {
                      date: userStore.formatDateTime(t, state.stale.updatedAt)
                    })
              }}
            </div>
            <template #action>
              <w-btn flat no-caps :label="t(`glossary.form.staleReload`)" @click="reloadStale" />
              <w-btn
                flat
                no-caps
                color="negative"
                :label="t(`glossary.form.staleOverwrite`)"
                @click="overwriteStale" />
            </template>
          </w-banner>

          <!--
            Two columns where the panel has room: what the term IS on the left, what it points at and
            how it behaves on the right, with the actions closing that column. One column, in that
            order, where it has not -- see `.glossary-form` below.
          -->
          <div class="glossary-form">
            <div class="glossary-form-col">
              <!-- TERM -->
              <div>
                <w-input
                  v-model="state.form.term"
                  outlined
                  required
                  hide-bottom-space
                  :label="t(`glossary.form.term`)" />
                <div v-if="termError" class="glossary-field-error">{{ termError }}</div>
                <w-checkbox
                  v-if="isRenaming"
                  class="mt-2"
                  v-model="state.keepOldAsAlias"
                  :label="t(`glossary.form.keepOldAsAlias`, { name: state.originalName })" />
              </div>

              <!-- EXPANSION -->
              <w-input
                v-model="state.form.expansion"
                outlined
                :label="t(`glossary.form.expansion`)"
                :hint="t(`glossary.form.expansionHint`)" />

              <!-- DEFINITION -->
              <div>
                <div class="flex items-center mb-2">
                  <div class="text-subtitle2">{{ t('glossary.form.definition') }}</div>
                  <w-space />
                  <w-btn-toggle
                    class="glossary-toggle"
                    v-model="state.definitionTab"
                    push
                    no-caps
                    toggle-color="primary"
                    :options="definitionTabs"
                    :aria-label="t(`glossary.form.definition`)" />
                </div>
                <w-input
                  v-if="state.definitionTab === `write`"
                  v-model="state.form.definition"
                  type="textarea"
                  outlined
                  :rows="8"
                  :aria-label="t(`glossary.form.definition`)"
                  :hint="t(`glossary.form.definitionHint`)" />
                <div v-else class="glossary-definition glossary-preview">
                  <div v-if="state.form.definition.trim()" v-html="previewDefinition" />
                  <div v-else class="text-grey-6">{{ t('glossary.noDefinition') }}</div>
                </div>
              </div>

              <!-- ALIASES -->
              <div>
                <w-select
                  v-model="state.form.aliases"
                  outlined
                  multiple
                  use-input
                  use-chips
                  create
                  hide-dropdown-icon
                  :options="state.form.aliases"
                  :label="t(`glossary.form.aliases`)"
                  :hint="t(`glossary.form.aliasesHint`)"
                  @create="addAlias" />
                <div v-if="aliasError" class="glossary-field-error">{{ aliasError }}</div>
              </div>

              <!-- RELATED TERMS -->
              <w-select
                v-model="state.form.relatedTerms"
                outlined
                multiple
                use-input
                use-chips
                emit-value
                map-options
                option-value="id"
                option-label="term"
                :options="relatedOptions"
                :label="t(`glossary.form.relatedTerms`)"
                :hint="t(`glossary.form.relatedTermsHint`)" />

              <!-- CATEGORY -->
              <!--
              -> Chips even for one value: with `use-input` the field is the filter box, and a single
                 selection shows nowhere else. The chip's own remove button clears it.
            -->
              <w-select
                v-model="state.form.category"
                outlined
                use-input
                use-chips
                create
                :options="state.categories"
                :label="t(`glossary.form.category`)"
                :hint="t(`glossary.form.categoryHint`)"
                @create="setCategory" />
            </div>

            <div class="glossary-form-col">
              <!-- DOCUMENTATION -->
              <div>
                <div class="text-subtitle2">{{ t('glossary.form.documentation') }}</div>
                <div class="text-caption text-grey-7 mb-2">
                  {{ t('glossary.form.documentationHint') }}
                </div>
                <div class="glossary-doc-picker">
                  <w-icon name="la:file-alt" class="text-grey-7" />
                  <span
                    class="flex-1 truncate font-robotomono text-body2"
                    :class="{ 'text-grey-6': !state.form.documentationPath }">
                    {{
                      state.form.documentationPath
                        ? `/${state.form.documentationPath}`
                        : t('glossary.form.documentationNone')
                    }}
                  </span>
                  <w-btn
                    v-if="state.form.documentationPath"
                    flat
                    round
                    dense
                    icon="la:times"
                    :aria-label="t(`common.actions.clear`)"
                    @click="clearDocumentation" />
                  <w-btn
                    flat
                    no-caps
                    color="primary"
                    :label="t(`glossary.form.selectPage`)"
                    @click="pickDocumentation" />
                </div>
                <w-input
                  class="mt-3"
                  v-model="state.form.documentationLabel"
                  outlined
                  dense
                  :disable="!state.form.documentationPath"
                  :label="t(`glossary.form.documentationLabel`)"
                  :placeholder="t(`glossary.readMore`)" />
              </div>

              <!-- REFERENCES -->
              <div>
                <div class="text-subtitle2 mb-2">{{ t('glossary.form.references') }}</div>
                <div
                  v-for="(ref, idx) of state.form.references"
                  :key="ref.key"
                  class="glossary-reference-row">
                  <w-input
                    class="flex-1"
                    v-model="ref.url"
                    outlined
                    dense
                    hide-bottom-space
                    placeholder="https://"
                    :aria-label="t(`glossary.form.referenceUrl`)"
                    :rules="[urlRule]" />
                  <w-input
                    class="flex-1"
                    v-model="ref.label"
                    outlined
                    dense
                    hide-bottom-space
                    :placeholder="t(`glossary.form.referenceLabel`)"
                    :aria-label="t(`glossary.form.referenceLabel`)" />
                  <w-btn
                    flat
                    round
                    dense
                    icon="la:trash"
                    color="negative"
                    :aria-label="t(`common.actions.delete`)"
                    @click="removeReference(idx)" />
                </div>
                <w-btn
                  v-if="state.form.references.length < REFERENCES_MAX"
                  flat
                  no-caps
                  color="primary"
                  icon="la:plus"
                  :label="t(`glossary.form.addReference`)"
                  @click="addReference" />
              </div>

              <!-- FLAGS -->
              <w-list class="glossary-flags">
                <w-item tag="label">
                  <w-item-section>
                    <w-item-label>{{ t('glossary.form.caseSensitive') }}</w-item-label>
                    <w-item-label caption>{{ t('glossary.form.caseSensitiveHint') }}</w-item-label>
                  </w-item-section>
                  <w-item-section avatar>
                    <w-toggle
                      v-model="state.form.caseSensitive"
                      :aria-label="t(`glossary.form.caseSensitive`)" />
                  </w-item-section>
                </w-item>
                <!-- -> Stored and shown, not yet acted on: auto-linking is a later phase (spec §9) -->
                <w-item>
                  <w-item-section>
                    <w-item-label>{{ t('glossary.form.autoLink') }}</w-item-label>
                    <w-item-label caption>{{ t('glossary.form.autoLinkHint') }}</w-item-label>
                  </w-item-section>
                  <w-item-section avatar>
                    <w-toggle
                      v-model="state.form.autoLink"
                      disable
                      :aria-label="t(`glossary.form.autoLink`)" />
                  </w-item-section>
                </w-item>
              </w-list>

              <div class="flex justify-end gap-2 mt-4">
                <w-btn flat no-caps :label="t(`common.actions.cancel`)" @click="cancelForm" />
                <w-btn
                  unelevated
                  no-caps
                  color="primary"
                  icon="la:check"
                  :label="state.editingId ? t(`common.actions.save`) : t(`common.actions.create`)"
                  :loading="state.saving"
                  :disable="!canSave"
                  @click="save" />
              </div>
            </div>
          </div>
        </div>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { confirm, dialog } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { useMinWidth } from '@/composables/screen'
import { apiErrorMessage } from '@/helpers/apiError'
import { renderDefinition } from '@/renderers/glossary'

import { useCommonStore } from '@/stores/common'
import { useGlossaryStore } from '@/stores/glossary'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import LinkPickerDialog from './LinkPickerDialog.vue'
import LocaleSelectorMenu from './LocaleSelectorMenu.vue'

/**
 * The glossary of a site, in one locale at a time: terms in a sidebar, the selected term (or the form
 * that creates or edits one) in the main panel. See `dev/specs/glossary.md` §6.
 *
 * Opened by `siteStore.openGlossary()`; reading is `read:glossary` and editing `manage:glossary`, both
 * page permissions granted per locale, as `stores/glossary.js` reports them. The terms are fetched when the overlay opens and after every
 * write, which is comfortable to a few thousand per locale.
 */

/** Matches `GLOSSARY_REFERENCES_MAX` in `backend/models/glossary.ts`. */
const REFERENCES_MAX = 20

/** Where the A–Z / Category choice is remembered, per browser. */
const GROUPING_STORAGE_KEY = 'glossary.grouping'

// STORES

const commonStore = useCommonStore()
const glossaryStore = useGlossaryStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()

// I18N

const { t } = useI18n()

// REFS

const rootEl = ref(null)

// DATA

/** A form with nothing in it, which is what New Term opens on. */
function blankForm() {
  return {
    term: '',
    expansion: '',
    definition: '',
    aliases: [],
    relatedTerms: [],
    documentationPath: '',
    documentationLabel: '',
    references: [],
    caseSensitive: false,
    autoLink: true,
    category: null
  }
}

let referenceKey = 0

const state = reactive({
  locale: initialLocale(),
  terms: [],
  loading: 0,
  forbidden: false,
  loadFailed: false,
  filter: '',
  grouping: storedGrouping(),
  /** Which term the sidebar marks. Kept through the form, so cancelling goes back to it. */
  selectedId: null,
  /** The selected term in full. */
  term: null,
  /** `empty` (nothing selected), `view` or `form`. */
  mode: 'empty',
  /** Below 900px, whether the list rather than the panel is showing. */
  listOpen: true,
  form: blankForm(),
  /** The form as it was opened, to tell whether anything has changed. */
  formSnapshot: '',
  editingId: null,
  expectedUpdatedAt: null,
  originalName: '',
  keepOldAsAlias: false,
  fieldErrors: { term: '', aliases: '' },
  /** The term as somebody else saved it while the form was open. */
  stale: null,
  categories: [],
  definitionTab: 'write',
  saving: false
})

// COMPUTED

const isWide = useMinWidth(900)

const groupingOptions = computed(() => [
  { value: 'az', label: t('glossary.groupAz') },
  { value: 'category', label: t('glossary.groupCategory') }
])

const definitionTabs = computed(() => [
  { value: 'write', label: t('glossary.form.write') },
  { value: 'preview', label: t('glossary.form.preview') }
])

/** A name as the server compares it: NFC, trimmed, inner whitespace collapsed, case folded. */
function nameKey(value) {
  return (value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase(state.locale)
}

/** The terms the filter leaves, matching a name or an alias. */
const filteredTerms = computed(() => {
  const query = nameKey(state.filter)
  if (!query) {
    return state.terms
  }
  return state.terms.filter(
    (term) =>
      nameKey(term.term).includes(query) ||
      term.aliases.some((alias) => nameKey(alias).includes(query))
  )
})

const isListEmpty = computed(() => filteredTerms.value.length < 1)

function compareNames(a, b) {
  return a.localeCompare(b, state.locale, { sensitivity: 'base' })
}

/**
 * The list as the sidebar draws it, under headings.
 *
 * A–Z by the term's first character, upper-cased in the locale, with everything that is not a letter
 * under `#` at the top. Category by name, with the terms that have none last.
 */
const groups = computed(() => {
  const terms = [...filteredTerms.value].sort((a, b) => compareNames(a.term, b.term))
  const byKey = new Map()
  for (const term of terms) {
    let key
    let label
    if (state.grouping === 'category') {
      key = term.category ? `c:${term.category}` : 'none'
      label = term.category || t('glossary.uncategorized')
    } else {
      const first = [...term.term][0] ?? ''
      const isLetter = /\p{L}/u.test(first)
      key = isLetter ? first.toLocaleUpperCase(state.locale) : '#'
      label = key
    }
    if (!byKey.has(key)) {
      byKey.set(key, { key, label, terms: [] })
    }
    byKey.get(key).terms.push(term)
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.key === b.key) {
      return 0
    }
    // -> `#` opens the A–Z list and "Uncategorized" closes the category one
    if (a.key === '#' || b.key === 'none') {
      return -1
    }
    if (b.key === '#' || a.key === 'none') {
      return 1
    }
    return compareNames(a.label, b.label)
  })
})

/** Whether this session may edit the glossary in the locale on screen. */
const canManage = computed(() => glossaryStore.canManageIn(state.locale))

/** Whether the term view names its last editor: the site's `lastEditedBy` feature, and an editor known. */
const showAuthor = computed(() => Boolean(siteStore.features.lastEditedBy && state.term?.author))

const renderedDefinition = computed(() => renderDefinition(state.term?.definition))
const previewDefinition = computed(() => renderDefinition(state.form.definition))

const documentationHref = computed(() =>
  state.term?.documentation
    ? `${siteStore.localeUrlPrefix(state.locale)}/${state.term.documentation.path}`
    : ''
)

/** Every other term of the locale, which is what a term may be related to. */
const relatedOptions = computed(() =>
  state.terms
    .filter((term) => term.id !== state.editingId)
    .map((term) => ({ id: term.id, term: term.term }))
)

/** Whether the form has anything in it that was not there when it opened. */
const isDirty = computed(
  () => state.mode === 'form' && JSON.stringify(state.form) !== state.formSnapshot
)

/** Whether an existing term's name has been changed, which is when keeping the old one is offered. */
const isRenaming = computed(
  () =>
    Boolean(state.editingId && state.originalName) &&
    nameKey(state.form.term).length > 0 &&
    nameKey(state.form.term) !== nameKey(state.originalName)
)

/**
 * The term another entry of the list already holds a name under, or null.
 *
 * Checked as the user types, which catches most collisions before a save. The server's answer is the
 * one that counts (it also sees terms created since the list was fetched), and lands in `fieldErrors`.
 */
function holderOf(name) {
  const key = nameKey(name)
  if (!key) {
    return null
  }
  return (
    state.terms.find(
      (term) =>
        term.id !== state.editingId &&
        (nameKey(term.term) === key || term.aliases.some((alias) => nameKey(alias) === key))
    ) ?? null
  )
}

const termError = computed(() => {
  if (state.fieldErrors.term) {
    return state.fieldErrors.term
  }
  const holder = holderOf(state.form.term)
  return holder
    ? t('glossary.form.nameTaken', { name: state.form.term.trim(), holder: holder.term })
    : ''
})

const aliasError = computed(() => {
  if (state.fieldErrors.aliases) {
    return state.fieldErrors.aliases
  }
  for (const alias of state.form.aliases) {
    const holder = holderOf(alias)
    if (holder) {
      return t('glossary.form.nameTaken', { name: alias, holder: holder.term })
    }
  }
  return ''
})

const canSave = computed(
  () =>
    nameKey(state.form.term).length > 0 &&
    !termError.value &&
    !aliasError.value &&
    state.form.references.every((ref) => urlRule(ref.url) === true)
)

// WATCHERS

watch(
  () => state.grouping,
  (grouping) => {
    try {
      localStorage.setItem(GROUPING_STORAGE_KEY, grouping)
    } catch {
      // -> A remembered tab is a convenience; a browser that refuses to store it loses nothing else
    }
  }
)

// -> A server-side refusal is about what was sent; editing the field is the answer to it
watch(
  () => state.form.term,
  () => {
    state.fieldErrors.term = ''
  }
)
watch(
  () => state.form.aliases,
  () => {
    state.fieldErrors.aliases = ''
  },
  { deep: true }
)

// METHODS

function initialLocale() {
  const readable = glossaryStore.readableLocales
  const wanted = siteStore.overlayOpts?.locale || commonStore.desiredLocale
  if (readable.includes(wanted)) {
    return wanted
  }
  return readable[0] ?? wanted ?? siteStore.locales.primary
}

function storedGrouping() {
  try {
    return localStorage.getItem(GROUPING_STORAGE_KEY) === 'category' ? 'category' : 'az'
  } catch {
    return 'az'
  }
}

function urlRule(value) {
  return /^https?:\/\/\S+$/i.test((value ?? '').trim()) || t('glossary.form.referenceUrlInvalid')
}

/**
 * Run `action` now, or once the user has agreed to throw away the changes in the form.
 */
function guardUnsaved(action) {
  if (!isDirty.value) {
    action()
    return
  }
  confirm({
    title: t('glossary.unsavedTitle'),
    message: t('glossary.unsavedMessage'),
    okLabel: t('common.actions.discard'),
    color: 'negative'
  }).onOk(() => action())
}

async function loadTerms() {
  state.loading++
  state.loadFailed = false
  try {
    state.terms = await API_CLIENT.get(`sites/${siteStore.id}/glossary`, {
      searchParams: { locale: state.locale }
    }).json()
    state.forbidden = false
  } catch (err) {
    state.terms = []
    if (err?.response?.status === 403) {
      state.forbidden = true
    } else {
      state.loadFailed = true
      notify({ type: 'negative', message: apiErrorMessage(err, t('glossary.loadFailed')) })
    }
  } finally {
    state.loading--
  }
}

async function loadCategories() {
  try {
    state.categories = await API_CLIENT.get(`sites/${siteStore.id}/glossary/categories`, {
      searchParams: { locale: state.locale }
    }).json()
  } catch {
    // -> Suggestions only: the field still takes whatever is typed
    state.categories = []
  }
}

/** Fetch a term in full and show it. False when it could not be had. */
async function showTerm(id) {
  state.loading++
  try {
    state.term = await API_CLIENT.get(`sites/${siteStore.id}/glossary/${id}`).json()
    state.selectedId = id
    state.mode = 'view'
    if (!isWide.value) {
      state.listOpen = false
    }
    return true
  } catch (err) {
    notify({ type: 'negative', message: apiErrorMessage(err, t('glossary.form.notFound')) })
    return false
  } finally {
    state.loading--
  }
}

function selectTerm(id) {
  guardUnsaved(() => showTerm(id))
}

function clearSelection() {
  state.selectedId = null
  state.term = null
  state.mode = 'empty'
}

function showList() {
  state.listOpen = true
}

/** Put a form on screen, and remember it as it opened so that leaving it can ask about changes. */
function openForm(form, { editingId = null, updatedAt = null, name = '' } = {}) {
  state.form = form
  state.formSnapshot = JSON.stringify(form)
  state.editingId = editingId
  state.expectedUpdatedAt = updatedAt
  state.originalName = name
  state.keepOldAsAlias = false
  state.fieldErrors = { term: '', aliases: '' }
  state.stale = null
  state.definitionTab = 'write'
  state.mode = 'form'
  if (!isWide.value) {
    state.listOpen = false
  }
  loadCategories()
}

/** The form for an existing term, filled from it. */
function formFrom(term) {
  return {
    term: term.term,
    expansion: term.expansion ?? '',
    definition: term.definition,
    aliases: [...term.aliases],
    relatedTerms: term.relatedTerms.map((related) => related.id),
    documentationPath: term.documentation?.path ?? '',
    documentationLabel: term.documentation?.label ?? '',
    references: term.references.map((ref) => ({ ...ref, key: referenceKey++ })),
    caseSensitive: term.caseSensitive,
    autoLink: term.autoLink,
    category: term.category
  }
}

function newTerm() {
  guardUnsaved(() => openForm(blankForm()))
}

function editTerm() {
  if (!state.term) {
    return
  }
  openForm(formFrom(state.term), {
    editingId: state.term.id,
    updatedAt: state.term.updatedAt,
    name: state.term.term
  })
}

function cancelForm() {
  guardUnsaved(() => {
    if (state.selectedId && state.term) {
      state.mode = 'view'
    } else {
      clearSelection()
    }
  })
}

function addAlias(value) {
  const name = value.trim()
  if (name && !state.form.aliases.some((alias) => nameKey(alias) === nameKey(name))) {
    state.form.aliases.push(name)
  }
}

function setCategory(value) {
  const name = value.trim()
  if (!name) {
    return
  }
  if (!state.categories.includes(name)) {
    state.categories.push(name)
  }
  state.form.category = name
}

function addReference() {
  state.form.references.push({ url: '', label: '', key: referenceKey++ })
}

function removeReference(idx) {
  state.form.references.splice(idx, 1)
}

function pickDocumentation() {
  dialog({
    component: LinkPickerDialog,
    componentProps: {
      title: t('glossary.form.documentation'),
      okLabel: t('common.actions.select'),
      initialHref: state.form.documentationPath
        ? `${siteStore.localeUrlPrefix(state.locale)}/${state.form.documentationPath}`
        : '',
      newTabOption: false,
      pagesOnly: true,
      locale: state.locale,
      lockLocale: true
    }
  }).onOk(({ path }) => {
    state.form.documentationPath = path
  })
}

function clearDocumentation() {
  state.form.documentationPath = ''
  state.form.documentationLabel = ''
}

/** What the API is sent, from the form. */
function payloadFrom(form) {
  const aliases = [...form.aliases]
  if (isRenaming.value && state.keepOldAsAlias) {
    aliases.push(state.originalName)
  }
  return {
    term: form.term,
    expansion: form.expansion || null,
    definition: form.definition,
    aliases,
    relatedTerms: form.relatedTerms,
    documentationPath: form.documentationPath || null,
    documentationLabel: form.documentationLabel || null,
    references: form.references
      .filter((ref) => ref.url.trim())
      .map((ref) => ({ url: ref.url.trim(), label: ref.label.trim() })),
    caseSensitive: form.caseSensitive,
    autoLink: form.autoLink,
    category: form.category || null
  }
}

async function save() {
  if (!canSave.value || state.saving) {
    return
  }
  state.saving = true
  const isNew = !state.editingId
  try {
    const payload = payloadFrom(state.form)
    const saved = isNew
      ? await API_CLIENT.post(`sites/${siteStore.id}/glossary`, {
          json: { ...payload, locale: state.locale }
        }).json()
      : await API_CLIENT.put(`sites/${siteStore.id}/glossary/${state.editingId}`, {
          json: { ...payload, expectedUpdatedAt: state.expectedUpdatedAt }
        }).json()
    // -> Leaving the form for the term it produced: nothing unsaved is left to ask about
    state.formSnapshot = JSON.stringify(state.form)
    state.term = saved
    state.selectedId = saved.id
    state.mode = 'view'
    state.stale = null
    notify({
      type: 'positive',
      message: isNew ? t('glossary.createSuccess') : t('glossary.saveSuccess')
    })
    await loadTerms()
  } catch (err) {
    await handleSaveError(err)
  } finally {
    state.saving = false
  }
}

async function handleSaveError(err) {
  const status = err?.response?.status
  const body = err?.data ?? {}
  if (status === 409 && body.reason === 'nameTaken') {
    state.fieldErrors[body.field === 'aliases' ? 'aliases' : 'term'] = t(
      'glossary.form.nameTaken',
      { name: body.name, holder: body.holder?.term ?? '' }
    )
    // -> Somebody else's new term, most likely: the list should know about it too
    await loadTerms()
  } else if (status === 409 && body.reason === 'stale') {
    state.stale = body.current
  } else if (status === 404) {
    notify({ type: 'negative', message: t('glossary.form.notFound') })
    state.formSnapshot = JSON.stringify(state.form)
    clearSelection()
    await loadTerms()
  } else if (status === 400 && /related/i.test(body.message ?? '')) {
    notify({ type: 'negative', message: t('glossary.form.invalidRelated') })
    const known = new Set()
    await loadTerms()
    state.terms.forEach((term) => known.add(term.id))
    state.form.relatedTerms = state.form.relatedTerms.filter((id) => known.has(id))
  } else {
    notify({ type: 'negative', message: apiErrorMessage(err) })
  }
}

/** Throw the draft away and edit the term as it now stands. */
function reloadStale() {
  const current = state.stale
  if (!current) {
    return
  }
  state.term = current
  openForm(formFrom(current), {
    editingId: current.id,
    updatedAt: current.updatedAt,
    name: current.term
  })
}

/** Keep the draft and save it over the newer version. */
function overwriteStale() {
  if (!state.stale) {
    return
  }
  state.expectedUpdatedAt = state.stale.updatedAt
  state.stale = null
  save()
}

function deleteTerm() {
  const term = state.term
  if (!term) {
    return
  }
  confirm({
    title: t('glossary.deleteConfirmTitle'),
    message: t('glossary.deleteConfirm', { term: term.term }),
    okLabel: t('common.actions.delete'),
    color: 'negative'
  }).onOk(async () => {
    state.loading++
    try {
      await API_CLIENT.delete(`sites/${siteStore.id}/glossary/${term.id}`)
      notify({ type: 'positive', message: t('glossary.deleteSuccess') })
      clearSelection()
      if (!isWide.value) {
        state.listOpen = true
      }
      await loadTerms()
    } catch (err) {
      notify({ type: 'negative', message: apiErrorMessage(err) })
    } finally {
      state.loading--
    }
  })
}

/** Switch the list to categories and bring this one's heading into view. */
async function showCategory(category) {
  state.grouping = 'category'
  state.filter = ''
  if (!isWide.value) {
    state.listOpen = true
  }
  await nextTick()
  const root = rootEl.value?.$el ?? rootEl.value
  root
    ?.querySelector(`[data-group="${CSS.escape(`c:${category}`)}"]`)
    ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

/**
 * Leave for the documentation page. The overlay is held open by `siteStore.overlay`, not by the route,
 * so it has to close first or the page would load behind it.
 */
function openDocumentation() {
  const href = documentationHref.value
  close()
  router.push(href)
}

function switchLocale(locale) {
  if (locale === state.locale) {
    return
  }
  guardUnsaved(async () => {
    state.locale = locale
    state.filter = ''
    state.formSnapshot = JSON.stringify(state.form)
    clearSelection()
    state.listOpen = true
    await loadTerms()
  })
}

function close() {
  guardUnsaved(() => {
    siteStore.$patch({ overlay: '' })
  })
}

// MOUNTED

onMounted(async () => {
  await glossaryStore.ensureAccess()
  await loadTerms()
  const termId = siteStore.overlayOpts?.termId
  if (termId) {
    await showTerm(termId)
  }
})
</script>

<style lang="scss">
.glossary {
  /*
    The ink, stated: the dialog panel draws no text colour of its own, and an overlay that is not built
    out of cards (which colour themselves) otherwise reads black on the dark panel -- term names, the
    heading, even what is typed into the inputs.
  */
  color: rgba(0, 0, 0, 0.87);

  @at-root .body--dark & {
    color: #fff;
  }

  &-sidebar {
    background-color: #f5f7fa;
    border-right: 1px solid rgba(0, 0, 0, 0.08);

    @at-root .body--dark & {
      background-color: $dark-5;
      border-right-color: rgba(255, 255, 255, 0.08);
    }
  }

  /* -> Three classes deep, to outrank the drawer's own scoped `.w-drawer[data-v-…]` width */
  & .glossary-sidebar.glossary-sidebar--full {
    grid-column: 1 / -1;
    width: 100%;

    /*
      -> No slide: the list and the panel share the cell here, and the panel is shown the moment the
         list starts leaving, so the drawer's margin slide dragged the list's controls across the
         term underneath. A swap is what a list → detail flow does anyway. Without a transition Vue
         ends the enter and leave at once.
    */
    &.w-drawer-enter-active,
    &.w-drawer-leave-active {
      transition: none;
    }
  }

  &-sidebar-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  &-sidebar-tools {
    padding: 1rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);

    @at-root .body--dark & {
      border-bottom-color: rgba(255, 255, 255, 0.08);
    }
  }

  /* -> The switch spans the column, its two halves sharing it evenly */
  &-grouping {
    display: flex;

    > * {
      flex: 1;
      text-align: center;
    }
  }

  /*
    -> An unselected segment has no fill of its own, so on the sidebar's and the panel's grey it read as
       a gap rather than a button. White in light mode; in dark mode a translucent white, which lands a
       step lighter than whichever of the two dark surfaces (`dark-5` sidebar, `dark-3` panel) is
       underneath.
  */
  &-toggle {
    @at-root .body--light & > [aria-checked='false'] {
      background-color: #fff;
    }

    @at-root .body--dark & > [aria-checked='false'] {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }

  &-sidebar-list {
    flex: 1;
    min-height: 0;
  }

  /* -> Sticky, so it needs the sidebar's own colour: transparent, the terms would scroll through it */
  &-group {
    position: sticky;
    top: 0;
    z-index: 1;
    background-color: #f5f7fa;
    font-weight: 600;

    @at-root .body--dark & {
      background-color: $dark-5;
    }
  }

  &-term-active {
    background-color: rgba(25, 118, 210, 0.12);
    color: $primary;

    @at-root .body--dark & {
      background-color: rgba(255, 255, 255, 0.08);
      color: #fff;
    }
  }

  &-main {
    display: flex;
    flex-direction: column;

    /* -> The File Manager's toolbar colour (`.fileman-toolbar`), so the two overlays read as a pair */
    @at-root .body--light & {
      background-color: $grey-1;
    }
  }

  &-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    opacity: 0.85;
  }

  &-panel {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: 2rem 1.5rem 3rem;

    /*
      -> The form takes two columns, so it is allowed nearly twice the reading width a term is. A
         container, so the columns answer to the PANEL's width -- the sidebar beside it takes 320px of
         the window, which a viewport breakpoint would not know.
    */
    &--form {
      max-width: 1280px;
      container-type: inline-size;
    }
  }

  /* -> No `margin` here: preflight already zeroes a heading's, and one here would beat the form's `mb-6` */
  &-term-name {
    font-size: 1.75rem;
    font-weight: 600;
    line-height: 1.25;
    word-break: break-word;
  }

  &-term-expansion {
    margin-top: 0.25rem;
    font-size: 1.05rem;
    opacity: 0.7;
  }

  /*
    A definition's typography: prose at a reading size, and nothing an article has that a definition
    cannot (`renderers/glossary.js` renders no headings, images or tables). The same choices as a
    comment's body, a step larger.
  */
  &-definition {
    font-size: 15px;
    line-height: 1.65;
    word-break: break-word;

    > *:first-child,
    > div > *:first-child {
      margin-top: 0;
    }

    > *:last-child,
    > div > *:last-child {
      margin-bottom: 0;
    }

    p,
    ul,
    ol,
    blockquote,
    pre {
      margin: 0 0 12px;
    }

    ul,
    ol {
      padding-left: 24px;
      list-style: revert;
    }

    blockquote {
      padding: 2px 0 2px 12px;
      border-left: 3px solid rgba(0, 0, 0, 0.12);
      color: rgba(0, 0, 0, 0.66);

      @at-root .body--dark & {
        border-left-color: rgba(255, 255, 255, 0.18);
        color: rgba(255, 255, 255, 0.7);
      }
    }

    code {
      font-family: var(--font-mono, monospace);
      font-size: 0.9em;
    }

    :not(pre) > code {
      padding: 1px 4px;
      border-radius: 3px;
      background-color: rgba(0, 0, 0, 0.06);

      @at-root .body--dark & {
        background-color: rgba(255, 255, 255, 0.1);
      }
    }

    pre {
      padding: 8px 10px;
      border-radius: 4px;
      overflow-x: auto;
      background-color: rgba(0, 0, 0, 0.06);

      @at-root .body--dark & {
        background-color: rgba(255, 255, 255, 0.08);
      }
    }

    a {
      color: $primary;
    }
  }

  &-preview {
    min-height: 10rem;
    padding: 12px 14px;
    border: 1px solid rgba(0, 0, 0, 0.18);
    border-radius: 4px;

    @at-root .body--dark & {
      border-color: rgba(255, 255, 255, 0.2);
    }
  }

  /* Label, then value, in two columns that fold into one on a phone. */
  /*
    -> The gap above is set here, not with a `mt-*` utility on the element: the utilities live in a
       cascade layer, which this unlayered rule's own `margin` would beat -- which is how the facts
       came to sit right under the definition.
  */
  &-facts {
    display: grid;
    grid-template-columns: 10rem 1fr;
    gap: 0.75rem 1rem;
    margin: 2rem 0 0;

    dt {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.6;
      padding-top: 0.2rem;
    }

    dd {
      margin: 0;
      min-width: 0;
    }

    @media (max-width: $breakpoint-xs-max) {
      grid-template-columns: 1fr;
      gap: 0.25rem;

      dd {
        margin-bottom: 0.75rem;
      }
    }
  }

  &-link {
    color: $primary;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  &-references {
    margin: 0;
    padding: 0;
    list-style: none;

    li + li {
      margin-top: 0.25rem;
    }
  }

  &-meta {
    font-size: 0.8rem;
    opacity: 0.55;
  }

  /*
    One column until the panel can give each of two about 380px, which is what the references row --
    a URL and a label side by side, and a delete button -- needs to stay usable.
  */
  &-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem 2rem;
    align-items: start;

    @container (min-width: 800px) {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }

  /* -> Tight, because most fields bring a hint line of their own that already separates them */
  &-form-col {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  &-field-error {
    margin-top: 0.25rem;
    font-size: 0.8rem;
    color: $negative;
  }

  &-doc-picker {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 4px 4px 4px 12px;
    border: 1px solid rgba(0, 0, 0, 0.18);
    border-radius: 4px;
    min-width: 0;

    @at-root .body--dark & {
      border-color: rgba(255, 255, 255, 0.2);
    }
  }

  &-reference-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.5rem;

    @media (max-width: $breakpoint-xs-max) {
      flex-wrap: wrap;
    }
  }

  /* -> A card on the panel: white on its light grey, a step below its `dark-3` in dark mode */
  &-flags {
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    background-color: #fff;

    @at-root .body--dark & {
      border-color: rgba(255, 255, 255, 0.14);
      background-color: var(--color-dark-4);
    }
  }
}
</style>
