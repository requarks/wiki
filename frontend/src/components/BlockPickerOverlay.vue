<template>
  <w-layout view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/fluent-rfid-tag.svg" left size="md" />
      <span>{{ t('editor.blockPicker.title') }}</span>
      <w-space />
      <w-btn
        class="mr-2"
        flat
        rounded
        color="white"
        :aria-label="t(`common.actions.viewDocs`)"
        icon="la:question-circle"
        :href="siteStore.docsBase + `/guide/blocks`"
        target="_blank"
        type="a" />
      <w-btn-group push>
        <w-btn
          push
          color="white"
          text-color="grey-7"
          :label="t(`common.actions.cancel`)"
          :aria-label="t(`common.actions.cancel`)"
          icon="la:times"
          @click="close" />
        <w-btn
          push
          color="positive"
          text-color="white"
          :label="t(`editor.blockPicker.insert`)"
          :aria-label="t(`editor.blockPicker.insert`)"
          icon="la:check"
          :disabled="!canInsert"
          @click="insert" />
      </w-btn-group>
    </w-header>
    <w-page-container>
      <w-page class="block-picker flex flex-nowrap items-stretch">
        <!-- ----------------------- -->
        <!-- The blocks -->
        <!-- ----------------------- -->
        <div class="block-picker-catalog w-2/3">
          <w-scroll-area style="height: 100%">
            <div class="p-4">
              <w-inner-loading :showing="state.isLoading" size="32px" />
              <div
                v-if="!state.isLoading && blocks.length < 1"
                class="text-caption p-6 text-center text-black/60 dark:text-white/70">
                {{ t('editor.blockPicker.noBlocks') }}
              </div>
              <div class="block-picker-grid">
                <button
                  v-for="block of blocks"
                  :key="block.id"
                  type="button"
                  class="block-picker-card"
                  :class="{ 'is-selected': state.selected?.id === block.id }"
                  @click="select(block)">
                  <w-icon
                    :name="`img:/_assets/icons/ultraviolet-${block.isCustom ? 'plugin' : block.icon}.svg`"
                    size="40px" />
                  <div class="min-w-0 flex-1 text-left">
                    <div class="text-body2">
                      <strong>{{ block.name }}</strong>
                    </div>
                    <div class="text-caption opacity-70">{{ block.description }}</div>
                    <div class="text-caption font-robotomono mt-1 opacity-60">
                      &lt;block-{{ block.block }}&gt;
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </w-scroll-area>
        </div>
        <w-separator vertical />
        <!-- ----------------------- -->
        <!-- Its properties -->
        <!-- ----------------------- -->
        <div class="block-picker-form w-1/3">
          <w-scroll-area style="height: 100%">
            <!-- A section header draws its own horizontal inset, so this pads vertically only -->
            <div class="py-4">
              <div
                v-if="!state.selected"
                class="text-caption p-6 text-center text-black/60 dark:text-white/70">
                {{ t('editor.blockPicker.selectHint') }}
              </div>
              <template v-else>
                <div class="w-section-header">{{ state.selected.name }}</div>
                <block-props-form
                  class="px-4 pt-4"
                  :fields="state.selected.props"
                  :values="state.values" />
                <!-- -> The markup itself, since that is what lands in the page -->
                <div class="w-section-header mt-6">{{ t('editor.blockPicker.markdown') }}</div>
                <!-- The same 16px all round, so it sits inside the panel the way the fields do -->
                <pre class="block-picker-output m-4">{{ markdown }}</pre>
              </template>
            </div>
          </w-scroll-area>
        </div>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { notify } from '@/composables/notify'
import { blockMarkdown, blockPropsFilled } from '@/helpers/blocks'

import BlockPropsForm from '@/components/BlockPropsForm.vue'

import { useSiteStore } from '@/stores/site'

/**
 * Picks a block and what to give it, and hands the editor the MDC markup for it.
 *
 * Only metadata is used here — the name, the icon, and the props the block declares. The component
 * itself is never imported: a block's code is fetched when its tag turns up in a page (see
 * `commonStore.loadBlocks`), and a picker that pulled in every block to show a list of them would
 * defeat that.
 *
 * `::block-name{prop="value"}` is MDC block syntax, which the renderer turns into
 * `<block-name prop="value">` — the element the component registers itself as.
 */

/** Blocks the editor's side toolbar inserts directly, so the picker leaves them out. */
const TOOLBAR_BLOCKS = ['tabs']

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  blocks: [],
  selected: null,
  /** Field values for the selected block, by prop name. */
  values: {},
  isLoading: false
})

// COMPUTED

