<template lang="pug">
  div(v-if='nav')
    #arrow-boxes.pt-2.pb-4.no-print
      .page-nav-row.page-nav-row--top
        a.circle.circle--index(:href='nav.index.href') {{ nav.index.label }}
        a.arrow-right(v-if='nav.next', :href='nav.next.href') {{ nav.next.title }}
        span.arrow-right.arrow-right--empty(v-else aria-hidden='true') -
      .page-nav-row
        a.arrow-left(v-if='nav.prev', :href='nav.prev.href') {{ nav.prev.title }}
        span.arrow-left.arrow-left--empty(v-else aria-hidden='true') -
        a.circle.circle--related(v-if='nav.related', :href='nav.related.href') {{ nav.related.label }}
    .related-posts.no-print(v-if='nav.cards && nav.cards.length')
      a.is-internal-link.is-valid-page.post-card(
        v-for='(card, idx) in nav.cards'
        :key='`related-card-${idx}`'
        :href='card.href'
      )
        img(:src='card.image', :alt='card.title', width='300', height='200')
        .post-card-body
          h3 {{ card.title }}
          hr.post-card-divider(v-if='card.description')
          p(v-if='card.description') {{ card.description }}
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
