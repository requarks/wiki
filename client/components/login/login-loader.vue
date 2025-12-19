<template lang='pug'>
  transition(name='loader-fade')
    .login-loader-overlay(v-if='value', @click.self='')
      transition(name='loader-scale', mode='out-in')
        .login-loader-card(:key='mode', :style='cardStyles')
          //- Loading State
          template(v-if='mode === "loading"')
            .loader-spinner
              atom-spinner.is-inline(
                :animation-duration='1000'
                :size='70'
                :color='spinnerColor'
              )
            .loader-title(:style='titleStyles') {{ title }}
            .loader-subtitle(v-if='subtitle', :style='subtitleStyles') {{ subtitle }}
          
          //- Success State
          template(v-else-if='mode === "success"')
            .loader-success
              .success-circle(:style='successCircleStyles')
                svg.success-checkmark(viewBox='0 0 52 52')
                  circle.success-circle-bg(cx='26', cy='26', r='25', :style='successBgStyles')
                  path.success-checkmark-path(fill='none', d='M14 27l7 7 16-16', :style='checkmarkStyles')
            .loader-title.success-title(:style='successTitleStyles') {{ title }}
            .loader-subtitle(v-if='subtitle', :style='successSubtitleStyles') {{ subtitle }}
</template>

<script>
import { AtomSpinner } from 'epic-spinners'
import colors from '@/themes/default/js/color-scheme'

export default {
  components: {
    AtomSpinner
  },
  props: {
    value: {
      type: Boolean,
      default: false
    },
    mode: {
      type: String,
      default: 'loading'
    },
    title: {
      type: String,
      default: 'Please wait...'
    },
    subtitle: {
      type: String,
      default: ''
    }
  },
  computed: {
    cardStyles() {
      return {
        'background-color': colors.surfaceLight.white,
        'box-shadow': '0 8px 32px rgba(199, 200, 203, 0.2)'
      }
    },
    spinnerColor() {
      return colors.surfaceLight.primaryBlueHeavy
    },
    titleStyles() {
      return {
        'color': colors.textLight.primary
      }
    },
    subtitleStyles() {
      return {
        'color': colors.textLight.secondary
      }
    },
    successCircleStyles() {
      return {
        'background-color': colors.textLight.positiveOnLite,
        'box-shadow': '0 4px 12px rgba(78, 185, 114, 0.25)'
      }
    },
    successBgStyles() {
      return {
        'fill': colors.textLight.positiveOnLite
      }
    },
    checkmarkStyles() {
      return {
        'stroke': colors.surfaceLight.white,
        'stroke-width': '3.5'
      }
    },
    successTitleStyles() {
      return {
        'color': colors.textLight.primary
      }
    },
    successSubtitleStyles() {
      return {
        'color': colors.textLight.positiveOnLite,
        'font-weight': '400'
      }
    }
  }
}
</script>

<style lang='scss' scoped>
  .login-loader-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
  
  .login-loader-card {
    border-radius: 12px;
    padding: 48px 40px;
    text-align: center;
    min-width: 320px;
    max-width: 400px;
  }
  
  .loader-spinner {
    margin: 0 auto 28px;
    
    .atom-spinner.is-inline {
      display: inline-block;
    }
  }
  
  .loader-success {
    margin: 0 auto 28px;
  }
  
  .success-circle {
    width: 80px;
    height: 80px;
    margin: 0 auto;
    position: relative;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: success-pop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
    
    .success-checkmark {
      width: 52px;
      height: 52px;
      display: block;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-miterlimit: 10;
    }
    
    .success-circle-bg {
      animation: fill-circle 0.4s ease-in-out 0.3s forwards;
      transform-origin: center;
      opacity: 0;
    }
    
    .success-checkmark-path {
      transform-origin: 50% 50%;
      stroke-dasharray: 48;
      stroke-dashoffset: 48;
      animation: draw-checkmark 0.3s ease-out 0.7s forwards;
    }
  }
  
  @keyframes success-pop {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  @keyframes fill-circle {
    0% {
      opacity: 0;
      transform: scale(0);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @keyframes draw-checkmark {
    0% {
      stroke-dashoffset: 48;
    }
    100% {
      stroke-dashoffset: 0;
    }
  }
  
  .loader-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
  }
  
  .success-title {
    font-weight: 500;
  }
  
  .loader-subtitle {
    font-size: 14px;
  }
  
  .loader-fade-enter-active,
  .loader-fade-leave-active {
    transition: opacity 0.3s ease;
  }
  
  .loader-fade-enter,
  .loader-fade-leave-to {
    opacity: 0;
  }
  
  .loader-scale-enter-active {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  .loader-scale-leave-active {
    transition: all 0.2s ease;
  }
  
  .loader-scale-enter {
    opacity: 0;
    transform: scale(0.85) translateY(10px);
  }
  
  .loader-scale-leave-to {
    opacity: 0;
    transform: scale(0.95);
  }
</style>
