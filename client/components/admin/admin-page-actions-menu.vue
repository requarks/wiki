<template>
  <span class="admin-page-actions-menu">
    <v-menu offset-y origin="top right" left>
      <template v-slot:activator="{ on, attrs }">
        <v-btn
          v-bind="attrs"
          v-on="on"
          class="admin-page-actions-menu__btn"
          :class="iconOnly ? '' : 'animated fadeInDown wait-p2s'"
          :color="iconOnly ? 'grey' : 'black'"
          :dark="!iconOnly"
          :depressed="!iconOnly"
          :icon="iconOnly"
          :outlined="iconOnly"
          :x-small="iconOnly"
        >
          <span v-if="!iconOnly">Actions</span>
          <v-icon v-if="!iconOnly" right>mdi-chevron-down</v-icon>
          <v-icon v-else small>mdi-dots-vertical</v-icon>
        </v-btn>
      </template>
      <v-list dense nav>
        <v-list-item :href="'/' + adminPage.locale + '/' + adminPage.path">
          <v-list-item-icon>
            <v-icon color="indigo">mdi-text-subject</v-icon>
          </v-list-item-icon>
          <v-list-item-title>View</v-list-item-title>
        </v-list-item>
        <v-list-item :href="'/e/' + adminPage.locale + '/' + adminPage.path">
          <v-list-item-icon>
            <v-icon color="indigo">mdi-pencil</v-icon>
          </v-list-item-icon>
          <v-list-item-title>Edit</v-list-item-title>
        </v-list-item>
        <v-list-item :href="'/s/' + adminPage.locale + '/' + adminPage.path">
          <v-list-item-icon>
            <v-icon color="indigo">mdi-code-tags</v-icon>
          </v-list-item-icon>
          <v-list-item-title>View Source</v-list-item-title>
        </v-list-item>
        <v-list-item :href="'/h/' + adminPage.locale + '/' + adminPage.path">
          <v-list-item-icon>
            <v-icon color="indigo">mdi-history</v-icon>
          </v-list-item-icon>
          <v-list-item-title>View History</v-list-item-title>
        </v-list-item>
        <v-list-item @click="$emit('request-delete')">
          <v-list-item-icon>
            <v-icon color="red">mdi-trash-can-outline</v-icon>
          </v-list-item-icon>
          <v-list-item-title>Delete</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </span>
</template>

<script>
export default {
  props: {
    adminPage: { type: Object, required: true },
    iconOnly: { type: Boolean, default: false }
  }
}
</script>

<style lang="scss" scoped>
.admin-page-actions-menu {
  display: flex;
  flex-shrink: 0;
  min-width: 0;

  &__btn {
    flex-shrink: 0;
  }
}
</style>
