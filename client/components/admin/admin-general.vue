<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.primary--text General
        .subheading.grey--text Main settings of your wiki
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-form
                v-card
                  v-toolbar(color='primary', dark, dense, flat)
                    v-toolbar-title
                      .subheading Site Info
                  v-subheader General
                  .px-3
                    v-text-field(label='Site Title', required, :counter='50', v-model='siteTitle', prepend-icon='public')
                    v-divider
                  v-subheader SEO
                  .px-3
                    v-text-field(label='Site Description', :counter='255', prepend-icon='public')
                    v-text-field(label='Site Keywords', :counter='255', prepend-icon='public')
                    v-select(label='Meta Robots', chips, tags, :items='metaRobots', v-model='metaRobotsSelection', prepend-icon='public')
                  v-card-chin
                    v-spacer
                    v-btn(color='primary')
                      v-icon(left) chevron_right
                      span Save
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading Site Branding
                v-card-text
                  v-text-field(label='Logo', prepend-icon='image')
                  v-divider

</template>

<script>

export default {
  data() {
    return {
      siteTitle: 'Wiki.js',
      metaRobotsSelection: ['Index', 'Follow'],
      metaRobots: ['Index', 'Follow', 'No Index', 'No Follow']
    }
  }
}
</script>

<style lang='scss'>

</style>
