<template>
  <w-layout view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/fluent-sidebar-menu.svg" left size="md" />
      <span>{{ t(`navEdit.editMenuItems`) }}</span>
      <!--
        Which menu is on screen, when it is not this page's own: an inherited menu is shared with every
        page that falls back to it, so a change here is not local to the page it was made from.
      -->
      <span class="ml-3 text-caption opacity-80" v-if="isEditingInherited">
        {{ t('navEdit.editingInherited') }}
      </span>
      <span class="ml-3 text-caption opacity-80" v-else-if="fromAdmin">
        {{ adminStore.overlayOpts.title }}
      </span>
      <w-space />
      <transition name="syncing">
        <w-spinner class="mr-2" v-show="state.loading > 0" color="accent" size="24px" />
      </transition>
      <w-btn
        class="mr-2"
        flat
        rounded
        color="white"
        :aria-label="t(`common.actions.viewDocs`)"
        icon="la:question-circle"
        :href="siteStore.docsBase + `/guide/navigation`"
        target="_blank">
        <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
      </w-btn>
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
          :label="t(`common.actions.save`)"
          :aria-label="t(`common.actions.save`)"
          icon="la:check"
          :disabled="state.loading > 0"
          @click="save" />
      </w-btn-group>
    </w-header>
    <w-drawer class="bg-dark-6" :model-value="true" :width="295" dark>
      <w-scroll-area class="nav-edit" :thumb-style="thumbStyle" :bar-style="barStyle">
        <!--
          The `q-list q-list--dense q-list--dark` this carried were the old framework's classes and
          nothing defines them any more, which is why the rows had drifted to full height: the density
          now comes from `dense` on each item, matching what NavSidebar renders.
        -->
        <sortable
          class="nav-edit-list"
          :list="state.items"
          item-key="id"
          :options="sortableOptions"
          @end="updateItemPosition">
          <template #item="{ element }">
            <div
              class="nav-edit-item nav-edit-item-header"
              v-if="element.type === `header`"
              :class="state.selected === element.id ? `is-active` : ``"
              @click="setItem(element)"
              @contextmenu="setItem(element)">
              <w-item-label class="text-caption" header>{{ element.label }}</w-item-label>
              <w-space />
              <w-item-section side>
                <w-icon class="handle" name="mdi:drag-horizontal" size="sm" />
              </w-item-section>
              <nav-edit-item-menu
                :item="element"
                @duplicate="duplicateItem"
                @toggle-nesting="toggleNesting"
                @delete="removeItem" />
            </div>
            <w-item
              class="nav-edit-item nav-edit-item-link"
              v-else-if="element.type === `link`"
              dense
              :class="{ 'is-active': state.selected === element.id, 'is-nested': element.isNested }"
              @click="setItem(element)"
              @contextmenu="setItem(element)"
              clickable>
              <w-item-section side><w-icon :name="element.icon" color="white" /></w-item-section>
              <w-item-section class="wrap-anywhere">{{ element.label }}</w-item-section>
              <w-item-section side>
                <w-icon class="handle" name="mdi:drag-horizontal" size="sm" />
              </w-item-section>
              <nav-edit-item-menu
                :item="element"
                @duplicate="duplicateItem"
                @toggle-nesting="toggleNesting"
                @delete="removeItem" />
            </w-item>
            <!--
              A link's row with a chevron for what it opens, and a warning where that is nothing: no
              menu picked yet, or one that has since been deleted -- the sidebar leaves such an item
              out, so the editor is the only place it still shows.

              Not `nav-edit-item-link`, though, which is the class the nesting rules read as a parent:
              a link nested under one of these has nothing to hang off, and is marked like one under a
              header.
            -->
            <w-item
              class="nav-edit-item nav-edit-item-menu"
              v-else-if="element.type === `menu`"
              dense
              :class="{ 'is-active': state.selected === element.id }"
              @click="setItem(element)"
              @contextmenu="setItem(element)"
              clickable>
              <w-item-section side><w-icon :name="element.icon" color="white" /></w-item-section>
              <w-item-section class="wrap-anywhere">{{ element.label }}</w-item-section>
              <w-item-section side>
                <w-icon
                  v-if="!element.targetNavId || element.targetMissing"
                  name="la:exclamation-triangle"
                  color="warning"
                  size="sm" />
                <w-icon v-else name="mdi:chevron-right" color="white" size="sm" />
              </w-item-section>
              <w-item-section side>
                <w-icon class="handle" name="mdi:drag-horizontal" size="sm" />
              </w-item-section>
              <nav-edit-item-menu
                :item="element"
                @duplicate="duplicateItem"
                @toggle-nesting="toggleNesting"
                @delete="removeItem" />
            </w-item>
            <div
              class="nav-edit-item nav-edit-item-separator"
              v-else
              :class="state.selected === element.id ? `is-active` : ``"
              @click="setItem(element)"
              @contextmenu="setItem(element)">
              <w-separator dark inset style="flex: 1; margin-top: 11px" />
              <w-item-section side>
                <w-icon class="handle" name="mdi:drag-horizontal" size="sm" />
              </w-item-section>
              <nav-edit-item-menu
                :item="element"
                @duplicate="duplicateItem"
                @toggle-nesting="toggleNesting"
                @delete="removeItem" />
            </div>
          </template>
        </sortable>
        <div class="p-4 flex">
          <w-btn
            class="acrylic-btn"
            style="flex: 1"
            flat
            color="positive"
            :label="t(`common.actions.add`)"
            :aria-label="t(`common.actions.add`)"
            icon="la:plus-circle">
            <w-menu class="translucent-menu" fit :offset="[0, 10]" auto-close>
              <w-card class="p-2">
                <w-list dense style="min-width: 150px">
                  <w-item clickable @click="addItem(`header`)">
                    <w-item-section side><w-icon name="la:heading" /></w-item-section>
                    <w-item-section>
                      <w-item-label>{{ t('navEdit.header') }}</w-item-label>
                    </w-item-section>
                  </w-item>
                  <w-item clickable @click="addItem(`link`)">
                    <w-item-section side><w-icon name="la:link" /></w-item-section>
                    <w-item-section>
                      <w-item-label>{{ t('navEdit.link') }}</w-item-label>
                    </w-item-section>
                  </w-item>
                  <w-item clickable @click="addItem(`menu`)">
                    <w-item-section side><w-icon name="mdi:menu-open" /></w-item-section>
                    <w-item-section>
                      <w-item-label>{{ t('navEdit.menu') }}</w-item-label>
                    </w-item-section>
                  </w-item>
                  <w-item clickable @click="addItem(`separator`)">
                    <w-item-section side><w-icon name="la:minus" /></w-item-section>
                    <w-item-section>
                      <w-item-label>{{ t('navEdit.separator') }}</w-item-label>
                    </w-item-section>
                  </w-item>
                </w-list>
              </w-card>
            </w-menu>
          </w-btn>
          <w-btn
            class="ml-2 acrylic-btn"
            flat
            color="grey"
            :aria-label="t(`common.actions.add`)"
            icon="la:ellipsis-v"
            padding="xs sm">
            <w-menu
              class="translucent-menu"
              :offset="[0, 10]"
              anchor="bottom right"
              self="top right"
              auto-close>
              <w-card class="p-2">
                <w-list dense style="min-width: 150px">
                  <w-item clickable @click="sortItems" :disable="state.items.length < 2">
                    <w-item-section side>
                      <w-icon name="mdi:sort-alphabetical-ascending" />
                    </w-item-section>
                    <w-item-section>
                      <w-item-label>{{ t('navEdit.sortItems') }}</w-item-label>
                    </w-item-section>
                  </w-item>
                  <w-separator class="my-1" />
                  <w-item clickable @click="exportItems" :disable="state.items.length < 1">
                    <w-item-section side>
                      <w-icon name="mdi:export" color="indigo" />
                    </w-item-section>
                    <w-item-section>
                      <w-item-label>{{ t('navEdit.export') }}</w-item-label>
                    </w-item-section>
                  </w-item>
                  <w-item clickable @click="importItems">
                    <w-item-section side>
                      <w-icon name="mdi:import" color="indigo" />
                    </w-item-section>
                    <w-item-section>
                      <w-item-label>{{ t('navEdit.import') }}</w-item-label>
                    </w-item-section>
                  </w-item>
                  <w-separator class="my-1" />
                  <w-item clickable @click="clearItems" :disable="state.items.length < 1">
                    <w-item-section side>
                      <w-icon name="la:trash-alt" color="negative" />
                    </w-item-section>
                    <w-item-section>
                      <w-item-label>{{ t('navEdit.clearItems') }}</w-item-label>
                    </w-item-section>
                  </w-item>
                </w-list>
              </w-card>
            </w-menu>
          </w-btn>
        </div>
      </w-scroll-area>
    </w-drawer>
    <w-page-container>
      <w-page class="p-4">
        <template v-if="state.items.length < 1">
          <w-card>
            <w-card-section>
              <w-icon class="mr-2" name="la:arrow-left" size="xs" />
              <span>{{ t('navEdit.emptyMenuText') }}</span>
            </w-card-section>
          </w-card>
        </template>
        <template v-else-if="!state.selected">
          <w-card>
            <w-card-section>
              <w-icon class="mr-2" name="la:arrow-left" size="xs" />
              <span>{{ t('navEdit.noSelection') }}</span>
            </w-card-section>
          </w-card>
        </template>
        <template v-if="state.current.type === `header`">
          <w-card class="pb-2">
            <w-card-section>
              <div class="text-subtitle1">{{ t('navEdit.header') }}</div>
            </w-card-section>
            <w-item>
              <blueprint-icon icon="typography" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.label`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.labelHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  v-model="state.current.label"
                  dense
                  hide-bottom-space
                  :aria-label="t(`navEdit.label`)" />
              </w-item-section>
            </w-item>
            <w-item>
              <blueprint-icon icon="user-groups" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.visibility`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.visibilityHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section avatar>
                <w-btn-toggle
                  v-model="state.current.visibilityLimited"
                  depth
                  no-caps
                  toggle-color="primary"
                  :options="visibilityOptions" />
              </w-item-section>
            </w-item>
            <w-item v-if="state.current.visibilityLimited">
              <w-space />
              <!-- -> `self-center`: WItem's own `items-stretch` outranks an `items-center` on the row -->
              <div class="text-caption mr-4 self-center">{{ t('navEdit.selectGroups') }}</div>
              <w-select
                style="width: 100%; max-width: calc(50% - 34px)"
                v-model="state.current.visibilityGroups"
                :options="state.groups"
                option-value="id"
                option-label="name"
                emit-value
                map-options
                dense
                multiple
                :aria-label="t(`navEdit.selectGroups`)" />
            </w-item>
          </w-card>
          <w-card class="p-4 mt-4 flex">
            <w-space />
            <w-btn
              class="acrylic-btn"
              flat
              icon="la:trash-alt"
              :label="t(`common.actions.delete`)"
              color="negative"
              padding="xs md"
              @click="removeItem(state.current)" />
          </w-card>
        </template>
        <template v-if="state.current.type === `link`">
          <w-card class="pb-2">
            <w-card-section>
              <div class="text-subtitle1">
                {{ currentIsParent ? t('navEdit.linkTrigger') : t('navEdit.link') }}
              </div>
              <!-- -> Why Target and Open in New Window are gone below, and how to get them back -->
              <div v-if="currentIsParent" class="text-caption text-grey-7">
                {{ t('navEdit.linkParentHint') }}
              </div>
            </w-card-section>
            <w-item>
              <blueprint-icon icon="typography" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.label`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.labelHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  v-model="state.current.label"
                  dense
                  hide-bottom-space
                  :aria-label="t(`navEdit.label`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="spring" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.icon`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.iconHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  v-model="state.current.icon"
                  dense
                  :aria-label="t(`navEdit.icon`)">
                  <template #append>
                    <!--
                      A button, not a bare `w-icon`: for a bundled icon WIcon renders an <svg> whose
                      body is set through `v-html`, and that branch renders no slot -- so the menu
                      inside it never existed and the control did nothing. It was also just the glyph,
                      with no hit area of its own. Same fix as the page-properties dialog.
                    -->
                    <w-field-cap icon="la:icons" :aria-label="t(`iconPicker.open`)">
                      <w-tooltip>{{ t('iconPicker.open') }}</w-tooltip>
                      <w-menu content-class="shadow-7">
                        <icon-picker-dialog v-model="state.current.icon" />
                      </w-menu>
                    </w-field-cap>
                  </template>
                </w-input>
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <!--
              A parent is a row that opens a submenu rather than a row that goes anywhere: the sidebar
              renders it as an expansion item and never reads its target, so both fields below are
              hidden rather than shown doing nothing. Hidden, not cleared -- unnesting the last child
              turns the row back into an ordinary link, and it comes back with the address it had.
            -->
            <template v-if="currentIsParent">
              <w-item tag="label">
                <blueprint-icon icon="chevron-right" />
                <w-item-section>
                  <w-item-label>{{ t(`navEdit.expandByDefault`) }}</w-item-label>
                  <w-item-label caption>{{ t(`navEdit.expandByDefaultHint`) }}</w-item-label>
                </w-item-section>
                <w-item-section avatar>
                  <w-toggle
                    v-model="state.current.expandByDefault"
                    color="primary"
                    checked-icon="la:check"
                    unchecked-icon="la:times"
                    :aria-label="t(`navEdit.expandByDefault`)" />
                </w-item-section>
              </w-item>
            </template>
            <template v-else>
              <w-item>
                <blueprint-icon icon="link" />
                <w-item-section>
                  <w-item-label>{{ t(`navEdit.target`) }}</w-item-label>
                  <w-item-label caption>{{ t(`navEdit.targetHint`) }}</w-item-label>
                </w-item-section>
                <w-item-section>
                  <w-input
                    v-model="state.current.target"
                    dense
                    hide-bottom-space
                    :aria-label="t(`navEdit.target`)">
                    <template #append>
                      <!--
                        Beside the field rather than in place of it: a path someone knows is quicker
                        typed than browsed to, and an external URL has nothing to browse. Same shape as
                        the icon picker's button one row up, for the same reason -- both open a chooser
                        for the field they sit in.
                      -->
                      <w-field-cap
                        icon="la:folder-open"
                        :aria-label="t(`common.actions.browse`)"
                        @click="browseTarget">
                        <w-tooltip>{{ t('common.actions.browse') }}</w-tooltip>
                      </w-field-cap>
                    </template>
                  </w-input>
                </w-item-section>
              </w-item>
              <w-separator class="my-2" inset />
              <w-item tag="label">
                <blueprint-icon icon="external-link" />
                <w-item-section>
                  <w-item-label>{{ t(`navEdit.openInNewWindow`) }}</w-item-label>
                  <w-item-label caption>{{ t(`navEdit.openInNewWindowHint`) }}</w-item-label>
                </w-item-section>
                <w-item-section avatar>
                  <w-toggle
                    v-model="state.current.openInNewWindow"
                    color="primary"
                    checked-icon="la:check"
                    unchecked-icon="la:times"
                    :aria-label="t(`navEdit.openInNewWindow`)" />
                </w-item-section>
              </w-item>
            </template>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="user-groups" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.visibility`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.visibilityHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section avatar>
                <w-btn-toggle
                  v-model="state.current.visibilityLimited"
                  depth
                  no-caps
                  toggle-color="primary"
                  :options="visibilityOptions" />
              </w-item-section>
            </w-item>
            <w-item v-if="state.current.visibilityLimited">
              <w-space />
              <!-- -> `self-center`: WItem's own `items-stretch` outranks an `items-center` on the row -->
              <div class="text-caption mr-4 self-center">{{ t('navEdit.selectGroups') }}</div>
              <w-select
                style="width: 100%; max-width: calc(50% - 34px)"
                v-model="state.current.visibilityGroups"
                :options="state.groups"
                option-value="id"
                option-label="name"
                emit-value
                map-options
                dense
                multiple
                :aria-label="t(`navEdit.selectGroups`)" />
            </w-item>
          </w-card>
          <w-card class="p-4 mt-4 flex items-start">
            <div>
              <w-btn
                class="acrylic-btn"
                v-if="state.current.isNested"
                flat
                :label="t(`navEdit.unnestItem`)"
                icon="mdi:format-indent-decrease"
                color="teal"
                padding="xs md"
                @click="state.current.isNested = false" />
              <w-btn
                class="acrylic-btn"
                v-else
                flat
                :label="t(`navEdit.nestItem`)"
                icon="mdi:format-indent-increase"
                color="teal"
                padding="xs md"
                @click="state.current.isNested = true" />
              <div class="text-caption mt-4 text-grey-7">{{ t('navEdit.nestingWarn') }}</div>
            </div>
            <w-space />
            <w-btn
              class="acrylic-btn"
              flat
              icon="la:trash-alt"
              :label="t(`common.actions.delete`)"
              color="negative"
              padding="xs md"
              @click="removeItem(state.current)" />
          </w-card>
        </template>
        <template v-if="state.current.type === `menu`">
          <w-card class="pb-2">
            <w-card-section>
              <div class="text-subtitle1">{{ t('navEdit.menu') }}</div>
              <div class="text-caption text-grey-7">{{ t('navEdit.menuHint') }}</div>
            </w-card-section>
            <w-item>
              <blueprint-icon icon="typography" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.label`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.labelHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  v-model="state.current.label"
                  dense
                  hide-bottom-space
                  :aria-label="t(`navEdit.label`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="spring" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.icon`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.iconHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  v-model="state.current.icon"
                  dense
                  :aria-label="t(`navEdit.icon`)">
                  <template #append>
                    <!-- -> The link panel's icon picker, for the reason given there -->
                    <w-field-cap icon="la:icons" :aria-label="t(`iconPicker.open`)">
                      <w-tooltip>{{ t('iconPicker.open') }}</w-tooltip>
                      <w-menu content-class="shadow-7">
                        <icon-picker-dialog v-model="state.current.icon" />
                      </w-menu>
                    </w-field-cap>
                  </template>
                </w-input>
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="tree-structure" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.menuTarget`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.menuTargetHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <!--
                  Read-only: a menu is picked, never typed. It is stored by id and shown by the path of
                  the page owning it, which is not something to edit here -- which is also why picking
                  is a labelled button of its own rather than an icon inside a field that looks locked.
                -->
                <div class="flex items-center">
                  <w-btn
                    class="acrylic-btn mr-2 shrink-0"
                    flat
                    no-caps
                    icon="la:folder-open"
                    color="primary"
                    :label="t(`navEdit.menuTargetPick`)"
                    @click="browseMenuTarget" />
                  <w-input
                    class="min-w-0 flex-1"
                    :model-value="menuTargetLabel"
                    dense
                    readonly
                    hide-bottom-space
                    :error="!state.current.targetNavId || state.current.targetMissing"
                    :aria-label="t(`navEdit.menuTarget`)" />
                </div>
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item tag="label">
              <blueprint-icon icon="link" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.showLink`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.showLinkHint`) }}</w-item-label>
                <!-- -> Said rather than refused: a page may yet be written there, and the option then
                        applies without anybody coming back to this menu -->
                <w-item-label
                  v-if="
                    state.current.showLink &&
                    state.current.targetNavId &&
                    !state.current.targetMissing &&
                    !state.current.targetHasPage
                  "
                  class="text-warning"
                  caption
                  >{{ t('navEdit.showLinkNoPage') }}</w-item-label
                >
              </w-item-section>
              <w-item-section avatar>
                <w-toggle
                  v-model="state.current.showLink"
                  color="primary"
                  checked-icon="la:check"
                  unchecked-icon="la:times"
                  :aria-label="t(`navEdit.showLink`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="user-groups" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.visibility`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.visibilityHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section avatar>
                <w-btn-toggle
                  v-model="state.current.visibilityLimited"
                  depth
                  no-caps
                  toggle-color="primary"
                  :options="visibilityOptions" />
              </w-item-section>
            </w-item>
            <w-item v-if="state.current.visibilityLimited">
              <w-space />
              <!-- -> `self-center`: WItem's own `items-stretch` outranks an `items-center` on the row -->
              <div class="text-caption mr-4 self-center">{{ t('navEdit.selectGroups') }}</div>
              <w-select
                style="width: 100%; max-width: calc(50% - 34px)"
                v-model="state.current.visibilityGroups"
                :options="state.groups"
                option-value="id"
                option-label="name"
                emit-value
                map-options
                dense
                multiple
                :aria-label="t(`navEdit.selectGroups`)" />
            </w-item>
          </w-card>
          <w-card class="p-4 mt-4 flex">
            <w-space />
            <w-btn
              class="acrylic-btn"
              flat
              icon="la:trash-alt"
              :label="t(`common.actions.delete`)"
              color="negative"
              padding="xs md"
              @click="removeItem(state.current)" />
          </w-card>
        </template>
        <template v-if="state.current.type === `separator`">
          <w-card class="pb-2">
            <w-card-section>
              <div class="text-subtitle1">{{ t('navEdit.separator') }}</div>
            </w-card-section>
            <w-item>
              <blueprint-icon icon="user-groups" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.visibility`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.visibilityHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section avatar>
                <w-btn-toggle
                  v-model="state.current.visibilityLimited"
                  depth
                  no-caps
                  toggle-color="primary"
                  :options="visibilityOptions" />
              </w-item-section>
            </w-item>
            <w-item v-if="state.current.visibilityLimited">
              <w-space />
              <!-- -> `self-center`: WItem's own `items-stretch` outranks an `items-center` on the row -->
              <div class="text-caption mr-4 self-center">{{ t('navEdit.selectGroups') }}</div>
              <w-select
                style="width: 100%; max-width: calc(50% - 34px)"
                v-model="state.current.visibilityGroups"
                :options="state.groups"
                option-value="id"
                option-label="name"
                emit-value
                map-options
                dense
                multiple
                :aria-label="t(`navEdit.selectGroups`)" />
            </w-item>
          </w-card>
          <w-card class="p-4 mt-4 flex">
            <w-space />
            <w-btn
              class="acrylic-btn"
              flat
              icon="la:trash-alt"
              :label="t(`common.actions.delete`)"
              color="negative"
              padding="xs md"
              @click="removeItem(state.current)" />
          </w-card>
        </template>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import { confirm, dialog } from '@/composables/dialog'
import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'

import { useAdminStore } from '@/stores/admin'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import { v4 as uuid } from 'uuid'
import { chunk, uniq } from 'es-toolkit/array'
import { pick } from 'es-toolkit/object'
import { fileOpen, fileSave } from 'browser-fs-access'
import { Sortable } from 'sortablejs-vue3'
import IconPickerDialog from '@/components/IconPickerDialog.vue'
import NavEditItemMenu from '@/components/NavEditItemMenu.vue'
import { apiErrorMessage } from '@/helpers/apiError'

// STORES

const adminStore = useAdminStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

/**
 * Whether this was opened from the admin area's Navigation screen rather than from a page.
 *
 * The admin layout has an overlay slot of its own, driven by the admin store, and there the editor has
 * no page in hand: it edits one menu of whichever site the admin area is on, addressed by the menu's id
 * (`overlayOpts.siteId` / `navId`), and saves the items alone — no page's mode changes. Settled once,
 * at setup, since the store's overlay is cleared before this unmounts.
 */
const fromAdmin = adminStore.overlay === 'NavEdit'

/** The site the menu belongs to — the admin area's selected one, which need not be the one served. */
const siteId = fromAdmin ? adminStore.overlayOpts.siteId : siteStore.id

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0,
  selected: null,
  items: [],
  current: {
    label: '',
    icon: '',
    target: '/',
    openInNewWindow: false,
    expandByDefault: false,
    visibilityGroups: [],
    visibilityLimited: false,
    isNested: false
  },
  groups: []
})

/**
 * The icon a new link item starts with.
 *
 * An Iconify reference, so that the icon picker opens on its search tab with this one selected, and so
 * that the sidebar draws it through `w-icon` like every other item. Kept to `mdi`, a set seeded on
 * every instance.
 */
const DEFAULT_LINK_ICON = 'mdi:text-box-outline'

/** The icon a new menu item starts with: a folder, which is what such a menu nearly always belongs to. */
const DEFAULT_MENU_ICON = 'mdi:folder-outline'

/**
 * What a menu export calls itself, and the version of its shape. An import refuses anything else.
 * The format is specified in `dev/specs/navigation-export.md`.
 */
const EXPORT_FORMAT = 'wikijs-navigation'
const EXPORT_VERSION = 1

/** An Iconify reference, as `WIcon` reads one — the only kind of icon that has to be materialized. */
const ICONIFY_REF = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[-.][a-z0-9]+)*$/

const sortableOptions = {
  handle: '.handle',
  animation: 150
}

/*
  A computed, not a plain array: the locale strings are fetched after the app mounts
  (`App.vue` -> `applyLocale`), so a `t()` called once during `setup()` can resolve before they
  land and leave the visibility choices showing raw keys for the life of the page — which is what a
  direct load of this screen does, as opposed to a navigation to it. Inside a computed
  it re-evaluates when `setLocaleMessage` fills the strings in.
*/
const visibilityOptions = computed(() => [
  { value: false, label: t('navEdit.visibilityAll') },
  { value: true, label: t('navEdit.visibilityLimited') }
])

// COMPUTED

/**
 * The menu being edited.
 *
 * `overlayOpts.navId` is a menu this page does not own: the one it inherits, resolved by the nav menu
 * that opened this editor, so that the sidebar a page shows can be edited from that page rather than
 * only from the ancestor holding it. Saving writes it back where it lives — see `save()`.
 *
 * Otherwise the page's own menu — or the folder's, at a path with no page. The home page edits the
 * site-wide menu — the one every other page inherits — which is why it goes through its resolved id
 * rather than its own. Any other page or folder owns a menu keyed by its own id, which the server
 * creates on the first save.
 */
const navId = computed(() => {
  if (fromAdmin) {
    return adminStore.overlayOpts.navId
  }
  return (
    siteStore.overlayOpts.navId ??
    (pageStore.id && pageStore.isHome ? pageStore.navigationId : pageStore.navEntryId)
  )
})

/** Whether the menu on screen is an inherited one, which is shared with every page using it. */
const isEditingInherited = computed(() => !fromAdmin && Boolean(siteStore.overlayOpts.navId))

/**
 * The locale of the menu being edited, which every menu a `menu` item opens has to share: a sidebar
 * never crosses into another locale. The page's own from a page -- an inherited menu is found by a walk
 * that never leaves it -- and the one the admin area passed otherwise.
 */
const menuLocale = computed(() => (fromAdmin ? adminStore.overlayOpts.locale : pageStore.locale))

/** What the Menu Target field shows: the path of the page owning the target, or what is wrong with it. */
const menuTargetLabel = computed(() => {
  if (!state.current.targetNavId) {
    return t('navEdit.menuTargetNone')
  }
  if (state.current.targetMissing) {
    return t('navEdit.menuTargetMissing')
  }
  return `/${state.current.targetPath ?? ''}`
})

/**
 * Whether the link being edited is a parent — one the sidebar draws as a submenu.
 *
 * Parenthood is not a property of the item: this list is flat, and `isNested` says an item belongs to
 * whatever link comes before it, so what makes a link a parent is the item that FOLLOWS it. Which is why
 * this is asked of the list rather than read off `state.current`, and why it answers again the moment a
 * child is nested, unnested or dragged away.
 */
const currentIsParent = computed(() => {
  const item = state.current
  if (item?.type !== 'link' || item.isNested) {
    return false
  }
  const idx = state.items.findIndex((it) => it.id === item.id)
  return idx >= 0 && Boolean(state.items[idx + 1]?.isNested)
})

const thumbStyle = {
  right: '2px',
  borderRadius: '5px',
  backgroundColor: '#FFF',
  width: '5px',
  opacity: 0.5
}
const barStyle = {
  backgroundColor: '#000',
  width: '9px',
  opacity: 0.1
}

// METHODS

function setItem(item) {
  state.selected = item.id
  state.current = item
}

/**
 * Picks the link's target: a page of this wiki, or any URL.
 *
 * The same dialog the markdown editor's Insert Link opens, with both of its tabs — a navigation link
 * goes to either, and which one it is is the reader's question rather than this panel's. It opens on
 * whatever the field already holds, so coming back to a link that exists starts from that link.
 *
 * Its "open in a new tab" offer is turned off: this panel asks that one row down and stores the
 * answer, so a second control for it could only disagree with the toggle that is actually saved.
 */
function browseTarget() {
  dialog({
    component: defineAsyncComponent(() => import('./LinkPickerDialog.vue')),
    componentProps: {
      title: t('navEdit.target'),
      okLabel: t('common.actions.select'),
      initialHref: state.current.target,
      newTabOption: false,
      // -> From the admin area there is no page to take a locale from: the menu's own is the one its
      //    links point into
      ...(fromAdmin && { locale: adminStore.overlayOpts.locale })
    }
  }).onOk(({ href }) => {
    state.current.target = href
  })
}

/**
 * Picks the menu a `menu` item opens, from those this editor may point one at.
 *
 * The list is the server's to draw up -- whoever may pick a menu is a question of the page rules on
 * the page owning it -- so the picker shows what `navigation/targets` answers, minus the menu being
 * edited, which an item cannot open from inside itself.
 */
function browseMenuTarget() {
  dialog({
    component: defineAsyncComponent(() => import('./MenuPickerDialog.vue')),
    componentProps: {
      siteId,
      locale: menuLocale.value,
      excludeId: navId.value,
      selectedId: state.current.targetNavId
    }
  }).onOk(({ id, path, hasPage }) => {
    state.current.targetNavId = id
    state.current.targetPath = path
    state.current.targetMissing = false
    state.current.targetHasPage = hasPage
  })
}

function addItem(type) {
  const newItem = {
    id: uuid(),
    type,
    visibilityGroups: [],
    visibilityLimited: false
  }
  switch (type) {
    case 'header': {
      newItem.label = t('navEdit.header')
      break
    }
    case 'link': {
      newItem.label = t('navEdit.link')
      newItem.icon = DEFAULT_LINK_ICON
      newItem.target = '/'
      newItem.openInNewWindow = false
      newItem.expandByDefault = false
      newItem.isNested = false
      break
    }
    case 'menu': {
      newItem.label = t('navEdit.menu')
      newItem.icon = DEFAULT_MENU_ICON
      newItem.targetNavId = null
      newItem.targetPath = null
      newItem.targetMissing = false
      newItem.targetHasPage = false
      newItem.showLink = true
      break
    }
  }
  state.items.push(newItem)
  state.selected = newItem.id
  state.current = newItem
}

function removeItem(item) {
  state.items = state.items.filter((it) => it.id !== item.id)
  // -> Only the row that went gives up the panel: a delete from another row's context menu leaves
  //    whatever was being edited on screen
  if (state.selected === item.id) {
    state.selected = null
    state.current = {}
  }
}

/**
 * Copies a row and drops the copy directly beneath it.
 *
 * A top-level link takes its nested children with it. This list is flat and `isNested` binds a child to
 * whatever link precedes it, so a copy inserted immediately after its original would slide between the
 * original and its children and inherit them — leaving the original childless and the copy holding a
 * submenu it was never given. Copying the whole branch and landing it after the last child is the only
 * reading that leaves the original as it was.
 */
function duplicateItem(item) {
  const idx = state.items.findIndex((it) => it.id === item.id)
  if (idx < 0) {
    return
  }
  // -> Only a top-level link has children to take along; a nested row, a header and a separator never do
  let end = idx
  if (item.type === 'link' && !item.isNested) {
    while (state.items[end + 1]?.isNested) {
      end++
    }
  }
  const copies = state.items.slice(idx, end + 1).map((it) => ({
    ...it,
    id: uuid(),
    // -> A fresh array, or editing one copy's group list would edit the other's
    visibilityGroups: [...(it.visibilityGroups ?? [])]
  }))
  state.items.splice(end + 1, 0, ...copies)
  setItem(state.items[end + 1])
}

/** Nests a link under the one above it, or takes it back out — the panel's pair of buttons, on the row. */
function toggleNesting(item) {
  const target = state.items.find((it) => it.id === item.id)
  if (target) {
    target.isNested = !target.isNested
  }
}

/** Empties the list, after asking. Like any other edit here, nothing is stored until Save. */
function clearItems() {
  confirm({
    title: t('navEdit.clearItems'),
    icon: 'img:/_assets/icons/fluent-delete-bin.svg',
    message: t('navEdit.clearItemsConfirm'),
    cancel: true,
    color: 'negative',
    okLabel: t('common.actions.clear')
  }).onOk(() => {
    state.items = []
    state.selected = null
    state.current = {}
  })
}

/**
 * Puts the menu's items in alphabetical order by label, after asking.
 *
 * Headers and separators stay where they are: they split the list into sections, and each section is
 * sorted on its own. Inside one, a top-level link moves together with the nested links under it, which
 * are sorted among themselves; a `menu` item sorts like any top-level link.
 *
 * A nested row with no link above it in its section (straight under a header, or under a `menu` item,
 * both of which the editor already marks as invalid) is kept where it is relative to what precedes it:
 * at the head of the section, or attached to that `menu` item. Sorting is not the place to settle what
 * such a row belongs to.
 */
function sortItems() {
  confirm({
    title: t('navEdit.sortItems'),
    icon: 'mdi:sort-alphabetical-ascending',
    message: t('navEdit.sortItemsConfirm'),
    cancel: true,
    okLabel: t('navEdit.sortItemsAction')
  }).onOk(() => {
    let collator
    try {
      collator = new Intl.Collator(menuLocale.value, { numeric: true, sensitivity: 'base' })
    } catch {
      // -> A wiki locale code the browser does not accept as a language tag
      collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
    }
    const byLabel = (a, b) => collator.compare(a.label ?? '', b.label ?? '')
    const byHead = (a, b) => byLabel(a[0], b[0])

    const sorted = []
    let units = []
    // -> Rows at the head of a section that have nothing to hang off: they keep their place
    let lead = []
    const flush = () => {
      sorted.push(...lead)
      for (const [head, ...children] of units.sort(byHead)) {
        sorted.push(head, ...children.sort(byLabel))
      }
      units = []
      lead = []
    }
    for (const item of state.items) {
      if (item.type === 'header' || item.type === 'separator') {
        flush()
        sorted.push(item)
      } else if (item.isNested) {
        if (units.length > 0) {
          units.at(-1).push(item)
        } else {
          lead.push(item)
        }
      } else {
        units.push([item])
      }
    }
    flush()
    state.items = sorted
  })
}

/**
 * Saves the menu as it stands in the editor -- saved or not -- to a JSON file another menu can import,
 * on this site or another. The shape is `dev/specs/navigation-export.md`.
 *
 * Item ids are left out: an import always mints its own, or importing a menu twice into one list would
 * put the same id on two rows. What only makes sense on this wiki goes out together with what can find
 * it again elsewhere -- a `menu` item's target with the path of the menu's owner, and each visibility
 * group with its name.
 */
async function exportItems() {
  let items
  try {
    items = buildItems()
  } catch (err) {
    return notify({ type: 'negative', message: err.message })
  }
  const toExport = ({ id, children, ...item }) => ({
    ...item,
    ...(item.type === 'menu' && {
      targetPath: state.items.find((it) => it.id === id)?.targetPath ?? null
    }),
    ...(children && { children: children.map(toExport) })
  })
  const groupIds = new Set(
    items
      .flatMap((item) => [item, ...(item.children ?? [])])
      .flatMap((item) => item.visibilityGroups)
  )
  const doc = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    groups: state.groups.filter((g) => groupIds.has(g.id)),
    items: items.map(toExport)
  }
  try {
    await fileSave(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), {
      fileName: 'navigation.json',
      extensions: ['.json']
    })
  } catch (err) {
    // -> Dismissing the file picker is not a failure
    if (err.name !== 'AbortError') {
      notify({ type: 'negative', message: err.message })
    }
  }
}

/**
 * Reads a menu export into the editor, replacing the items on screen or adding after them. Nothing is
 * stored until Save, like any other change made here.
 *
 * What pointed at something on the wiki the file came from is looked for again here, and whatever is
 * not found is left in a state the editor already marks and that cannot reach a reader by accident:
 * a `menu` item with no target, which Save refuses until one is picked, and an item restricted to
 * groups none of which exist here, which keeps those ids and so stays hidden from everyone rather than
 * becoming visible to everyone.
 */
async function importItems() {
  let parsed
  try {
    const blob = await fileOpen({
      mimeTypes: ['application/json'],
      extensions: ['.json'],
      startIn: 'downloads',
      excludeAcceptAllOption: true
    })
    parsed = parseExport(JSON.parse(await blob.text()))
  } catch (err) {
    if (err.name === 'AbortError') {
      return
    }
    return notify({
      type: 'negative',
      message: t('navEdit.importFailed'),
      caption: err.message
    })
  }
  if (state.items.length < 1) {
    return applyImport(parsed, 'replace')
  }
  confirm({
    title: t('navEdit.importModeTitle'),
    message: t('navEdit.importModeText'),
    options: {
      model: 'replace',
      type: 'radio',
      items: [
        { label: t('navEdit.importModeReplace'), value: 'replace' },
        { label: t('navEdit.importModeAppend'), value: 'append' }
      ]
    },
    cancel: true
  }).onOk((mode) => applyImport(parsed, mode))
}

/**
 * Turns an export into the editor's flat rows, each with a fresh id, refusing a file that is not one.
 *
 * Strict about structure -- a type the editor does not know, a non-link nested under a link -- since a
 * row the editor cannot draw is one nobody could fix before saving. Lenient about values, which fall
 * back to what a newly added item of that type starts with.
 */
function parseExport(doc) {
  if (doc?.format !== EXPORT_FORMAT || !Array.isArray(doc.items)) {
    throw new Error(t('navEdit.importNotExport'))
  }
  if (doc.version !== EXPORT_VERSION) {
    throw new Error(t('navEdit.importVersion', { version: String(doc.version) }))
  }
  if (doc.items.length < 1) {
    throw new Error(t('navEdit.importEmpty'))
  }
  const text = (value, fallback) => (typeof value === 'string' ? value : fallback)
  const toRow = (raw, isNested) => {
    if (!['header', 'link', 'menu', 'separator'].includes(raw?.type)) {
      throw new Error(t('navEdit.importNotExport'))
    }
    if ((isNested || raw.type !== 'link') && raw.children !== undefined) {
      throw new Error(t('navEdit.importNotExport'))
    }
    const visibilityGroups = Array.isArray(raw.visibilityGroups)
      ? uniq(raw.visibilityGroups.filter((g) => typeof g === 'string' && g))
      : []
    const row = {
      id: uuid(),
      type: raw.type,
      visibilityGroups,
      visibilityLimited: visibilityGroups.length > 0
    }
    switch (raw.type) {
      case 'header': {
        row.label = text(raw.label, t('navEdit.header'))
        break
      }
      case 'link': {
        row.label = text(raw.label, t('navEdit.link'))
        row.icon = text(raw.icon, DEFAULT_LINK_ICON)
        row.target = text(raw.target, '/')
        row.openInNewWindow = Boolean(raw.openInNewWindow)
        row.expandByDefault = !isNested && Boolean(raw.expandByDefault)
        row.isNested = isNested
        break
      }
      case 'menu': {
        row.label = text(raw.label, t('navEdit.menu'))
        row.icon = text(raw.icon, DEFAULT_MENU_ICON)
        row.targetNavId = text(raw.targetNavId, null)
        row.targetPath = text(raw.targetPath, null)
        row.targetMissing = false
        row.targetHasPage = false
        row.showLink = typeof raw.showLink === 'boolean' ? raw.showLink : true
        break
      }
    }
    return row
  }

  const rows = []
  for (const raw of doc.items) {
    rows.push(toRow(raw, false))
    for (const child of Array.isArray(raw.children) ? raw.children : []) {
      if (child?.type !== 'link') {
        throw new Error(t('navEdit.importNotExport'))
      }
      rows.push(toRow(child, true))
    }
  }
  const groupNames = new Map(
    (Array.isArray(doc.groups) ? doc.groups : [])
      .filter((g) => typeof g?.id === 'string' && typeof g?.name === 'string')
      .map((g) => [g.id, g.name])
  )
  return { rows, groupNames }
}

/**
 * Points each imported `menu` item at a menu of this editor's site and locale: the same menu by id
 * (an import into the site it came from), else the one whose owner sits at the same path. Only among
 * those the server lets this editor pick -- what `navigation/targets` answers, minus the menu being
 * edited -- since Save refuses any other. Returns how many found nothing, which are left without a
 * target.
 */
async function resolveMenuTargets(rows) {
  const menuRows = rows.filter((row) => row.type === 'menu')
  if (menuRows.length < 1) {
    return 0
  }
  let targets = []
  try {
    const resp = await API_CLIENT.get(`sites/${siteId}/navigation/targets`, {
      searchParams: { locale: menuLocale.value }
    }).json()
    targets = (resp?.menus ?? []).filter((menu) => menu.id !== navId.value)
  } catch {
    // -> Nothing can be matched; every menu item is left for a target to be picked
  }
  const trimSlashes = (path) => path.replace(/^\/+|\/+$/g, '')
  let unresolved = 0
  for (const row of menuRows) {
    const match =
      targets.find((menu) => menu.id === row.targetNavId) ??
      (row.targetPath === null
        ? undefined
        : targets.find((menu) => menu.path === trimSlashes(row.targetPath)))
    if (match) {
      row.targetNavId = match.id
      row.targetPath = match.path
      row.targetHasPage = match.hasPage
    } else {
      row.targetNavId = null
      row.targetPath = null
      unresolved++
    }
  }
  return unresolved
}

/**
 * Maps each imported row's visibility groups onto the groups of this wiki: by id (the same instance),
 * else by the name the export recorded for it. Groups found nowhere are dropped, which only narrows who
 * sees the item -- unless none of its groups are found, in which case it keeps the ids it came with and
 * is shown to nobody, rather than having its restriction quietly removed. Returns how many rows that
 * happened to.
 */
function resolveVisibilityGroups(rows, groupNames) {
  const known = new Set(state.groups.map((g) => g.id))
  const byName = new Map(state.groups.map((g) => [g.name.trim().toLowerCase(), g.id]))
  let unresolved = 0
  for (const row of rows) {
    if (row.visibilityGroups.length < 1) {
      continue
    }
    const resolved = uniq(
      row.visibilityGroups
        .map((id) => (known.has(id) ? id : byName.get(groupNames.get(id)?.trim().toLowerCase())))
        .filter(Boolean)
    )
    if (resolved.length > 0) {
      row.visibilityGroups = resolved
    } else {
      unresolved++
    }
  }
  return unresolved
}

/**
 * Stores the imported icons on this wiki, as the icon picker does for one it picks, so that they are
 * served without the Iconify API. An icon that cannot be stored is still imported; it may just not
 * render.
 */
async function materializeIcons(rows) {
  const icons = uniq(rows.map((row) => row.icon).filter((icon) => ICONIFY_REF.test(icon ?? '')))
  let failed = 0
  for (const batch of chunk(icons, 128)) {
    try {
      const resp = await API_CLIENT.post('icons/materialize', { json: { icons: batch } }).json()
      failed += resp?.failed?.length ?? (resp?.ok === false ? batch.length : 0)
    } catch {
      failed += batch.length
    }
  }
  if (failed > 0) {
    notify({ type: 'warning', message: t('navEdit.importIconsFailed', failed) })
  }
}

async function applyImport({ rows, groupNames }, mode) {
  state.loading++
  loading.show()
  try {
    const unresolvedTargets = await resolveMenuTargets(rows)
    const unresolvedGroups = resolveVisibilityGroups(rows, groupNames)
    if (mode === 'replace') {
      state.items = rows
      state.selected = null
      state.current = {}
    } else {
      state.items.push(...rows)
    }
    notify({ type: 'positive', message: t('navEdit.importSuccess', rows.length) })
    if (unresolvedTargets > 0) {
      notify({ type: 'warning', message: t('navEdit.importTargetsUnresolved', unresolvedTargets) })
    }
    if (unresolvedGroups > 0) {
      notify({ type: 'warning', message: t('navEdit.importGroupsUnresolved', unresolvedGroups) })
    }
  } finally {
    loading.hide()
    state.loading--
  }
  materializeIcons(rows)
}

function updateItemPosition(ev) {
  const item = state.items.splice(ev.oldIndex, 1)[0]
  state.items.splice(ev.newIndex, 0, item)
}

function close() {
  if (fromAdmin) {
    adminStore.$patch({ overlay: '' })
  } else {
    siteStore.$patch({ overlay: '' })
  }
}

async function loadGroups() {
  state.loading++
  try {
    const groups = await API_CLIENT.get('groups').json()
    state.groups = (groups ?? []).map((g) => ({ id: g.id, name: g.name }))
  } catch (err) {
    // -> Without the list, per-group visibility cannot be set, but the rest of the editor still works
    notify({
      type: 'warning',
      message: t('navEdit.groupsFailed'),
      caption: apiErrorMessage(err, 'An unexpected error occured.')
    })
  }
  state.loading--
}

async function loadMenuItems() {
  state.loading++
  loading.show()
  try {
    // -> `full`, because the editor has to see items limited to groups the editor is not in: saving
    //    without them would delete them
    const items = await API_CLIENT.get(`sites/${siteId}/navigation/${navId.value}`, {
      searchParams: { full: true }
    }).json()
    for (const item of items ?? []) {
      state.items.push({
        ...pick(item, [
          'id',
          'type',
          'label',
          'icon',
          'target',
          'openInNewWindow',
          'expandByDefault',
          'visibilityGroups',
          // -> A `menu` item's target, and what the server could tell about it: where its owner sits,
          //    or that it is gone
          'targetNavId',
          'targetPath',
          'targetMissing',
          'targetHasPage',
          'showLink'
        ]),
        visibilityLimited: item.visibilityGroups?.length > 0
      })
      for (const child of item?.children ?? []) {
        state.items.push({
          ...pick(child, [
            'id',
            'type',
            'label',
            'icon',
            'target',
            'openInNewWindow',
            'visibilityGroups'
          ]),
          visibilityLimited: child.visibilityGroups?.length > 0,
          isNested: true
        })
      }
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: apiErrorMessage(err, 'An unexpected error occured.')
    })
    close()
  }
  loading.hide()
  state.loading--
}

function cleanMenuItem(item, isNested = false) {
  switch (item.type) {
    case 'header': {
      return {
        ...pick(item, ['id', 'type', 'label']),
        visibilityGroups: item.visibilityLimited ? item.visibilityGroups : []
      }
    }
    case 'link': {
      return {
        ...pick(item, ['id', 'type', 'label', 'icon', 'target', 'openInNewWindow']),
        visibilityGroups: item.visibilityLimited ? item.visibilityGroups : [],
        // -> Only a top-level link can hold children, so only one of those can be a parent — a nested
        //    item carrying an expand flag would be a setting nothing ever reads
        ...(!isNested && { children: [], expandByDefault: Boolean(item.expandByDefault) })
      }
    }
    case 'separator': {
      return {
        ...pick(item, ['id', 'type', 'label', 'icon', 'target', 'openInNewWindow']),
        visibilityGroups: item.visibilityLimited ? item.visibilityGroups : []
      }
    }
    case 'menu': {
      return {
        ...pick(item, ['id', 'type', 'label', 'icon', 'targetNavId']),
        showLink: Boolean(item.showLink),
        visibilityGroups: item.visibilityLimited ? item.visibilityGroups : []
      }
    }
  }
}

/**
 * The editor's flat list as the menu is stored: nested rows folded into the `children` of the link
 * above them. Throws where a nested row has no link to belong to.
 */
function buildItems() {
  const items = []
  for (const item of state.items) {
    if (item.isNested) {
      if (items.length < 1 || items.at(-1)?.type !== 'link') {
        throw new Error('One or more nested link items are not under a parent link!')
      }
      items[items.length - 1].children.push(cleanMenuItem(item, true))
    } else {
      items.push(cleanMenuItem(item))
    }
  }
  return items
}

async function save() {
  state.loading++
  loading.show()
  try {
    // -> Said here rather than left to the server, which refuses it too: the row is marked in the list,
    //    and the message names the fix
    if (state.items.some((item) => item.type === 'menu' && !item.targetNavId)) {
      throw new Error(t('navEdit.menuTargetRequired'))
    }
    const items = buildItems()

    if (fromAdmin) {
      await saveFromAdmin(items)
    } else {
      await saveFromPage(items)
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: apiErrorMessage(err, 'An unexpected error occured.')
    })
  }
  loading.hide()
  state.loading--
}

/** Saves the items together with the page's mode, which is what decides which menu they belong to. */
async function saveFromPage(items) {
  /*
    The mode goes with the items, because the mode is what decides which menu they belong to: with
    `inherit` the server stores them against the menu this page inherits — the one shown on screen,
    and the one `navId` was resolved from — rather than starting a menu of this page's own that
    nothing would point at.
  */
  const resp = await API_CLIENT.put(
    `sites/${siteStore.id}/navigation/pages/${pageStore.navEntryId}`,
    {
      json: {
        mode: siteStore.overlayOpts.mode ?? pageStore.navigationMode,
        items
      }
    }
  ).json()
  // -> The API client does not throw on 400, so a refusal comes back as a parsed error
  if (resp?.ok === false) {
    throw new Error(resp.message || 'An unexpected error occured.')
  }
  notify({
    type: 'positive',
    message: t('navEdit.saveSuccess')
  })
  pageStore.$patch({
    navigationMode: resp.navigationMode,
    navigationId: resp.navigationId ?? null
  })
  // -> Redraw the sidebar from what was just saved, rather than waiting for a navigation
  await siteStore.fetchNavigation(resp.navigationId ?? navId.value)
  close()
}

/**
 * Saves the items alone, to the menu by its id: the admin area edits a menu, not how a page resolves
 * one.
 */
async function saveFromAdmin(items) {
  const resp = await API_CLIENT.put(`sites/${siteId}/navigation/${navId.value}`, {
    json: { items }
  }).json()
  if (resp?.ok === false) {
    throw new Error(resp.message || 'An unexpected error occured.')
  }
  notify({
    type: 'positive',
    message: t('navEdit.saveSuccess')
  })
  // -> The sidebar the site store holds is drawn again on the way back to the wiki only if its menu
  //    changes id, which a save here never does
  if (siteId === siteStore.id && siteStore.nav.currentId === navId.value) {
    await siteStore.fetchNavigation(navId.value)
  }
  close()
}

onMounted(() => {
  loadMenuItems()
  loadGroups()
})

onBeforeUnmount(() => {
  if (fromAdmin) {
    adminStore.overlayOpts = {}
  } else {
    siteStore.overlayOpts = {}
  }
})
</script>

<style lang="scss" scoped>
@use 'sass:color';

/*
  Light ink on an always-dark surface.

  This drawer is dark whatever the site theme is, but the shared components' own dark treatments are
  `dark:` variants -- keyed off `body.body--dark`, i.e. the APP theme. On a light-themed site their
  light-mode colours therefore applied here: `WItemLabel`'s header variant resolved to black at 54%
  and `WItemSection`'s side variant likewise, which on `dark-6` is invisible. WDrawer's `dark` prop
  covers plain inherited text, not a component that states a colour of its own, so each one that does
  is restated here at the value its dark variant would have used.
*/
.nav-edit {
  height: 100%;

  .handle {
    cursor: grab;
    color: rgba(255, 255, 255, 0.7);
  }

  /*
    Same padding NavSidebar gives its own headings: `WItemLabel`'s uniform `p-4` made this row 52px
    against the sidebar's 40px, so a heading looked considerably heavier here than the thing being
    edited.
  */
  .w-item-label--header {
    color: rgba(255, 255, 255, 0.7);
    padding-bottom: 4px;
  }

  /* -> A rule between nav items is content here, not trim: 15% white is too faint to aim at */
  .nav-edit-item-separator .w-separator {
    --w-hairline-color: rgb(255 255 255 / 0.32);
  }
}

.nav-edit-item {
  position: relative;
  &.is-active {
    background-color: $blue-8;
  }

  &.sortable-chosen {
    background-color: $blue-5;
  }
}

.nav-edit-item-header {
  display: flex;
  cursor: pointer;
}
.nav-edit-item-link {
  &.is-nested {
    border-left: 10px solid $dark-1;
    background-color: $dark-4;
    &.is-active {
      background-color: $primary;
    }

    & + div:not(.is-nested) {
      &::before {
        content: '';
        display: 'block';
        position: absolute;
        top: 0;
        left: 0;
        width: 10px;
        height: 10px;
        border-style: solid;
        border-color: $dark-1 transparent transparent $dark-1;
        border-width: 10px 10px 10px 0;
      }
    }
  }

  &:not(.is-nested) + &.is-nested {
    &::before {
      content: '';
      display: 'block';
      position: absolute;
      top: -10px;
      left: -10px;
      width: 10px;
      height: 10px;
      border-style: solid;
      border-color: transparent transparent $dark-1 $dark-1;
      border-width: 0 10px 10px 0;
    }
  }
}
.nav-edit-item-separator {
  display: flex;
  cursor: pointer;
}

/* -> A nested link can only follow a link: after anything else it is a child of nothing */
.nav-edit-item-header,
.nav-edit-item-separator,
.nav-edit-item-menu {
  & + .nav-edit-item-link.is-nested {
    background-color: $negative !important;
    border-left-color: color.adjust($negative, $lightness: -10%) !important;

    & + div:not(.is-nested) {
      &::before {
        display: none !important;
      }
    }
  }
}

.nav-edit-list {
  .nav-edit-item-separator + .nav-edit-item-header > .w-item-label {
    padding-top: 8px;
  }

  .is-nested:first-child {
    background-color: $negative !important;
    border-left-color: color.adjust($negative, $lightness: -10%) !important;

    & + div:not(.is-nested) {
      &::before {
        display: none !important;
      }
    }
  }
}
</style>
