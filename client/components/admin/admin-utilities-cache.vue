<template lang='pug'>
  v-card
    v-toolbar(flat, color='primary', dark, dense)
      .subheading {{ $t('admin:utilities.cacheTitle') }}
    v-card-text
      v-subheader.pl-0 Flush Pages Cache
      .body-1 Pages are cached to disk for better performance. You can flush the cache to force all content to be fetched from the DB again.
      v-btn(outline, color='primary').ml-0.mt-3
        v-icon(left) build
        span Proceed
      v-divider.my-3
      v-subheader.pl-0 Flush Assets Cache
      .body-1 Assets such as images and other files are cached to disk for better performance. You can flush the cache to force all assets to be fetched from the DB again.
      v-btn(outline, color='primary').ml-0.mt-3
        v-icon(left) build
        span Proceed
      v-divider.my-3
      v-subheader.pl-0 Flush Temporary Uploads
      .body-1 New uploads are temporarily saved to disk while they are being processed. They are automatically deleted after processing, but you can force an immediate cleanup using this tool.
      v-btn(outline, color='primary').ml-0.mt-3
        v-icon(left) build
        span Proceed
</template>

<script>
export default {
}
</script>

<style lang='scss'>

</style>
