<template>
  <!--
    Nothing at all when you are on your own, which is the ordinary case: a single bubble of your own
    face says nothing you did not already know, and the header has better uses for the space. Unless
    the caller asks otherwise -- see `showAlone`.
  -->
  <div
    v-if="collabStore.people.length > (props.showAlone ? 0 : 1)"
    class="collab-presence"
    role="group"
    :aria-label="t('editor.collab.participants')">
    <!--
      The bubble is wrapped rather than styled alone because it has to clip the avatar to a circle,
      and a ring rippling outwards from something that clips its own children would be cut off at the
      edge it is supposed to leave.
    -->
    <div
      v-for="person of visible"
      :key="person.id"
      class="collab-presence-person"
      :class="{ 'is-typing': person.typing }">
      <span
        class="collab-presence-wave"
        :style="{ borderColor: person.color }"
        aria-hidden="true" />
      <div class="collab-presence-bubble" :style="{ backgroundColor: person.color }">
        <!--
          No `alt`: the name is already on the group's label and in the tooltip, and an avatar that
          fails to load should fall back to the coloured circle rather than to the person's name in
          plain text across the header.
        -->
        <img v-if="person.hasAvatar" :src="`/_user/${person.id}/avatar`" alt="" />
        <span v-else>{{ initials(person.name) }}</span>
      </div>
      <w-tooltip>
        {{ personLabel(person) }}
      </w-tooltip>
    </div>
    <!--
      Everybody past the fifth, as a count. The count pulses on behalf of whoever it is standing in
      for, so that someone typing out of sight is not simply invisible.

      Hovering it names everyone in the room, and clicking it lists them -- the click being the way in
      on a touch screen and from the keyboard, which a tooltip is not. Everyone rather than only the
      ones it hides, since "who is here" is the question, and the faces in the row only answer it for
      people who recognise them. The tooltip stands down while the list is open, both saying the same.
    -->
    <button
      v-if="overflow > 0"
      type="button"
      class="w-unstyled collab-presence-person collab-presence-person--overflow"
      :class="{ 'is-typing': overflowTyping }"
      aria-haspopup="menu"
      :aria-expanded="String(state.listOpen)"
      :aria-label="t('editor.collab.showEveryone', { count: overflow })"
      @click="toggleList">
      <span class="collab-presence-wave" aria-hidden="true" />
      <span class="collab-presence-bubble collab-presence-overflow">+{{ overflow }}</span>
      <w-tooltip v-if="!state.listOpen">
        <div v-for="person of everyone" :key="person.id">{{ personLabel(person) }}</div>
      </w-tooltip>
      <w-menu v-model="state.listOpen" anchor="bottom right" self="top right">
        <w-list
          dense
          padding
          style="min-width: 200px"
          :aria-label="t('editor.collab.participants')">
          <w-item v-for="person of everyone" :key="person.id">
            <w-item-section avatar class="!min-w-0 !pr-2">
              <span
                class="collab-presence-bubble collab-presence-bubble--small"
                :style="{ backgroundColor: person.color }">
                <img v-if="person.hasAvatar" :src="`/_user/${person.id}/avatar`" alt="" />
                <span v-else>{{ initials(person.name) }}</span>
              </span>
            </w-item-section>
            <w-item-section>{{ personLabel(person) }}</w-item-section>
          </w-item>
        </w-list>
      </w-menu>
    </button>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCollabStore } from '@/stores/collab'

/**
 * Who is editing this page right now, as a row of overlapping faces in the page header.
 *
 * Fed entirely by `stores/collab.js`, so it is empty whenever there is no session — which covers the
 * site having the feature off, the editor being anything other than markdown, and an edit being
 * suggested rather than made.
 */

// PROPS

const props = defineProps({
  /**
   * Draw the row even when the only face in it is the reader's own. A live note asks for this: it is a
   * room people are sent to by link, and the row is how a reader sees at a glance that they are in it
   * and who else is.
   */
  showAlone: {
    type: Boolean,
    default: false
  }
})

const collabStore = useCollabStore()

const { t } = useI18n()

/**
 * Past this many the row starts costing more space than it is worth, and the rest become a count: five
 * people show as five faces, and a sixth turns into `+1` beside them.
 */
