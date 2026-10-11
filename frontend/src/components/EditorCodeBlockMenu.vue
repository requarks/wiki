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

import { ALL_LANGUAGES, COMMON_LANGUAGES } from '@/helpers/codeLanguages'

/**
 * Picks the language for a fenced code block, from the list in `helpers/codeLanguages.js`. The filter
 * matches an entry's id, its name or one of its aliases, so `md` finds Markdown and `js` finds
 * JavaScript.
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
