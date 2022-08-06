import { boot } from 'quasar/wrappers'

import BlueprintIcon from '../components/BlueprintIcon.vue'
import StatusLight from '../components/StatusLight.vue'
import VNetworkGraph from 'v-network-graph'

export default boot(({ app }) => {
  app.component('BlueprintIcon', BlueprintIcon)
  app.component('StatusLight', StatusLight)
  app.use(VNetworkGraph)
})
