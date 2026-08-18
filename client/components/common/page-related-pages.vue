<template lang="pug">
  .related-posts.no-print(v-if='related && related.cards && related.cards.length')
    a.is-internal-link.is-valid-page.post-card(
      v-for='(card, idx) in related.cards'
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
    related: {
      type: Object,
      default: null
    }
  }
}
</script>

<style lang="scss">
.related-posts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.related-posts .post-card {
  background: #fff;
  border: 1px solid mc('grey', '300');
  border-radius: 6px;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  padding: 10px;
  display: flex;
  flex-direction: column;
  height: 300px;
  box-sizing: border-box;
  text-decoration: none;
  color: inherit;
}

.related-posts .post-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.related-posts .post-card img {
  flex: 6 1 0;
  min-height: 0;
  width: 100%;
  height: auto;
  object-fit: cover;
  display: block;
  border-radius: 4px;
}

.related-posts .post-card-body {
  flex: 4 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.related-posts .post-card h3 {
  font-size: 1rem;
  font-weight: 700;
  color: mc('grey', '900');
  margin: 8px 4px 4px;
  line-height: 1.3;
  flex: 0 0 auto;
}

.related-posts .post-card-divider {
  border: none;
  border-top: 1px solid mc('grey', '300');
  margin: 0 4px 4px;
  flex: 0 0 auto;
}

.related-posts .post-card p {
  font-size: 0.88rem;
  font-weight: normal;
  color: mc('grey', '700');
  margin: 0 4px 0;
  line-height: 1.35;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

@media print {
  .related-posts.no-print {
    display: none !important;
  }
}
</style>
