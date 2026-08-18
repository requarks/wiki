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
  border: 1px solid mc('grey', '300');
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
  background-color: mc('theme', 'primary');
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
  color: mc('blue', '400') !important;
}

#arrow-boxes .circle--index {
  margin-right: 0.5rem;
}

#arrow-boxes .arrow-right {
  background-color: mc('blue', '100');
  color: mc('blue', '800') !important;
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
  background-color: mc('blue', '100');
  color: mc('blue', '800') !important;
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
  #arrow-boxes.no-print {
    display: none !important;
  }
}
</style>
