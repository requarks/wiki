import { get } from 'vuex-pathify'
import _ from 'lodash'

export default {
    computed: {
        permissions: get('user/permissions')
    },
    methods: {
        hasPermission(prm) {
            if (_.isArray(prm)) {
                return _.some(prm, p => {
                    return _.includes(this.permissions, p)
                })
            } else {
                return _.includes(this.permissions, prm)
            }
        }
    }
}
