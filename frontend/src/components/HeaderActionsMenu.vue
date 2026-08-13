<template>
  <w-btn
    class="header-actions-btn ml-4"
    flat
    round
    dense
    icon="la:ellipsis-v"
    aria-label="More Actions">
    <w-menu ref="menu" class="translucent-menu" anchor="bottom right" self="top right">
      <!--
        Every row's icon takes its colour as a literal `text-*` class rather than through `WIcon`'s
        `color` prop, which builds `text-${color}` at runtime: Tailwind generates a utility only for a
        class name it can find as literal text in the source, so a constructed one resolves to nothing
        and the icon falls back to the menu's own ink. `color="positive"` happens to work because that
        string is written literally elsewhere in the app; `color="amber"` and `color="blue-4"` are not,
        and rendered black. The colours themselves match the buttons these rows stand in for.
      -->
      <w-list padding style="min-width: 250px">
        <!--
          Who is signed in. The account button this stands in for led with the same two lines, and
          nothing else in the phone header says whose session this is.
        -->
        <template v-if="userStore.authenticated">
          <w-item>
            <w-item-section avatar>
              <w-avatar v-if="userStore.hasAvatar" size="32px">
                <img :src="`/_user/current/avatar`" />
              </w-avatar>
              <w-icon v-else name="la:user-circle" />
            </w-item-section>
            <w-item-section>
              <w-item-label>{{ userStore.name }}</w-item-label>
              <w-item-label caption>{{ userStore.email }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-separator class="my-2" />
        </template>
        <!--
          A submenu, because New Page is a choice of editor rather than a single action -- the same
          choice, from the same component, as the header button on a wide screen. It anchors to this row
          because `WMenu` takes the nearest `.w-item` as its trigger.

          `hide-asset-btn` because this menu has a File Manager row of its own directly below, and
          `@new-page` closes this menu once the submenu has acted: the editor opens behind it otherwise,
          with the menu still floating over it.
        -->
        <w-item v-if="userStore.can(`write:pages`)" clickable>
          <w-item-section avatar>
            <w-icon name="la:plus-circle" class="text-blue-4" />
          </w-item-section>
          <w-item-section>Create New Page</w-item-section>
          <w-item-section side>
            <w-icon name="la:angle-right" />
          </w-item-section>
          <page-new-menu hide-asset-btn @new-page="close" />
        </w-item>
        <!--
          -> Whoever may put a file somewhere: `write:assets` outright, or `write:pages` for an author
             whose rules cover the pages but not the assets beside them, since the editor sends them
             here to insert an image. Every folder and every file is checked again by the endpoints
             behind the manager, which answer per path, so this decides only whether the door is shown.
        -->
        <w-item v-if="canUseFileManager" clickable @click="openFileManager">
          <w-item-section avatar>
            <w-icon name="la:folder-open" class="text-positive" />
          </w-item-section>
          <w-item-section>File Manager</w-item-section>
        </w-item>
        <w-item v-if="userStore.authenticated" clickable to="/_inbox" @click="close">
          <w-item-section avatar>
            <w-icon name="mdi:inbox-full" class="text-amber" />
          </w-item-section>
          <w-item-section>{{ t('inbox.title') }}</w-item-section>
        </w-item>
        <w-item v-if="userStore.can(`access:admin`)" clickable to="/_admin" @click="close">
          <w-item-section avatar>
            <w-icon name="la:tools" class="text-pink" />
          </w-item-section>
          <w-item-section>{{ t('common.header.admin') }}</w-item-section>
        </w-item>
        <!-- -> Only once there is something above it to divide from the account rows below: a guest whose
                rules grant nothing but reading has none of the four, and the menu opened on a rule with
                blank space over it and Login alone underneath -->
        <w-separator v-if="hasActionRows" class="my-2" />
        <!--
          The account rows, flattened into this list rather than opened as a second submenu: they are two
          plain actions, and the panel they live in on a wide screen is 300px of card -- wider than this
          menu is on the screens it exists for.
        -->
        <template v-if="userStore.authenticated">
          <w-item clickable to="/_profile" @click="close">
            <w-item-section avatar>
              <w-icon name="la:user-alt" class="text-primary" />
            </w-item-section>
            <w-item-section>{{ t('common.header.profile') }}</w-item-section>
          </w-item>
          <w-item clickable @click="logout">
            <w-item-section avatar>
              <w-icon name="la:sign-out-alt" class="text-red" />
            </w-item-section>
            <w-item-section>{{ t('common.header.logout') }}</w-item-section>
          </w-item>
        </template>
        <!-- -> The header's Login button is one of the ones this menu stands in for, so a guest has to
                find it in here -->
        <w-item v-else clickable to="/login" @click="close">
          <w-item-section avatar>
            <w-icon name="la:sign-in-alt" class="text-primary" />
          </w-item-section>
          <w-item-section>{{ t('common.actions.login') }}</w-item-section>
        </w-item>
      </w-list>
    </w-menu>
  </w-btn>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import PageNewMenu from '@/components/PageNewMenu.vue'

/**
 * The phone header's overflow menu: one button standing in for every action the bar shows as its own
 * icon on a wide screen -- New Page, File Manager, Inbox, Administration, and the account.
 *
 * Rendered only below 900px; see `HeaderNav`. The rows repeat the permission tests the buttons they
 * replace make, rather than being handed a list, so the two cannot drift apart.
 */

// STORES

const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// REFS

const menu = ref(null)

// COMPUTED

const canUseFileManager = computed(
  () => userStore.can('write:assets') || userStore.can('write:pages')
)

/**
 * Whether any row is shown above the account group, which is what decides the rule between the two.
 *
 * Restates the test each of those four rows makes rather than a shorter equivalent — `canUseFileManager`
 * already implies the New Page row's permission today, but a row added or a test changed up there would
 * otherwise leave this behind, and the failure is silent.
 */
const hasActionRows = computed(
  () =>
    userStore.can('write:pages') ||
    canUseFileManager.value ||
    userStore.authenticated ||
    userStore.can('access:admin')
)

// METHODS

/**
 * Dismiss the menu.
 *
 * Every row calls it, rather than the menu carrying `auto-close`: that closes on ANY click inside,
 * including the New Page row -- which would take the submenu's trigger out of the document in the same
 * tick it was pressed.
 */
function close() {
  menu.value?.hide()
}

/*
  Closed before the manager opens: it is a full-screen overlay, and a menu teleported to the body
  outranks it -- so the menu would be left floating over the panel it had just opened.
*/
function openFileManager() {
  close()
  siteStore.openFileManager()
}

function logout() {
  close()
  userStore.logout()
}
</script>

<style lang="scss">
// -> Where the button gets its colour, so it carries no `color` prop: `WBtn` emits an inline `color`,
//    which would outrank this rule. Matches `.account-avbtn`, the button it stands in for.
.header-actions-btn {
  color: rgba(255, 255, 255, 0.75);
}
</style>
