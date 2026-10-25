<template>
  <!--
    `h-full` so the card fills the panel: the scroll area below is sized `calc(100% - 50px)`, which
    against an auto-height card resolves to `auto` and let the card grow past the panel instead of
    scrolling inside it -- the white surface and the panel's shadow ending in different places.
  -->
  <w-card class="page-properties-dialog h-full">
    <!-- -> Offset comes from the stylesheet now, relative to this card; see SideDialog -->
    <div class="floating-sidepanel-quickaccess animated fadeIn" v-if="state.showQuickAccess">
      <template v-for="(qa, idx) of quickaccess" :key="`qa-` + qa.key">
        <w-btn :icon="qa.icon" flat padding="sm xs" size="sm" @click="jumpToSection(qa.key)">
          <w-tooltip anchor="center left" self="center right">{{ qa.label }}</w-tooltip>
        </w-btn>
        <w-separator dark v-if="idx < quickaccess.length - 1" />
      </template>
    </div>
    <w-toolbar class="bg-primary text-white flex">
      <div class="text-subtitle2">{{ t('editor.props.pageProperties') }}</div>
      <w-space />
      <w-btn
        class="mr-2"
        dense
        flat
        rounded
        color="white"
        icon="la:question-circle"
        :href="siteStore.docsBase + `/guide/page-properties`"
        target="_blank"
        type="a" />
      <w-btn icon="la:times" dense flat @click="siteStore.sideDialogShown = false" />
    </w-toolbar>
    <w-scroll-area
      ref="scrollArea"
      :thumb-style="siteStore.scrollStyle.thumb"
      :bar-style="siteStore.scrollStyle.bar"
      style="height: calc(100% - 50px)">
      <w-card-section id="refCardInfo">
        <div class="w-section-header">{{ t('editor.props.info') }}</div>
        <w-form class="gap-2">
          <w-input
            ref="iptTitle"
            v-model="pageStore.title"
            :label="t(`editor.props.title`)"
            outlined
            dense />
          <w-input
            v-model="pageStore.description"
            :label="t(`editor.props.shortDescription`)"
            outlined
            dense />
          <w-input v-model="pageStore.icon" :label="t(`editor.props.icon`)" outlined dense>
            <template #prepend>
              <w-icon
                :class="pageIconColorClass(pageStore.iconColor)"
                :name="pageStore.icon"
                size="20px" />
            </template>
            <template #append>
              <!--
                A button, not a bare `w-icon`: for a bundled icon WIcon renders an <svg> whose body is
                set through `v-html`, which renders no slot -- so the menu inside it never existed and
                the control did nothing. It was also just the 14px glyph, with no hit area of its own.
              -->
              <w-btn
                flat
                dense
                round
                icon="la:icons"
                color="primary"
                :aria-label="t(`iconPicker.open`)">
                <w-tooltip>{{ t('iconPicker.open') }}</w-tooltip>
                <!-- The properties panel is docked to the right edge, so the picker has to grow leftwards -->
                <w-menu content-class="shadow-7" anchor="bottom right" self="top right">
                  <icon-picker-dialog v-model="pageStore.icon" />
                </w-menu>
              </w-btn>
            </template>
          </w-input>
          <!--
            Still editable for an `img:` icon: the picture keeps its own colors, but the color is also
            what the page's background and border are drawn in elsewhere. A multicolor Iconify icon
            ignores it the same way, but telling one apart needs the icon itself, so that case gets no
            hint.
          -->
          <w-select
            v-model="pageStore.iconColor"
            :options="iconColorOptions"
            :label="t(`editor.props.iconColor`)"
            :hint="isColorableIcon ? null : t(`editor.props.iconColorImageHint`)"
            emit-value
            map-options
            outlined
            dense>
            <template #prepend>
              <span class="size-4 shrink-0 rounded-full" :class="selectedIconColorSwatch" />
            </template>
            <template #option="{ opt }">
              <span class="flex flex-nowrap items-center gap-2">
                <span class="size-3 shrink-0 rounded-full" :class="opt.swatch" />
                <span class="truncate">{{ opt.label }}</span>
              </span>
            </template>
          </w-select>
          <w-input
            v-if="pageStore.path !== `home`"
            v-model="pageStore.alias"
            :label="t(`editor.props.alias`)"
            outlined
            dense
            prefix="/a/" />
        </w-form>
      </w-card-section>
      <w-card-section class="alt-card" id="refCardLifecycle" v-if="showLifecycleSection">
        <div class="w-section-header">{{ t('editor.props.lifecycleRules') }}</div>
        <w-list
          class="rounded mb-2 bg-white dark:bg-black/20"
          v-if="lifecycleRules.length > 0"
          separator
          bordered>
          <w-item v-for="(rule, idx) of lifecycleRules" :key="rule.id ?? rule.key">
            <w-item-section>
              <w-item-label
                ><strong>{{ rule.name }}</strong></w-item-label
              >
              <w-item-label caption>{{ triggerSummary(rule) }}</w-item-label>
              <w-item-label v-if="removalSummary(rule)" caption>
                {{ removalSummary(rule) }}
              </w-item-label>
              <w-item-label
                v-if="rule.lastFiredAt"
                caption
                :class="{ 'text-negative': rule.lastOutcome?.status === `failed` }">
                {{ outcomeSummary(rule) }}
              </w-item-label>
            </w-item-section>
            <w-item-section side>
              <span class="flex flex-nowrap gap-1">
                <w-icon
                  v-for="action of rule.actions"
                  :key="action.kind"
                  :name="LIFECYCLE_ACTION_ICONS[action.kind]"
                  size="16px" />
              </span>
            </w-item-section>
            <w-item-section side>
              <w-btn icon="la:pen" dense flat padding="none" @click="editLifecycleRule(idx)" />
            </w-item-section>
            <w-item-section side>
              <w-btn icon="la:times" dense flat padding="none" @click="removeLifecycleRule(idx)" />
            </w-item-section>
          </w-item>
        </w-list>
        <w-btn
          class="w-full"
          :label="t(`editor.props.lifecycleRuleAdd`)"
          icon="la:plus"
          no-caps
          unelevated
          color="secondary"
          @click="newLifecycleRule">
          <w-tooltip>{{ t('editor.props.lifecycleRuleAddHint') }}</w-tooltip>
        </w-btn>
      </w-card-section>
      <w-card-section id="refCardOwnership" v-if="showOwnershipSection">
        <div class="w-section-header">{{ t('editor.props.ownership') }}</div>
        <w-form class="gap-4">
          <div>
            <w-btn-toggle
              :model-value="ownership.mode"
              push
              glossy
              no-caps
              toggle-color="primary"
              :options="ownershipModes"
              @update:model-value="updateOwnership({ mode: $event })" />
          </div>
          <div class="text-caption">
            <em>{{ t(ownershipHints[ownership.mode]) }}</em>
          </div>
          <div class="text-caption text-black/54 dark:text-white/60" v-if="!mayListUsers">
            {{ t('editor.props.ownershipNoListUsers') }}
          </div>
          <div class="text-caption text-black/54 dark:text-white/60" v-if="!mayListGroups">
            {{ t('editor.props.ownershipNoListGroups') }}
          </div>
          <template v-if="ownership.mode === `users`">
            <w-select
              v-if="mayListUsers"
              :model-value="ownership.users"
              :options="state.userOptions"
              :label="t(`editor.props.ownerUsers`)"
              :no-options-label="t(`editor.props.ownersNoResults`)"
              :loading="state.ownerLookups > 0"
              option-value="id"
              option-label="name"
              multiple
              use-input
              use-chips
              remote-filter
              outlined
              dense
              @filter="lookupUsers"
              @update:model-value="updateOwnership({ users: $event })">
              <template #option="{ opt }">
                <span class="flex flex-nowrap items-center gap-2">
                  <w-avatar v-if="opt.hasAvatar" size="sm">
                    <img :src="`/_user/${opt.id}/avatar`" alt="" />
                  </w-avatar>
                  <w-avatar v-else size="sm" color="primary" text-color="white" icon="la:user" />
                  <span class="truncate">{{ opt.name }}</span>
                  <span v-if="opt.handle" class="text-caption text-black/54 dark:text-white/60"
                    >@{{ opt.handle }}</span
                  >
                </span>
              </template>
            </w-select>
            <!-- -> Who owns it is still theirs to see, and to hand back to the creator -->
            <div v-else class="flex flex-wrap gap-1">
              <w-chip v-for="usr of ownership.users" :key="usr.id" :label="usr.name" size="sm" />
            </div>
          </template>
          <template v-else-if="ownership.mode === `groups`">
            <w-select
              v-if="mayListGroups"
              :model-value="ownership.groups"
              :options="state.groupOptions"
              :label="t(`editor.props.ownerGroups`)"
              :no-options-label="t(`editor.props.ownersNoResults`)"
              :loading="state.ownerLookups > 0"
              option-value="id"
              option-label="name"
              multiple
              use-input
              use-chips
              remote-filter
              outlined
              dense
              @filter="lookupGroups"
              @update:model-value="updateOwnership({ groups: $event })" />
            <div v-else class="flex flex-wrap gap-1">
              <w-chip v-for="grp of ownership.groups" :key="grp.id" :label="grp.name" size="sm" />
            </div>
          </template>
        </w-form>
      </w-card-section>
      <w-card-section class="alt-card" id="refCardPublishState">
        <div class="w-section-header">{{ t('editor.props.publishState') }}</div>
        <w-form class="gap-4">
          <div>
            <w-btn-toggle
              v-model="pageStore.publishState"
              push
              glossy
              no-caps
              toggle-color="primary"
              :options="[
                { label: t('editor.props.draft'), value: 'draft' },
                { label: t('editor.props.published'), value: 'published' },
                { label: t('editor.props.dateRange'), value: 'scheduled' }
              ]" />
          </div>
          <div class="text-caption" v-if="pageStore.publishState === `published`">
            <em>{{ t('editor.props.publishedHint') }}</em>
          </div>
          <div class="text-caption" v-else-if="pageStore.publishState === `draft`">
            <em>{{ t('editor.props.draftHint') }}</em>
          </div>
          <template v-else-if="pageStore.publishState === `scheduled`">
            <div class="text-caption">
              <em>{{ t('editor.props.dateRangeHint') }}</em>
            </div>
            <w-date v-model="publishingRange" range flat bordered landscape minimal />
          </template>
        </w-form>
      </w-card-section>
      <w-card-section id="refCardRelations">
        <div class="w-section-header">{{ t('editor.props.relations') }}</div>
        <w-list
          class="rounded mb-2 bg-white dark:bg-black/20"
          v-if="pageStore.relations.length > 0"
          separator
          bordered>
          <w-item v-for="rel of pageStore.relations" :key="`rel-id-` + rel.id">
            <w-item-section side><w-icon :name="rel.icon" /></w-item-section>
            <w-item-section>
              <w-item-label
                ><strong>{{ rel.label }}</strong></w-item-label
              >
              <w-item-label caption>{{ rel.caption }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-chip class="px-2" dense square color="primary" text-color="white">
                <div class="text-caption">{{ rel.position }}</div>
              </w-chip>
            </w-item-section>
            <w-item-section side>
              <w-btn icon="la:pen" dense flat padding="none" @click="editRelation(rel)" />
            </w-item-section>
            <w-item-section side>
              <w-btn icon="la:times" dense flat padding="none" @click="removeRelation(rel)" />
            </w-item-section>
          </w-item>
        </w-list>
        <w-btn
          class="w-full"
          :label="t(`editor.props.relationAdd`)"
          icon="la:plus"
          no-caps
          unelevated
          color="secondary"
          @click="newRelation">
          <w-tooltip>{{ t('editor.props.relationAddHint') }}</w-tooltip>
        </w-btn>
        <!--
          A different kind of relation, which is why it is its own button rather than another position
          in the one above: a page relation is a link this page draws in its footer, while a locale
          relation says that another page IS this page, written in another language.
        -->
        <w-btn
          class="mt-2 w-full"
          :label="t(`editor.props.localeRelations`)"
          icon="la:language"
          no-caps
          unelevated
          color="secondary"
          @click="state.showLocaleRelationsDialog = true">
          <w-tooltip>{{ t('editor.props.localeRelationsHint') }}</w-tooltip>
        </w-btn>
        <!--
          The third kind of relation, and the only one nobody writes: what links to this page is read
          off the content of every other page, so this is a switch rather than a list. Hidden where
          the site has the feature off altogether -- a toggle for a tab that cannot appear is a
          setting that does nothing, and the reason it does nothing is on a screen this author may
          well not be able to reach.
        -->
        <div class="pt-4" v-if="siteStore.features.backlinks">
          <w-toggle
            v-model="pageStore.allowBacklinks"
            dense
            :label="t(`editor.props.allowBacklinks`)"
            color="primary"
            checked-icon="la:check"
            unchecked-icon="la:times" />
        </div>
        <!-- -> Hidden where the site links no terms at all, for the reason the backlinks switch is -->
        <div class="pt-4" v-if="siteStore.features.glossary && siteStore.features.glossaryAutoLink">
          <w-toggle
            v-model="pageStore.allowGlossaryLinks"
            dense
            :label="t(`editor.props.allowGlossaryLinks`)"
            color="primary"
            checked-icon="la:check"
            unchecked-icon="la:times" />
        </div>
      </w-card-section>
      <!--
        Only for an author who may actually write them: the server drops a script or a stylesheet from
        somebody without the permission rather than refusing the save, so left on show these buttons
        took an edit, closed on it, and lost it without a word.
      -->
      <w-card-section class="alt-card" id="refCardScripts" v-if="mayWriteScripts || mayWriteStyles">
        <div class="w-section-header">{{ t('editor.props.scripts') }}</div>
        <w-btn
          class="w-full"
          v-if="mayWriteScripts"
          :label="t(`editor.props.jsLoad`)"
          icon="la:js-square"
          no-caps
          unelevated
          color="secondary"
          @click="editScripts(`jsLoad`)">
          <w-tooltip>{{ t('editor.props.jsLoadHint') }}</w-tooltip>
        </w-btn>
        <w-btn
          class="w-full mt-2"
          v-if="mayWriteScripts"
          :label="t(`editor.props.jsUnload`)"
          icon="la:js-square"
          no-caps
          unelevated
          color="secondary"
          @click="editScripts(`jsUnload`)">
          <w-tooltip>{{ t('editor.props.jsUnloadHint') }}</w-tooltip>
        </w-btn>
        <!-- -> The gap above it belongs to the buttons before it, so it goes when they do -->
        <w-btn
          class="w-full"
          :class="{ 'mt-2': mayWriteScripts }"
          v-if="mayWriteStyles"
          :label="t(`editor.props.styles`)"
          icon="la:css3-alt"
          no-caps
          unelevated
          color="secondary"
          @click="editScripts(`styles`)">
          <w-tooltip>{{ t('editor.props.stylesHint') }}</w-tooltip>
        </w-btn>
      </w-card-section>
      <w-card-section class="pb-6" id="refCardSidebar">
        <div class="w-section-header">{{ t('editor.props.sidebar') }}</div>
        <w-form class="gap-4 pt-2">
          <div>
            <w-toggle
              v-model="pageStore.showSidebar"
              dense
              :label="t(`editor.props.showSidebar`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div>
            <w-toggle
              v-if="pageStore.showSidebar"
              v-model="pageStore.showToc"
              dense
              :label="t(`editor.props.showToc`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div v-if="pageStore.showSidebar && pageStore.showToc" style="padding-left: 40px">
            <div class="text-caption">
              {{ t('editor.props.tocMinMaxDepth') }}
              <strong>(H{{ pageStore.tocDepth.min }} &rarr; H{{ pageStore.tocDepth.max }})</strong>
            </div>
            <w-range
              v-model="pageStore.tocDepth"
              :min="1"
              :max="6"
              color="primary"
              :left-label-value="`H` + pageStore.tocDepth.min"
              :right-label-value="`H` + pageStore.tocDepth.max"
              snap
              label
              markers />
          </div>
          <div>
            <w-toggle
              v-if="pageStore.showSidebar"
              v-model="pageStore.showTags"
              dense
              :label="t(`editor.props.showTags`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div>
            <w-toggle
              v-if="pageStore.showSidebar"
              v-model="pageStore.showLastEditedBy"
              dense
              :label="t(`editor.props.showLastEditedBy`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
        </w-form>
      </w-card-section>
      <w-card-section class="alt-card pb-6" id="refCardSocial">
        <div class="w-section-header">{{ t('editor.props.social') }}</div>
        <w-form class="gap-4 pt-2">
          <div>
            <w-toggle
              v-model="pageStore.allowComments"
              dense
              :label="t(`editor.props.allowComments`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div>
            <w-toggle
              v-model="pageStore.allowContributions"
              dense
              :label="t(`editor.props.allowContributions`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <!-- -> Nothing to allow while the site rates nothing: General -> Features is the other half -->
          <div v-if="siteStore.features.ratingsMode !== `off`">
            <w-toggle
              v-model="pageStore.allowRatings"
              dense
              :label="t(`editor.props.allowRatings`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
        </w-form>
      </w-card-section>
      <!--
        Shown read-only to an author who may not retag the page, and left out altogether when there is
        nothing to read either: a heading over an empty box says a page has no tags in a place that
        cannot be used to give it any.
      -->
      <w-card-section class="pb-6" id="refCardTags" v-if="showTagsSection">
        <div class="w-section-header">{{ t('editor.props.tags') }}</div>
        <page-tags :edit="mayWriteTags" />
      </w-card-section>
      <w-card-section class="alt-card pb-6" id="refCardVisibility">
        <div class="w-section-header">{{ t('editor.props.visibility') }}</div>
        <w-form class="gap-4 pt-2">
          <div>
            <w-toggle
              v-model="pageStore.isBrowsable"
              dense
              :label="$t(`editor.props.showInTree`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div>
            <w-toggle
              v-model="pageStore.isSearchable"
              dense
              :label="$t(`editor.props.isSearchable`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div>
            <w-toggle
              v-model="state.requirePassword"
              @update:model-value="toggleRequirePassword"
              dense
              :label="$t(`editor.props.requirePassword`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div v-if="state.requirePassword" style="padding-left: 40px">
            <!-- -> Masked, with WInput's own reveal toggle: this is a secret to hand out rather than
                    one to remember, so the author has to be able to read back what they typed -->
            <w-input
              ref="iptPagePassword"
              v-model="pageStore.password"
              type="password"
              revealable
              autocomplete="off"
              :label="t(`editor.props.password`)"
              :hint="t(`editor.props.passwordHint`)"
              outlined
              dense />
          </div>
        </w-form>
      </w-card-section>

      <!--
        The page's id, last and quietly.

        Only once there is one: a page being created has no id until the first save, and a field
        reading `0` would be a fact about this dialog rather than about the page. It is here because
        it is the one name a page never loses — an alias can be retyped and a path can be moved — so
        it is what a bug report, a support thread or a link that has to keep working is built on, and
        `/i/<id>` is where that link goes.
      -->
      <w-card-section v-if="pageStore.id" class="pt-3 pb-4">
        <div class="text-caption text-black/50 dark:text-white/40">
          {{ t('editor.props.pageId') }}
          <span class="font-mono select-all">{{ pageStore.id }}</span>
        </div>
      </w-card-section>
    </w-scroll-area>
    <w-dialog v-model="state.showLocaleRelationsDialog">
      <page-locale-relations-dialog @close="state.showLocaleRelationsDialog = false" />
    </w-dialog>
    <w-dialog v-model="state.showRelationDialog">
      <page-relation-dialog
        :edit-id="state.editRelationId"
        @close="state.showRelationDialog = false" />
    </w-dialog>
    <w-dialog v-model="state.showLifecycleRuleDialog">
      <page-lifecycle-rule-dialog
        :rule="editedLifecycleRule"
        :banner-taken="lifecycleBannerTaken"
        @save="saveLifecycleRule"
        @close="state.showLifecycleRuleDialog = false" />
    </w-dialog>
    <w-dialog v-model="state.showScriptsDialog">
      <page-scripts-dialog :mode="state.pageScriptsMode" @close="state.showScriptsDialog = false" />
    </w-dialog>
  </w-card>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { debounce } from 'es-toolkit/function'
import { v4 as uuid } from 'uuid'

import { scrollBehavior } from '@/helpers/motion'
import { PAGE_ICON_COLORS, pageIconColorClass } from '@/helpers/pageIconColors'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import IconPickerDialog from './IconPickerDialog.vue'
import PageLifecycleRuleDialog from './PageLifecycleRuleDialog.vue'
import PageLocaleRelationsDialog from './PageLocaleRelationsDialog.vue'
import PageRelationDialog from './PageRelationDialog.vue'
import PageScriptsDialog from './PageScriptsDialog.vue'
import PageTags from './PageTags.vue'

// STORES

const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  showRelationDialog: false,
  showLocaleRelationsDialog: false,
  showScriptsDialog: false,
  requirePassword: false,
  editRelationId: null,
  pageScriptsMode: 'jsLoad',
  showQuickAccess: true,
  userOptions: [],
  groupOptions: [],
  ownerLookups: 0,
  showLifecycleRuleDialog: false,
  editLifecycleRuleIdx: null
})

