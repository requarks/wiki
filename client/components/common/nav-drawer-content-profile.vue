<template lang='pug'>
  v-list(dense, nav, :dark='drawerDark')
    v-list-item(to='/profile', color='primary', @click='onNavigate')
      v-list-item-action: v-icon mdi-face-profile
      v-list-item-content
        v-list-item-title {{$t('profile:title')}}
    v-list-item(to='/pages', color='primary', @click='onNavigate')
      v-list-item-action: v-icon mdi-file-document-outline
      v-list-item-content
        v-list-item-title {{$t('profile:pages.title')}}
</template>

<script>
export default {
  i18nOptions: { namespaces: 'profile' },
  computed: {
    drawerDark () {
      return this.$vuetify.breakpoint.smAndDown || this.$vuetify.theme.dark
    }
  },
  methods: {
    onNavigate () {
      this.$emit('navigate')
    }
  }
}
</script>
