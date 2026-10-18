<template>
  <!--
    The document's headings, kept up to date as it is written, each one a way to the line it is on.
    The third column of a source editor, between its preview and the actions rail. Shared by the
    Markdown and AsciiDoc editors, which each supply the headings their renderer found and do the
    moving: this pane only says where to go.
  -->
  <nav class="editor-contents" :aria-label="t(`editor.contents.title`)">
    <!-- -> A bar level with the preview's, set the way its label is, and stepping into the rail as it did -->
    <div class="editor-contents-toolbar" :class="{ 'is-railless': props.railless }">
      <strong class="editor-contents-label"
        ><em>{{ t('editor.contents.title') }}</em></strong
      >
      <w-space />
      <w-btn
        icon="mdi:dots-horizontal"
        padding="xs sm"
        flat
        :aria-label="t(`editor.contents.menu`)">
        <w-menu auto-close anchor="bottom right" self="top right">
          <w-list dense padding>
            <w-item clickable @click="emit('hide')">
              <w-item-section side><w-icon name="mdi:eye-off-outline" /></w-item-section>
              <w-item-section>
                <w-item-label>{{ t('editor.contents.hide') }}</w-item-label>
              </w-item-section>
            </w-item>
          </w-list>
        </w-menu>
        <w-tooltip anchor="top middle" self="bottom middle">{{
          t('editor.contents.menu')
        }}</w-tooltip>
      </w-btn>
    </div>
    <div class="editor-contents-body">
      <ul v-if="items.length > 0">
        <li v-for="heading of items" :key="`${heading.line}-${heading.text}`">
          <a
            :href="`#L${heading.line}`"
            :class="[`is-h${heading.level}`, { 'is-current': heading.line === currentHeadingLine }]"
            @click.prevent="emit('goToLine', heading.line)"
            >{{ heading.text }}</a
          >
        </li>
      </ul>
      <div v-else class="editor-contents-empty">
        {{ t('editor.contents.empty') }}
      </div>
      <div class="editor-contents-actions">
        <!-- -> Only when there is something it would add: H3s are what expanding shows -->
        <a v-if="hasH3" href="#" @click.prevent="expanded = !expanded">{{
          expanded ? t('editor.contents.collapse') : t('editor.contents.expand')
        }}</a>
        <a href="#" @click.prevent="emit('goToLine', 1)">{{ t('editor.contents.backToTop') }}</a>
        <a href="#" @click.prevent="emit('goToEnd')">{{ t('editor.contents.goToBottom') }}</a>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// PROPS

