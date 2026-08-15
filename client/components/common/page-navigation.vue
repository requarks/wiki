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

<style lang="scss">
#arrow-boxes {
  padding-left: 0;
  padding-right: 0;
  border: 1px solid #ddd;
}

#arrow-boxes .page-nav-row {
  display: flex;
  align-items: center;
}

#arrow-boxes .page-nav-row--top {
  margin-bottom: 1rem;
}

#arrow-boxes .circle {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background-color: #3b82f6;
  color: #fff !important;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
  text-decoration: none !important;
  font-size: 1rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

#arrow-boxes .circle--related {
  margin-left: 0.5rem;
  flex-shrink: 0;
}

#arrow-boxes .arrow-left--empty,
#arrow-boxes .arrow-right--empty {
  pointer-events: none;
  color: #7a9cc6 !important;
}

#arrow-boxes .circle--index {
  margin-right: 0.5rem;
}

#arrow-boxes .arrow-right {
  background-color: #bfdbfe;
  color: #4a6fa5 !important;
  font-weight: 700;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 100px;
  clip-path: polygon(0 0, 95% 0, 100% 50%, 95% 100%, 0 100%);
  flex-grow: 1;
  text-decoration: none !important;
  font-size: 1rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

#arrow-boxes .arrow-left {
  background-color: #bfdbfe;
  color: #4a6fa5 !important;
  font-weight: 700;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 100px;
  clip-path: polygon(5% 0, 100% 0, 100% 100%, 5% 100%, 0 50%);
  flex-grow: 1;
  text-decoration: none !important;
  font-size: 1rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

#arrow-boxes .arrow-left:hover,
#arrow-boxes .arrow-right:hover,
#arrow-boxes .circle:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12) !important;
}

@media (min-width: 992px) {
  #arrow-boxes {
    padding-left: 50px;
    padding-right: 50px;
  }
}

@media print {
  #arrow-boxes.no-print,
  .related-posts.no-print {
    display: none !important;
  }
}

.related-posts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.related-posts .post-card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  padding: 10px;
  display: block;
  text-decoration: none;
  color: inherit;
}

.related-posts .post-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.related-posts .post-card img {
  width: 100%;
  height: 160px;
  object-fit: cover;
  display: block;
  border-radius: 4px;
}

.related-posts .post-card h3 {
  font-size: 1rem;
  font-weight: 700;
  color: #111;
  margin: 12px 14px 8px;
  line-height: 1.4;
}

.related-posts .post-card-divider {
  border: none;
  border-top: 1px solid #ddd;
  margin: 0 14px 8px;
}

.related-posts .post-card p {
  font-size: 0.88rem;
  font-weight: normal;
  color: #555;
  margin: 0 14px 14px;
  line-height: 1.45;
  min-height: 60px;
}
</style>
