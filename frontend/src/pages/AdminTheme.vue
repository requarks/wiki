<template>
  <w-page class="admin-theme">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon animated fadeInLeft"
          src="/_assets/icons/fluent-paint-roller-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.theme.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.theme.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/theme`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="load">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          unelevated
          icon="mdi:check"
          :label="t(`common.actions.apply`)"
          color="secondary"
          @click="save"
          :loading="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-6">
        <!-- ----------------------- -->
        <!-- Theme Options -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>
            {{ t('admin.theme.appearance') }}
            <template #action>
              <w-btn
                class="acrylic-btn"
                icon="la:redo-alt"
                :label="t(`admin.theme.resetDefaults`)"
                flat
                size="sm"
                color="pink"
                @click="resetColors" />
            </template>
          </w-card-header>
          <w-item tag="label">
            <blueprint-icon icon="light-on" />
            <w-item-section>
              <w-item-label>{{ t(`admin.theme.darkMode`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.theme.darkModeHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle v-model="state.config.dark" :aria-label="t(`admin.theme.darkMode`)" />
            </w-item-section>
          </w-item>
          <template v-for="cl of colorKeys" :key="cl">
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="fill-color" />
              <w-item-section>
                <w-item-label>{{ t(`admin.theme.` + cl + `Color`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.theme.` + cl + `ColorHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section side>
                <div class="text-caption text-grey-6">
                  {{ state.config[`color` + startCase(cl)] }}
                </div>
              </w-item-section>
              <w-item-section side>
                <w-btn
                  class="mr-2"
                  :key="`btnpick-` + cl"
                  glossy
                  padding="xs md"
                  no-caps
                  size="sm"
                  :style="`background-color: ` + state.config[`color` + startCase(cl)] + `;`"
                  text-color="white">
                  <w-icon class="mr-2" name="la:fill" size="xs" />
                  <span>Pick...</span>
                  <w-menu
                    ><w-color-picker v-model="state.config[`color` + startCase(cl)]"
                  /></w-menu>
                </w-btn>
              </w-item-section>
            </w-item>
          </template>
        </w-card>
        <!-- ----------------------- -->
        <!-- Code Blocks -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>
            {{ t('admin.theme.codeBlocks') }}
            <template #action>
              <w-btn
                class="acrylic-btn"
                icon="la:redo-alt"
                :label="t(`admin.theme.resetDefaults`)"
                flat
                size="sm"
                color="pink"
                @click="resetCodeBlocks" />
            </template>
          </w-card-header>
          <w-item>
            <blueprint-icon icon="code" />
            <w-item-section>
              <w-item-label>{{ t(`admin.theme.codeBlocksAppearance`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.theme.codeBlocksAppearanceHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-select
                outlined
                v-model="state.config.codeBlocksTheme"
                :options="codeThemes"
                emit-value
                map-options
                dense
                options-dense
                :aria-label="t(`admin.theme.codeBlocksAppearance`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- Theme Layout -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.theme.layout') }}</w-card-header>
          <template v-if="flagStore.experimental">
            <w-item>
              <blueprint-icon icon="width" />
              <w-item-section>
                <w-item-label>{{ t(`admin.theme.contentWidth`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.theme.contentWidthHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section class="flex-none">
                <w-btn-toggle
                  v-model="state.config.contentWidth"
                  push
                  glossy
                  no-caps
                  toggle-color="primary"
                  :options="widthOptions" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
          </template>
          <w-item>
            <blueprint-icon icon="right-navigation-toolbar" />
            <w-item-section>
              <w-item-label>{{ t(`admin.theme.sidebarPosition`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.theme.sidebarPositionHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section class="flex-none">
              <w-btn-toggle
                v-model="state.config.sidebarPosition"
                push
                glossy
                no-caps
                toggle-color="primary"
                :options="rightLeftOptions" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="index" />
            <w-item-section>
              <w-item-label>{{ t(`admin.theme.tocPosition`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.theme.tocPositionHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section class="flex-none">
              <w-btn-toggle
                v-model="state.config.tocPosition"
                push
                glossy
                no-caps
                toggle-color="primary"
                :options="rightLeftOptions" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="share" />
            <w-item-section>
              <w-item-label>{{ t(`admin.theme.showSharingMenu`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.theme.showSharingMenuHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.showSharingMenu"
                :aria-label="t(`admin.theme.showSharingMenu`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="print" />
            <w-item-section>
              <w-item-label>{{ t(`admin.theme.showPrintBtn`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.theme.showPrintBtnHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.showPrintBtn"
                :aria-label="t(`admin.theme.showPrintBtn`)" />
            </w-item-section>
          </w-item>
        </w-card>
      </div>
      <div class="col-span-6">
        <!-- ----------------------- -->
        <!-- Fonts -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>
            {{ t('admin.theme.fonts') }}
            <template #action>
              <w-btn
                class="acrylic-btn"
                icon="la:redo-alt"
                :label="t(`admin.theme.resetDefaults`)"
                flat
                size="sm"
                color="pink"
                @click="resetFonts" />
            </template>
          </w-card-header>
          <w-item>
            <blueprint-icon icon="fonts-app" />
            <w-item-section>
              <w-item-label>{{ t(`admin.theme.baseFont`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.theme.baseFontHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-select
                outlined
                v-model="state.config.baseFont"
                :options="fonts"
                emit-value
                map-options
                dense
                :aria-label="t(`admin.theme.baseFont`)" />
            </w-item-section>
          </w-item>
          <w-item>
            <blueprint-icon icon="fonts-app" />
            <w-item-section>
              <w-item-label>{{ t(`admin.theme.contentFont`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.theme.contentFontHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-select
                outlined
                v-model="state.config.contentFont"
                :options="fonts"
                emit-value
                map-options
                dense
                :aria-label="t(`admin.theme.contentFont`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- Code Injection -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.theme.codeInjection') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="css" />
            <w-item-section>
              <w-item-label>{{ t(`admin.theme.cssOverride`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.theme.cssOverrideHint`) }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-item>
            <w-item-section>
              <util-code-editor
                v-model="state.config.injectCSS"
                language="css"
                :aria-label="t(`admin.theme.cssOverride`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="html" />
            <w-item-section>
              <w-item-label>{{ t(`admin.theme.headHtmlInjection`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.theme.headHtmlInjectionHint`) }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-item>
            <w-item-section>
              <util-code-editor
                v-model="state.config.injectHead"
                language="html"
                :aria-label="t(`admin.theme.headHtmlInjection`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="html" />
            <w-item-section>
              <w-item-label>{{ t(`admin.theme.bodyHtmlInjection`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.theme.bodyHtmlInjectionHint`) }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-item>
            <w-item-section>
              <util-code-editor
                v-model="state.config.injectBody"
                language="html"
                :aria-label="t(`admin.theme.bodyHtmlInjection`)" />
            </w-item-section>
          </w-item>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, reactive, watch } from 'vue'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import { useAdminStore } from '@/stores/admin'
import { useFlagsStore } from '@/stores/flags'
import { useSiteStore } from '@/stores/site'

import { toMerged } from 'es-toolkit/object'
import { startCase } from 'es-toolkit/string'
import UtilCodeEditor from '../components/UtilCodeEditor.vue'

// STORES

const adminStore = useAdminStore()
const flagStore = useFlagsStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.theme.title')
})

// DATA

/**
 * Fallbacks for theme keys a site may not have stored yet, so that every control renders with a
 * defined value. Must mirror the theme defaults used by the backend when creating a site.
 */
function defaultConfig() {
  return {
    dark: false,
    injectCSS: '',
    injectHead: '',
    injectBody: '',
    colorPrimary: '#1976D2',
    colorSecondary: '#02C39A',
    colorAccent: '#FF9800',
    colorHeader: '#000000',
    colorSidebar: '#1976D2',
    codeBlocksTheme: 'github-dark',
    contentWidth: 'full',
    sidebarPosition: 'left',
    tocPosition: 'right',
    showSharingMenu: true,
    showPrintBtn: true,
    baseFont: 'roboto',
    contentFont: 'roboto'
  }
}

const state = reactive({
  loading: 0,
  config: defaultConfig()
})

const colorKeys = ['primary', 'secondary', 'accent', 'header', 'sidebar']

const widthOptions = [
  { label: 'Full Width', value: 'full' },
  { label: 'Centered', value: 'centered' }
]

const rightLeftOptions = [
  { label: 'Hide', value: 'off' },
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' }
]

const fonts = [
  { label: 'Inter', value: 'inter' },
  { label: 'Open Sans', value: 'opensans' },
  { label: 'Montserrat', value: 'montserrat' },
  { label: 'Roboto', value: 'roboto' },
  { label: 'Rubik', value: 'rubik' },
  { label: 'Tajawal', value: 'tajawal' },
  { label: 'User System Defaults', value: 'user' }
]

const codeThemes = [
  { label: 'A 11 Y Dark', value: 'a11y-dark' },
  { label: 'A 11 Y Light', value: 'a11y-light' },
  { label: 'Agate', value: 'agate' },
  { label: 'An Old Hope', value: 'an-old-hope' },
  { label: 'Androidstudio', value: 'androidstudio' },
  { label: 'Arduino Light', value: 'arduino-light' },
  { label: 'Arta', value: 'arta' },
  { label: 'Ascetic', value: 'ascetic' },
  { label: 'Atom One Dark', value: 'atom-one-dark' },
  { label: 'Atom One Dark Reasonable', value: 'atom-one-dark-reasonable' },
  { label: 'Atom One Light', value: 'atom-one-light' },
  { label: 'Base16 / 3024', value: 'base16/3024' },
  { label: 'Base16 / Apathy', value: 'base16/apathy' },
  { label: 'Base16 / Apprentice', value: 'base16/apprentice' },
  { label: 'Base16 / Ashes', value: 'base16/ashes' },
  { label: 'Base16 / Atelier Cave', value: 'base16/atelier-cave' },
  { label: 'Base16 / Atelier Cave Light', value: 'base16/atelier-cave-light' },
  { label: 'Base16 / Atelier Dune', value: 'base16/atelier-dune' },
  { label: 'Base16 / Atelier Dune Light', value: 'base16/atelier-dune-light' },
  { label: 'Base16 / Atelier Estuary', value: 'base16/atelier-estuary' },
  { label: 'Base16 / Atelier Estuary Light', value: 'base16/atelier-estuary-light' },
  { label: 'Base16 / Atelier Forest', value: 'base16/atelier-forest' },
  { label: 'Base16 / Atelier Forest Light', value: 'base16/atelier-forest-light' },
  { label: 'Base16 / Atelier Heath', value: 'base16/atelier-heath' },
  { label: 'Base16 / Atelier Heath Light', value: 'base16/atelier-heath-light' },
  { label: 'Base16 / Atelier Lakeside', value: 'base16/atelier-lakeside' },
  { label: 'Base16 / Atelier Lakeside Light', value: 'base16/atelier-lakeside-light' },
  { label: 'Base16 / Atelier Plateau', value: 'base16/atelier-plateau' },
  { label: 'Base16 / Atelier Plateau Light', value: 'base16/atelier-plateau-light' },
  { label: 'Base16 / Atelier Savanna', value: 'base16/atelier-savanna' },
  { label: 'Base16 / Atelier Savanna Light', value: 'base16/atelier-savanna-light' },
  { label: 'Base16 / Atelier Seaside', value: 'base16/atelier-seaside' },
  { label: 'Base16 / Atelier Seaside Light', value: 'base16/atelier-seaside-light' },
  { label: 'Base16 / Atelier Sulphurpool', value: 'base16/atelier-sulphurpool' },
  { label: 'Base16 / Atelier Sulphurpool Light', value: 'base16/atelier-sulphurpool-light' },
  { label: 'Base16 / Atlas', value: 'base16/atlas' },
  { label: 'Base16 / Bespin', value: 'base16/bespin' },
  { label: 'Base16 / Black Metal', value: 'base16/black-metal' },
  { label: 'Base16 / Black Metal Bathory', value: 'base16/black-metal-bathory' },
  { label: 'Base16 / Black Metal Burzum', value: 'base16/black-metal-burzum' },
  { label: 'Base16 / Black Metal Dark Funeral', value: 'base16/black-metal-dark-funeral' },
  { label: 'Base16 / Black Metal Gorgoroth', value: 'base16/black-metal-gorgoroth' },
  { label: 'Base16 / Black Metal Immortal', value: 'base16/black-metal-immortal' },
  { label: 'Base16 / Black Metal Khold', value: 'base16/black-metal-khold' },
  { label: 'Base16 / Black Metal Marduk', value: 'base16/black-metal-marduk' },
  { label: 'Base16 / Black Metal Mayhem', value: 'base16/black-metal-mayhem' },
  { label: 'Base16 / Black Metal Nile', value: 'base16/black-metal-nile' },
  { label: 'Base16 / Black Metal Venom', value: 'base16/black-metal-venom' },
  { label: 'Base16 / Brewer', value: 'base16/brewer' },
  { label: 'Base16 / Bright', value: 'base16/bright' },
  { label: 'Base16 / Brogrammer', value: 'base16/brogrammer' },
  { label: 'Base16 / Brush Trees', value: 'base16/brush-trees' },
  { label: 'Base16 / Brush Trees Dark', value: 'base16/brush-trees-dark' },
  { label: 'Base16 / Chalk', value: 'base16/chalk' },
  { label: 'Base16 / Circus', value: 'base16/circus' },
  { label: 'Base16 / Classic Dark', value: 'base16/classic-dark' },
  { label: 'Base16 / Classic Light', value: 'base16/classic-light' },
  { label: 'Base16 / Codeschool', value: 'base16/codeschool' },
  { label: 'Base16 / Colors', value: 'base16/colors' },
  { label: 'Base16 / Cupcake', value: 'base16/cupcake' },
  { label: 'Base16 / Cupertino', value: 'base16/cupertino' },
  { label: 'Base16 / Danqing', value: 'base16/danqing' },
  { label: 'Base16 / Darcula', value: 'base16/darcula' },
  { label: 'Base16 / Dark Violet', value: 'base16/dark-violet' },
  { label: 'Base16 / Darkmoss', value: 'base16/darkmoss' },
  { label: 'Base16 / Darktooth', value: 'base16/darktooth' },
  { label: 'Base16 / Decaf', value: 'base16/decaf' },
  { label: 'Base16 / Default Dark', value: 'base16/default-dark' },
  { label: 'Base16 / Default Light', value: 'base16/default-light' },
  { label: 'Base16 / Dirtysea', value: 'base16/dirtysea' },
  { label: 'Base16 / Dracula', value: 'base16/dracula' },
  { label: 'Base16 / Edge Dark', value: 'base16/edge-dark' },
  { label: 'Base16 / Edge Light', value: 'base16/edge-light' },
  { label: 'Base16 / Eighties', value: 'base16/eighties' },
  { label: 'Base16 / Embers', value: 'base16/embers' },
  { label: 'Base16 / Equilibrium Dark', value: 'base16/equilibrium-dark' },
  { label: 'Base16 / Equilibrium Gray Dark', value: 'base16/equilibrium-gray-dark' },
  { label: 'Base16 / Equilibrium Gray Light', value: 'base16/equilibrium-gray-light' },
  { label: 'Base16 / Equilibrium Light', value: 'base16/equilibrium-light' },
  { label: 'Base16 / Espresso', value: 'base16/espresso' },
  { label: 'Base16 / Eva', value: 'base16/eva' },
  { label: 'Base16 / Eva Dim', value: 'base16/eva-dim' },
  { label: 'Base16 / Flat', value: 'base16/flat' },
  { label: 'Base16 / Framer', value: 'base16/framer' },
  { label: 'Base16 / Fruit Soda', value: 'base16/fruit-soda' },
  { label: 'Base16 / Gigavolt', value: 'base16/gigavolt' },
  { label: 'Base16 / Github', value: 'base16/github' },
  { label: 'Base16 / Google Dark', value: 'base16/google-dark' },
  { label: 'Base16 / Google Light', value: 'base16/google-light' },
  { label: 'Base16 / Grayscale Dark', value: 'base16/grayscale-dark' },
  { label: 'Base16 / Grayscale Light', value: 'base16/grayscale-light' },
  { label: 'Base16 / Green Screen', value: 'base16/green-screen' },
  { label: 'Base16 / Gruvbox Dark Hard', value: 'base16/gruvbox-dark-hard' },
  { label: 'Base16 / Gruvbox Dark Medium', value: 'base16/gruvbox-dark-medium' },
  { label: 'Base16 / Gruvbox Dark Pale', value: 'base16/gruvbox-dark-pale' },
  { label: 'Base16 / Gruvbox Dark Soft', value: 'base16/gruvbox-dark-soft' },
  { label: 'Base16 / Gruvbox Light Hard', value: 'base16/gruvbox-light-hard' },
  { label: 'Base16 / Gruvbox Light Medium', value: 'base16/gruvbox-light-medium' },
  { label: 'Base16 / Gruvbox Light Soft', value: 'base16/gruvbox-light-soft' },
  { label: 'Base16 / Hardcore', value: 'base16/hardcore' },
  { label: 'Base16 / Harmonic 16 Dark', value: 'base16/harmonic16-dark' },
  { label: 'Base16 / Harmonic 16 Light', value: 'base16/harmonic16-light' },
  { label: 'Base16 / Heetch Dark', value: 'base16/heetch-dark' },
  { label: 'Base16 / Heetch Light', value: 'base16/heetch-light' },
  { label: 'Base16 / Helios', value: 'base16/helios' },
  { label: 'Base16 / Hopscotch', value: 'base16/hopscotch' },
  { label: 'Base16 / Horizon Dark', value: 'base16/horizon-dark' },
  { label: 'Base16 / Horizon Light', value: 'base16/horizon-light' },
  { label: 'Base16 / Humanoid Dark', value: 'base16/humanoid-dark' },
  { label: 'Base16 / Humanoid Light', value: 'base16/humanoid-light' },
  { label: 'Base16 / Ia Dark', value: 'base16/ia-dark' },
  { label: 'Base16 / Ia Light', value: 'base16/ia-light' },
  { label: 'Base16 / Icy Dark', value: 'base16/icy-dark' },
  { label: 'Base16 / Ir Black', value: 'base16/ir-black' },
  { label: 'Base16 / Isotope', value: 'base16/isotope' },
  { label: 'Base16 / Kimber', value: 'base16/kimber' },
  { label: 'Base16 / London Tube', value: 'base16/london-tube' },
  { label: 'Base16 / Macintosh', value: 'base16/macintosh' },
  { label: 'Base16 / Marrakesh', value: 'base16/marrakesh' },
  { label: 'Base16 / Materia', value: 'base16/materia' },
  { label: 'Base16 / Material', value: 'base16/material' },
  { label: 'Base16 / Material Darker', value: 'base16/material-darker' },
  { label: 'Base16 / Material Lighter', value: 'base16/material-lighter' },
  { label: 'Base16 / Material Palenight', value: 'base16/material-palenight' },
  { label: 'Base16 / Material Vivid', value: 'base16/material-vivid' },
  { label: 'Base16 / Mellow Purple', value: 'base16/mellow-purple' },
  { label: 'Base16 / Mexico Light', value: 'base16/mexico-light' },
  { label: 'Base16 / Mocha', value: 'base16/mocha' },
  { label: 'Base16 / Monokai', value: 'base16/monokai' },
  { label: 'Base16 / Nebula', value: 'base16/nebula' },
  { label: 'Base16 / Nord', value: 'base16/nord' },
  { label: 'Base16 / Nova', value: 'base16/nova' },
  { label: 'Base16 / Ocean', value: 'base16/ocean' },
  { label: 'Base16 / Oceanicnext', value: 'base16/oceanicnext' },
  { label: 'Base16 / One Light', value: 'base16/one-light' },
  { label: 'Base16 / Onedark', value: 'base16/onedark' },
  { label: 'Base16 / Outrun Dark', value: 'base16/outrun-dark' },
  { label: 'Base16 / Papercolor Dark', value: 'base16/papercolor-dark' },
  { label: 'Base16 / Papercolor Light', value: 'base16/papercolor-light' },
  { label: 'Base16 / Paraiso', value: 'base16/paraiso' },
  { label: 'Base16 / Pasque', value: 'base16/pasque' },
  { label: 'Base16 / Phd', value: 'base16/phd' },
  { label: 'Base16 / Pico', value: 'base16/pico' },
  { label: 'Base16 / Pop', value: 'base16/pop' },
  { label: 'Base16 / Porple', value: 'base16/porple' },
  { label: 'Base16 / Qualia', value: 'base16/qualia' },
  { label: 'Base16 / Railscasts', value: 'base16/railscasts' },
  { label: 'Base16 / Rebecca', value: 'base16/rebecca' },
  { label: 'Base16 / Ros Pine', value: 'base16/ros-pine' },
  { label: 'Base16 / Ros Pine Dawn', value: 'base16/ros-pine-dawn' },
  { label: 'Base16 / Ros Pine Moon', value: 'base16/ros-pine-moon' },
  { label: 'Base16 / Sagelight', value: 'base16/sagelight' },
  { label: 'Base16 / Sandcastle', value: 'base16/sandcastle' },
  { label: 'Base16 / Seti Ui', value: 'base16/seti-ui' },
  { label: 'Base16 / Shapeshifter', value: 'base16/shapeshifter' },
  { label: 'Base16 / Silk Dark', value: 'base16/silk-dark' },
  { label: 'Base16 / Silk Light', value: 'base16/silk-light' },
  { label: 'Base16 / Snazzy', value: 'base16/snazzy' },
  { label: 'Base16 / Solar Flare', value: 'base16/solar-flare' },
  { label: 'Base16 / Solar Flare Light', value: 'base16/solar-flare-light' },
  { label: 'Base16 / Solarized Dark', value: 'base16/solarized-dark' },
  { label: 'Base16 / Solarized Light', value: 'base16/solarized-light' },
  { label: 'Base16 / Spacemacs', value: 'base16/spacemacs' },
  { label: 'Base16 / Summercamp', value: 'base16/summercamp' },
  { label: 'Base16 / Summerfruit Dark', value: 'base16/summerfruit-dark' },
  { label: 'Base16 / Summerfruit Light', value: 'base16/summerfruit-light' },
  { label: 'Base16 / Synth Midnight Terminal Dark', value: 'base16/synth-midnight-terminal-dark' },
  {
    label: 'Base16 / Synth Midnight Terminal Light',
    value: 'base16/synth-midnight-terminal-light'
  },
  { label: 'Base16 / Tango', value: 'base16/tango' },
  { label: 'Base16 / Tender', value: 'base16/tender' },
  { label: 'Base16 / Tomorrow', value: 'base16/tomorrow' },
  { label: 'Base16 / Tomorrow Night', value: 'base16/tomorrow-night' },
  { label: 'Base16 / Twilight', value: 'base16/twilight' },
  { label: 'Base16 / Unikitty Dark', value: 'base16/unikitty-dark' },
  { label: 'Base16 / Unikitty Light', value: 'base16/unikitty-light' },
  { label: 'Base16 / Vulcan', value: 'base16/vulcan' },
  { label: 'Base16 / Windows 10', value: 'base16/windows-10' },
  { label: 'Base16 / Windows 10 Light', value: 'base16/windows-10-light' },
  { label: 'Base16 / Windows 95', value: 'base16/windows-95' },
  { label: 'Base16 / Windows 95 Light', value: 'base16/windows-95-light' },
  { label: 'Base16 / Windows High Contrast', value: 'base16/windows-high-contrast' },
  { label: 'Base16 / Windows High Contrast Light', value: 'base16/windows-high-contrast-light' },
  { label: 'Base16 / Windows Nt', value: 'base16/windows-nt' },
  { label: 'Base16 / Windows Nt Light', value: 'base16/windows-nt-light' },
  { label: 'Base16 / Woodland', value: 'base16/woodland' },
  { label: 'Base16 / Xcode Dusk', value: 'base16/xcode-dusk' },
  { label: 'Base16 / Zenburn', value: 'base16/zenburn' },
  { label: 'Brown Paper', value: 'brown-paper' },
  { label: 'Codepen Embed', value: 'codepen-embed' },
  { label: 'Color Brewer', value: 'color-brewer' },
  { label: 'Dark', value: 'dark' },
  { label: 'Devibeans', value: 'devibeans' },
  { label: 'Docco', value: 'docco' },
  { label: 'Far', value: 'far' },
  { label: 'Felipec', value: 'felipec' },
  { label: 'Foundation', value: 'foundation' },
  { label: 'Github', value: 'github' },
  { label: 'Github Dark', value: 'github-dark' },
  { label: 'Github Dark Dimmed', value: 'github-dark-dimmed' },
  { label: 'Gml', value: 'gml' },
  { label: 'Googlecode', value: 'googlecode' },
  { label: 'Gradient Dark', value: 'gradient-dark' },
  { label: 'Gradient Light', value: 'gradient-light' },
  { label: 'Grayscale', value: 'grayscale' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'Idea', value: 'idea' },
  { label: 'Intellij Light', value: 'intellij-light' },
  { label: 'Ir Black', value: 'ir-black' },
  { label: 'Isbl Editor Dark', value: 'isbl-editor-dark' },
  { label: 'Isbl Editor Light', value: 'isbl-editor-light' },
  { label: 'Kimbie Dark', value: 'kimbie-dark' },
  { label: 'Kimbie Light', value: 'kimbie-light' },
  { label: 'Lightfair', value: 'lightfair' },
  { label: 'Lioshi', value: 'lioshi' },
  { label: 'Magula', value: 'magula' },
  { label: 'Mono Blue', value: 'mono-blue' },
  { label: 'Monokai', value: 'monokai' },
  { label: 'Monokai Sublime', value: 'monokai-sublime' },
  { label: 'Night Owl', value: 'night-owl' },
  { label: 'Nnfx Dark', value: 'nnfx-dark' },
  { label: 'Nnfx Light', value: 'nnfx-light' },
  { label: 'Nord', value: 'nord' },
  { label: 'Obsidian', value: 'obsidian' },
  { label: 'Panda Syntax Dark', value: 'panda-syntax-dark' },
  { label: 'Panda Syntax Light', value: 'panda-syntax-light' },
  { label: 'Paraiso Dark', value: 'paraiso-dark' },
  { label: 'Paraiso Light', value: 'paraiso-light' },
  { label: 'Pojoaque', value: 'pojoaque' },
  { label: 'Purebasic', value: 'purebasic' },
  { label: 'Qtcreator Dark', value: 'qtcreator-dark' },
  { label: 'Qtcreator Light', value: 'qtcreator-light' },
  { label: 'Rainbow', value: 'rainbow' },
  { label: 'Routeros', value: 'routeros' },
  { label: 'School Book', value: 'school-book' },
  { label: 'Shades Of Purple', value: 'shades-of-purple' },
  { label: 'Srcery', value: 'srcery' },
  { label: 'Stackoverflow Dark', value: 'stackoverflow-dark' },
  { label: 'Stackoverflow Light', value: 'stackoverflow-light' },
  { label: 'Sunburst', value: 'sunburst' },
  { label: 'Tokyo Night Dark', value: 'tokyo-night-dark' },
  { label: 'Tokyo Night Light', value: 'tokyo-night-light' },
  { label: 'Tomorrow Night Blue', value: 'tomorrow-night-blue' },
  { label: 'Tomorrow Night Bright', value: 'tomorrow-night-bright' },
  { label: 'Vs', value: 'vs' },
  { label: 'Vs 2015', value: 'vs2015' },
  { label: 'Xcode', value: 'xcode' },
  { label: 'Xt 256', value: 'xt256' }
]

// WATCHERS

watch(
  () => adminStore.currentSiteId,
  (newValue) => {
    load()
  }
)

// METHODS

function resetColors() {
  state.config.dark = false
  state.config.colorPrimary = '#1976D2'
  state.config.colorSecondary = '#02C39A'
  state.config.colorAccent = '#FF9800'
  state.config.colorHeader = '#000'
  state.config.colorSidebar = '#1976D2'
}

function resetFonts() {
  state.config.baseFont = 'roboto'
  state.config.contentFont = 'roboto'
}

function resetCodeBlocks() {
  state.config.codeBlocksTheme = 'github-dark'
}

async function load() {
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.get(`sites/${adminStore.currentSiteId}?strict=true`).json()
    if (!resp?.theme) {
      throw new Error('Failed to fetch theme config.')
    }
    state.config = toMerged(defaultConfig(), resp.theme)
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to fetch site theme config'
    })
  }
  loading.hide()
  state.loading--
}

async function save() {
  state.loading++
  try {
    const patchTheme = {
      dark: state.config.dark,
      codeBlocksTheme: state.config.codeBlocksTheme,
      colorPrimary: state.config.colorPrimary,
      colorSecondary: state.config.colorSecondary,
      colorAccent: state.config.colorAccent,
      colorHeader: state.config.colorHeader,
      colorSidebar: state.config.colorSidebar,
      injectCSS: state.config.injectCSS,
      injectHead: state.config.injectHead,
      injectBody: state.config.injectBody,
      contentWidth: state.config.contentWidth,
      sidebarPosition: state.config.sidebarPosition,
      tocPosition: state.config.tocPosition,
      showSharingMenu: state.config.showSharingMenu,
      showPrintBtn: state.config.showPrintBtn,
      baseFont: state.config.baseFont,
      contentFont: state.config.contentFont
    }
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}`, {
      json: {
        theme: patchTheme
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(
        t(`admin.theme.${resp?.error}`, resp?.message || 'An unexpected error occured.')
      )
    }
    if (adminStore.currentSiteId === siteStore.id) {
      siteStore.$patch({
        theme: patchTheme
      })
      EVENT_BUS.emit('applyTheme')
    }
    notify({
      type: 'positive',
      message: t('admin.theme.saveSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to save site theme config',
      caption: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  if (adminStore.currentSiteId) {
    load()
  }
})
</script>

<!-- -> The `.admin-theme-cm` rules that were here framed the old editor; UtilCodeEditor draws its own -->
