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
            ) {{$t('admin:groups.banEditPermission')}}
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
                  :value='pm.value'
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
    return {
      permissions: [
        {
          category: this.$t('admin:permission.contentTitle'),
          items: [
            {
              value: 'read:pages',
              permission: this.$t('admin:permission.readPages'),
              hint: this.$t('admin:permission.readPagesHint'),
              warning: false,
              restrictedForSystem: false,
              disabled: false
            },
            {
              value: 'write:pages',
              permission: this.$t('admin:permission.writePages'),
              hint: this.$t('admin:permission.writePagesHint'),
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              value: 'manage:pages',
              permission: this.$t('admin:permission.managePages'),
              hint: this.$t('admin:permission.managePagesHint'),
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              value: 'delete:pages',
              permission: this.$t('admin:permission.deletePages'),
              hint: this.$t('admin:permission.deletePagesHint'),
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              value: 'write:styles',
              permission: this.$t('admin:permission.writeStyles'),
              hint: this.$t('admin:permission.writeStylesHint'),
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              value: 'write:scripts',
              permission: this.$t('admin:permission.writeScripts'),
              hint: this.$t('admin:permission.writeScriptsHint'),
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              value: 'read:source',
              permission: this.$t('admin:permission.readSource'),
              hint: this.$t('admin:permission.readSourceHint'),
              warning: false,
              restrictedForSystem: false,
              disabled: false
            },
            {
              value: 'read:history',
              permission: this.$t('admin:permission.readHistory'),
              hint: this.$t('admin:permission.readHistoryHint'),
              warning: false,
              restrictedForSystem: false,
              disabled: false
            },
            {
              value: 'read:assets',
              permission: this.$t('admin:permission.readAssets'),
              hint: this.$t('admin:permission.readAssetsHint'),
              warning: false,
              restrictedForSystem: false,
              disabled: false
            },
            {
              value: 'write:assets',
              permission: this.$t('admin:permission.writeAssets'),
              hint: this.$t('admin:permission.writeAssetsHint'),
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              value: 'maange:assets',
              permission: this.$t('admin:permission.manageAssets'),
              hint: this.$t('admin:permission.manageAssetsHint'),
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              value: 'read:comments',
              permission: this.$t('admin:permission.readComments'),
              hint: this.$t('admin:permission.readCommentsHint'),
              warning: false,
              restrictedForSystem: false,
              disabled: false
            },
            {
              value: 'write:comments',
              permission: this.$t('admin:permission.writeComments'),
              hint: this.$t('admin:permission.writeCommentsHint'),
              warning: false,
              restrictedForSystem: false,
              disabled: false
            },
            {
              value: 'manage:comments',
              permission: this.$t('admin:permission.manageComments'),
              hint: this.$t('admin:permission.manageCommentsHint'),
              warning: false,
              restrictedForSystem: true,
              disabled: false
            }
          ]
        },
        {
          category: this.$t('admin:permission.usersTitle'),
          items: [
            {
              value: 'write:users',
              permission: this.$t('admin:permission.writeUsers'),
              hint: this.$t('admin:permission.writeUsersHint'),
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              value: 'manage:users',
              permission: this.$t('admin:permission.manageUsers'),
              hint: this.$t('admin:permission.manageUsersHint'),
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              value: 'write:groups',
              permission: this.$t('admin:permission.writeGroups'),
              hint: this.$t('admin:permission.writeGroupsHint'),
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              value: 'manage:groups',
              permission: this.$t('admin:permission.manageGroups'),
              hint: this.$t('admin:permission.manageGroupsHint'),
              warning: true,
              restrictedForSystem: true,
              disabled: false
            }
          ]
        },
        {
          category: this.$t('admin:permission.administrationTitle'),
          items: [
            {
              value: 'manage:navigation',
              permission: this.$t('admin:permission.manageNavigation'),
              hint: this.$t('admin:permission.manageNavigationHint'),
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              value: 'manage:theme',
              permission: this.$t('admin:permission.manageTheme'),
              hint: this.$t('admin:permission.manageThemeHint'),
              warning: false,
              restrictedForSystem: true,
              disabled: false
            },
            {
              value: 'manage:api',
              permission: this.$t('admin:permission.manageApi'),
              hint: this.$t('admin:permission.manageApiHint'),
              warning: true,
              restrictedForSystem: true,
              disabled: false
            },
            {
              value: 'manage:system',
              permission: this.$t('admin:permission.manageSystem'),
              hint: this.$t('admin:permission.manageSystemHint'),
              warning: true,
              restrictedForSystem: true,
              disabled: true

            }
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
