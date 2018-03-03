<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.blue--text.text--darken-2 Theme
        .subheading.grey--text Modify the look &amp; feel of your wiki
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='blue', dark, dense, flat)
                  v-toolbar-title
                    .subheading Theme
                  v-btn(fab, absolute, right, bottom, small, light): v-icon save
                v-card-text
                  v-select(:items='themes', prepend-icon='palette', v-model='selectedTheme', label='Site Theme', persistent-hint, hint='Themes affect how content pages are displayed. Other site sections (such as the editor or admin area) are not affected.')
                    template(slot='item', slot-scope='data')
                      v-list-tile-avatar
                        v-icon.blue--text(dark) filter_frames
                      v-list-tile-content
                        v-list-tile-title(v-html='data.item.text')
                        v-list-tile-sub-title(v-html='data.item.author')
                  v-divider
                  v-switch(v-model='darkMode', label='Dark Mode', color='blue darken-2', persistent-hint, hint='Not recommended for accessibility')
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='blue', dark, dense, flat)
                  v-toolbar-title
                    .subheading Theme Options
                v-list
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
  }
}
</script>

<style lang='scss'>

</style>
