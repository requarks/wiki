<template lang="pug">
  v-dialog(v-model="dialog", :max-width="maxWidth", persistent, transition="dialog-bottom-transition")
    v-card
      v-toolbar(flat, dense, dark, color="white")
        v-spacer
        v-btn(icon, dark, @click="dialog = false")
          v-icon(color="black") mdi-close
      v-card-text
        v-img(:src="photoUrl", :alt="photoAlt", height="700px", contain)
      v-card-actions
        v-spacer
        v-btn(color="dark darken-1", text, @click="close") Close
</template>

<script>
export default {
  data() {
    return {
      dialog: false,
      photoUrl: '',
      photoAlt: '',
      maxWidth: '85%',
    };
  },
  methods: {
    open(photoUrl, photoAlt) {
      this.photoUrl = photoUrl;
      this.photoAlt = photoAlt;
      this.dialog = true;
    },
    close() {
      this.dialog = false;
    },
  },
  mounted() {
    this.$root.$on('openImageModal', (photoUrl, photoAlt) => {
      this.open(photoUrl, photoAlt);
    });
  },
};
</script>
