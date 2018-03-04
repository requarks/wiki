<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.primary--text Locale
        .subheading.grey--text Set localization options for your wiki
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='blue', dark, dense, flat)
                  v-toolbar-title
                    .subheading Locale
                  v-btn(fab, absolute, right, bottom, small, light): v-icon save
                v-card-text
                  v-select(:items='locales', prepend-icon='public', v-model='selectedLocale', label='Site Locale', persistent-hint, hint='All UI text elements will be displayed in selected language.')
                    template(slot='item', slot-scope='data')
                      v-list-tile-avatar
                        v-avatar.blue.white--text(tile, size='40', v-html='data.item.value.toUpperCase()')
                      v-list-tile-content
                        v-list-tile-title(v-html='data.item.text')
                        v-list-tile-sub-title(v-html='data.item.original')
                  v-divider
                  v-switch(v-model='rtlEnabled', label='RTL Text Display', color='primary', persistent-hint, hint='For Right-to-Left languages, e.g. Arabic')
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='blue', dark, dense, flat)
                  v-toolbar-title
                    .subheading Download Locale
                v-list
                  v-list-tile(@click='')
                    v-list-tile-avatar
                      v-avatar.blue.white--text(tile, size='40') ZH
                    v-list-tile-content
                      v-list-tile-title Chinese
                      v-list-tile-sub-title 中文
                    v-list-tile-action
                      v-btn(icon)
                        v-icon.grey--text cloud_download
                  v-list-tile(@click='')
                    v-list-tile-avatar
                      v-avatar.blue.white--text(tile, size='40') EN
                    v-list-tile-content
                      v-list-tile-title English
                      v-list-tile-sub-title English
                    v-list-tile-action
                      v-icon.green--text check
                  v-list-tile(@click='')
                    v-list-tile-avatar
                      v-avatar.blue.white--text(tile, size='40') FR
                    v-list-tile-content
                      v-list-tile-title French
                      v-list-tile-sub-title Français
                    v-list-tile-action
                      v-icon.green--text check
                  v-list-tile(@click='')
                    v-list-tile-avatar
                      v-avatar.blue.white--text(tile, size='40') RU
                    v-list-tile-content
                      v-list-tile-title Russian
                      v-list-tile-sub-title Русский
                    v-list-tile-action
                      v-btn(icon)
                        v-icon.blue--text update
</template>

<script>
export default {
  data() {
    return {
      locales: [
        { text: 'English', original: 'English', value: 'en' },
        { text: 'French', original: 'Français', value: 'fr' }
      ],
      selectedLocale: 'en',
      rtlEnabled: false
    }
  }
}
</script>

<style lang='scss'>

</style>
