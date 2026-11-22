<template>
  <w-menu
    ref="menuRef"
    class="translucent-menu"
    :anchor="props.anchor"
    :self="props.self"
    @show="onShow">
    <div class="emoji-menu">
      <!--
        The tabs scroll the list rather than switching what is in it: one list with headings is what
        makes a search across everything, and a "Frequently Used" section above the groups, simple
        enough to be obviously correct.
      -->
      <div class="emoji-menu-tabs">
        <button
          v-for="tab of tabs"
          :key="tab.key"
          type="button"
          class="emoji-menu-tab"
          :class="{ 'is-active': state.activeTab === tab.key }"
          :aria-label="tab.label"
          @click="scrollToSection(tab.key)">
          <w-icon :name="tab.icon" size="20px" />
          <w-tooltip>{{ tab.label }}</w-tooltip>
        </button>
      </div>
      <div class="p-2">
        <!-- -> `transparent`, for the same reason as the code block menu's filter: the panel is acrylic -->
        <w-input
          ref="iptSearch"
          v-model="state.search"
          dense
          transparent
          clearable
          hide-bottom-space
          :label="t(`editor.emoji.search`)"
          :aria-label="t(`editor.emoji.search`)"
          @keyup:enter="chooseFirst">
          <template #prepend><w-icon name="la:search" /></template>
        </w-input>
      </div>
      <w-separator />
      <w-scroll-area ref="scrollRef" class="emoji-menu-list" @scroll="onScroll">
        <template v-if="isSearching">
          <div class="emoji-menu-heading">{{ t('editor.emoji.results') }}</div>
          <div class="emoji-menu-grid">
            <button
              v-for="[shortcode, character] of searchResults"
              :key="`found-${shortcode}`"
              type="button"
              class="emoji-menu-cell"
              :aria-label="shortcode"
              @click="choose(shortcode)"
              @mouseenter="state.preview = [shortcode, character]"
              @focus="state.preview = [shortcode, character]">
              {{ character }}
            </button>
          </div>
          <div v-if="searchResults.length < 1" class="emoji-menu-empty">
            {{ t('editor.emoji.noResults') }}
          </div>
        </template>
        <template v-else>
          <template v-for="section of sections" :key="section.key">
            <div :ref="(el) => setSectionRef(section.key, el)" class="emoji-menu-heading">
              {{ section.label }}
            </div>
            <div class="emoji-menu-grid">
              <button
                v-for="[shortcode, character] of section.emoji"
                :key="`${section.key}-${shortcode}`"
                type="button"
                class="emoji-menu-cell"
                :aria-label="shortcode"
                @click="choose(shortcode)"
                @mouseenter="state.preview = [shortcode, character]"
                @focus="state.preview = [shortcode, character]">
                {{ character }}
              </button>
            </div>
          </template>
        </template>
      </w-scroll-area>
      <w-separator />
      <!-- -> What the pointer is over, spelled out: the grid is 1,800 lookalikes and the shortcode is
              what actually lands in the page -->
      <div class="emoji-menu-preview">
        <div class="emoji-menu-preview-emoji">{{ state.preview ? state.preview[1] : '☝️' }}</div>
        <div class="min-w-0 flex-1 truncate">
          <div v-if="state.preview" class="text-body2 font-robotomono">
            :{{ state.preview[0] }}:
          </div>
          <div v-else class="text-body2 text-black/54 dark:text-white/70">
            {{ t('editor.emoji.pick') }}
          </div>
        </div>
      </div>
    </div>
  </w-menu>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { EMOJI_GROUPS } from '@/assets/emoji.generated'

/**
 * Picks an emoji, as the `:shortcode:` the renderer understands.
 *
 * What goes into a page is the shortcode, not the character: that is what `markdown-it-emoji` replaces
 * and what the renderer then draws as a twemoji SVG, so a page reads the same everywhere regardless of
 * the fonts on the machine. The grid shows the characters, which is the one place the system font is
 * exactly what is wanted.
 *
 * The groups come from `assets/emoji.generated.js` — see `scripts/generate-emoji.mjs` for why the
 * grouping is generated rather than fetched or hand-kept.
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

/** How many recent picks to keep, and where. Shared across editors and pages by design. */
const RECENT_KEY = 'wiki.emoji.recent'
const RECENT_MAX = 27

