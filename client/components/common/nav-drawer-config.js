// Desktop sidebar width (px). Keep in sync with scss/layout/_nav-drawer.scss.
export const NAV_DRAWER_DESKTOP_WIDTH = 300
export const NAV_DRAWER_MOBILE_MAX_WIDTH = 320
export const NAV_DRAWER_MOBILE_WIDTH_RATIO = 0.88
export const NAV_DRAWER_FOOTER_GUTTER = 16
export const NAV_DRAWER_FAB_INSET = 21

export function getNavDrawerMobileWidth (viewportWidth = window.innerWidth) {
  return Math.min(
    Math.round(viewportWidth * NAV_DRAWER_MOBILE_WIDTH_RATIO),
    NAV_DRAWER_MOBILE_MAX_WIDTH
  )
}

export function getNavDrawerFooterOffset () {
  return NAV_DRAWER_DESKTOP_WIDTH + NAV_DRAWER_FOOTER_GUTTER
}

export function getNavDrawerFabOffset () {
  return NAV_DRAWER_DESKTOP_WIDTH - NAV_DRAWER_FAB_INSET
}

export function applyNavDrawerCssVars (root = document.documentElement) {
  root.style.setProperty('--nav-drawer-desktop-width', `${NAV_DRAWER_DESKTOP_WIDTH}px`)
  root.style.setProperty('--nav-drawer-footer-offset', `${getNavDrawerFooterOffset()}px`)
  root.style.setProperty('--nav-drawer-fab-offset', `${getNavDrawerFabOffset()}px`)
}
