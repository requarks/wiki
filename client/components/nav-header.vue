<template lang='pug'>
  v-toolbar(color='black', dark, app, clipped-left, fixed, flat)
    v-toolbar-side-icon(@click.native='')
    v-toolbar-title
      span.subheading Wiki.js
    v-spacer
    v-progress-circular.mr-3(indeterminate, color='blue')
    v-btn(icon)
      v-icon(color='grey') search
    v-btn(icon, @click.native='darkTheme = !darkTheme')
      v-icon(color='grey') settings
    v-menu(offset-y, min-width='300')
      v-btn(icon, slot='activator')
        v-icon(color='grey') account_circle
      v-list.py-0
        v-list-tile.py-3(avatar)
          v-list-tile-avatar
            v-avatar.red(:size='40'): span.white--text.subheading JD
          v-list-tile-content
            v-list-tile-title John Doe
            v-list-tile-sub-title john.doe@example.com
        v-divider.my-0
        v-list-tile(@click='')
          v-list-tile-action: v-icon(color='red') exit_to_app
          v-list-tile-title Logout
</template>

<script>
export default {

}
</script>

<style>

</style>
