<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card class="rule-perms" style="width: 1280px; max-width: 95vw">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-security-lock.svg" size="sm" class="mr-2" />
        <span>{{ t('admin.groups.rulePermissionsTitle') }}</span>
        <w-space />
        <!-- -> The help button the overlays carry in their headers -- see `FileManager` -->
        <w-btn
          class="-my-2"
          flat
          round
          dense
          color="white"
          icon="la:question-circle"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/permissions#permissions`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
      </w-card-section>
      <!--
        Grouped by what a rule's pattern means to the permission: most are decided per page, and the
        pattern says which pages; a few are about a site and a locale, and the pattern says nothing to
        them (`LOCALE_PERMISSIONS` in `backend/models/groups.ts`). Putting them side by side is what
        tells an administrator that a rule for `/docs` granting one of the second kind grants it
        everywhere.

        The first group is long enough to take two lists of its own where the dialog is wide, so the
        layout is three columns, two, or one -- see the container queries below.
      -->
      <div class="rule-perms-body">
        <section
          v-for="group of groups"
          :key="group.key"
          class="rule-perms-group"
          :class="`is-${group.key}`">
          <div class="rule-perms-group-header">
            <div class="text-subtitle2">{{ group.title }}</div>
            <div class="text-caption text-grey-7">{{ group.hint }}</div>
          </div>
          <div class="rule-perms-lists">
            <!--
              -> Not `dense`, on the list or the rows: `WList` compresses a dense list's rows with a
                 scoped rule that outranks `.rule-perms-row`, which is what sets their spacing here.
            -->
            <w-list v-for="(list, idx) of group.lists" :key="idx">
              <w-item
                v-for="opt of list"
                :key="opt.permission"
                class="rule-perms-row"
                :class="{ 'is-section-end': SECTION_ENDS.includes(opt.permission) }"
                tag="label">
                <w-item-section avatar class="!min-w-0 !pr-3">
                  <w-toggle
                    v-model="state.selected"
                    :val="opt.permission"
                    dense
                    :aria-label="opt.title" />
                </w-item-section>
                <w-item-section>
                  <w-item-label>{{ opt.title }}</w-item-label>
                  <w-item-label caption>{{ opt.hint }}</w-item-label>
                </w-item-section>
              </w-item>
            </w-list>
          </div>
        </section>
      </div>
      <w-card-actions class="card-actions">
        <span class="text-caption text-grey-7 pl-2">
          {{
            t(
              'admin.groups.rulePermissionsCount',
              { count: state.selected.length },
              state.selected.length
            )
          }}
        </span>
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="grey"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          :label="t(`common.actions.apply`)"
          color="primary"
          padding="xs md"
          @click="apply" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'

import { useSiteStore } from '@/stores/site'

/**
 * Pick the permissions one page rule grants or denies.
 *
 * Opened from a rule in the group editor (`GroupEditOverlay`), which owns the list of what may be
 * offered -- the guests group is offered fewer -- and gets back the chosen permissions, in the order
 * they are offered here, through `onOk`.
 */

// PROPS

