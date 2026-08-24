<template>
  <w-menu
    ref="menu"
    class="translucent-menu"
    :anchor="props.anchor"
    :self="props.self"
    :offset="props.offset"
    @show="onShow">
    <!-- -> A fixed width: the levels slide sideways past each other, so a panel that resized to its
            contents would jump mid-slide. Long titles truncate instead. -->
    <div class="browse-menu-panel">
      <div class="browse-menu-header flex flex-nowrap items-center">
        <!-- -> There is nowhere to go up to from the root, so the button is absent there rather than
                sitting disabled. It slides in from the left as its own space opens up, and back out
                the same way, so the title beside it moves with it instead of jumping. -->
        <transition name="browse-menu-up">
          <div v-if="!isRoot" class="browse-menu-up-slot">
            <!-- -> The icon comes through the slot rather than the `icon` prop, which is the only way
                    to size it: WBtn draws a prop icon at WIcon's own default of 24px -->
            <w-btn
              class="browse-menu-up acrylic-btn"
              flat
              dense
              :disable="state.isLoading"
              :aria-label="t(`common.browse.upOneLevel`)"
              @click="goUp">
              <w-icon name="la:arrow-up" size="xs" />
              <w-tooltip>{{ t('common.browse.upOneLevel') }}</w-tooltip>
            </w-btn>
          </div>
        </transition>
        <div class="min-w-0 flex-1">
          <!-- -> The root has no title of its own, and the site is already named in the sidebar
                  header directly above this, so there the path stands alone -->
          <div v-if="level.title" class="truncate text-sm font-medium">{{ level.title }}</div>
          <div class="text-caption truncate opacity-60 font-robotomono">/{{ state.path }}</div>
        </div>
      </div>
      <w-separator />
      <div class="browse-menu-track relative overflow-hidden">
        <!-- -> Absolute, so that showing it neither shifts the rows down nor re-anchors the panel -->
        <w-linear-progress
          v-if="state.isLoading"
          class="absolute inset-x-0 top-0 z-10"
          indeterminate
          size="2px" />
        <transition :name="`browse-menu-${state.direction}`">
          <div :key="state.path" class="browse-menu-level py-1">
            <div
              v-for="item of level.items"
              :key="item.path"
              class="browse-menu-row flex flex-nowrap items-stretch">
              <!--
                One row per name, whichever of the two kinds it is -- and both at once for a page
                that also has a folder of pages under it. There the label opens the page and the
                chevron beside it descends, so neither way in hides the other.
              -->
              <router-link
                v-if="item.isPage"
                class="browse-menu-target"
                :to="`${localePrefix}/${item.path}`"
                @click="menu?.hide()">
                <w-icon :name="item.icon || `la:file-alt`" size="xs" class="shrink-0 opacity-70" />
                <span class="truncate">{{ item.title }}</span>
              </router-link>
              <!-- -> The File Manager's folder, so a folder looks the same wherever the wiki draws
                      one. Full strength, unlike the line icons around it: it is a colour image, and
                      dimming it only washes the yellow out. -->
              <button v-else type="button" class="browse-menu-target" @click="descend(item)">
                <w-icon name="img:/_assets/icons/fluent-folder.svg" size="xs" class="shrink-0" />
                <span class="truncate">{{ item.title }}</span>
                <w-space />
                <w-icon name="la:angle-right" size="xs" class="shrink-0 opacity-40" />
              </button>
              <button
                v-if="item.isPage && item.isFolder"
                type="button"
                class="browse-menu-into"
                :aria-label="t(`common.browse.openFolder`, { title: item.title })"
                @click="descend(item)">
                <w-tooltip>{{ t('common.browse.openFolder', { title: item.title }) }}</w-tooltip>
                <w-icon name="la:angle-right" size="xs" class="opacity-70" />
              </button>
            </div>
            <div v-if="level.items.length < 1" class="browse-menu-note">
              {{ t('common.browse.empty') }}
            </div>
            <div v-if="level.truncated" class="browse-menu-note">
              {{ t('common.browse.truncated') }}
            </div>
          </div>
        </transition>
      </div>
    </div>
  </w-menu>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { notify } from '@/composables/notify'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

