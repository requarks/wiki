<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.primary--text Theme
        .subheading.grey--text Modify the look &amp; feel of your wiki
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading Theme
                v-card-text
                  v-select(:items='themes', prepend-icon='palette', v-model='selectedTheme', label='Site Theme', persistent-hint, hint='Themes affect how content pages are displayed. Other site sections (such as the editor or admin area) are not affected.')
                    template(slot='item', slot-scope='data')
                      v-list-tile-avatar
                        v-icon.blue--text(dark) filter_frames
                      v-list-tile-content
                        v-list-tile-title(v-html='data.item.text')
                        v-list-tile-sub-title(v-html='data.item.author')
                  v-divider
                  v-switch(v-model='darkMode', label='Dark Mode', color='primary', persistent-hint, hint='Not recommended for accessibility.')
                v-card-chin
                  v-spacer
                  v-btn(color='primary', :loading='loading', @click='save')
                    v-icon(left) chevron_right
                    span Save
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='teal', dark, dense, flat)
                  v-toolbar-title
                    .subheading Download Themes
                v-card-text.caption -- Coming soon --
</template>

<script>
export default {
  data() {
    return {
      themes: [
        { text: 'Default', author: 'requarks.io', value: 'default' }
      ],
      selectedTheme: 'default',
      darkMode: false
    }
  },
  watch: {
    darkMode(newValue, oldValue) {
      this.$store.commit('admin/setThemeDarkMode', newValue)
      console.info(this.$vuetify.dark)
    }
  }
}
</script>

<style lang='scss'>

</style>
