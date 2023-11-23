import { boot } from 'quasar/wrappers'
import { ApolloClient, HttpLink, InMemoryCache, from, split } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { BatchHttpLink } from '@apollo/client/link/batch-http'
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs'

import { useUserStore } from 'src/stores/user'

export default boot(({ app }) => {
  const userStore = useUserStore()

  const defaultLinkOptions = {
    uri: '/_graphql',
    credentials: 'omit'
  }

  let refreshPromise = null
  let fetching = false

  // Authentication Link
  const authLink = setContext(async (req, { headers }) => {
    if (!userStore.token) {
      return {
        headers: {
          ...headers,
          Authorization: ''
        }
      }
    }

    // -> Refresh Token
    if (!userStore.isTokenValid({ minutes: 1 })) {
      if (!fetching) {
        refreshPromise = new Promise((resolve, reject) => {
          (async () => {
            fetching = true
            try {
              await userStore.refreshToken()
              resolve()
            } catch (err) {
              reject(err)
            }
            fetching = false
          })()
        })
      } else {
        // -> Another request is already executing, wait for it to complete
        await refreshPromise
      }
    }

    return {
      headers: {
        ...headers,
        Authorization: userStore.token ? `Bearer ${userStore.token}` : ''
      }
    }
  })

  // Upload / HTTP Link
  const uploadLink = createUploadLink({
    ...defaultLinkOptions,
    headers: {
      'Apollo-Require-Preflight': 'true'
    }
  })

  // Directional Link
  const link = split(
    op => op.getContext().skipAuth,
    new HttpLink(defaultLinkOptions),
    from([
      authLink,
      split(
        op => op.getContext().uploadMode,
        uploadLink,
        new BatchHttpLink(defaultLinkOptions)
      )
    ])
  )

  // Cache
  const cache = new InMemoryCache()

  // Restore SSR state
  if (typeof window !== 'undefined') {
    const state = window.__APOLLO_STATE__
    if (state) {
      cache.restore(state.defaultClient)
    }
  }

  // Client
  const client = new ApolloClient({
    cache,
    link,
    ssrForceFetchDelay: 100
  })

  if (import.meta.env.SSR) {
    global.APOLLO_CLIENT = client
  } else {
    window.APOLLO_CLIENT = client
  }
})
