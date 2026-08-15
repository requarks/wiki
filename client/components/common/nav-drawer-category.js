export function getNavDrawerCategory (pathname = window.location.pathname) {
  if (/^\/a(\/|$)/.test(pathname)) { return 'admin' }
  if (/^\/t(\/|$)/.test(pathname)) { return 'tags' }
  if (/^\/p(\/|$)/.test(pathname)) { return 'profile' }
  if (/^\/e(\/|$)/.test(pathname)) { return 'minimal' }
  if (/^\/s(\/|$)/.test(pathname)) { return 'minimal' }
  if (/^\/h(\/|$)/.test(pathname)) { return 'minimal' }

  const root = document.getElementById('root')
  if (root && root.classList.contains('is-fullscreen')) { return null }

  return 'wiki'
}
