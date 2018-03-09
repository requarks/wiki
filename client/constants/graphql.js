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
    `
  },
  GQL_QUERY_TRANSLATIONS: gql`
    query($locale: String!, $namespace: String!) {
      translations(locale:$locale, namespace:$namespace) {
        key
        value
      }
    }
  `,
  GQL_MUTATION_LOGIN: gql`
    mutation($username: String!, $password: String!, $provider: String!) {
      login(username: $username, password: $password, provider: $provider) {
        succeeded
        message
        tfaRequired
        tfaLoginToken
      }
    }
  `,
  GQL_MUTATION_LOGINTFA: gql`
    mutation($loginToken: String!, $securityCode: String!) {
      loginTFA(loginToken: $loginToken, securityCode: $securityCode) {
        succeeded
        message
      }
    }
  `
}