/**
 * Blocks offered here: the ones this site has switched on, minus the ones the editor inserts itself.
 *
 * A block that is off cannot render, so offering it is a trap. Tabs is on but has its own button in
 * the editor's side toolbar, which inserts the very same markup — listing it here as well is a second
 * way to the same place.
 */
const blocks = computed(() =>
  state.blocks.filter((block) => block.isEnabled && !TOOLBAR_BLOCKS.includes(block.block))
)

const markdown = computed(() => (state.selected ? blockMarkdown(state.selected, state.values) : ''))

// -> A required prop with nothing in it would insert a block that cannot draw anything
const canInsert = computed(
  () => Boolean(state.selected) && blockPropsFilled(state.selected, state.values)
)

// METHODS

function select(block) {
  state.selected = block
  // -> Started at the block's own defaults, so the form shows what it would do if left alone
  state.values = Object.fromEntries(block.props.map((prop) => [prop.name, prop.default ?? '']))
}

function insert() {
  EVENT_BUS.emit('insertBlock', markdown.value)
  close()
}

function close() {
  siteStore.$patch({ overlay: '' })
}

// MOUNTED

onMounted(async () => {
  state.isLoading = true
  try {
    state.blocks = (await API_CLIENT.get(`sites/${siteStore.id}/blocks`).json()) ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: t('editor.blockPicker.loadFailed'),
      caption: err.message
    })
  }
  state.isLoading = false
})
</script>

<style lang="scss">
.block-picker {
  height: 100%;
  padding: 0;

  /*
    Nothing here sits on a `w-card`, and that is where the app's dark text colour comes from -- so the
    panels have to state it themselves or everything inheriting `color` stays black on a dark surface.
  */
  @at-root .body--light & {
    color: $grey-9;
  }
  @at-root .body--dark & {
    color: #fff;
  }

  /*
    In dark mode the catalog is the darkest surface in the pair, so the cards read as lifted off it,
    and the form is the lighter panel beside it. Stated outright rather than left to whatever sits
    behind the overlay, since the two panels are only legible relative to each other.
  */
  &-catalog {
    height: 100%;

    @at-root .body--dark & {
      background-color: $dark-6;
    }
  }

  &-form {
    height: 100%;

    @at-root .body--light & {
      background-color: $grey-1;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
    }
  }

  /*
    Two columns at most, however wide the overlay gets: a card carries a name, a sentence and a tag
    name, so it reads better wide than tiled. The `max()` is what caps the count -- a track asking
    for half the row (less its share of the gap) can only ever fit twice -- while the 280px floor
    takes over on a panel too narrow for two of them and drops the grid to a single column.
  */
  &-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(max(280px, calc(50% - 6px)), 1fr));
  }

  /*
    -> A card is the whole hit target, so the icon and the text are both part of choosing it

    It floats on its shadow rather than sitting in a border: deeper on hover, and ringed by a glow of
    the site's primary colour once picked. Selection is a shadow too, so nothing reflows as it moves
    between cards. Dark mode takes the raised surface `w-card` uses instead of staying white, which at
    this size would glare and would need its own text colour to stay readable.
  */
  &-card {
    display: flex;
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border-radius: 6px;
    background-color: #fff;
    color: inherit;
    text-align: left;
    cursor: pointer;
    box-shadow:
      0 1px 3px rgb(0 0 0 / 0.12),
      0 1px 2px rgb(0 0 0 / 0.06);
    transition: box-shadow 0.15s var(--ease-standard);

    &:hover {
      box-shadow:
        0 5px 12px rgb(0 0 0 / 0.16),
        0 2px 4px rgb(0 0 0 / 0.08);
    }

    &.is-selected,
    &.is-selected:hover {
      box-shadow:
        0 0 0 2px var(--color-primary),
        0 0 14px 2px color-mix(in srgb, var(--color-primary) 45%, transparent);
    }

    @at-root .body--dark & {
      background-color: $dark-3;
      box-shadow:
        0 1px 3px rgb(0 0 0 / 0.5),
        0 1px 2px rgb(0 0 0 / 0.35);

      &:hover {
        box-shadow:
          0 5px 14px rgb(0 0 0 / 0.6),
          0 2px 5px rgb(0 0 0 / 0.4);
      }

      &.is-selected,
      &.is-selected:hover {
        box-shadow:
          0 0 0 2px var(--color-primary),
          0 0 16px 3px color-mix(in srgb, var(--color-primary) 55%, transparent);
      }
    }
  }

  &-output {
    padding: 10px;
    border-radius: 4px;
    font-family: 'Roboto Mono', Consolas, 'Liberation Mono', Courier, monospace;
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;

    @at-root .body--light & {
      background-color: $grey-3;
      color: $grey-9;
    }
    @at-root .body--dark & {
      background-color: $dark-6;
      color: #fff;
    }
  }
}
</style>
