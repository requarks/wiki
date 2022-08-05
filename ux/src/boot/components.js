import { boot } from 'quasar/wrappers'

import BlueprintIcon from '../components/BlueprintIcon.vue'
import VNetworkGraph from 'v-network-graph'

export default boot(({ app }) => {
  app.component('BlueprintIcon', BlueprintIcon)
  app.use(VNetworkGraph)
})