const MAX_VISIBLE = 5

const state = reactive({
  /** Whether the list behind the count is open. */
  listOpen: false
})

/**
 * Whose faces are shown besides the reader's own, by user id, in the order they are drawn -- held by
 * the collab store as `shownIds`, so that the row hidden and drawn again on a resize comes back as it
 * was.
 *
 * Kept rather than worked out afresh, because which faces are shown is decided by who was active last
 * -- typed most recently -- and a ranking redrawn in full would reshuffle the row every time somebody
 * typed. So a face keeps its place for as long as it is shown, and changes only when it has to -- see
 * `arrange`.
 */
const slotIds = computed(() => collabStore.shownIds)

const self = computed(() => collabStore.people.find((person) => person.isSelf) ?? null)
const others = computed(() => collabStore.people.filter((person) => !person.isSelf))

/** The reader's own face is always first, so the others have what is left of the row. */
const slotCount = computed(() => MAX_VISIBLE - (self.value ? 1 : 0))

const visible = computed(() => {
  const byId = new Map(others.value.map((person) => [person.id, person]))
  const shown = slotIds.value.map((id) => byId.get(id)).filter(Boolean)
  return self.value ? [self.value, ...shown] : shown
})
const hidden = computed(() => others.value.filter((person) => !slotIds.value.includes(person.id)))
const overflow = computed(() => hidden.value.length)
const overflowTyping = computed(() => hidden.value.some((person) => person.typing))
/** Everyone in the room, for the tooltip and the list behind the count: the row's order, then the rest. */
const everyone = computed(() => [...visible.value, ...hidden.value])

// WATCHERS

watch([others, () => collabStore.activeAt, slotCount], arrange, { immediate: true })

// METHODS

/**
 * Open or close the list behind the count. The menu is bound with `v-model` -- so that the tooltip can
 * stand down while it is open -- and a controlled `WMenu` leaves its trigger's click to the caller.
 */
function toggleList() {
  state.listOpen = !state.listOpen
}

/** When somebody was last seen typing, or 0 for somebody who has not typed this session. */
function activityOf(id) {
  return collabStore.activeAt[id] ?? 0
}

/**
 * Bring the shown faces up to date with who is in the room and who has been active, moving as few of
 * them as possible.
 *
 * - Somebody who left gives up their place, and it is taken where it stands rather than closed up --
 *   by whoever has been active most recently among those not shown.
 * - Somebody not shown who was active more recently than the face shown longest idle takes that
 *   face's place, in place. Which is the only way a face shown is ever replaced: by somebody who has
 *   just made it the sixth most recently active person in the room, the reader included.
 * - Any place still free goes to whoever is left, most recently active first and then in the order
 *   they arrived, which is how a room fills up before anybody has typed. A newcomer who has not typed
 *   takes a free place and never anybody's face.
 */
function arrange() {
  const present = new Set(others.value.map((person) => person.id))
  const slots = slotIds.value.map((id) => (present.has(id) ? id : null))
  // -> Fewer places than faces (the reader's own face has just arrived): the longest idle go
  while (slots.length > slotCount.value) {
    const at = slots.indexOf(null)
    slots.splice(at >= 0 ? at : leastActiveSlot(slots), 1)
  }

  const waiting = others.value
    .filter((person) => !slots.includes(person.id))
    .map((person) => person.id)
    // -> Stable, so that among people who have not typed, the order they arrived in is kept
    .sort((a, b) => activityOf(b) - activityOf(a))

  for (const id of waiting) {
    const free = slots.indexOf(null)
    if (free >= 0) {
      slots[free] = id
    } else if (slots.length < slotCount.value) {
      slots.push(id)
    } else {
      const at = leastActiveSlot(slots)
      if (activityOf(id) <= activityOf(slots[at])) {
        // -> In order of activity, so nobody further down the queue is more active either
        break
      }
      slots[at] = id
    }
  }

  // -> Only when something moved: this runs on every awareness change, a caret moving included
  const next = slots.filter(Boolean)
  if (
    next.length !== slotIds.value.length ||
    next.some((id, index) => id !== slotIds.value[index])
  ) {
    collabStore.shownIds = next
  }
}

