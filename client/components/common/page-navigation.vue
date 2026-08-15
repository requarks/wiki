<template lang="pug">
  #arrow-boxes.pt-4.mt-4.pb-4.no-print(v-if='nav')
    .page-nav-row.page-nav-row--top
      a.circle.circle--index(:href='nav.index.href') {{ nav.index.label }}
      a.arrow-right(v-if='nav.next', :href='nav.next.href') {{ nav.next.title }}
    .page-nav-row
      a.arrow-left(v-if='nav.prev', :href='nav.prev.href') {{ nav.prev.title }}
      a.circle.circle--related(v-if='nav.related', :href='nav.related.href') {{ nav.related.label }}
</template>

<script>
export default {
  props: {
    nav: {
      type: Object,
      default: null
    }
  }
}
</script>
