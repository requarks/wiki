<template>
  <w-card style="min-width: 350px">
    <w-card-section class="card-header">
      <w-icon name="img:/_assets/icons/fluent-sidebar-menu.svg" left size="sm" />
      <span>{{t(`navEdit.title`)}}</span>
    </w-card-section>
    <w-list padding>
      <template v-if="isRoot">
        <w-item tag="label">
          <w-item-section side><w-radio v-model="state.mode" val="inherit" /></w-item-section>
          <w-item-section>
            <w-item-label>Show</w-item-label>
            <w-item-label caption>Show the left sidebar navigaiton menu items.</w-item-label>
          </w-item-section>
        </w-item>
        <w-item tag="label">
          <w-item-section side><w-radio v-model="state.mode" val="hide" /></w-item-section>
          <w-item-section>
            <w-item-label>Hide</w-item-label>
            <w-item-label caption>Completely hide the left sidebar navigation.</w-item-label>
          </w-item-section>
        </w-item>
      </template>
      <template v-else>
        <w-item tag="label">
          <w-item-section side><w-radio v-model="state.mode" val="inherit" /></w-item-section>
          <w-item-section>
            <w-item-label>Inherit</w-item-label>
            <w-item-label caption>Use the menu items and settings from the parent path.</w-item-label>
          </w-item-section>
        </w-item>
        <w-item tag="label">
          <w-item-section side><w-radio v-model="state.mode" val="override" /></w-item-section>
          <w-item-section>
            <w-item-label>Override Current + Descendants</w-item-label>
            <w-item-label caption>Set menu items and settings for this path and all descendants.</w-item-label>
          </w-item-section>
        </w-item>
        <w-item tag="label">
          <w-item-section side><w-radio v-model="state.mode" val="overrideExact" /></w-item-section>
          <w-item-section>
            <w-item-label>Override Current Only</w-item-label>
            <w-item-label caption>Set menu items and settings only for this path.</w-item-label>
          </w-item-section>
        </w-item>
        <w-item tag="label">
          <w-item-section side><w-radio v-model="state.mode" val="hide" /></w-item-section>
          <w-item-section>
            <w-item-label>Hide Current + Descendants</w-item-label>
            <w-item-label caption>Completely hide the left sidebar navigation for this path and all descendants.</w-item-label>
          </w-item-section>
        </w-item>
        <w-item tag="label">
          <w-item-section side><w-radio v-model="state.mode" val="hideExact" /></w-item-section>
          <w-item-section>
            <w-item-label>Hide Current Only</w-item-label>
            <w-item-label caption>Completely hide the left sidebar navigation only for this path.</w-item-label>
          </w-item-section>
        </w-item>
      </template>
    </w-list>
    <template v-if="canEditMenuItems">
      <w-separator inset />
      <w-card-section>
        <w-btn
          class="w-full"
          unelevated
          icon="mdi:playlist-edit"
          color="deep-orange-9"
          :label="t(`navEdit.editMenuItems`)"
          @click="startEditing" />
      </w-card-section>
    </template>
    <w-card-actions class="card-actions">
      <w-space />
      <w-btn
        class="acrylic-btn"
        flat
        :label="t(`common.actions.cancel`)"
        color="grey"
        padding="xs md"
        @click="props.menuHideHandler" />
      <w-btn
        unelevated
        :label="t(`common.actions.save`)"
        color="positive"
        padding="xs md"
        @click="save"
        :loading="state.loading > 0" />
    </w-card-actions>
  </w-card>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

import { notify } from '@/composables/notify'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { apiErrorMessage } from '@/helpers/apiError'

// PROPS

const props = defineProps({
  menuHideHandler: {
    type: Function,
    default: () => ({})
  },
  updatePositionHandler: {
    type: Function,
    default: () => ({})
  }
})


// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  mode: 'inherit',
  /**
   * The menu this page inherits, resolved on open for any page that is not the root — see the
   * `inherited` endpoint.
   *
   * Asked of the server rather than read off `pageStore.navigationId`, which only answers this while
   * the SAVED mode is `inherit`: on a page that currently overrides, picking Inherit here has to point
   * at the ancestor's menu, and the ancestor holding it is not something the page knows.
   *
   * Null means nothing to inherit: the sidebar above this page is hidden.
   */
  inheritedNavId: null,
  loading: 0
})

// COMPUTED

const isRoot = computed(() => {
  return pageStore.path === '' || pageStore.path === 'home'
})

const canEditMenuItems = computed(() => {
  // -> Inheriting edits the menu this page shows where it lives, which needs there to be one
  if (!isRoot.value && state.mode === 'inherit') {
    return Boolean(state.inheritedNavId)
  }
  return ['inherit', 'override', 'overrideExact'].includes(state.mode)
})

// WATCHERS

watch(
  () => state.mode,
  () => {
    nextTick(() => {
      props.updatePositionHandler()
    })
  }
)

// METHODS

/**
 * Resolves the menu this page inherits, so that Inherit can offer to edit it.
 *
 * Quiet on failure: the mode itself is what this menu is for and can still be set, so a resolution
 * that did not come back only leaves the Edit Menu Items button out.
 */
async function loadInheritedNav() {
  // -> Deliberately outside `state.loading`, which is what the Save button spins on: this runs as the
  //    menu opens, and a spinner there would read as a save in flight
  try {
    const resp = await API_CLIENT.get(
      `sites/${siteStore.id}/navigation/pages/${pageStore.id}/inherited`
    ).json()
    state.inheritedNavId = resp?.navigationId ?? null
    // -> A row appearing under the list makes the menu taller than the popup it was measured for
    nextTick(() => {
      props.updatePositionHandler()
    })
  } catch (err) {
    console.warn(`Could not resolve the inherited navigation menu: ${apiErrorMessage(err)}`)
  }
}

function startEditing() {
  siteStore.$patch({
    overlay: 'NavEdit',
    overlayOpts: {
      mode: state.mode,
      // -> A menu this page does not own: only Inherit edits one, and only away from the root, where
      //    inheriting and owning are the same menu. See NavEditOverlay's `navId`.
      ...(!isRoot.value && state.mode === 'inherit' && { navId: state.inheritedNavId })
    }
  })
  props.menuHideHandler()
}

async function save() {
  state.loading++
  try {
    // -> Only the mode: the menu items themselves are what the overlay saves
    const resp = await API_CLIENT.put(`sites/${siteStore.id}/navigation/pages/${pageStore.id}`, {
      json: { mode: state.mode }
    }).json()
    // -> The API client does not throw on 400, so a refusal comes back as a parsed error
    if (resp?.ok === false) {
      throw new Error(resp.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('navEdit.saveModeSuccess')
    })
    // -> Patching the id is what makes the sidebar reload: it watches this and refetches the menu the
    //    page now resolves to
    pageStore.$patch({
      navigationMode: state.mode,
      navigationId: resp.navigationId ?? null
    })
    props.menuHideHandler()
  } catch (err) {
    notify({
      type: 'negative',
      message: apiErrorMessage(err)
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  state.mode = pageStore.navigationMode
  if (!isRoot.value) {
    loadInheritedNav()
  }
})
</script>
