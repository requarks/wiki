<template lang='pug'>
  v-app
    div(class='disambiguation')
      h1 {{ $t('disambiguation.title') }}
      p {{ $t('disambiguation.subtitle') }}
      span(v-for='(page,index) in pagesArr' :key='index')
        a(:href='page.path') {{ page.path }}
      v-btn.mt-5(color='purple lighten-3', href='javascript:window.history.go(-1);', outlined)
        v-icon(left) mdi-arrow-left
        span {{ $t('disambiguation.goback') }}
</template>

<style scoped>
.disambiguation {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  min-height: 100%;
  background: url('../static/svg/motif-overlay.svg');
  background-size: 100%;
  color: white;
}
span{
  margin: 0.5rem 0;
}
a {
  text-decoration: none;
}
</style>

<script>

export default {
  props: {
    pages: {
      type: String,
      default: ""
    },
  },
  computed:{
    pagesArr(){
      return JSON.parse(this.pages)
    }
  },
  data() {
    return { }
  }
}

</script>
