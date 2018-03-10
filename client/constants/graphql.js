import gql from 'graphql-tag'

export default {
  AUTHENTICATION: {
    QUERY_PROVIDERS: gql`
      query {
        authentication {
          providers {
            isEnabled
            key
            props
            title
            useForm
            config {
              key
              value
            }
          }
        }
      }
    `,
    QUERY_LOGIN_PROVIDERS: gql`
      query {
        authentication {
          providers(
            filter: "isEnabled eq true",
            orderBy: "title ASC"
          ) {
            key
            title
            useForm
            icon
          }
        }
      }
    `,
    MUTATION_LOGIN: gql`
      mutation($username: String!, $password: String!, $provider: String!) {
        authentication {
          login(username: $username, password: $password, provider: $provider) {
            operation {
              succeeded
              code
              slug
              message
            }
            tfaRequired
            tfaLoginToken
          }
        }
      }
    `,
    MUTATION_LOGINTFA: gql`
      mutation($loginToken: String!, $securityCode: String!) {
        authentication {
          loginTFA(loginToken: $loginToken, securityCode: $securityCode) {
            operation {
              succeeded
              code
              slug
              message
            }
          }
        }
      }
    `
  },
  TRANSLATIONS: {
    QUERY_NAMESPACE: gql`
      query($locale: String!, $namespace: String!) {
        translations(locale:$locale, namespace:$namespace) {
          key
          value
        }
      }
    `
  }
}
