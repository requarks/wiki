import { defineRelations } from 'drizzle-orm'
import * as schema from './schema.ts'

export const relations = defineRelations(schema, (r) => ({
  users: {
    groups: r.many.groups({
      from: r.users.id.through(r.userGroups.userId),
      to: r.groups.id.through(r.userGroups.groupId)
    })
  },
  groups: {
    members: r.many.users()
  },
  userKeys: {
    user: r.one.users({
      from: r.userKeys.userId,
      to: r.users.id
    })
  },
  auditLog: {
    // -> Optional, and stays that way: the row outlives the account it points at, and reading the
    //    log after a deletion falls back to the name and email kept on `meta.actor`
    user: r.one.users({
      from: r.auditLog.userId,
      to: r.users.id,
      optional: true
    })
  }
}))
