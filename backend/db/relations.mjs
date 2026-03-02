import { defineRelations } from 'drizzle-orm'
import * as schema from './schema.mjs'

export const relations = defineRelations(schema,
  r => ({
    users: {
      groups: r.many.groups({
        from: r.users.id.through(r.userGroups.userId),
        to: r.groups.id.through(r.userGroups.groupId)
      })
    },
    groups: {
      members: r.many.users()
    }
  })
)