// REFS

const iptTitle = ref(null)
const iptPagePassword = ref(null)

// COMPUTED

/*
  Whether this author may write a script or a stylesheet onto THIS page.

  Read off `pagePermissions` rather than through `userStore.can()`: both are page rule permissions,
  granted per path by a group's rules, and `can()` also answers for the group-wide list -- which is a
  broader question ("somewhere") than the one these buttons ask ("here"). It is the same list
  `buildScripts` consults on the way in, an administrator holding all of them.
*/
const mayWriteScripts = computed(() => userStore.pagePermissions.includes('write:scripts'))
const mayWriteStyles = computed(() => userStore.pagePermissions.includes('write:styles'))

/*
  And whether they may retag it, which the same rules answer separately: writing a page and deciding
  which tags — and so which rules — it falls under are two permissions. The field is what assigns one,
  so without it the section reads the tags out and offers no way to change them, exactly as the
  PATCH route would refuse a body that did.
*/
const mayWriteTags = computed(() => userStore.pagePermissions.includes('write:tags'))
// -> Named apart from `pageStore.showTags`, which is the page's own choice to display them
const showTagsSection = computed(() => mayWriteTags.value || pageStore.tags?.length > 0)

/*
  Who may name owners, per kind: the same lists `PUT …/ownership` checks (`LIST_USERS_PERMISSIONS` and
  `LIST_GROUPS_PERMISSIONS` in `models/groups.ts`). These are GLOBAL permissions -- finding somebody
  is not a question about a path -- so `can()` is the right question here, unlike the page rules above.
*/
const LIST_USERS_PERMISSIONS = ['list:users', 'read:users', 'write:users', 'manage:users']
const LIST_GROUPS_PERMISSIONS = ['list:groups', 'read:groups', 'write:groups', 'manage:groups']
const mayListUsers = computed(() => LIST_USERS_PERMISSIONS.some((perm) => userStore.can(perm)))
const mayListGroups = computed(() => LIST_GROUPS_PERMISSIONS.some((perm) => userStore.can(perm)))