/** The tab strip, in the order the sections appear. Recents first, then Unicode's own order. */
const GROUP_TABS = {
  smileys_emotion: { icon: 'mdi:emoticon-outline', label: 'editor.emoji.smileysEmotion' },
  people_body: { icon: 'mdi:hand-wave-outline', label: 'editor.emoji.peopleBody' },
  animals_nature: { icon: 'mdi:dog', label: 'editor.emoji.animalsNature' },
  food_drink: { icon: 'mdi:food-apple-outline', label: 'editor.emoji.foodDrink' },
  travel_places: { icon: 'mdi:car', label: 'editor.emoji.travelPlaces' },
  activities: { icon: 'mdi:basketball', label: 'editor.emoji.activities' },
  objects: { icon: 'mdi:lightbulb-outline', label: 'editor.emoji.objects' },
  symbols: { icon: 'mdi:percent-outline', label: 'editor.emoji.symbols' },
  flags: { icon: 'mdi:flag-outline', label: 'editor.emoji.flags' }
}

const RECENT_TAB = { icon: 'mdi:clock-outline', label: 'editor.emoji.frequentlyUsed' }

// REFS

const menuRef = ref(null)
const iptSearch = ref(null)
const scrollRef = ref(null)

/** Each section's heading element, which is what a tab scrolls to and what the tabs track. */
const sectionEls = new Map()

/** WScrollArea is the scrolling element itself, so its root is what has to be scrolled. */
function scrollEl() {
  return scrollRef.value?.$el ?? null
}

// DATA

const state = reactive({
  search: '',
  /** The `[shortcode, character]` under the pointer, shown in the footer. Null when nothing is. */
  preview: null,
  recent: [],
  activeTab: 'smileys_emotion'
})

// COMPUTED

const isSearching = computed(() => state.search.trim().length > 0)

const tabs = computed(() => [
  ...(state.recent.length > 0
    ? [{ key: 'recent', icon: RECENT_TAB.icon, label: t(RECENT_TAB.label) }]
    : []),
  ...EMOJI_GROUPS.map((group) => ({
    key: group.slug,
    icon: GROUP_TABS[group.slug]?.icon ?? 'mdi:emoticon-outline',
    // -> The generated English name is the fallback, for a group the dataset adds later
    label: GROUP_TABS[group.slug] ? t(GROUP_TABS[group.slug].label) : group.name
  }))
])

const sections = computed(() => [
  ...(state.recent.length > 0
    ? [{ key: 'recent', label: t(RECENT_TAB.label), emoji: state.recent }]
    : []),
  ...EMOJI_GROUPS.map((group) => ({
    key: group.slug,
    label: GROUP_TABS[group.slug] ? t(GROUP_TABS[group.slug].label) : group.name,
    emoji: group.emoji
  }))
])

/*
  Matched on the shortcode alone, which is both the name and what gets written. Underscores are treated
  as spaces so that `open mouth` finds `open_mouth`, and every result is a shortcode the renderer knows,
  since that is where the list came from.
*/
const searchResults = computed(() => {
  const needle = state.search.trim().toLowerCase().replaceAll(' ', '_')
  return EMOJI_GROUPS.flatMap((group) =>
    group.emoji.filter(([shortcode]) => shortcode.includes(needle))
  )
})

// METHODS

function setSectionRef(key, el) {
  if (el) {
    sectionEls.set(key, el)
  } else {
    sectionEls.delete(key)
  }
}

/** Every pair by shortcode, for turning the stored recents back into something to draw. */
const BY_SHORTCODE = new Map(EMOJI_GROUPS.flatMap((group) => group.emoji))

function readRecent() {
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(RECENT_KEY) ?? '[]')
    if (!Array.isArray(stored)) {
      return []
    }
    /*
      Only shortcodes are stored, and only ones still in the data survive being read back: a name that
      has since gone would otherwise draw an empty cell nobody could explain.
    */
    return stored
      .filter((shortcode) => BY_SHORTCODE.has(shortcode))
      .map((shortcode) => [shortcode, BY_SHORTCODE.get(shortcode)])
  } catch {
    return []
  }
}

