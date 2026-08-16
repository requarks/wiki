import Cookies from 'js-cookie'

const GUEST_EFFECTIVE_PERMISSIONS = {
  comments: {
    read: false,
    write: false,
    manage: false
  },
  history: {
    read: false
  },
  source: {
    read: false
  },
  pages: {
    read: false,
    write: false,
    manage: false,
    delete: false,
    script: false,
    style: false
  },
  system: {
    manage: false
  }
}

export function parseJwtPayload (jwtToken) {
  if (!jwtToken || typeof jwtToken !== 'string') {
    return null
  }

  try {
    const parts = jwtToken.split('.')
    if (parts.length < 2) {
      return null
    }

    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch (err) {
    return null
  }
}

export function getAuthSession () {
  const jwtCookie = Cookies.get('jwt')
  const jwtData = parseJwtPayload(jwtCookie)

  if (!jwtData) {
    return { authenticated: false, jwtData: null, expired: false }
  }

  if (jwtData.exp && jwtData.exp * 1000 <= Date.now()) {
    return { authenticated: false, jwtData: null, expired: true }
  }

  return { authenticated: true, jwtData, expired: false }
}

export function applyAuthDocumentClass (authenticated) {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.classList.remove('wiki-auth-guest', 'wiki-auth-authenticated')
  root.classList.add(authenticated ? 'wiki-auth-authenticated' : 'wiki-auth-guest')
  window.__wikiAuth = { authenticated: !!authenticated }
}

export function getGuestEffectivePermissions () {
  return JSON.parse(JSON.stringify(GUEST_EFFECTIVE_PERMISSIONS))
}

const ADMIN_ACCESS_PERMISSIONS = [
  'manage:system',
  'write:users',
  'manage:users',
  'write:groups',
  'manage:groups',
  'manage:navigation',
  'manage:theme',
  'manage:api'
]

function hasJwtPermission (jwtPermissions, permission) {
  return Array.isArray(jwtPermissions) && jwtPermissions.includes(permission)
}

function hasAnyJwtPermission (jwtPermissions, permissions) {
  return Array.isArray(jwtPermissions) && permissions.some((permission) => jwtPermissions.includes(permission))
}

/**
 * Cloudflare may serve HTML cached for anonymous users. Embedded effectivePermissions
 * then reflect guest access even when a JWT cookie is present. Merge JWT global
 * permissions so client nav (bottom bar, header actions) matches login state.
 */
export function mergeJwtPermissions (embeddedPermissions, jwtPermissions) {
  if (!embeddedPermissions) {
    return embeddedPermissions
  }
  if (!Array.isArray(jwtPermissions) || jwtPermissions.length === 0) {
    return embeddedPermissions
  }

  const isAdmin = hasAnyJwtPermission(jwtPermissions, ADMIN_ACCESS_PERMISSIONS)

  return {
    comments: {
      read: (embeddedPermissions.comments && embeddedPermissions.comments.read) || hasJwtPermission(jwtPermissions, 'read:comments'),
      write: hasJwtPermission(jwtPermissions, 'write:comments'),
      manage: hasJwtPermission(jwtPermissions, 'manage:comments')
    },
    history: {
      read: (embeddedPermissions.history && embeddedPermissions.history.read) || hasJwtPermission(jwtPermissions, 'read:history')
    },
    source: {
      read: (embeddedPermissions.source && embeddedPermissions.source.read) || hasJwtPermission(jwtPermissions, 'read:source')
    },
    pages: {
      read: (embeddedPermissions.pages && embeddedPermissions.pages.read) || hasJwtPermission(jwtPermissions, 'read:pages'),
      write: hasJwtPermission(jwtPermissions, 'write:pages') || hasJwtPermission(jwtPermissions, 'manage:pages') || isAdmin,
      manage: hasJwtPermission(jwtPermissions, 'manage:pages') || isAdmin,
      delete: hasJwtPermission(jwtPermissions, 'delete:pages') || isAdmin,
      script: hasJwtPermission(jwtPermissions, 'write:scripts') || isAdmin,
      style: hasJwtPermission(jwtPermissions, 'write:styles') || isAdmin
    },
    system: {
      manage: hasJwtPermission(jwtPermissions, 'manage:system')
    }
  }
}

export function sanitizeEffectivePermissions (permissions, authenticated, jwtPermissions = null) {
  if (!permissions) {
    return permissions
  }

  if (authenticated) {
    const session = getAuthSession()
    const resolvedJwtPermissions = jwtPermissions ||
      (session.jwtData && session.jwtData.permissions) ||
      []
    return mergeJwtPermissions(permissions, resolvedJwtPermissions)
  }

  return {
    comments: {
      read: (permissions.comments && permissions.comments.read) || false,
      write: false,
      manage: false
    },
    history: {
      read: (permissions.history && permissions.history.read) || false
    },
    source: {
      read: (permissions.source && permissions.source.read) || false
    },
    pages: {
      read: (permissions.pages && permissions.pages.read) || false,
      write: false,
      manage: false,
      delete: false,
      script: false,
      style: false
    },
    system: {
      manage: false
    }
  }
}

export function decodeEffectivePermissions (encodedPermissions, authenticated) {
  if (!encodedPermissions) {
    return null
  }

  try {
    const permissions = JSON.parse(Buffer.from(encodedPermissions, 'base64').toString())
    return sanitizeEffectivePermissions(permissions, authenticated)
  } catch (err) {
    return authenticated ? null : getGuestEffectivePermissions()
  }
}

export function installAuthNavGuard () {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return
  }

  const applyGuard = () => {
    const authenticated = getAuthSession().authenticated
    applyAuthDocumentClass(authenticated)

    document.querySelectorAll('[data-auth-required]').forEach((el) => {
      if (authenticated) {
        el.classList.remove('wiki-auth-blocked')
        el.removeAttribute('aria-disabled')
      } else {
        el.classList.add('wiki-auth-blocked')
        el.setAttribute('aria-disabled', 'true')
      }
    })
  }

  let scheduled = false
  const scheduleGuard = () => {
    if (scheduled) {
      return
    }
    scheduled = true
    window.requestAnimationFrame(() => {
      scheduled = false
      applyGuard()
    })
  }

  applyGuard()

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyGuard)
  }

  const observer = new MutationObserver(scheduleGuard)
  const startObserver = () => {
    if (!document.body) {
      return
    }
    observer.observe(document.body, { childList: true, subtree: true })
  }

  if (document.body) {
    startObserver()
  } else {
    document.addEventListener('DOMContentLoaded', startObserver)
  }
}