/*
  The owners as this panel has them: the pending edit, else what the server last said.

  `pageStore.ownership` is null for a reader who may not write the page -- the server does not tell
  them -- and there is nothing for them to edit here either. Never in suggest mode, which saves no
  page at all.
*/
const showOwnershipSection = computed(
  () => editorStore.mode !== 'suggest' && pageStore.ownership !== null
)
const ownership = computed(
  () => editorStore.ownership ?? pageStore.ownership ?? { mode: 'creator', users: [], groups: [] }
)
const ownershipModes = computed(() => [
  { label: t('editor.props.ownershipCreator'), value: 'creator' },
  { label: t('editor.props.ownershipUsers'), value: 'users', disable: !mayListUsers.value },
  { label: t('editor.props.ownershipGroups'), value: 'groups', disable: !mayListGroups.value }
])
const ownershipHints = {
  creator: 'editor.props.ownershipCreatorHint',
  users: 'editor.props.ownershipUsersHint',
  groups: 'editor.props.ownershipGroupsHint'
}

/*
  The lifecycle rules as this panel has them: the pending edit, else what the server last said -- on
  the same terms as the owners above, and for the same reason held apart from the page's own fields.
*/
const showLifecycleSection = computed(
  () => editorStore.mode !== 'suggest' && pageStore.lifecycleRules !== null
)
const lifecycleRules = computed(() => editorStore.lifecycleRules ?? pageStore.lifecycleRules ?? [])
const editedLifecycleRule = computed(() =>
  state.editLifecycleRuleIdx === null ? null : lifecycleRules.value[state.editLifecycleRuleIdx]
)
// -> One banner per page: taken when a rule OTHER than the one being edited already shows it
const lifecycleBannerTaken = computed(() =>
  lifecycleRules.value.some(
    (rule, idx) =>
      idx !== state.editLifecycleRuleIdx && rule.actions.some((action) => action.kind === 'banner')
  )
)
const LIFECYCLE_ACTION_ICONS = {
  banner: 'mdi:alert-box-outline',
  notify: 'mdi:bell-outline',
  move: 'mdi:folder-move-outline',
  tags: 'mdi:tag-multiple-outline',
  remove: 'mdi:delete-clock-outline'
}
const LIFECYCLE_SUMMARIES = {
  contentAge: 'editor.lifecycle.summaryContentAge',
  commentAge: 'editor.lifecycle.summaryCommentAge',
  interval: 'editor.lifecycle.summaryInterval'
}

