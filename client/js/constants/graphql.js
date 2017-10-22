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
  `
}
