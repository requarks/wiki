<template lang='pug'>
  v-card.wiki-form
    v-toolbar(flat, color='primary', dark, dense)
      .subheading {{ $t('admin:utilities.importv1Title') }}
    v-card-text
      .text-xs-center
        img.animated.fadeInUp.wait-p1s(src='/svg/icon-software.svg')
        .body-2 Import from Wiki.js 1.x
      v-divider.my-4
      .body-1 Data from a Wiki.js 1.x installation can be imported easily using this tool. What do you want to import?
      v-checkbox(
        label='Content'
        value='content'
        color='deep-orange darken-2'
        v-model='importFilters'
        hide-details
      )
      v-checkbox(
        label='Uploads'
        value='uploads'
        color='deep-orange darken-2'
        v-model='importFilters'
        hide-details
      )
      v-checkbox(
        label='Users'
        value='users'
        color='deep-orange darken-2'
        v-model='importFilters'
        hide-details
      )
      v-divider.my-3
      v-text-field.mt-3(
        outline
        label='MongoDB Connection String'
        hint='The connection string to connect to the Wiki.js 1.x MongoDB database.'
        persistent-hint
        v-model='dbConnStr'
        v-if='needDB'
      )
      v-text-field.mt-3(
        outline
        label='Content Repo Path'
        hint='The full path to where the Wiki.js 1.x content is stored on disk.'
        persistent-hint
        v-model='contentPath'
        v-if='needDisk'
      )
    v-card-chin
      v-btn(depressed, color='deep-orange darken-2', :disabled='!needDB && !needDisk').ml-0
        v-icon(left, color='white') label_important
        span.white--text Start Import
</template>

<script>
export default {
  data() {
    return {
      importFilters: ['content', 'uploads'],
      dbConnStr: 'mongodb://',
      contentPath: '/wiki-v1/repo'
    }
  },
  computed: {
    needDB() {
      return this.importFilters.indexOf('users') >= 0
    },
    needDisk() {
      return this.importFilters.indexOf('content') >= 0 || this.importFilters.indexOf('uploads') >= 0
    }
  }
}
</script>

<style lang='scss'>

</style>
