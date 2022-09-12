import { boot } from 'quasar/wrappers'
import { ApolloClient, InMemoryCache } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { createUploadLink } from 'apollo-upload-client'

export default boot(({ app, store }) => {
  // Authentication Link
  const authLink = setContext(async (req, { headers }) => {
    const token = store.state.value.user.token
    return {
      headers: {
        ...headers,
        Authorization: token ? `Bearer ${token}` : ''
      }
    }
  })

  // Upload / HTTP Link
  const uploadLink = createUploadLink({
    uri () {
      return '/_graphql'
    }
  })

  // Cache
  const cache = new InMemoryCache()

  if (typeof window !== 'undefined') {
    const state = window.__APOLLO_STATE__
    if (state) {
      cache.restore(state.defaultClient)
    }
  }

  // Client
  const client = new ApolloClient({
    cache,
    link: authLink.concat(uploadLink),
    credentials: 'omit',
    ssrForceFetchDelay: 100
  })

  if (import.meta.env.SSR) {
    global.APOLLO_CLIENT = client
  } else {
    window.APOLLO_CLIENT = client
  }
})