/** Where the face shown longest idle is: the last of them, among those tied. */
function leastActiveSlot(slots) {
  let at = 0
  for (const [index, id] of slots.entries()) {
    if (id && activityOf(id) <= activityOf(slots[at])) {
      at = index
    }
  }
  return at
}

/** A participant's name, or `You` for the reader's own face. */
function personLabel(person) {
  return person.isSelf ? t('editor.collab.you') : person.name
}

/**
 * Up to two letters, from the first and last word of the name — `Ada Lovelace` gives `AL`, and a
 * mononym gives its first letter. Falls back to a neutral glyph rather than an empty circle for an
 * account with no name on it.
 */
function initials(name) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length < 1) {
    return '?'
  }
  const first = words[0][0]
  const last = words.length > 1 ? words.at(-1)[0] : ''
  return `${first}${last}`.toUpperCase()
}
</script>

<style scoped lang="scss">
.collab-presence {
  display: flex;
  align-items: center;
  /* -> Leaves the leftmost bubble's own overlap margin with nothing to overlap into */
  padding-left: 8px;

  &-person {
    position: relative;
    /* -> The overlap that makes the row read as a group rather than a list of separate faces */
    margin-left: -8px;
  }

  /*
    The ripple. Sits under the faces rather than over them, so a wave passing beneath the next avatar
    along does not wash over it -- `z-index: 0` against the bubbles' `1`, in document order, is what
    puts it there.
  */
  &-wave {
    position: absolute;
    z-index: 0;
    inset: 0;
    border-radius: 9999px;
    /* -> A hairline: the ring is meant to be noticed out of the corner of an eye, not read */
    border: 1px solid transparent;
    opacity: 0;
    pointer-events: none;
  }

  &-person.is-typing &-wave {
    animation: collab-presence-wave 1.6s ease-out infinite;
  }

  &-bubble {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 9999px;
    color: #fff;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    overflow: hidden;
    user-select: none;

    /*
      The ring is what stops two adjacent faces from reading as one shape, so it has to be the header
      behind them rather than a fixed colour — the header is near-white on one theme and near-black
      on the other.
    */
    @at-root .body--light & {
      box-shadow: 0 0 0 2px $grey-1;
    }
    @at-root .body--dark & {
      box-shadow: 0 0 0 2px $dark-3;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  /*
    A face in the list behind the count, beside a name. No ring: it separates a face from the one it
    overlaps in the row, and in a list nothing overlaps.
  */
  &-bubble--small {
    width: 22px;
    height: 22px;
    font-size: 0.6rem;

    @at-root .body--light &,
      .body--dark & {
      box-shadow: none;
    }
  }

  &-person--overflow {
    cursor: pointer;
    border-radius: 9999px;
  }

  &-overflow {
    @at-root .body--light & {
      background-color: $grey-6;
    }
    @at-root .body--dark & {
      background-color: $grey-8;
    }
  }

  /*
    The count stands in for several people at once and so has no one colour to ripple in; it borrows
    the grey it is drawn in. Every other wave takes its colour from its owner, inline.
  */
  &-person--overflow &-wave {
    @at-root .body--light & {
      border-color: $grey-6;
    }
    @at-root .body--dark & {
      border-color: $grey-8;
    }
  }
}

@keyframes collab-presence-wave {
  0% {
    transform: scale(1);
    opacity: 0.35;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

/*
  A ring that never stops moving is exactly what someone who asked for less motion asked to be spared,
  and the information it carries -- who is typing -- would be lost with it. So it stops expanding and
  stays put instead: a steady halo that still says the same thing.
*/
@media (prefers-reduced-motion: reduce) {
  .collab-presence-person.is-typing .collab-presence-wave {
    animation: none;
    transform: scale(1.35);
    /* -> Held a little stronger than the moving ring, having only stillness to be noticed by */
    opacity: 0.45;
  }
}
/* -> Twinned under the Reduce Motion profile setting; see `css/_animation.scss` */
.body--reduce-motion .collab-presence-person.is-typing .collab-presence-wave {
  animation: none;
  transform: scale(1.35);
  opacity: 0.45;
}
</style>
