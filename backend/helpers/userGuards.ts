import { CustomError } from './common.ts'
import { ELEVATED_PERMISSIONS, SYSTEM_PERMISSION, isElevated } from '../models/groups.ts'
import type { FastifyRequest } from 'fastify'
import type { GroupWithUserCount } from '../models/groups.ts'

/**
 * The three guards that stand between an administrator and the accounts that administer the wiki.
 *
 * They live here rather than in the models because every one of them is a question about the
 * CALLER — what the session or the API key making this request holds — and a model is reachable
 * from the scheduler, where there is no caller to ask about. They live here rather than in
 * `api/users.ts` because there is now more than one surface that writes users and groups: the admin
 * API, and the SCIM endpoint under `/_scim`, which a directory drives with a bearer token. A guard
 * that only one of the two went through would be a guard with a way around it.
 *
 * All three answer with the refusal to throw rather than throwing it themselves, so that a caller
 * can decide whether a refusal is an error or, as SCIM needs, a 404 that discloses nothing.
 */

/** What a request holds, whether it arrived as a session or as an API key. */
function permissionsOf(req: FastifyRequest): string[] {
  return req.apiKey?.permissions ?? req.session?.permissions ?? []
}

/**
 * Refuse any change to a user who is protected by `manage:system`.
 *
 * `manage:users` is deliberately short of the root: an administrator who can rename, re-group, reset
 * the password of, or delete a `manage:system` account can take the instance over through it. Only
 * somebody who already holds `manage:system` may touch one.
 *
 * @returns The refusal to throw, or null when the caller may proceed
 */
export async function systemUserGuard(
  req: FastifyRequest,
  userId: string
): Promise<CustomError | null> {
  if (WIKI.models.groups.holdsSystemPermission(req)) {
    return null
  }
  if (!(await WIKI.models.groups.userHoldsSystemPermission(userId))) {
    return null
  }
  return new CustomError(
    'userSystemProtected',
    'This user belongs to a group with the manage:system permission. Only a user who holds manage:system can modify them.',
    403
  )
}

/**
 * Refuse a change to who is in a group that administers the instance.
 *
 * Membership of such a group IS the permission: adding somebody hands them what the group can reach,
 * and removing somebody takes it away from a real administrator. Deleting the group does both at
 * once, so it asks the same question.
 *
 * Where the line falls depends on what the caller holds, and the rungs are deliberately different:
 *
 * - **`manage:groups`** is stopped only by `manage:system`, the permission that bypasses every check
 *   on the server. Everything below that is theirs to arrange; managing groups is the job.
 * - **Everything else** — `write:groups`, and `manage:scim` on a SCIM request — is stopped by every
 *   one of `ELEVATED_PERMISSIONS`. Those are the rungs that may build and populate ordinary groups
 *   without being trusted to decide who administers the wiki, and since neither can edit a group's
 *   permissions at all, their only route to an elevated group would be through the membership of one
 *   that already exists.
 *
 * @param action What the caller was trying to do, as the message reads it back to them
 * @returns The refusal to throw, or null when the caller may proceed
 */
export function elevatedGroupGuard(
  req: FastifyRequest,
  group: GroupWithUserCount,
  action = 'change who belongs to the group'
): CustomError | null {
  if (WIKI.models.groups.holdsSystemPermission(req)) {
    return null
  }
  const permissions = permissionsOf(req)
  if (permissions.includes('manage:groups')) {
    if (!group.permissions.includes(SYSTEM_PERMISSION)) {
      return null
    }
    return new CustomError(
      'groupMembershipSystemProtected',
      `This group has the ${SYSTEM_PERMISSION} permission. Only a user who holds it can ${action}.`,
      403
    )
  }
  if (!isElevated(group.permissions)) {
    return null
  }
  const held = group.permissions.filter((p) =>
    (ELEVATED_PERMISSIONS as readonly string[]).includes(p)
  )
  return new CustomError(
    'groupMembershipElevatedProtected',
    `This group administers the wiki (${held.join(', ')}). Only a user who holds manage:groups or manage:system can ${action}.`,
    403
  )
}

/**
 * Refuse moving a user into or out of a group that administers the wiki.
 *
 * Both directions, because adding hands them whatever that group can reach and removing takes it
 * from a real administrator. Creating an account already inside one is the same act as promoting an
 * existing one, so a create asks this with an empty `current` rather than skipping it — otherwise
 * the way around every other guard would be to make a second account instead of editing the first.
 *
 * Groups the request leaves alone are never consulted, so a save that only renames a user still goes
 * through whatever they already belong to.
 *
 * @param current The groups the user is in now — empty when the user is being created
 * @param requested The membership being asked for, in full
 * @returns The refusal to throw, or null when the caller may proceed
 */
export async function elevatedMembershipGuard(
  req: FastifyRequest,
  current: readonly string[],
  requested: readonly string[]
): Promise<CustomError | null> {
  if (WIKI.models.groups.holdsSystemPermission(req)) {
    return null
  }
  const moved = [
    ...requested.filter((id) => !current.includes(id)),
    ...current.filter((id) => !requested.includes(id))
  ]
  if (moved.length < 1) {
    return null
  }
  const elevated = await WIKI.models.groups.elevatedGroupIds()
  if (!moved.some((id) => elevated.includes(id))) {
    return null
  }
  return new CustomError(
    'groupMembershipElevatedProtected',
    'Only a user who holds manage:system can add a user to, or remove one from, a group that administers the wiki.',
    403
  )
}
