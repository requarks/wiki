import BlueprintIcon from '@/components/BlueprintIcon.vue'
import StatusLight from '@/components/StatusLight.vue'
import LoadingGeneric from '@/components/LoadingGeneric.vue'
import VNetworkGraph from 'v-network-graph'

export function initializeComponents (app) {
  app.component('BlueprintIcon', BlueprintIcon)
  app.component('LoadingGeneric', LoadingGeneric)
  app.component('StatusLight', StatusLight)
  app.use(VNetworkGraph)
}
