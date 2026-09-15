<template>
  <w-dialog v-model="dialogVisible" persistent @hide="onDialogHide">
    <w-card style="width: 560px; max-width: 100%">
      <w-card-header>{{ t('convertPage.title') }}</w-card-header>
      <w-linear-progress v-if="state.busy" query />

      <w-card-section>
        <div class="text-sm opacity-70 mb-3">
          {{ t('convertPage.intro', { editor: editorName(pageStore.editor) }) }}
        </div>

        <!--
          The editors this page could be opened with: what the server says its content type allows,
          narrowed to what this site has actually turned on. An editor nobody can open is not an
          offer.
        -->
        <w-list padding bordered>
          <w-item
            v-for="target of targets"
            :key="target"
            clickable
            :active="state.target === target"
            active-class="text-primary"
            @click="selectTarget(target)">
            <w-item-section side><w-icon name="la:pen-fancy" /></w-item-section>
            <w-item-section>
              <w-item-label>{{ editorName(target) }}</w-item-label>
              <w-item-label caption>{{ t(`convertPage.describe.${target}`) }}</w-item-label>
            </w-item-section>
          </w-item>
        </w-list>

        <!--
          What converting will actually do to the file. The source is rewritten only in one direction,
          and only then is there anything to warn about — see `convert.js`.
        -->
        <div v-if="state.checked" class="mt-4">
          <w-banner v-if="state.error" class="bg-red-1 text-red-9" dense>
            {{ t('convertPage.failed', { message: state.error }) }}
          </w-banner>
          <w-banner v-else-if="!state.identical" class="bg-orange-1 text-orange-9" dense>
            <div class="font-semibold">{{ t('convertPage.wouldChange') }}</div>
            <div class="text-xs mt-2 font-mono whitespace-pre-wrap opacity-80">
              {{ t('convertPage.wasRendered') }} {{ state.difference?.before }}
            </div>
            <div class="text-xs mt-1 font-mono whitespace-pre-wrap opacity-80">
              {{ t('convertPage.wouldRender') }} {{ state.difference?.after }}
            </div>
          </w-banner>
          <w-banner v-else-if="state.changed" class="bg-blue-1 text-blue-9" dense>
            {{ t('convertPage.willReformat') }}
          </w-banner>
          <w-banner v-else class="bg-green-1 text-green-9" dense>
            {{ t('convertPage.noSourceChange') }}
          </w-banner>
        </div>
      </w-card-section>

      <w-card-actions align="right">
        <w-btn flat :label="t('common.actions.cancel')" @click="onDialogCancel" />
        <w-btn
          unelevated
          color="primary"
          :label="t('convertPage.convert')"
          :disabled="!state.target || state.busy || Boolean(state.error)"
          @click="convert" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

/**
 * Moving a page from one editor to another.
 *
 * A page has exactly one editor and everyone who opens it gets that one, so this is a deliberate act
 * on the page rather than a preference of whoever is reading it — which is why it lives with the
 * other page actions and asks before it does anything.
 *
 * The interesting part is the check. Converting to the Visual editor rewrites the source into the
 * form that editor writes, and rather than trusting that rewrite to be faithful, the page is rendered
 * both ways and the two are compared. An author is told what they are about to get: nothing at all,
 * a reformatted file that renders identically, or — if the serialiser cannot express something the
 * page contains — the difference itself, with Convert refused.
 */

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// STORES

const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  target: '',
  busy: false,
  checked: false,
  changed: false,
  identical: true,
  difference: null,
  error: null,
  content: '',
  render: ''
})

// COMPUTED

/**
 * What this page can become: the content-type peers the server named, narrowed to the editors the
 * site has enabled. Both halves are needed — the first is what would not lose anything, the second is
 * what somebody could actually open afterwards.
 */
const targets = computed(() =>
  (pageStore.convertibleTo ?? []).filter((editor) => siteStore.activeEditors.includes(editor))
)

// METHODS

function editorName(editor) {
  return t(`admin.editors.${editor}Name`)
}

/**
 * Pick a target, and work out what converting to it would do.
 *
 * The whole check runs in the browser because the markdown pipeline does: parsing, serialising and
 * rendering are all here, and the server has no way to do any of it without a headless browser.
 */
async function selectTarget(target) {
  state.target = target
  state.checked = false
  state.error = null
  state.difference = null

  if (target !== 'visual') {
    /*
      Converting AWAY from the Visual editor rewrites nothing: what it wrote is markdown that every
      markdown editor reads unchanged. So there is nothing to check and nothing to warn about.
    */
    state.changed = false
    state.identical = true
    state.checked = true
    return
  }

  state.busy = true
  try {
    // -> Loaded on demand: this is the only screen in the app that needs the Visual editor's
    //    machinery without opening the Visual editor
    const [{ createParser }, { serialize }, { normalizeForVisual }, { MarkdownRenderer }] =
      await Promise.all([
        import('@/editor/visual/parse'),
        import('@/editor/visual/serialize'),
        import('@/editor/visual/convert'),
        import('@/renderers/markdown')
      ])

    if (!editorStore.configIsLoaded) {
      await editorStore.fetchConfigs()
    }
    const source = await pageSource()
    const config = editorStore.editors.markdown ?? {}
    const renderer = new MarkdownRenderer(config)
    const result = normalizeForVisual(source, {
      parser: createParser(renderer, config),
      serialize,
      renderer,
      pagePath: pageStore.path
    })
    Object.assign(state, {
      changed: result.changed,
      identical: result.identical,
      difference: result.difference,
      error: result.error,
      content: result.content,
      render: result.render,
      checked: true
    })
  } catch (err) {
    state.error = err.message
    state.checked = true
  } finally {
    state.busy = false
  }
}

/**
 * The page's source.
 *
 * The page view does not ask for content — a reader is served the render — so this is very often not
 * in the store yet, and converting is being done from the page view.
 */
async function pageSource() {
  if (pageStore.contentLoaded) {
    return pageStore.content
  }
  const data = await API_CLIENT.get(
    `sites/${siteStore.id}/pages/${pageStore.id}?withContent=true`
  ).json()
  return data?.content ?? ''
}

async function convert() {
  state.busy = true
  try {
    const body = { editor: state.target }
    /*
      The rewritten source only where there is one, and only when it actually differs: sending it
      unchanged would still cost a history version saying the page was edited when nothing about it
      was.
    */
    if (state.target === 'visual' && state.changed) {
      body.content = state.content
      body.render = state.render
    }
    body.reasonForChange = t('convertPage.reason', { editor: editorName(state.target) })

    await API_CLIENT.put(`sites/${siteStore.id}/pages/${pageStore.id}/editor`, { json: body })
    notify({
      type: 'positive',
      message: t('convertPage.success', { editor: editorName(state.target) })
    })
    // -> The page is reloaded rather than patched: its editor, its source and its render all moved
    await pageStore.pageLoad({ id: pageStore.id })
    onDialogOK()
  } catch (err) {
    notify({ type: 'negative', message: apiErrorMessage(err) })
  } finally {
    state.busy = false
  }
}
</script>