/*
  The rail of jump links down the side of the panel. A computed rather than a constant because the
  Scripts section is not always there, and a link to a section that is not rendered is a link that
  throws -- `jumpToSection` reads the element straight off the document.
*/
const quickaccess = computed(() =>
  [
    { key: 'refCardInfo', icon: 'la:info-circle', label: t('editor.props.info') },
    {
      key: 'refCardLifecycle',
      icon: 'la:hourglass-half',
      label: t('editor.props.lifecycleRules'),
      shown: showLifecycleSection.value
    },
    {
      key: 'refCardOwnership',
      icon: 'la:user-tag',
      label: t('editor.props.ownership'),
      shown: showOwnershipSection.value
    },
    { key: 'refCardPublishState', icon: 'la:power-off', label: t('editor.props.publishState') },
    { key: 'refCardRelations', icon: 'la:sun', label: t('editor.props.relations') },
    {
      key: 'refCardScripts',
      icon: 'la:code',
      label: t('editor.props.scripts'),
      shown: mayWriteScripts.value || mayWriteStyles.value
    },
    { key: 'refCardSidebar', icon: 'la:ruler-vertical', label: t('editor.props.sidebar') },
    { key: 'refCardSocial', icon: 'la:comments', label: t('editor.props.social') },
    {
      key: 'refCardTags',
      icon: 'la:tags',
      label: t('editor.props.tags'),
      shown: showTagsSection.value
    },
    { key: 'refCardVisibility', icon: 'la:eye', label: t('editor.props.visibility') }
  ].filter((qa) => qa.shown !== false)
)

