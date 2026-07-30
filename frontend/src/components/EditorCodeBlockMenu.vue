<template>
  <w-menu
    ref="menuRef"
    class="translucent-menu"
    :anchor="props.anchor"
    :self="props.self"
    @show="onShow">
    <div class="code-block-menu">
      <div class="p-2">
        <!-- -> `transparent`: the panel behind this is acrylic, and an opaque field on it reads as a
                slab with the floating label straddling its edge -->
        <w-input
          ref="iptFilter"
          v-model="state.filter"
          dense
          outlined
          transparent
          clearable
          hide-bottom-space
          :label="t(`editor.codeBlock.filter`)"
          :aria-label="t(`editor.codeBlock.filter`)"
          @keyup:enter="chooseFirst">
          <template #prepend><w-icon name="la:search" /></template>
        </w-input>
      </div>
      <w-separator />
      <w-scroll-area class="code-block-menu-list">
        <w-list dense>
          <!--
            The handful worth reaching without typing, above the full set. Only while nothing is being
            filtered: with a filter on, two lists to read is worse than one, and every one of these is
            in the list below anyway.
          -->
          <template v-if="!isFiltering">
            <w-item
              v-for="language of COMMON_LANGUAGES"
              :key="`common-${language.id}`"
              clickable
              @click="choose(language.id)">
              <w-item-section>
                <w-item-label>{{ language.label }}</w-item-label>
              </w-item-section>
              <!-- -> A dash for plain text, which goes on the fence as nothing at all -->
              <w-item-section side>
                <div class="text-caption font-robotomono">{{ language.id || '—' }}</div>
              </w-item-section>
            </w-item>
            <w-separator class="my-1" />
          </template>
          <w-item
            v-for="language of filtered"
            :key="language.id"
            clickable
            @click="choose(language.id)">
            <w-item-section>
              <w-item-label>{{ language.label }}</w-item-label>
            </w-item-section>
            <!-- -> The id, because that is what ends up on the fence and what a reader of the source
                    will see -->
            <w-item-section side>
              <div class="text-caption font-robotomono">{{ language.id }}</div>
            </w-item-section>
          </w-item>
          <div
            v-if="filtered.length < 1"
            class="text-caption p-4 text-center text-black/60 dark:text-white/70">
            {{ t('editor.codeBlock.noResults') }}
          </div>
        </w-list>
      </w-scroll-area>
    </div>
  </w-menu>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import hljs from 'highlight.js'

/**
 * Picks the language for a fenced code block.
 *
 * The list is whatever highlight.js has registered — asked at runtime rather than kept as a copy here,
 * so it cannot drift from what the renderer will actually highlight. Each entry carries the id that
 * goes on the fence and the name hljs calls it; the filter matches either, plus the aliases, so `md`
 * finds Markdown and `js` finds JavaScript.
 */

// PROPS

const props = defineProps({
  anchor: {
    type: String,
    default: 'bottom left'
  },
  self: {
    type: String,
    default: 'top left'
  }
})

// EMITS

const emit = defineEmits(['select'])

// I18N

const { t } = useI18n()

/**
 * The five worth having at the top. Labelled here rather than taking hljs's own names, which for these
 * read as `Plain text`, `HTML, XML` and `Bash` — precise, and not what someone scanning a shortlist is
 * looking for.
 *
 * Two of the ids are not what the list below would show either:
 *   - `sh` and `md` are aliases rather than registered ids, so they are absent from that list; hljs
 *     resolves them to Bash and Markdown, which is what highlights the block.
 *   - Plain text has no id at all. A bare fence is how markdown says "no language", and it is what the
 *     renderer already treats as unhighlighted — so there is nothing to put after the backticks. The
 *     menu shows a dash where the others show their id.
 */
const COMMON_LANGUAGES = [
  { id: '', label: 'Plain Text' },
  { id: 'json', label: 'JSON' },
  { id: 'md', label: 'Markdown' },
  { id: 'sh', label: 'Bash Shell' },
  { id: 'xml', label: 'XML' }
]

/** Every registered language, by display name. Built once: the set cannot change at runtime. */
const ALL_LANGUAGES = hljs
  .listLanguages()
  .map((id) => {
    const definition = hljs.getLanguage(id)
    return {
      id,
      label: definition?.name ?? id,
      // -> Searched but never shown: `sh` and `zsh` are how someone looks for Bash
      aliases: definition?.aliases ?? []
    }
  })
  .sort((a, b) => a.label.localeCompare(b.label))

// REFS

const menuRef = ref(null)
const iptFilter = ref(null)

// DATA

const state = reactive({
  filter: ''
})

// COMPUTED

const isFiltering = computed(() => state.filter.trim().length > 0)

const filtered = computed(() => {
  if (!isFiltering.value) {
    return ALL_LANGUAGES
  }
  const needle = state.filter.trim().toLowerCase()
  return ALL_LANGUAGES.filter(
    (language) =>
      language.label.toLowerCase().includes(needle) ||
      language.id.includes(needle) ||
      language.aliases.some((alias) => alias.includes(needle))
  )
})

// METHODS

/** Opens on the whole list with the caret in the filter, whatever the last visit left behind. */
async function onShow() {
  state.filter = ''
  await nextTick()
  iptFilter.value?.focus()
}

function choose(id) {
  emit('select', id)
  menuRef.value?.hide()
}

/** Enter takes the top match, so a language can be chosen without leaving the keyboard. */
function chooseFirst() {
  const first = isFiltering.value ? filtered.value[0] : COMMON_LANGUAGES[0]
  if (first) {
    choose(first.id)
  }
}
</script>

<style scoped>
.code-block-menu {
  width: 300px;
}

.code-block-menu-list {
  height: 320px;
}
</style>