/**
 * The sidebar's Browse menu: one folder of the site at a time, as a reader walks it.
 *
 * Opens on the folder holding the page being read, and slides a level sideways on the way in or out
 * rather than nesting submenus -- a wiki tree is deep, and cascading panels would run off the screen
 * a couple of levels down.
 *
 * What it lists comes from `tree/browse`, which decides what a reader may see; nothing here filters,
 * so there is no version of this menu that shows more than the server was willing to hand over.
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
  },
  offset: {
    type: Array,
    default: () => [0, 0]
  }
})

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// REFS

const menu = ref(null)

// DATA

const EMPTY_LEVEL = { title: '', items: [], truncated: false }

const state = reactive({
  /** Slash-separated path of the folder being listed. Empty at the site root. */
  path: '',
  /**
   * The locale the levels held here were listed in. Captured when the menu opens rather than read per
   * row: a level is one locale's tree, so what it lists and where its rows lead have to agree on which.
   */
  locale: '',
  /** Which way the next level slides in from. */
  direction: 'forward',
  isLoading: false,
  /** Levels already fetched, by path, so that walking back up is instant. */
  levels: {}
})

// COMPUTED

const level = computed(() => state.levels[state.path] ?? EMPTY_LEVEL)

const isRoot = computed(() => !state.path)

/**
 * What a row's link starts with, for the locale this level was listed in.
 *
 * `tree/browse` answers for one locale, so every page here is read at that locale's address — which on
 * a site that brackets its URLs by locale is a prefixed one. Without it each row pointed at the
 * primary locale's copy of the path: a reader browsing the French tree was sent to the English page,
 * or to a path that has no page in the primary locale at all.
 */
const localePrefix = computed(() => siteStore.localeUrlPrefix(state.locale))

// METHODS

/** Opens on the folder holding the current page, with whatever was cached from last time dropped. */
function onShow() {
  state.levels = {}
  state.direction = 'forward'
  state.locale = pageStore.locale
  state.path = pageStore.folderPath
  load(state.path)
}

/*
  Which fetch is the current one. Reopening the menu drops the cache and asks again, so a request
  from the previous open can still land afterwards — and it must not be the one that decides the
  progress bar is finished. The level it writes is keyed by its own path, so it is harmless otherwise.
*/
let latestRequest = 0

async function load(path) {
  if (state.levels[path]) {
    return true
  }
  const request = ++latestRequest
  state.isLoading = true
  try {
    const data = await API_CLIENT.get(`sites/${siteStore.id}/tree/browse`, {
      searchParams: {
        path,
        locale: state.locale
      }
    }).json()
    state.levels[path] = {
      title: data.title ?? '',
      items: data.items ?? [],
      truncated: Boolean(data.truncated)
    }
    return true
  } catch (err) {
    notify({
      type: 'negative',
      message: t('common.browse.loadFailed'),
      caption: err.message
    })
    return false
  } finally {
    if (request === latestRequest) {
      state.isLoading = false
    }
  }
}

/**
 * Moves to another level: the contents are fetched first, so the slide reveals the rows already in
 * place rather than an empty panel that fills in afterwards.
 */
async function moveTo(path, direction) {
  if (state.isLoading || path === state.path) {
    return
  }
  if (!(await load(path))) {
    return
  }
  state.direction = direction
  state.path = path
  // -> The panel is anchored by its top edge, and a level of a different length moves the other one
  await nextTick()
  menu.value?.updatePosition()
}

function descend(item) {
  moveTo(item.path, 'forward')
}

function goUp() {
  moveTo(state.path.split('/').slice(0, -1).join('/'), 'back')
}
</script>

<style scoped lang="scss">
.browse-menu-panel {
  width: 270px;
}

/*
  A fixed height, because the header's contents are not the same on every level: the root has no
  title line and no up button, and letting the row size itself moved everything below it by the
  difference each time a level changed. 52px is the two lines it holds at most -- a 20px title and a
  20px path -- plus the space around them.

  That leaves 12px above and below the 28px button, which is where the 12px beside it comes from: the
  gap around it reads as even only if all four sides match. The left one is this padding, the right
  one is the slot's own margin below.
*/
.browse-menu-header {
  height: 52px;
  padding: 0 8px 0 12px;
}

/*
  A square target. `dense` puts 4px around the 18px icon, and pinning the min-width to the 28px the
  height comes to is what keeps the box from ending up wider or narrower than it is tall, rather than
  leaving the square to be a coincidence of two component defaults.
*/
.browse-menu-up {
  min-width: 28px;
}

