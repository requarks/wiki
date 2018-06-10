<template lang='pug'>
  v-card(flat)
    v-card(flat, :color='$vuetify.dark ? "grey darken-4" : "grey lighten-5"').pa-3.pt-4
      .headline.primary--text Storage
      .subheading.grey--text Set backup and sync targets for your content
    v-tabs(:color='$vuetify.dark ? "primary" : "grey lighten-4"', fixed-tabs, :slider-color='$vuetify.dark ? "white" : "primary"', show-arrows)
      v-tab(key='settings'): v-icon settings
      v-tab(key='local') Local FS
      v-tab(key='git') Git
      v-tab(key='s3') Amazon S3
      v-tab(key='azure') Azure Blob Storage
      v-tab(key='digitalocean') DigitalOcean Spaces
      v-tab(key='dropbox') Dropbox
      v-tab(key='gdrive') Google Drive
      v-tab(key='onedrive') OneDrive
      v-tab(key='scp') SCP (SSH)

      v-tab-item(key='settings')
        v-card.pa-3
          v-form
            v-checkbox(
              v-for='(target, n) in targets',
              v-model='auths',
              :key='n',
              :label='target.text',
              :value='target.value',
              color='primary',
              hide-details
            )
            v-divider
            v-btn(color='primary')
              v-icon(left) chevron_right
              | Set Backup Targets

</template>

<script>
export default {
  data() {
    return {
      targets: [
        { text: 'Local Filesystem', value: 'local' },
        { text: 'Git', value: 'auth0' },
        { text: 'Amazon S3', value: 'algolia' },
        { text: 'Azure Blob Storage', value: 'elasticsearch' },
        { text: 'DigitalOcean Spaces', value: 'solr' },
        { text: 'Dropbox', value: 'solr' },
        { text: 'Google Drive', value: 'solr' },
        { text: 'OneDrive', value: 'solr' },
        { text: 'SCP (SSH)', value: 'solr' }
      ],
      auths: ['local']
    }
  }
}
</script>

<style lang='scss'>

</style>
