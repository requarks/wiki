<template lang="pug">
.row
  .col-auto.bg-grey-1(style='width: 250px;')
    q-tree(
      :nodes='tree'
      default-expand-all
      node-key='label'
      @lazy-load='onLazyLoad'
    )
  .col Doude
</template>

<script>
export default {
  data () {
    return {
      tree: [
        {
          label: 'Item 1',
          icon: 'las la-folder',
          children: [
            { label: 'Item 1.1' },
            {
              label: 'Item 1.2',
              icon: 'las la-folder',
              children: [
                { label: 'Item 1.2.1' },
                { label: 'Item 1.2.2' }
              ]
            }
          ]
        }
      ]
    }
  },
  methods: {
    async onLazyLoad ({ node, key, done, fail }) {
      done([])
    }
  }
}
</script>