/** Unset first, which is the site's primary color, then the palette in Tailwind's own order. */
const iconColorOptions = computed(() => [
  { label: t('editor.props.iconColorUnset'), value: '', swatch: 'bg-primary' },
  ...Object.entries(PAGE_ICON_COLORS).map(([key, color]) => ({
    label: t(`editor.props.iconColors.${key}`),
    value: key,
    swatch: color.swatch
  }))
])
const selectedIconColorSwatch = computed(
  () => PAGE_ICON_COLORS[pageStore.iconColor]?.swatch ?? 'bg-primary'
)
// -> An `img:` icon is a picture, drawn as it is
const isColorableIcon = computed(() => !pageStore.icon?.startsWith('img:'))

const publishingRange = computed({
  get() {
    return {
      from: pageStore.publishStartDate,
      to: pageStore.publishEndDate
    }
  },
  set(newValue) {
    pageStore.publishStartDate = newValue?.from
    pageStore.publishEndDate = newValue?.to
  }
})

// WATCHERS

pageStore.$subscribe(() => {
  editorStore.$patch({
    lastChangeTimestamp: Temporal.Now.instant()
  })
})

// METHODS

/**
 * Change the owners, as a pending edit beside the page rather than in it -- see `editorStore.ownership`.
 *
 * Back to nothing pending once it matches what is stored again, so that picking someone and taking
 * them off does not leave a save to make. Both lists are kept whichever mode is showing, so that
 * flipping between them does not throw a selection away; only the one `mode` names is sent.
 */
