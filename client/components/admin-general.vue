<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.primary--text General
        .subheading.grey--text Main settings of your wiki
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='blue', dark, dense, flat)
                  v-toolbar-title
                    .subheading Site Info
                  v-btn(fab, absolute, right, bottom, small, light): v-icon save
                v-card-text
                  v-text-field(label='Site Title', required, :counter='50', v-model='siteTitle')
                  v-text-field(label='Site Description', :counter='255')
                  v-text-field(label='Site Keywords', :counter='255')
                  v-select(label='Meta Robots', chips, tags, :items='metaRobots', v-model='metaRobotsSelection')
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='blue', dark, dense, flat)
                  v-toolbar-title
                    .subheading Site Branding
                v-card-text ---

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
