<template lang="pug">
.loader-generic
  div
</template>

<style lang="scss">
.loader-generic {
  box-shadow: none !important;
  padding-top: 64px;

  > div {
    background-color: rgba(0,0,0,.75);
    width: 64px;
    height: 64px;
    border-radius: 5px !important;
    position: relative;

    &:before {
      content: '';
      box-sizing: border-box;
      position: absolute;
      top: 50%;
      left: 50%;
      width: 24px;
      height: 24px;
      margin-top: -12px;
      margin-left: -12px;
      border-radius: 50%;
      border-top: 2px solid #FFF;
      border-right: 2px solid transparent;
      animation: loadergenericspinner .6s linear infinite;
    }
  }
}

@keyframes loadergenericspinner {
  to { transform: rotate(360deg); }
}
</style>
