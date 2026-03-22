import ky from 'ky'

import { useUserStore } from '@/stores/user'

export function initializeApi(store) {
  const userStore = useUserStore(store)

  let refreshPromise = null
  let fetching = false

  const client = ky.create({
    prefixUrl: '/_api',
    credentials: 'same-origin',
    throwHttpErrors: (statusNumber) => statusNumber > 400, // Don't throw for 400
    hooks: {
      beforeRequest: [
        async (request) => {
          // -> Guest
          if (!userStore.token) {
            request.headers.set('Authorization', '')
            return
          }

          // -> Refresh Token
          if (!userStore.isTokenValid({ minutes: 1 })) {
            if (!fetching) {
              refreshPromise = new Promise((resolve, reject) => {
                ;(async () => {
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

          request.headers.set('Authorization', userStore.token ? `Bearer ${userStore.token}` : '')
        }
      ]
    }
  })

  if (import.meta.env.SSR) {
    global.API_CLIENT = client
  } else {
    window.API_CLIENT = client
  }
}