/* -> Dimmed at rest: it is the one control up here, and it should not compete with the folder name
      beside it. Full strength once the pointer is on it. */
.browse-menu-up .w-icon {
  opacity: 0.7;
}

.browse-menu-up:hover .w-icon {
  opacity: 1;
}

/*
  The button's footprint, as its own element: `width` is what animates, so the space closes up with
  the button rather than after it. Sized to match the button, which fills it exactly, plus the gap
  that separates it from the title -- which belongs to the button and so goes when it goes.
*/
.browse-menu-up-slot {
  flex: none;
  width: 28px;
  margin-right: 12px;
}

/*
  Clipped only while it moves. At rest the slot must not clip, or it would cut off the focus ring
  WBtn draws just outside its own box.
*/
.browse-menu-up-enter-active,
.browse-menu-up-leave-active {
  overflow: hidden;
  transition:
    width 0.18s var(--ease-standard),
    margin-right 0.18s var(--ease-standard),
    opacity 0.18s var(--ease-standard);
}

/* -> The slide itself is on the button: a percentage transform on the slot would resolve against a
      width that is zero at exactly that moment, and move nothing */
.browse-menu-up-enter-active .browse-menu-up,
.browse-menu-up-leave-active .browse-menu-up {
  transition: transform 0.18s var(--ease-standard);
}

.browse-menu-up-enter-from,
.browse-menu-up-leave-to {
  width: 0;
  margin-right: 0;
  opacity: 0;
}

.browse-menu-up-enter-from .browse-menu-up,
.browse-menu-up-leave-to .browse-menu-up {
  transform: translateX(-100%);
}

@media (prefers-reduced-motion: reduce) {
  .browse-menu-up-enter-active,
  .browse-menu-up-leave-active,
  .browse-menu-up-enter-active .browse-menu-up,
  .browse-menu-up-leave-active .browse-menu-up {
    transition-duration: 0.01ms;
  }
}

.browse-menu-target {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 13px;
  text-align: left;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}

/*
  The page being read, marked without a line of script: a `router-link` to the current route carries
  `router-link-exact-active` itself, and the menu opens on that page's own folder — so it is normally
  one of the rows on screen.
*/
.browse-menu-target.router-link-exact-active {
  color: var(--color-primary);
  font-weight: 500;

  @at-root .body--dark & {
    color: var(--color-primary-light);
  }
}

.browse-menu-into {
  display: flex;
  align-items: center;
  padding: 0 10px;
  cursor: pointer;
  /* -> The seam that says the row has two hit targets rather than one */
  border-left: 1px solid rgb(0 0 0 / 0.08);

  @at-root .body--dark & {
    border-left-color: rgb(255 255 255 / 0.12);
  }
}

/* Same tints WItem uses, so a row here feels like a row anywhere else */
.browse-menu-target,
.browse-menu-into {
  &:hover {
    background-color: rgb(0 0 0 / 0.08);
  }
  &:active {
    background-color: rgb(0 0 0 / 0.14);
  }

  @at-root .body--dark & {
    &:hover {
      background-color: rgb(255 255 255 / 0.14);
    }
    &:active {
      background-color: rgb(255 255 255 / 0.22);
    }
  }
}

.browse-menu-note {
  padding: 8px 12px;
  font-size: 12px;
  opacity: 0.6;
}

/*
  The slide.

  The incoming level stays in flow, so the panel takes its height immediately; the outgoing one is
  taken out of flow for the duration, which is what lets the two overlap while they cross.
*/
.browse-menu-level {
  width: 100%;
}

.browse-menu-forward-enter-active,
.browse-menu-forward-leave-active,
.browse-menu-back-enter-active,
.browse-menu-back-leave-active {
  transition:
    transform 0.18s var(--ease-standard),
    opacity 0.18s var(--ease-standard);
}

.browse-menu-forward-leave-active,
.browse-menu-back-leave-active {
  position: absolute;
  top: 0;
  left: 0;
}

.browse-menu-forward-enter-from,
.browse-menu-back-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.browse-menu-forward-leave-to,
.browse-menu-back-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .browse-menu-forward-enter-active,
  .browse-menu-forward-leave-active,
  .browse-menu-back-enter-active,
  .browse-menu-back-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