function updateOwnership(patch) {
  const next = { ...ownership.value, ...patch }
  editorStore.ownership = sameOwnership(next, pageStore.ownership) ? null : next
}
function sameOwnership(a, b) {
  if (!b || a.mode !== b.mode) {
    return false
  }
  const ids = (o) => (o.mode === 'creator' ? [] : o[o.mode].map((owner) => owner.id).sort())
  return ids(a).join() === ids(b).join()
}

/*
  The two pickers search the server as the author types. Debounced, and each answer is dropped if a
  newer search was started after it, so a slow reply cannot replace the list a later one put up.
*/
let lookupSeq = 0
async function lookupOwners(kind, query) {
  const seq = ++lookupSeq
  state.ownerLookups++
  try {
    const results = await API_CLIENT.get(`${kind}/lookup`, { searchParams: { query } }).json()
    if (seq === lookupSeq) {
      state[kind === 'users' ? 'userOptions' : 'groupOptions'] = results
    }
  } catch (err) {
    console.warn(err)
  } finally {
    state.ownerLookups--
  }
}
const lookupUsers = debounce((query) => lookupOwners('users', query), 250)
const lookupGroups = debounce((query) => lookupOwners('groups', query), 250)

function triggerSummary(rule) {
  return t(LIFECYCLE_SUMMARIES[rule.trigger], { days: rule.triggerDays })
}
// -> How many firings a rule that removes itself has left, counting the ones it has had
function removalSummary(rule) {
  const remove = rule.actions.find((action) => action.kind === 'remove')
  if (!remove) {
    return null
  }
  return t('editor.lifecycle.removesAfter', {
    count: Math.max(remove.after - (rule.fireCount ?? 0), 1)
  })
}
function outcomeSummary(rule) {
  const date = userStore.formatDateTime(t, rule.lastFiredAt)
  return rule.lastOutcome?.message
    ? t('editor.lifecycle.lastOutcome', { date, message: rule.lastOutcome.message })
    : t('editor.lifecycle.lastTriggered', { date })
}

