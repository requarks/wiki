import { installAuthNavGuard } from '../helpers/auth-session'
import store from '../store'

export default function () {
  installAuthNavGuard(store)
}
