import { CustomError, rethrowAsBadRequest } from '../helpers/common.ts'
import { detectImageMime, imageMimeTypes } from '../helpers/images.ts'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { UserPatch, UserProfilePatch } from '../models/users.ts'

interface UserUpdateBody {
  name?: string
  email?: string
  isActive?: boolean
  isVerified?: boolean
  meta?: Record<string, any>
  prefs?: Record<string, any>
  groups?: string[]
  auth?: Record<string, any>
}

/** How large an avatar upload may be, before any resizing. */
const avatarUploadLimit = 2 * 1024 * 1024

/**
 * The user the session belongs to, or null when the request is not from a logged in user.
 *
 * The `/profile` routes are session-authenticated rather than permission-gated: every logged in user
 * may read and change its own profile, and no permission expresses that.
 */
function sessionUserId(req: FastifyRequest): string | null {
  return req.session?.authenticated && req.session.user?.id ? req.session.user.id : null
}

/**
 * Who is asking, as the interface needs to know it: the account on the session and the group-wide
 * permissions it holds, or nothing at all for a guest.
 *
 * Exported because `bootstrap` answers the same question as part of the one call an app load makes,
 * and two versions of "who is this" would be one too many.
 */
export function whoAmI(req: FastifyRequest): Record<string, any> {
  if (!req.session?.authenticated) {
    return { authenticated: false }
  }
  return {
    authenticated: true,
    ...req.session.user,
    /*
      The same list the route permission hook checks against — written onto the session at login from
      the groups the user belongs to. Nothing is added for the interface's benefit: a control it shows
      on a permission the session does not hold leads to a button that gets a 403 from the endpoint
      behind it.
    */
    permissions: req.session.permissions ?? []
  }
}

/**
 * Refuse a `manage:users` holder any change to a user who is protected by `manage:system`.
 *
 * `manage:users` is deliberately short of the root: an administrator who can rename, re-group, reset
 * the password of, or delete a `manage:system` account can take the instance over through it. Only
 * somebody who already holds `manage:system` may touch one.
 *
 * @returns The refusal to throw, or null when the caller may proceed
 */