/**
 * Change the rules, as a pending edit beside the page -- see `editorStore.lifecycleRules`. Back to
 * nothing pending once the list says what is stored again.
 */
function setLifecycleRules(rules) {
  const essentials = (list) =>
    JSON.stringify(
      (list ?? []).map(({ id, name, trigger, triggerDays, actions }) => ({
        id,
        name,
        trigger,
        triggerDays,
        actions
      }))
    )
  editorStore.lifecycleRules =
    essentials(rules) === essentials(pageStore.lifecycleRules) ? null : rules
}
function newLifecycleRule() {
  state.editLifecycleRuleIdx = null
  state.showLifecycleRuleDialog = true
}
function editLifecycleRule(idx) {
  state.editLifecycleRuleIdx = idx
  state.showLifecycleRuleDialog = true
}
function saveLifecycleRule(rule) {
  const rules = [...lifecycleRules.value]
  if (state.editLifecycleRuleIdx === null) {
    // -> No id until the server gives it one; `key` only tells the list rows apart until then
    rules.push({ ...rule, id: null, key: uuid() })
  } else {
    rules[state.editLifecycleRuleIdx] = rule
  }
  setLifecycleRules(rules)
}
function removeLifecycleRule(idx) {
  setLifecycleRules(lifecycleRules.value.filter((_rule, i) => i !== idx))
}

