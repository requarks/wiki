import { boot } from 'quasar/wrappers'
import { createApolloProvider } from '@vue/apollo-option'
import { ApolloClient, InMemoryCache } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { createUploadLink } from 'apollo-upload-client'

export default boot(({ app }) => {
  // Authentication Link
  const authLink = setContext(async (req, { headers }) => {
    const token = 'test' // await window.auth0Client.getTokenSilently()
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

  // Init Vue Apollo
  const apolloProvider = createApolloProvider({
    defaultClient: client
  })

  if (import.meta.env.SSR) {
    global.APOLLO_CLIENT = client
  } else {
    window.APOLLO_CLIENT = client
  }

  app.use(apolloProvider)
})