async function systemUserGuard(req: FastifyRequest, userId: string): Promise<CustomError | null> {
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
 * Whether self-service profile editing is enabled on the site being browsed.
 *
 * It is a per-site feature: an instance whose user data comes from an external identity provider turns
 * it off. The site is resolved from the request hostname, which is how the admin flag is scoped; an
 * unresolvable hostname leaves the feature at its default.
 */
async function isProfileEditable(req: FastifyRequest): Promise<boolean> {
  const site = req.hostname
    ? await WIKI.models.sites.getSiteByHostname({ hostname: req.hostname })
    : null
  return !site || site.config?.features?.profile !== false
}

/**
 * Users API Routes
 */
async function routes(app: FastifyInstance) {
  // -> An avatar upload is the raw image rather than a multipart form: one file, no fields, and no
  //    dependency to add. Registered inside this plugin, so every other route keeps rejecting an
  //    image body outright.
  app.addContentTypeParser(
    [...imageMimeTypes],
    { parseAs: 'buffer', bodyLimit: avatarUploadLimit },
    (req, body, done) => {
      done(null, body)
    }
  )

  app.get<{
    Querystring: { page?: number; limit?: number; filter?: string; assignableToGroupId?: string }
  }>(
    '/',
    {
      config: {
        permissions: ['read:users', 'manage:users']
      },
      schema: {
        summary: 'List all users',
        tags: ['Users'],
        querystring: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Matched against the user name and email, case-insensitively.',
              maxLength: 255
            },
            assignableToGroupId: {
              type: 'string',
              format: 'uuid',
              description:
                'Keep only the users that may be assigned to this group, i.e. omit its current members and any system user. Intended for pickers offering users to assign.'
            },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          }
        },
        response: {
          200: {
            description: 'List of Users',
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              users: {
                type: 'array',
                items: { $ref: 'UserCore#' }
              }
            }
          }
        }
      }
    },
    async (req) => {
      const page = req.query.page ?? 1
      const limit = req.query.limit ?? 20
      const { total, users } = await WIKI.models.users.getUsers({
        filter: req.query.filter ?? '',
        assignableToGroupId: req.query.assignableToGroupId ?? '',
        page,
        limit
      })
      return { page, limit, total, users }
    }
  )

  /**
   * RECENT LOGINS
   */
  app.get<{ Querystring: { limit?: number } }>(
    '/recent-logins',
    {
      config: {
        // -> `access:admin`, not `read:users`: this answers a panel on the admin dashboard, which
        //    everyone who can open the admin area sees, and it is the same permission `system/info`
        //    fills the rest of that dashboard with. It is why the answer is identity plus a timestamp
        //    and nothing else -- the user list, and every account flag on it, still needs `read:users`.
        permissions: ['access:admin']
      },
      schema: {
        summary: 'List the most recent logins',
        description:
          'Who signed in last, most recent first. Accounts that have never logged in are left out rather than trailing the list, as are system accounts — nothing signs in as the guest.',
        tags: ['Users'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
          }
        },
        response: {
          200: {
            description: 'The most recent logins, newest first',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                email: { type: 'string' },
                lastLoginAt: {
                  type: 'string',
                  format: 'date-time',
                  description: 'RFC 3339 Date Time'
                }
              }
            }
          }
        }
      }
    },
    async (req) => {
      return WIKI.models.users.getRecentLogins({ limit: req.query.limit ?? 10 })
    }
  )

  app.get(
    '/whoami',
    {
      schema: {
        summary: 'Get currently logged in user info',
        description:
          'Includes the group-wide permissions of the session, which is what the interface hides its own controls by. Permissions ON A PAGE are a different question, answered by `pages/userPermissions`.\n\nThe app itself gets this from `bootstrap` on load, together with the site and the flags; this endpoint is what asks again once a login or a logout has changed the answer.',
        tags: ['Users']
      }
    },
    async (req, reply) => {
      reply.preventCache()
      return whoAmI(req)
    }
  )

  /**
   * GET OWN PROFILE
   */
  app.get(
    '/profile',
    {
      schema: {
        summary: "Get the logged in user's own profile",
        description:
          'Returns the profile of the user the session belongs to, with the `meta` / `prefs` blobs flattened into plain fields.',
        tags: ['Users'],
        response: {
          200: {
            description: 'User profile',
            type: 'object',
            $ref: 'UserProfile#'
          }
        }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }
      const profile = await WIKI.models.users.getProfile(userId)
      if (!profile) {
        // -> The session outlived the user it points at
        return reply.unauthorized()
      }
      return profile
    }
  )

  /**
   * UPDATE OWN PROFILE
   */
  app.put<{ Body: UserProfilePatch }>(
    '/profile',
    {
      schema: {
        summary: "Update the logged in user's own profile",
        description:
          'Updates any subset of the profile fields; omitted ones are left unchanged. Requires the current site to have the `profile` feature enabled. The email cannot be changed here, and neither can any field an administrator owns.',
        tags: ['Users'],
        body: {
          $ref: 'UserProfileUpdate#'
        },
        response: {
          200: {
            description: 'Profile updated successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              profile: {
                $ref: 'UserProfile#'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }
      if (!(await isProfileEditable(req))) {
        return reply.forbidden('Profile editing is disabled on this site.')
      }

      // -> A bad time zone would break every date the user sees, and the list of valid zones is only
      //    known at runtime, so it cannot be expressed as a schema enum
      if (req.body.timezone !== undefined && req.body.timezone !== '') {
        if (!Intl.supportedValuesOf('timeZone').includes(req.body.timezone)) {
          throw new CustomError(
            'userProfileInvalidTimezone',
            `Not a recognized IANA time zone: ${req.body.timezone}`
          )
        }
      }

      const patch: UserProfilePatch = {}
      for (const key of [
        'name',
        'location',
        'jobTitle',
        'pronouns',
        'timezone',
        'dateFormat',
        'timeFormat',
        'appearance',
        'cvd'
      ] as const) {
        if (req.body[key] !== undefined) {
          patch[key] = req.body[key]
        }
      }
      if (Object.keys(patch).length < 1) {
        throw new CustomError('userProfileEmpty', 'No profile fields provided to update.')
      }
      if (patch.name !== undefined && !/^[^<>"]+$/.test(patch.name)) {
        throw new CustomError('userProfileInvalidName', 'Invalid User Name')
      }

      const profile = await WIKI.models.users.updateProfile(userId, patch)
      if (!profile) {
        return reply.unauthorized()
      }

      // -> The session carries a copy of the name and the preferences, which `/whoami` serves on
      //    every page load. Left alone, it would hand back the pre-save values.
      req.session.user = {
        ...req.session.user!,
        name: profile.name,
        timezone: profile.timezone,
        dateFormat: profile.dateFormat,
        timeFormat: profile.timeFormat,
        appearance: profile.appearance,
        cvd: profile.cvd
      }

      return {
        ok: true,
        message: 'Profile updated successfully.',
        profile
      }
    }
  )

  /**
   * UPLOAD OWN AVATAR
   */
  app.put(
    '/profile/avatar',
    {
      schema: {
        summary: "Replace the logged in user's own avatar",
        description: `The body is the raw image, not a multipart form — send the file itself with its \`Content-Type\`. At most ${avatarUploadLimit / 1024 / 1024} MB, and it must really be one of the accepted formats: the bytes are checked, not the declared type. Resized to a 180x180 JPEG when the Sharp extension is installed, otherwise stored as uploaded. Requires the current site to have the \`profile\` feature enabled.`,
        tags: ['Users'],
        consumes: [...imageMimeTypes],
        response: {
          200: {
            description: 'Avatar uploaded successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }
      if (!(await isProfileEditable(req))) {
        return reply.forbidden('Profile editing is disabled on this site.')
      }

      const data = req.body
      if (!Buffer.isBuffer(data) || data.length < 1) {
        throw new CustomError('userAvatarEmpty', 'No image was sent.')
      }
      // -> The declared content type got the request this far; what the bytes actually are is what
      //    decides, since they are what gets stored and served back
      if (!detectImageMime(data)) {
        throw new CustomError(
          'userAvatarInvalidImage',
          'Not a PNG, JPEG, WebP or GIF image, whatever the request said it was.'
        )
      }

      await WIKI.models.users.setAvatar(userId, data)
      // -> The account menu reads `hasAvatar` off the session on every page load
      req.session.user = { ...req.session.user!, hasAvatar: true }

      return {
        ok: true,
        message: 'Avatar uploaded successfully.'
      }
    }
  )

  /**
   * CLEAR OWN AVATAR
   */
  app.delete(
    '/profile/avatar',
    {
      schema: {
        summary: "Remove the logged in user's own avatar",
        description:
          'Leaves the user to be rendered as a placeholder again. Succeeds even if there was no avatar to remove. Requires the current site to have the `profile` feature enabled.',
        tags: ['Users'],
        response: {
          200: {
            description: 'Avatar cleared successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }
      if (!(await isProfileEditable(req))) {
        return reply.forbidden('Profile editing is disabled on this site.')
      }

      await WIKI.models.users.clearAvatar(userId)
      req.session.user = { ...req.session.user!, hasAvatar: false }

      return {
        ok: true,
        message: 'Avatar cleared successfully.'
      }
    }
  )

  /**
   * GET OWN GROUPS
   *
   * A user may see which groups it belongs to without holding `read:groups`, which would expose every
   * group on the instance.
   */
  app.get(
    '/profile/groups',
    {
      schema: {
        summary: 'Get the groups the logged in user belongs to',
        description:
          'Only the identity of each group. Reading what a group grants requires `read:groups`.',
        tags: ['Users'],
        response: {
          200: {
            description: 'Groups the user belongs to',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  format: 'uuid'
                },
                name: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }
      return WIKI.models.users.getUserGroups(userId)
    }
  )

  /**
   * GET OWN EDITOR SETTINGS
   *
   * Per-user and per-editor, e.g. whether the markdown editor opens with its preview pane showing.
   * Session-scoped like the rest of `/profile`, so it needs no permission of its own: a user can
   * only ever read its own.
   */
  app.get<{ Params: { editor: string } }>(
    '/profile/editor-settings/:editor',
    {
      schema: {
        summary: "Get the logged in user's settings for one editor",
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            editor: { type: 'string', description: 'Editor key, e.g. `markdown`' }
          },
          required: ['editor']
        },
        response: {
          200: {
            description: 'Editor settings. An object whose shape belongs to the editor.',
            type: 'object',
            additionalProperties: true
          }
        }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }
      return WIKI.models.users.getEditorSettings(userId, req.params.editor)
    }
  )

  /**
   * UPDATE OWN EDITOR SETTINGS
   */
  app.put<{ Params: { editor: string }; Body: Record<string, any> }>(
    '/profile/editor-settings/:editor',
    {
      schema: {
        summary: "Update the logged in user's settings for one editor",
        description:
          "Replaces the settings for this editor. Other editors' settings, and every other preference, are left alone.",
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            editor: { type: 'string', description: 'Editor key, e.g. `markdown`' }
          },
          required: ['editor']
        },
        body: {
          type: 'object',
          additionalProperties: true
        },
        response: {
          200: {
            description: 'Editor settings updated successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              config: { type: 'object', additionalProperties: true }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }
      const config = await WIKI.models.users.setEditorSettings(userId, req.params.editor, req.body)
      if (config === null) {
        // -> The session outlived the user it points at
        return reply.unauthorized()
      }
      return { ok: true, config }
    }
  )

  /**
   * GET OWN AUTHENTICATION METHODS
   *
   * What the profile's authentication page is built from: the providers linked to the account and the
   * passkeys registered against it. Session-scoped like the rest of `/profile` — a user can only ever
   * see its own, and no permission expresses that.
   */
  app.get(
    '/profile/auth',
    {
      schema: {
        summary: "Get the logged in user's authentication methods",
        description:
          'The providers the account can be signed in with, plus its registered passkeys. Secrets are never included: each provider reports only whether a password is set, whether 2FA is active, and whether the user is allowed to turn it off.',
        tags: ['Users'],
        response: {
          200: {
            description: 'Authentication methods',
            type: 'object',
            properties: {
              authMethods: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    authId: { type: 'string', format: 'uuid' },
                    authName: { type: 'string' },
                    strategyKey: { type: 'string' },
                    strategyIcon: { type: 'string' },
                    config: {
                      type: 'object',
                      properties: {
                        isPasswordSet: { type: 'boolean' },
                        isTfaSetup: { type: 'boolean' },
                        isTfaRequired: {
                          type: 'boolean',
                          description:
                            'Either this user is flagged for 2FA or the strategy enforces it. Turning 2FA off is refused while this holds.'
                        },
                        isPasswordLoginEnabled: {
                          type: 'boolean',
                          description:
                            'False once password login has been turned off, by the user or by an administrator.'
                        },
                        canDisablePasswordLogin: {
                          type: 'boolean',
                          description:
                            'Whether the account has another way in — a passkey or another linked provider — and may therefore turn password login off.'
                        }
                      }
                    }
                  }
                }
              },
              passkeys: {
                type: 'array',
                items: { $ref: 'Passkey#' }
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      reply.preventCache()
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }
      return {
        authMethods: await WIKI.models.users.getProfileAuthMethods(userId),
        passkeys: await WIKI.models.passkeys.list(userId)
      }
    }
  )

  /**
   * CHANGE OWN PASSWORD
   */
  app.put<{ Body: { strategyId: string; currentPassword: string; newPassword: string } }>(
    '/profile/password',
    {
      schema: {
        summary: "Change the logged in user's own password",
        description:
          'The current password has to be given, and is what authorizes the change. Only a provider that stores the password on this instance can be changed here. Also clears any pending forced password change.',
        tags: ['Users'],
        body: {
          type: 'object',
          required: ['strategyId', 'currentPassword', 'newPassword'],
          properties: {
            strategyId: {
              type: 'string',
              format: 'uuid',
              description: 'The provider whose password is being changed.'
            },
            currentPassword: { type: 'string', minLength: 1, maxLength: 255 },
            newPassword: { type: 'string', minLength: 8, maxLength: 255 }
          }
        },
        response: {
          200: {
            description: 'Password changed successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }

      try {
        await WIKI.models.users.changeOwnPassword({
          userId,
          strategyId: req.body.strategyId,
          currentPassword: req.body.currentPassword,
          newPassword: req.body.newPassword
        })
      } catch (err: any) {
        rethrowAsBadRequest(err)
      }

      return {
        ok: true,
        message: 'Password changed successfully.'
      }
    }
  )

  /**
   * TURN OWN PASSWORD LOGIN ON OR OFF
   */
  app.put<{ Body: { strategyId: string; isEnabled: boolean } }>(
    '/profile/password-login',
    {
      schema: {
        summary: "Turn password login on or off for the logged in user's own account",
        description:
          'The same restriction an administrator can apply from the admin area. Turning it off is refused unless the account has another way in — a registered passkey or another linked provider — so that a user cannot lock themselves out. The password itself is kept, so turning it back on restores it.',
        tags: ['Users'],
        body: {
          type: 'object',
          required: ['strategyId', 'isEnabled'],
          properties: {
            strategyId: {
              type: 'string',
              format: 'uuid',
              description:
                'The provider to change, which has to be one that stores a password here.'
            },
            isEnabled: { type: 'boolean' }
          }
        },
        response: {
          200: {
            description: 'Password login setting updated successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }

      try {
        await WIKI.models.users.setPasswordLoginEnabled({
          userId,
          strategyId: req.body.strategyId,
          isEnabled: req.body.isEnabled
        })
      } catch (err: any) {
        rethrowAsBadRequest(err)
      }

      return {
        ok: true,
        message: req.body.isEnabled ? 'Password login enabled.' : 'Password login disabled.'
      }
    }
  )

  /**
   * START OWN 2FA SETUP
   *
   * Two steps, because the server cannot know the secret reached the user's authenticator until the
   * user proves it did: this hands out a QR code and a continuation token, and `PUT` activates the
   * secret once a code generated from it comes back.
   */
  app.post<{ Body: { strategyId: string } }>(
    '/profile/tfa',
    {
      schema: {
        summary: "Start setting up 2FA on the logged in user's account",
        description:
          'Generates a secret and returns the QR code to scan. The secret does nothing until a code produced by it is submitted to `PUT /users/profile/tfa` with the continuation token returned here. Starting again replaces a secret that was never activated.',
        tags: ['Users'],
        body: {
          type: 'object',
          required: ['strategyId'],
          properties: {
            strategyId: { type: 'string', format: 'uuid' }
          }
        },
        response: {
          200: {
            description: '2FA setup started',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              continuationToken: { type: 'string' },
              tfaQRImage: {
                type: 'string',
                description: 'The `otpauth://` URI as an SVG QR code, to be rendered as-is.'
              },
              tfaSecret: {
                type: 'string',
                description:
                  'The base32 secret the QR code encodes, for a user who would rather type it into an authenticator app than scan it. Returned only to the user setting 2FA up on their own account — here, and from the login flow that enforces it.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }

      // -> The site names the entry in the user's authenticator app, and is the one being browsed
      //    rather than one the client names: nothing else about this request is client-chosen either
      const site = req.hostname
        ? await WIKI.models.sites.getSiteByHostname({ hostname: req.hostname })
        : null

      try {
        const { continuationToken, tfaQRImage, tfaSecret } =
          await WIKI.models.users.startProfileTfaSetup({
            userId,
            strategyId: req.body.strategyId,
            siteId: site?.id
          })
        return {
          ok: true,
          continuationToken,
          tfaQRImage,
          tfaSecret
        }
      } catch (err: any) {
        rethrowAsBadRequest(err)
      }
    }
  )

  /**
   * FINISH OWN 2FA SETUP
   */
  app.put<{ Body: { strategyId: string; continuationToken: string; securityCode: string } }>(
    '/profile/tfa',
    {
      schema: {
        summary: 'Activate the 2FA secret the logged in user just set up',
        description:
          'Checks a code from the user’s authenticator against the secret generated by `POST /users/profile/tfa`, and activates it. A wrong code can be retried a handful of times before the continuation token is discarded and the setup has to be started again.',
        tags: ['Users'],
        body: {
          type: 'object',
          required: ['strategyId', 'continuationToken', 'securityCode'],
          properties: {
            strategyId: { type: 'string', format: 'uuid' },
            continuationToken: { type: 'string', minLength: 1, maxLength: 255 },
            securityCode: {
              type: 'string',
              pattern: '^[0-9]{6}$',
              description: 'The six digits shown by the authenticator app.'
            }
          }
        },
        response: {
          200: {
            description: '2FA activated successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }

      try {
        await WIKI.models.users.confirmTfaSetup({
          userId,
          strategyId: req.body.strategyId,
          continuationToken: req.body.continuationToken,
          securityCode: req.body.securityCode
        })
      } catch (err: any) {
        rethrowAsBadRequest(err)
      }

      return {
        ok: true,
        message: '2FA enabled successfully.'
      }
    }
  )

  /**
   * TURN OWN 2FA OFF
   */
  app.delete<{ Params: { strategyId: string } }>(
    '/profile/tfa/:strategyId',
    {
      schema: {
        summary: "Turn 2FA off on the logged in user's account",
        description:
          'Forgets the secret, so setting 2FA up again starts from a new one. Refused when the account is flagged for 2FA or the strategy enforces it — the next login would only ask for it again.',
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            strategyId: { type: 'string', format: 'uuid' }
          },
          required: ['strategyId']
        },
        response: {
          204: {
            description: '2FA turned off successfully'
          }
        }
      }
    },
    async (req, reply) => {
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }

      try {
        await WIKI.models.users.disableTfa(userId, req.params.strategyId)
      } catch (err: any) {
        rethrowAsBadRequest(err)
      }

      return reply.code(204).send()
    }
  )

  /**
   * START REGISTERING A PASSKEY
   */
  app.post(
    '/profile/passkeys/challenge',
    {
      schema: {
        summary: 'Get the options for registering a new passkey',
        description:
          "Pass the result to the browser's WebAuthn API, then send what the authenticator produces to `POST /users/profile/passkeys`. The credential is bound to the hostname of this request, so a passkey registered on one site of a multi-site instance does not work on another.",
        tags: ['Users'],
        response: {
          200: {
            description: 'Registration options',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              registrationOptions: {
                type: 'object',
                additionalProperties: true,
                description: 'A WebAuthn `PublicKeyCredentialCreationOptions`, JSON-encoded.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }

      try {
        const { registrationOptions, pending } = await WIKI.models.passkeys.startRegistration({
          userId,
          hostname: req.hostname,
          origin: req.headers.origin
        })
        // -> Kept out of the client's hands: what the authenticator signs is only worth anything if the
        //    challenge it answers is one this server remembers issuing
        req.session.passkeyRegistration = pending
        return {
          ok: true,
          registrationOptions
        }
      } catch (err: any) {
        rethrowAsBadRequest(err)
      }
    }
  )

  /**
   * FINISH REGISTERING A PASSKEY
   */
  app.post<{ Body: { name: string; registrationResponse: Record<string, any> } }>(
    '/profile/passkeys',
    {
      schema: {
        summary: 'Register the passkey an authenticator just created',
        tags: ['Users'],
        body: {
          type: 'object',
          required: ['name', 'registrationResponse'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description: 'What to call it in the list, e.g. the device it lives on.'
            },
            registrationResponse: {
              type: 'object',
              additionalProperties: true,
              description: "The browser's WebAuthn registration response, JSON-encoded."
            }
          }
        },
        response: {
          200: {
            description: 'Passkey registered successfully',
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              passkey: { $ref: 'Passkey#' }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }

      try {
        const passkey = await WIKI.models.passkeys.finalizeRegistration({
          userId,
          name: req.body.name,
          registrationResponse: req.body.registrationResponse as any,
          pending: req.session.passkeyRegistration
        })
        return {
          ok: true,
          passkey
        }
      } catch (err: any) {
        rethrowAsBadRequest(err)
      } finally {
        // -> Spent either way: a rejected response does not get a second go at the same challenge
        req.session.passkeyRegistration = undefined
      }
    }
  )

  /**
   * REMOVE A PASSKEY
   */
  app.delete<{ Params: { passkeyId: string } }>(
    '/profile/passkeys/:passkeyId',
    {
      schema: {
        summary: 'Remove one of the logged in user’s passkeys',
        description:
          'Only this instance forgets it — the credential itself lives on the user’s device and has to be deleted there too.',
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            passkeyId: {
              type: 'string',
              description: 'The credential ID, as listed by `GET /users/profile/auth`.'
            }
          },
          required: ['passkeyId']
        },
        response: {
          204: {
            description: 'Passkey removed successfully'
          }
        }
      }
    },
    async (req, reply) => {
      const userId = sessionUserId(req)
      if (!userId) {
        return reply.unauthorized()
      }
      if (!(await WIKI.models.passkeys.remove(userId, req.params.passkeyId))) {
        return reply.notFound('You have no passkey with this ID.')
      }
      return reply.code(204).send()
    }
  )

  /**
   * GET USER DEFAULTS
   *
   * Instance-wide, not per-site: stored as the `userDefaults` key of the settings table.
   */
  app.get(
    '/defaults',
    {
      config: {
        permissions: ['read:users', 'manage:users']
      },
      schema: {
        summary: 'Get the defaults applied to new users',
        tags: ['Users'],
        response: {
          200: {
            description: 'User defaults',
            type: 'object',
            $ref: 'UserDefaults#'
          }
        }
      }
    },
    async () => {
      return WIKI.config.userDefaults
    }
  )

  /**
   * UPDATE USER DEFAULTS
   */
  app.put<{ Body: { timezone?: string; dateFormat?: string; timeFormat?: string } }>(
    '/defaults',
    {
      config: {
        permissions: ['manage:users']
      },
      schema: {
        summary: 'Update the defaults applied to new users',
        description:
          'These are instance-wide, not per-site. Existing users keep their own preferences.',
        tags: ['Users'],
        body: {
          $ref: 'UserDefaults#'
        },
        response: {
          200: {
            description: 'User defaults updated successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      // -> A bad time zone would break every date the affected users see, and the list of valid
      //    zones is only known at runtime, so it cannot be expressed as a schema enum
      if (req.body.timezone !== undefined) {
        if (!Intl.supportedValuesOf('timeZone').includes(req.body.timezone)) {
          throw new CustomError(
            'userDefaultsInvalidTimezone',
            `Not a recognized IANA time zone: ${req.body.timezone}`
          )
        }
      }

      const patch: Record<string, any> = {}
      for (const key of ['timezone', 'dateFormat', 'timeFormat'] as const) {
        if (req.body[key] !== undefined) {
          patch[key] = req.body[key]
        }
      }
      if (Object.keys(patch).length < 1) {
        throw new CustomError('userDefaultsEmpty', 'No user defaults provided to update.')
      }

      const previousDefaults = WIKI.config.userDefaults
      WIKI.config.userDefaults = { ...previousDefaults, ...patch }

      if (!(await WIKI.configSvc.saveToDb(['userDefaults']))) {
        WIKI.config.userDefaults = previousDefaults
        return reply.internalServerError('Failed to save user defaults.')
      }

      return {
        ok: true,
        message: 'User defaults updated successfully.'
      }
    }
  )

  app.get<{ Params: { userId: string } }>(
    '/:userId',
    {
      config: {
        permissions: ['read:users', 'manage:users']
      },
      schema: {
        summary: 'Get user info',
        description:
          'Returns the user with its group membership and linked authentication providers.',
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['userId']
        },
        response: {
          200: {
            description: 'User info',
            type: 'object',
            $ref: 'User#'
          }
        }
      }
    },
    async (req, reply) => {
      const user = await WIKI.models.users.getUserDetail(req.params.userId)
      if (!user) {
        return reply.notFound('User does not exist.')
      }
      return user
    }
  )

  /**
   * CREATE USER
   */
  app.post<{
    Body: {
      name: string
      email: string
      password: string
      groups?: string[]
      mustChangePassword?: boolean
      sendWelcomeEmail?: boolean
      sendWelcomeEmailFromSiteId?: string
    }
  }>(
    '/',
    {
      config: {
        permissions: ['create:users', 'manage:users']
      },
      schema: {
        summary: 'Create a new user',
        description:
          'Creates a user authenticated against the local strategy. With `sendWelcomeEmail` the new address is told the account exists and where to sign in — the account is created either way, so a mail that could not be sent is reported in the reply rather than failing the request.',
        tags: ['Users'],
        body: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            },
            email: {
              type: 'string',
              format: 'email',
              maxLength: 255
            },
            password: {
              type: 'string',
              minLength: 8,
              maxLength: 255
            },
            groups: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uuid'
              }
            },
            mustChangePassword: {
              type: 'boolean',
              default: false
            },
            sendWelcomeEmail: {
              type: 'boolean',
              default: false
            },
            sendWelcomeEmailFromSiteId: {
              type: 'string',
              format: 'uuid'
            }
          },
          examples: [
            {
              name: 'Jane Doe',
              email: 'jane@example.com',
              password: 'a-long-password',
              groups: []
            }
          ]
        },
        response: {
          200: {
            description: 'User created successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              },
              id: {
                type: 'string',
                format: 'uuid'
              },
              welcomeEmailError: {
                type: 'string',
                description:
                  'Only when `sendWelcomeEmail` was asked for and the mail server refused it — what it said. The account was still created.'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      if (!/^[^<>"]+$/.test(req.body.name)) {
        throw new CustomError('userCreateInvalidName', 'Invalid User Name')
      }
      if (await WIKI.models.users.getByEmail(req.body.email.toLowerCase())) {
        throw new CustomError('userCreateDuplicateEmail', 'A user with this email already exists.')
      }
      if (req.body.sendWelcomeEmail && !WIKI.models.mail.isConfigured) {
        throw new CustomError(
          'userCreateWelcomeEmailUnavailable',
          'No SMTP server is configured, so no welcome email can be sent.'
        )
      }

      try {
        const id = await WIKI.models.users.createUser({
          name: req.body.name,
          email: req.body.email,
          password: req.body.password,
          groups: req.body.groups ?? [],
          mustChangePassword: req.body.mustChangePassword ?? false
        })
        /*
          After the account, and never allowed to undo it: an administrator asked for a user and got
          one, and a mail server that would not take the message does not change that. The failure is
          reported in the same reply instead, since the button that sends it again is one screen away.
        */
        if (req.body.sendWelcomeEmail) {
          try {
            await WIKI.models.users.sendWelcomeEmail({
              userId: id,
              siteId: req.body.sendWelcomeEmailFromSiteId,
              req
            })
          } catch (err: any) {
            WIKI.logger.warn(`Welcome email for new user ${id} failed: ${err.message}`)
            return {
              ok: true,
              message: 'User created successfully.',
              id,
              welcomeEmailError: err.message
            }
          }
        }
        return {
          ok: true,
          message: 'User created successfully.',
          id
        }
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.internalServerError()
      }
    }
  )

  /**
   * UPDATE USER
   */
  app.put<{ Params: { userId: string }; Body: UserUpdateBody }>(
    '/:userId',
    {
      config: {
        permissions: ['manage:users']
      },
      schema: {
        summary: 'Update a user',
        description:
          'Updates any subset of the user fields. Omitted fields are left unchanged. Passing `groups` replaces the group membership entirely — except for system users (the guest account), whose membership is fixed.',
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['userId']
        },
        body: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 255
            },
            email: {
              type: 'string',
              format: 'email',
              maxLength: 255
            },
            isActive: {
              type: 'boolean'
            },
            isVerified: {
              type: 'boolean'
            },
            meta: {
              type: 'object',
              additionalProperties: true
            },
            prefs: {
              type: 'object',
              additionalProperties: true
            },
            groups: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uuid'
              }
            },
            auth: {
              type: 'object',
              description:
                'Local-strategy flags: `mustChangePwd`, `restrictLogin`, `tfaRequired`. Secrets cannot be set here — use the password endpoint.',
              properties: {
                mustChangePwd: {
                  type: 'boolean'
                },
                restrictLogin: {
                  type: 'boolean'
                },
                tfaRequired: {
                  type: 'boolean'
                }
              }
            }
          }
        },
        response: {
          200: {
            description: 'User updated successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const user = await WIKI.models.users.getById(req.params.userId)
      if (!user) {
        return reply.notFound('User does not exist.')
      }

      const systemUserRefusal = await systemUserGuard(req, user.id)
      if (systemUserRefusal) {
        throw systemUserRefusal
      }

      // -> Collect only the fields actually provided
      const patch: UserPatch = {}
      for (const key of ['name', 'email', 'isActive', 'isVerified', 'meta', 'prefs'] as const) {
        if (req.body[key] !== undefined) {
          ;(patch as Record<string, any>)[key] = req.body[key]
        }
      }

      if (
        Object.keys(patch).length < 1 &&
        req.body.groups === undefined &&
        req.body.auth === undefined
      ) {
        throw new CustomError('userUpdateEmpty', 'No user fields provided to update.')
      }

      // -> Email is unique, so a clash needs a clearer answer than a constraint violation
      if (patch.email && patch.email.toLowerCase() !== user.email.toLowerCase()) {
        if (await WIKI.models.users.getByEmail(patch.email.toLowerCase())) {
          throw new CustomError(
            'userUpdateDuplicateEmail',
            'A user with this email already exists.'
          )
        }
      }

      // -> Group membership is replaced wholesale here, which would otherwise be a way around the
      //    guards on the groups endpoint.
      if (req.body.groups !== undefined) {
        // -> The guest account must stay in the guests group and nowhere else. Resending the
        //    membership unchanged is allowed, so that saving another field is not blocked.
        if (user.isSystem) {
          const current = await WIKI.models.users.getUserGroupIds(req.params.userId)
          const requested = req.body.groups
          const unchanged =
            current.length === requested.length && current.every((id) => requested.includes(id))
          if (!unchanged) {
            return reply.conflict('Cannot change the group membership of a system user.')
          }
        }

        /*
          Handing somebody `manage:system` by putting them in a group that carries it. Only ADDING is
          checked: a user already in such a group is protected by `systemUserGuard` above, which has
          refused this request before it gets here.
        */
        if (!WIKI.models.groups.holdsSystemPermission(req)) {
          const current = await WIKI.models.users.getUserGroupIds(req.params.userId)
          const systemGroupIds = await WIKI.models.groups.systemGroupIds()
          const added = req.body.groups.filter((id) => !current.includes(id))
          if (added.some((id) => systemGroupIds.includes(id))) {
            throw new CustomError(
              'groupMembershipSystemProtected',
              'Only a user who holds the manage:system permission can add a user to a group that has it.',
              403
            )
          }
        }

        const rootAdminGroupId = WIKI.config.auth.rootAdminGroupId
        const wasRootAdmin = await WIKI.models.groups.isUserInGroup(
          rootAdminGroupId,
          req.params.userId
        )
        if (wasRootAdmin && !req.body.groups.includes(rootAdminGroupId)) {
          if ((await WIKI.models.groups.countUsersInGroup(rootAdminGroupId)) <= 1) {
            return reply.conflict('Cannot remove the last user from the root administrators group.')
          }
        }
      }

      try {
        if (Object.keys(patch).length > 0) {
          await WIKI.models.users.updateUser(req.params.userId, patch)
        }
        if (req.body.groups !== undefined) {
          await WIKI.models.users.setUserGroups(req.params.userId, req.body.groups)
        }
        if (req.body.auth !== undefined) {
          await WIKI.models.users.setUserAuthFlags(req.params.userId, req.body.auth)
        }
        return {
          ok: true,
          message: 'User updated successfully.'
        }
      } catch (err: any) {
        WIKI.logger.warn(err)
        return reply.internalServerError()
      }
    }
  )

  /**
   * SET USER PASSWORD
   */
  app.put<{
    Params: { userId: string }
    Body: { newPassword: string; mustChangePassword?: boolean }
  }>(
    '/:userId/password',
    {
      config: {
        permissions: ['manage:users']
      },
      schema: {
        summary: "Set a user's password",
        description: 'Replaces the local-strategy password. Other linked providers are untouched.',
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['userId']
        },
        body: {
          type: 'object',
          required: ['newPassword'],
          properties: {
            newPassword: {
              type: 'string',
              minLength: 8,
              maxLength: 255
            },
            mustChangePassword: {
              type: 'boolean',
              default: false
            }
          }
        },
        response: {
          200: {
            description: 'Password updated successfully',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      const systemUserRefusal = await systemUserGuard(req, req.params.userId)
      if (systemUserRefusal) {
        throw systemUserRefusal
      }

      const updated = await WIKI.models.users.setUserPassword({
        id: req.params.userId,
        newPassword: req.body.newPassword,
        mustChangePassword: req.body.mustChangePassword ?? false
      })
      if (!updated) {
        return reply.notFound('User does not exist.')
      }
      return {
        ok: true,
        message: 'User password updated successfully.'
      }
    }
  )

  /**
   * SEND A WELCOME EMAIL
   *
   * The same mail `POST /users` offers to send on create, available afterwards — for an account
   * created before mail was configured, or one whose owner never got the first one.
   */
  app.post<{ Params: { userId: string }; Body: { siteId?: string } }>(
    '/:userId/send-welcome-email',
    {
      config: {
        permissions: ['manage:users']
      },
      schema: {
        summary: 'Send a welcome email to a user',
        description:
          "Tells the account's address that it exists and where to sign in. Carries no password and no confirmation link: an account an administrator created is verified already.",
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['userId']
        },
        body: {
          type: 'object',
          properties: {
            siteId: {
              type: 'string',
              format: 'uuid',
              description:
                'Which site to welcome them to, i.e. whose name and address the mail carries. Defaults to the one this request was addressed to.'
            }
          }
        },
        response: {
          200: {
            description: 'The welcome email was accepted by the mail server',
            type: 'object',
            properties: {
              ok: {
                type: 'boolean'
              },
              message: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    async (req, reply) => {
      if (!WIKI.models.mail.isConfigured) {
        return reply.badRequest('No SMTP server is configured, so no welcome email can be sent.')
      }
      try {
        await WIKI.models.users.sendWelcomeEmail({
          userId: req.params.userId,
          siteId: req.body?.siteId,
          req
        })
        return {
          ok: true,
          message: 'Welcome email sent successfully.'
        }
      } catch (err: any) {
        if (err.message === 'ERR_INVALID_USER') {
          return reply.notFound('User does not exist.')
        }
        WIKI.logger.warn(`Welcome email for user ${req.params.userId} failed: ${err.message}`)
        // -> The mail server's own words, as with the test mail: what is wrong is on its end
        return reply.badRequest(err.message)
      }
    }
  )

  app.delete<{ Params: { userId: string } }>(
    '/:userId',
    {
      config: {
        permissions: ['manage:users']
      },
      schema: {
        summary: 'Delete a user',
        description:
          'System users cannot be deleted, nor the account the caller is signed in as, nor the last user of the root administrators group. A user who has authored pages or assets cannot be deleted either — deactivate them, or reassign what they own.',
        tags: ['Users'],
        params: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid'
            }
          },
          required: ['userId']
        },
        response: {
          204: {
            description: 'User deleted successfully'
          }
        }
      }
    },
    async (req, reply) => {
      const user = await WIKI.models.users.getById(req.params.userId)
      if (!user) {
        return reply.notFound('User does not exist.')
      }

      const systemUserRefusal = await systemUserGuard(req, user.id)
      if (systemUserRefusal) {
        throw systemUserRefusal
      }

      // -> The guest account is the only system user, and anonymous access is resolved through it
      if (user.isSystem) {
        return reply.conflict('Cannot delete a system user.')
      }

      /*
        Not your own account, whatever permissions you hold: the request would end the session making
        it, and an administrator who did it by accident has nothing left to undo it with. Another
        administrator can — which is also the answer to an account that has to go and cannot ask.
      */
      if (user.id === sessionUserId(req)) {
        return reply.conflict('You cannot delete your own account. Another administrator can.')
      }

      // -> Emptying the root administrators group would lock everyone out of system management
      const rootAdminGroupId = WIKI.config.auth.rootAdminGroupId
      if (await WIKI.models.groups.isUserInGroup(rootAdminGroupId, user.id)) {
        if ((await WIKI.models.groups.countUsersInGroup(rootAdminGroupId)) <= 1) {
          return reply.conflict('Cannot delete the last user of the root administrators group.')
        }
      }

      try {
        await WIKI.models.users.deleteUser(user.id)
        return reply.code(204).send()
      } catch (err: any) {
        // -> Pages and assets reference users without a cascade, so a user who authored content
        //    cannot be removed. That is a conflict to report, not a server fault.
        if (err.cause?.code === '23503' || err.code === '23503') {
          return reply.conflict(
            'Cannot delete a user who still owns pages or assets. Reassign them first.'
          )
        }
        WIKI.logger.warn(err)
        return reply.internalServerError()
      }
    }
  )
}

export default routes