function editScripts(mode) {
  state.pageScriptsMode = mode
  state.showScriptsDialog = true
}
function newRelation() {
  state.editRelationId = null
  state.showRelationDialog = true
}
function editRelation(rel) {
  state.editRelationId = rel.id
  state.showRelationDialog = true
}
function removeRelation(rel) {
  pageStore.relations = pageStore.relations.filter((r) => r.id !== rel.id)
}
function jumpToSection(id) {
  document.querySelector(`#${id}`).scrollIntoView({
    behavior: scrollBehavior()
  })
}
function toggleRequirePassword(newValue) {
  if (newValue) {
    nextTick(() => {
      iptPagePassword.value.focus()
      iptPagePassword.value.$el.scrollIntoView({
        behavior: scrollBehavior()
      })
    })
  } else {
    pageStore.password = ''
  }
}

// MOUNTED

onMounted(() => {
  state.requirePassword = pageStore.password?.length > 0

  // -> Title is the field this panel is opened to edit, so the caret starts there
  nextTick(() => {
    iptTitle.value?.focus()
  })

  setTimeout(() => {
    state.showQuickAccess = true
  }, 300)
})
</script>

<style lang="scss">
/*
  The panel is inset from the window and rounded now, so the two children that reach its corners have
  to be rounded too -- a square toolbar or scroll area paints straight over the radius. `inherit`
  takes the card's own value, so these stay right if that radius ever changes.

  The scroll area is what makes the BOTTOM corners work: it already clips its overflow, so giving it
  the radius clips the last section (grey, `alt-card`) to the corner instead of letting it square off.
*/
.page-properties-dialog {
  > .w-toolbar {
    border-top-left-radius: inherit;
    border-top-right-radius: inherit;
  }

  > .w-scroll-area {
    border-bottom-left-radius: inherit;
    border-bottom-right-radius: inherit;
  }

  /*
    The section headings, in the treatment the profile pages use.

    `.w-section-header` carries its own 16px inset and expects to sit in a column that has none --
    inside a `w-card-section` it would be indented twice, and its wash would stop short of the panel
    on both sides. So the section's padding is cancelled around it: the band then spans the panel and
    its text lines up with the fields beneath it, exactly as on a profile page. The top padding is
    given back so the heading sits where the section's own padding had it.

    The tinted `alt-card` sections keep their stripe: the heading is inside the section, so the wash
    is drawn over whichever surface that section has.
  */
  .w-section-header {
    margin: -16px -16px 10px;
    padding-top: 16px;
  }
}
</style>
