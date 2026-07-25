/**
 * Generated IDs handed to each model's `init()` during first-run seeding.
 *
 * Built in `core/config.ts` → `initDbValues()`, mixing freshly generated UUIDs with the fixed
 * system IDs declared in `base.yml`.
 */
export interface SystemIds {
  groupAdminId: string
  groupUserId: string
  groupGuestId: string
  siteId: string
  authModuleId: string
  userAdminId: string
  userGuestId: string
}
