import gql from 'graphql-tag'

export default {
  GQL_QUERY_AUTHENTICATION: gql`
    query($mode: String!) {
      authentication(mode:$mode) {
        key
        useForm
        title
        icon
      }
    }
  `,
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
