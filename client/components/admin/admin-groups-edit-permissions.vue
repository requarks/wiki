<template lang="pug">
  v-card(flat)
    v-container.px-3.pb-3.pt-3(fluid, grid-list-md)
      v-layout(row, wrap)
        v-flex(xs12, v-if='group.isSystem')
          v-alert.radius-7.mb-0(
            color='orange darken-2'
            :class='$vuetify.theme.dark ? "grey darken-4" : "orange lighten-5"'
            outlined
            :value='true'
            icon='mdi-lock-outline'
            ) This is a system group. Some permissions cannot be modified.
        v-flex(xs12, md6, lg4, v-for='pmGroup in permissions', :key='pmGroup.category')
          v-card.md2(flat, :class='$vuetify.theme.dark ? "grey darken-3-d5" : "grey lighten-5"')
            .overline.px-5.pt-5.pb-3.grey--text.text--darken-2 {{pmGroup.category}}
            v-card-text.pt-0
              template(v-for='(pm, idx) in pmGroup.items')
                v-checkbox.pt-0(
                  style='justify-content: space-between;'
                  :key='pm.permission'
                  :label='pm.permission'
                  :hint='pm.hint'
                  persistent-hint
                  color='primary'
                  v-model='group.permissions'
                  :value='pm.permission'
                  :append-icon='pm.warning ? "mdi-alert" : null',
                  :disabled='(group.isSystem && pm.restrictedForSystem) || group.id === 1 || pm.disabled'
                )
                v-divider.mt-3(v-if='idx < pmGroup.items.length - 1')
</template>

<script>
export default {
  props: {
    value: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    function preparePermission(permission, hint, opts = {}) {
      return {
        permission,
        hint,
        warning: opts.warning || false,
        restrictedForSystem: opts.restrictedForSystem || false,
        disabled: opts.disabled || false,
        userPerm: opts.userPerm || false
      }
    }

    return {
      permissions: [
        {
          category: 'Content',
          items: [
            preparePermission('read:pages', 'Can view pages, as specified in the Page Rules'),
            preparePermission('write:pages', 'Can create / edit pages, as specified in the Page Rules', { restrictedForSystem: true }),
            preparePermission('manage:pages', 'Can move existing pages as specified in the Page Rules', { restrictedForSystem: true }),
            preparePermission('delete:pages', 'Can delete existing pages, as specified in the Page Rules', { restrictedForSystem: true }),
            preparePermission('write:styles', 'Can insert CSS styles in pages, as specified in the Page Rules', { restrictedForSystem: true }),
            preparePermission('read:source', 'Can view pages source, as specified in the Page Rules'),
            preparePermission('read:history', 'Can view pages history, as specified in the Page Rules'),
            preparePermission('read:assets', 'Can view / use assets (such as images and files), as specified in the Page Rules'),
            preparePermission('write:assets', 'Can upload new assets (such as images and files), as specified in the Page Rules', { restrictedForSystem: true }),
            preparePermission('manage:assets', 'Can edit and delete existing assets (such as images and files), as specified in the Page Rules', { restrictedForSystem: true }),
            preparePermission('read:comments', 'Can view comments, as specified in the Page Rules'),
            preparePermission('write:comments', 'Can post new comments, as specified in the Page Rules'),
            preparePermission('manage:own_comments', 'Can edit and delete own comments, as specified in the Page Rules', { restrictedForSystem: true })
          ]
        },
        {
          category: 'Sites',
          items: [
            preparePermission('manage:sites', 'Can manage the groups of one or more sites, add & remove users from the site(s)', { restrictedForSystem: true })
          ]
        },
        {
          category: 'Users',
          items: [
            // User Management (assignable by those with group management capabilities or system admin)
            preparePermission('write:users', 'Can create users (non-system operations)', { userPerm: true })
          ]
        }
      ]
    }
  },
  computed: {
    group: {
      get() { return this.value },
      set(val) { this.$set('input', val) }
    }
  }
}
</script>