const props = defineProps({
  /**
   * The document's headings in order, as its renderer found them: `{ level, text, line }`, with
   * `level` the HTML heading it is drawn as and `line` the source line it starts on.
   */
  headings: {
    type: Array,
    default: () => []
  },
  /** The line the caret is on, for marking which section is being written in. */
  cursorLine: {
    type: Number,
    default: 1
  },
  /** No actions rail beside the editor -- a live note's -- so no brickwork stepping into one. */
  railless: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['goToLine', 'goToEnd', 'hide'])

// I18N

const { t } = useI18n()

// STATE

/** Whether H3s are listed as well as H1s and H2s. Open to start with; Collapse hides them. */
const expanded = ref(true)

// COMPUTED

const items = computed(() =>
  props.headings.filter((heading) => heading.level <= (expanded.value ? 3 : 2))
)

const hasH3 = computed(() => props.headings.some((heading) => heading.level === 3))

/** The heading of the section the caret is in, among the ones listed: the last at or above it. */
const currentHeadingLine = computed(() => {
  let current = null
  for (const heading of items.value) {
    if (heading.line > props.cursorLine) {
      break
    }
    current = heading.line
  }
  return current
})
</script>

<style lang="scss">
@use '@/css/_bricks.scss' as *;

/*
  A light grey in the light theme, so that it reads as furniture beside the white of the render
  rather than as more of it.

  Its width is `--editor-contents-size`, set by the editor it is in, which also has to allow for it in
  the preview's measure -- see `has-contents` in either editor's stylesheet.

  Kept tight throughout, since it is the third column of a screen already split two ways and every
  pixel it takes comes out of the source and the preview. `--inset` is where the text of a top-level
  entry starts -- the body's side padding plus a link's, below -- which the bar's label lines up with.
*/
.editor-contents {
  --inset: 0.6rem;

  flex: 0 0 var(--editor-contents-size);
  display: flex;
  flex-direction: column;
  // -> The editors' own `$editor-height`, which it stands beside
  height: calc(100vh - 64px - 96px);
  font-size: 0.8rem;
  line-height: 1.3;

  @at-root .body--light & {
    background-color: $grey-2;
    border-left: 1px solid $grey-3;
    color: $grey-8;
  }
  // -> A step up from the render's `$dark`, as the light theme's grey is a step down from its white
  @at-root .body--dark & {
    background-color: $dark-4;
    border-left: 1px solid rgba(#fff, 0.08);
    color: $grey-4;
  }

  /*
    Opening and closing, the way the preview does it: the box slides between nothing and its width,
    and what is in it keeps the full width throughout so that nothing rewraps as it goes -- the
    headings are clipped by the edge moving over them instead. The editor wraps the pane in a
    `<transition name="editor-contents">`.
  */
  &-enter-active,
  &-leave-active {
    overflow: hidden;
    max-width: var(--editor-contents-size);
    transition: max-width 0.5s ease;

    > * {
      width: var(--editor-contents-size);
      min-width: var(--editor-contents-size);
    }
  }
  &-enter-from,
  &-leave-to {
    max-width: 0;
  }
  // -> The operating system's own setting; the reader's Reduce Motion is the global rule in `_animation.scss`
  @media (prefers-reduced-motion: reduce) {
    &-enter-active,
    &-leave-active {
      transition-duration: 0.01ms;
    }
  }

  /*
    The preview bar's height and type, a step lighter (`$dark-1` against its `$dark-2`): beside it,
    and part of the same strip, but its own column. Dark in either appearance, as that bar is.
  */
  &-toolbar {
    /*
      -> A fixed height, as the preview bar's is, and allowed to be smaller than what is in it: a
         flex item's automatic minimum is its content, and the button would otherwise make it taller
    */
    flex: 0 0 auto;
    height: 32px;
    min-height: 0;
    display: flex;
    align-items: center;
    padding: 0 0.25rem 0 var(--inset);
    background-color: $dark-1;
    /* -> The preview bar's, for the button: dark in both themes, so not the column's own text colour */
    color: $grey-6;
    font-size: 0.875rem;
    line-height: normal;

    /*
      -> The brickwork into the actions rail, which the preview bar hands over while this column
         stands between it and the rail -- and, as there, none on a note, which has no rail
    */
    @include brick-transition($dark-1);
    padding-right: calc(var(--brick) * 6 + 0.25rem);

    &.is-railless {
      background-image: none;
      padding-right: 0.25rem;
    }
  }
  // -> Cut short rather than pushing the button off a narrow bar, in a language with a longer word for it
  &-label {
    color: $grey-5;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* -> What scrolls, under a bar that does not */
  &-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 0.4rem 0.2rem 0.75rem;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  // -> Each level a step further in than the one above, the step being about the width of a letter
  li a {
    display: block;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    color: inherit;
    text-decoration: none;
    overflow-wrap: anywhere;

    &:hover {
      background-color: rgba($primary, 0.08);
    }
    &.is-h1 {
      font-weight: 600;
    }
    &.is-h2 {
      padding-inline-start: 0.9rem;
    }
    &.is-h3 {
      padding-inline-start: 1.4rem;
      opacity: 0.8;
    }
    /* -> The section the caret is in */
    &.is-current {
      color: $primary;
      background-color: rgba($primary, 0.1);
      opacity: 1;

      // -> The lighter blue on a dark column, as the page's own contents does (`PageToc.vue`)
      @at-root .body--dark & {
        color: var(--color-primary-light);
      }
    }
  }

  &-empty {
    padding: 0 0.4rem;
    opacity: 0.6;
  }

  /*
    -> Expand / Collapse, then the two ends of the document, one under the other -- ruled off from the
       headings above, since these act on the list and the document rather than being entries in it
  */
  &-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
    margin-top: 0.5rem;
    padding: 0.5rem 0.4rem 0;

    @at-root .body--light & {
      border-top: 1px solid $grey-4;
    }
    @at-root .body--dark & {
      border-top: 1px solid rgba(#fff, 0.1);
    }

    a {
      color: $primary;
      text-decoration: none;

      @at-root .body--dark & {
        color: var(--color-primary-light);
      }

      &:hover {
        text-decoration: underline;
      }
    }
  }
}
</style>