const props = defineProps({
  /**
   * What may be picked: `{ permission, title, hint, scope }`, where `scope` is `locale` for the
   * permissions a rule's pattern does not apply to.
   */
  options: {
    type: Array,
    default: () => []
  },
  /** The permissions the rule holds now. */
  selected: {
    type: Array,
    default: () => []
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  selected: [...props.selected]
})

// COMPUTED

/**
 * What the second list of the per-page group holds: the permissions over the things that hang off a
 * page rather than the page itself -- its assets, its comments and its navigation menu. Everything
 * else about pages stays in the first. Tested against the option, not the position, so the order of
 * the list each comes from is kept.
 */
/**
 * The last permission of each run of related ones -- the page lifecycle, what may go into a page,
 * assets, comments -- which a dotted rule closes off from the next run. Only ever drawn where the
 * permission is not the last of its list, so a column never ends on a rule.
 */
const SECTION_ENDS = ['delete:pages', 'write:scripts', 'manage:assets', 'manage:comments']

function isAttachedToPage(opt) {
  return /:(assets|comments)$/.test(opt.permission) || opt.permission === 'manage:navigation'
}

const groups = computed(() => {
  const perPage = props.options.filter((opt) => opt.scope !== 'locale')
  return [
    {
      key: 'page',
      title: t('admin.groups.rulePermissionsPage'),
      hint: t('admin.groups.rulePermissionsPageHint'),
      lists: [
        perPage.filter((opt) => !isAttachedToPage(opt)),
        // -> Navigation last, after the assets and comments, wherever the source list has it
        [
          ...perPage.filter(
            (opt) => isAttachedToPage(opt) && opt.permission !== 'manage:navigation'
          ),
          ...perPage.filter((opt) => opt.permission === 'manage:navigation')
        ]
      ].filter((list) => list.length > 0)
    },
    {
      key: 'locale',
      title: t('admin.groups.rulePermissionsLocale'),
      hint: t('admin.groups.rulePermissionsLocaleHint'),
      lists: [props.options.filter((opt) => opt.scope === 'locale')]
    }
  ]
})

// METHODS

/**
 * Hand back what is ticked, in the order offered, followed by anything the rule held that this list
 * does not offer -- a rule imported from elsewhere may name one, and picking from a narrower list is
 * not a reason to drop it silently.
 */
function apply() {
  const offered = props.options.map((opt) => opt.permission)
  const ticked = new Set(state.selected)
  onDialogOK([
    ...offered.filter((permission) => ticked.has(permission)),
    ...props.selected.filter((permission) => !offered.includes(permission))
  ])
}
</script>

<style lang="scss">
/*
  Three columns, two or one, decided by the card's own width rather than the window's (the dialog is
  capped at 95vw, and a container query cannot be fooled by that):

  - 1100px and up: the per-page group takes two thirds, as two lists side by side; the locale group
    takes the last third.
  - 700px and up: two equal columns, the per-page group's lists stacked in the first.
  - Below that: everything in one column.
*/
.rule-perms {
  container-type: inline-size;

  &-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0 1rem;
    /* -> The window less the header, the actions and the dialog's own margins */
    max-height: calc(100vh - 180px);
    overflow: auto;
    padding: 0.5rem 0.5rem 0.75rem;

    @container (min-width: 700px) {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    @container (min-width: 1100px) {
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    }
  }

  &-lists {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0 1rem;
    align-items: start;
  }

  @container (min-width: 1100px) {
    .is-page &-lists {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
  }

  /* -> Room under the hint, so it reads as the group's caption rather than the first row's */
  &-group-header {
    padding: 0.5rem 1rem 0.75rem;
  }

  /*
    -> A rule between the two groups wherever they sit side by side, since that is the line the dialog
       exists to draw: what a rule's pattern applies to, and what it does not.
  */
  @container (min-width: 700px) {
    .is-locale {
      border-left: 1px solid rgba(0, 0, 0, 0.12);
      padding-left: 0.5rem;

      @at-root .body--dark & {
        border-left-color: rgba(255, 255, 255, 0.12);
      }
    }
  }

  /*
    -> Each permission its own row, with room between them: a title and its hint read as a pair, and
       the next pair starts clearly below. The toggle is centred on the two together.
  */
  &-row {
    min-height: 0;
    padding-top: 5px;
    padding-bottom: 5px;

    .w-item-label--caption {
      line-height: 1.3;
    }

    &.is-section-end:not(:last-child) {
      border-bottom: 2px dotted rgba(0, 0, 0, 0.16);
      margin-bottom: 5px;
      padding-bottom: 10px;

      @at-root .body--dark & {
        border-bottom-color: rgba(255, 255, 255, 0.16);
      }
    }
  }
}
</style>
