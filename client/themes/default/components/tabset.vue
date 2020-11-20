<template lang="pug">
  .tabset.elevation-2
    ul.tabset-tabs(ref='tabs')
      slot(name='tabs')
    .tabset-content(ref='content')
      slot(name='content')
</template>

<script>
export default {
  data() {
    return {
      currentTab: 0
    }
  },
  watch: {
    currentTab (newValue, oldValue) {
      this.setActiveTab()
    }
  },
  methods: {
    setActiveTab () {
      this.$refs.tabs.childNodes.forEach((node, idx) => {
        if (idx === this.currentTab) {
          node.className = 'is-active'
        } else {
          node.className = ''
        }
      })
      this.$refs.content.childNodes.forEach((node, idx) => {
        if (idx === this.currentTab) {
          node.className = 'tabset-panel is-active'
        } else {
          node.className = 'tabset-panel'
        }
      })
    }
  },
  mounted () {
    this.setActiveTab()
    this.$refs.tabs.childNodes.forEach((node, idx) => {
      node.addEventListener('click', ev => {
        this.currentTab = [].indexOf.call(ev.target.parentNode.children, ev.target)
      })
    })
  }
}
</script>

<style lang="scss">
.tabset {
  border-radius: 5px;
  margin-top: 10px;

  @at-root .theme--dark & {
    background-color: #292929;
  }

  > .tabset-tabs {
    padding-left: 0;
    margin: 0;
    display: flex;
    align-items: stretch;
    background: linear-gradient(to bottom, #FFF, #FAFAFA);
    box-shadow: inset 0 -1px 0 0 #DDD;
    border-radius: 5px 5px 0 0;
    overflow: auto;

    @at-root .theme--dark & {
      background: linear-gradient(to bottom, #424242, #333);
      box-shadow: inset 0 -1px 0 0 #555;
    }

    > li {
      display: block;
      padding: 16px;
      margin-top: 0;
      cursor: pointer;
      transition: color 1s ease;
      border-right: 1px solid #FFF;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 1px;
      user-select: none;

      @at-root .theme--dark & {
        border-right-color: #555;
      }

      &.is-active {
        background-color: #FFF;
        margin-bottom: 0;
        padding-bottom: 17px;
        color: mc('blue', '700');

        @at-root .theme--dark & {
          background-color: #292929;
          color: mc('blue', '300');
        }
      }

      &:last-child {
        border-right: none;

        &.is-active {
          border-right: 1px solid #EEE;

          @at-root .theme--dark & {
            border-right-color: #555;
          }
        }
      }

      &:hover {
        background-color: rgba(#CCC, .1);

        @at-root .theme--dark & {
          background-color: rgba(#222, .25);
        }

        &.is-active {
          background-color: #FFF;

          @at-root .theme--dark & {
            background-color: #292929;
          }
        }
      }

      & + li {
        border-left: 1px solid #EEE;

        @at-root .theme--dark & {
          border-left-color: #222;
        }
      }
    }
  }

  > .tabset-content {
    .tabset-panel {
      padding: 2px 16px 16px;
      display: none;

      &.is-active {
        display: block;
      }
    }
  }
}
</style>