function rememberRecent(shortcode) {
  const pairs = [
    [shortcode, BY_SHORTCODE.get(shortcode)],
    ...state.recent.filter(([code]) => code !== shortcode)
  ].slice(0, RECENT_MAX)
  state.recent = pairs
  try {
    globalThis.localStorage?.setItem(RECENT_KEY, JSON.stringify(pairs.map(([code]) => code)))
  } catch {
    // -> A browser refusing storage costs the recents list and nothing else
  }
}

/** Opens on the search field, with recents as they were left. */
async function onShow() {
  state.search = ''
  state.preview = null
  state.recent = readRecent()
  state.activeTab = state.recent.length > 0 ? 'recent' : 'smileys_emotion'
  await nextTick()
  iptSearch.value?.focus()
}

/*
  Both of these measure with `getBoundingClientRect`, deliberately.

  `offsetTop` is relative to the nearest POSITIONED ancestor, which for these headings is the menu's
  floating panel rather than the scroll container -- so comparing it against the container's `scrollTop`
  was off by the panel's own offset, and every click landed on the section before the one asked for.
  Rects are in viewport space for both sides, so the difference is the real distance.
*/
function scrollToSection(key) {
  state.activeTab = key
  const list = scrollEl()
  const el = sectionEls.get(key)
  if (list && el) {
    list.scrollTop += el.getBoundingClientRect().top - list.getBoundingClientRect().top
  }
}

/** Keeps the tab strip in step with what is on screen while scrolling. */
function onScroll(event) {
  const listTop = event.target.getBoundingClientRect().top
  let active = sections.value[0]?.key
  for (const section of sections.value) {
    const el = sectionEls.get(section.key)
    // -> A heading counts as reached once it is at or above the top of the visible area
    if (el && el.getBoundingClientRect().top - listTop <= 8) {
      active = section.key
    }
  }
  state.activeTab = active
}

function choose(shortcode) {
  rememberRecent(shortcode)
  emit('select', shortcode)
  menuRef.value?.hide()
}

/** Enter takes the first match, so an emoji can be picked without leaving the keyboard. */
function chooseFirst() {
  const first = isSearching.value ? searchResults.value[0] : sections.value[0]?.emoji?.[0]
  if (first) {
    choose(first[0])
  }
}
</script>

<style scoped lang="scss">
.emoji-menu {
  width: 340px;
}

.emoji-menu-tabs {
  display: flex;
  flex-wrap: nowrap;
  padding: 0 4px;
}

/*
  A tab is an icon and an underline, which is all the strip needs: the label lives in the tooltip and in
  the heading the tab scrolls to.
*/
.emoji-menu-tab {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  padding: 8px 0 6px;
  border-bottom: 2px solid transparent;
  color: inherit;
  opacity: 0.55;
  cursor: pointer;
  transition:
    opacity 0.15s var(--ease-standard),
    border-color 0.15s var(--ease-standard);

  &:hover {
    opacity: 0.9;
  }

  &.is-active {
    border-bottom-color: var(--color-primary);
    opacity: 1;
  }
}

.emoji-menu-list {
  height: 300px;
}

.emoji-menu-heading {
  padding: 8px 10px 4px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.6;
}

.emoji-menu-grid {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  padding: 0 6px;
}

.emoji-menu-cell {
  display: flex;
  aspect-ratio: 1;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  /* -> The emoji itself, at a size worth aiming at; the system font is the point here */
  font-size: 20px;
  line-height: 1;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background-color: rgb(0 0 0 / 0.08);
    outline: none;

    @at-root .body--dark & {
      background-color: rgb(255 255 255 / 0.14);
    }
  }
}

.emoji-menu-empty {
  padding: 24px 12px;
  font-size: 12px;
  text-align: center;
  opacity: 0.6;
}

.emoji-menu-preview {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
}

.emoji-menu-preview-emoji {
  font-size: 26px;
  line-height: 1;
}
</style>
