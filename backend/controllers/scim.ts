import { audit } from '../helpers/audit.ts'
import { CustomError, originOf } from '../helpers/common.ts'
import { elevatedGroupGuard, systemUserGuard } from '../helpers/userGuards.ts'
import {
  SCHEMA_ERROR,
  SCHEMA_GROUP,
  SCHEMA_USER,
  SCIM_CONTENT_TYPE,
  SCIM_MAX_RESULTS,
  SCIM_PERMISSION,
  ScimError
} from '../models/scim.ts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

/**
 * SCIM 2.0, at `/_scim/v2`.
 *
 * A controller rather than a route plugin under `api/`, and every one of the four reasons is
 * load-bearing:
 *
 *   - **The error body.** RFC 7644 §3.12 gives a refusal its own shape, with a `scimType` a
 *     connector branches on. The `/_api/` error handler in `index.ts` produces a different one, so
 *     this plugin sets its own inside its encapsulation context.
 *   - **The content type** is `application/scim+json`. Parsed here and nowhere else, so every other
 *     route in the wiki goes on refusing it.
 *   - **The 404 body** has to be a SCIM error too, which is a not-found handler of its own.
 *   - **OpenAPI.** `hideUntagged` is on and nothing here declares a tag, so SCIM stays out of the
 *     API docs — it is described by its own RFC and by the discovery endpoints below.
 *
 * Authorization is `manage:scim`, held as a bearer API key (the usual case — a connector) or by a
 * signed-in session (which is what makes the endpoint drivable by hand while it is being set up).
 * It is checked in this plugin's own hook rather than through `config.permissions`, because the
 * enabled check has to come first — a wiki that has not turned provisioning on answers 404, not 401
 * — and because every refusal on this prefix has to leave as a SCIM error.
 *
 * What it may then DO is not decided here: `helpers/userGuards.ts` holds the same three guards the
 * admin API goes through, so a directory cannot reach through `/_scim` for something an
 * administrator could not do through `/_api`. In practice that means a SCIM client can never staff
 * the Administrators group, nor touch an account that belongs to it.
 */

/** RFC 7644 §5 — what this service provider supports, which connectors read before they sync. */
const SERVICE_PROVIDER_CONFIG = {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
  documentationUri: 'https://docs.js.wiki/admin/scim',
  patch: { supported: true },
  bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
  filter: { supported: true, maxResults: SCIM_MAX_RESULTS },
  changePassword: { supported: false },
  sort: { supported: false },
  etag: { supported: false },
  authenticationSchemes: [
    {
      type: 'oauthbearertoken',
      name: 'OAuth Bearer Token',
      description:
        'An API key issued under Admin → API, belonging to a group that holds the manage:scim permission.',
      specUri: 'https://www.rfc-editor.org/rfc/rfc6750',
      primary: true
    }
  ]
}

const RESOURCE_TYPES = [
  {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
    id: 'User',
    name: 'User',
    endpoint: '/Users',
    description: 'A wiki user account.',
    schema: SCHEMA_USER,
    schemaExtensions: []
  },
  {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
    id: 'Group',
    name: 'Group',
    endpoint: '/Groups',
    description: 'A wiki group. Its permissions and page rules are set in the wiki, never here.',
    schema: SCHEMA_GROUP,
    schemaExtensions: []
  }
]

/** A shorthand for the attribute declarations below, which are otherwise nine identical lines each. */
function attr(name: string, overrides: Record<string, any> = {}): Record<string, any> {
  return {
    name,
    type: 'string',
    multiValued: false,
    required: false,
    caseExact: false,
    mutability: 'readWrite',
    returned: 'default',
    uniqueness: 'none',
    ...overrides
  }
}

/**
 * The two schemas, declaring only what this wiki actually stores.
 *
 * Deliberately short of RFC 7643's full User: a wiki account is a name, an address and whether it is
 * active. An attribute declared here that nothing could be written to would be a promise the mapping
 * does not keep.
 */
const SCHEMAS = [
  {
    id: SCHEMA_USER,
    name: 'User',
    description: 'A wiki user account.',
    attributes: [
      attr('userName', { required: true, uniqueness: 'server' }),
      {
        ...attr('name'),
        type: 'complex',
        subAttributes: [attr('formatted'), attr('givenName'), attr('familyName')]
      },
      attr('displayName'),
      attr('title'),
      attr('timezone'),
      attr('active', { type: 'boolean' }),
      {
        ...attr('emails'),
        type: 'complex',
        multiValued: true,
        subAttributes: [attr('value'), attr('type'), attr('primary', { type: 'boolean' })]
      },
      {
        ...attr('groups', { mutability: 'readOnly' }),
        type: 'complex',
        multiValued: true,
        subAttributes: [
          attr('value', { mutability: 'readOnly' }),
          attr('display', { mutability: 'readOnly' }),
          attr('$ref', { type: 'reference', mutability: 'readOnly' })
        ]
      }
    ],
    meta: { resourceType: 'Schema', location: `/Schemas/${SCHEMA_USER}` }
  },
  {
    id: SCHEMA_GROUP,
    name: 'Group',
    description: 'A wiki group. Its permissions and page rules are set in the wiki, never here.',
    attributes: [
      attr('displayName', { required: true, uniqueness: 'server' }),
      {
        ...attr('members'),
        type: 'complex',
        multiValued: true,
        subAttributes: [
          attr('value'),
          attr('display', { mutability: 'immutable' }),
          attr('$ref', { type: 'reference' })
        ]
      }
    ],
    meta: { resourceType: 'Schema', location: `/Schemas/${SCHEMA_GROUP}` }
  }
]

/** Where `meta.location` and every `$ref` point, as this request reached the wiki. */
function baseUrlFor(req: FastifyRequest): string {
  return `${originOf(req)}/_scim/v2`
}

/** Send a resource, always under the SCIM media type. */
function sendScim(reply: FastifyReply, status: number, body: unknown): FastifyReply {
  return reply.code(status).type(`${SCIM_CONTENT_TYPE}; charset=utf-8`).send(body)
}

/** What a request holds, whether it arrived as a bearer key or as a browser session. */
function permissionsOf(req: FastifyRequest): string[] | null {
  if (req.apiKey) {
    return req.apiKey.permissions
  }
  return req.session?.authenticated ? (req.session.permissions ?? []) : null
}

/** A caller guard's refusal, as the SCIM error it has to leave as. */
function asScimError(refusal: CustomError): ScimError {
  return new ScimError(refusal.statusCode, refusal.message)
}

/**
 * The body of a write, as an object.
 *
 * Both content types land here — `application/json` through Fastify's own parser and
 * `application/scim+json` through the one registered below — so this only has to catch the request
 * that carried nothing at all, which several connectors send while probing an endpoint.
 */
function resourceBody(req: FastifyRequest): Record<string, any> {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ScimError(400, 'A request body is required.', 'invalidSyntax')
  }
  return body as Record<string, any>
}

async function routes(app: FastifyInstance) {
  /*
    RFC 7644 §3.1 gives SCIM its own media type. Registered inside this plugin, so that a body of
    `application/scim+json` posted anywhere else in the wiki goes on being refused.
  */
  app.addContentTypeParser(
    [SCIM_CONTENT_TYPE],
    { parseAs: 'string' },
    (_req, body: string | Buffer, done) => {
      const text = body.toString().trim()
      if (text.length < 1) {
        done(null, undefined)
        return
      }
      try {
        done(null, JSON.parse(text))
      } catch {
        done(new ScimError(400, 'The request body is not valid JSON.', 'invalidSyntax'), undefined)
      }
    }
  )

  // ----------------------------------------
  // Errors
  // ----------------------------------------

  app.setErrorHandler((error: any, req, reply) => {
    const statusCode: number =
      error instanceof ScimError ? error.statusCode : (error.statusCode ?? 500)
    const isFault = statusCode >= 500
    if (isFault) {
      WIKI.logger.warn(`SCIM ${req.method} ${req.url} failed: ${error.message}`)
    }
    const detail = isFault ? 'Internal server error.' : error.message
    WIKI.models.scim.recordRequest({
      method: req.method,
      path: req.url,
      status: statusCode,
      message: detail
    })
    return sendScim(reply, statusCode, {
      schemas: [SCHEMA_ERROR],
      status: String(statusCode),
      ...(error instanceof ScimError && error.scimType ? { scimType: error.scimType } : {}),
      detail
    })
  })

  app.setNotFoundHandler((req, reply) => {
    WIKI.models.scim.recordRequest({
      method: req.method,
      path: req.url,
      status: 404,
      message: 'No such SCIM endpoint.'
    })
    return sendScim(reply, 404, {
      schemas: [SCHEMA_ERROR],
      status: '404',
      detail: `No SCIM endpoint answers ${req.method} ${req.url}.`
    })
  })

  // ----------------------------------------
  // Access
  // ----------------------------------------

  app.addHook('onRequest', async (req, reply) => {
    if (!WIKI.models.scim.isEnabled()) {
      /*
        404 rather than 403: with provisioning off there is no endpoint here, and a connector pointed
        at a wiki that has not turned it on should be told the URL is wrong rather than that its
        token is. The message names the feature, which is in the manual anyway.
      */
      return sendScim(reply, 404, {
        schemas: [SCHEMA_ERROR],
        status: '404',
        detail: 'SCIM provisioning is not enabled on this wiki.'
      })
    }
    /*
      The address check comes before everything else that costs anything: it is the only gate here
      that needs neither the database nor a signature, and an operator who has written a list has
      said requests from anywhere else are not to be entertained at all.

      403 rather than 404. Hiding the endpoint from an address would be pointless — it is a fixed,
      documented path on a wiki that is answering on every other one — and a connector moved to a
      new egress range needs to be told which of the two things is wrong.
    */
    if (!WIKI.models.scim.isAddressAllowed(req.ip)) {
      WIKI.logger.debug(`Refused a SCIM request from ${req.ip}: not in the allowed address list.`)
      return sendScim(reply, 403, {
        schemas: [SCHEMA_ERROR],
        status: '403',
        detail: 'This address is not allowed to reach the SCIM endpoint.'
      })
    }

    /*
      Then the limit, and before the credential check rather than after it, so that an unauthorized
      flood is capped as well as an authorized one — the request being refused is exactly when the
      counter matters. Counted per address against the same postgres-backed counter the login limit
      uses, so two instances behind a load balancer share one budget.

      Successes are counted too, as they are for auth. A sync is what this endpoint is FOR, so the
      ceiling is set high enough that an ordinary one never approaches it; see `base.yml`.
    */
    const config = WIKI.models.scim.getConfig()
    if (config.rateLimitEnabled) {
      const verdict = await WIKI.models.rateLimits.consume(
        `scim:${req.ip}`,
        WIKI.models.scim.rateLimitPolicy()
      )
      if (!verdict.allowed) {
        WIKI.logger.debug(
          `Rate limit: refused a SCIM request from ${req.ip}, ${verdict.retryAfter}s left of its ban.`
        )
        // -> `Retry-After` because this is the same answer as before with a time on it, and a
        //    connector that reads it will come back rather than give up on the sync
        return sendScim(reply.header('Retry-After', String(verdict.retryAfter)), 429, {
          schemas: [SCHEMA_ERROR],
          status: '429',
          detail: `Too many requests. Try again in ${verdict.retryAfter}s.`
        })
      }
    }

    const permissions = permissionsOf(req)
    if (!permissions) {
      return sendScim(reply.header('WWW-Authenticate', 'Bearer realm="scim"'), 401, {
        schemas: [SCHEMA_ERROR],
        status: '401',
        detail: 'This endpoint requires a bearer API key.'
      })
    }
    if (!permissions.includes(SCIM_PERMISSION) && !permissions.includes('manage:system')) {
      return sendScim(reply, 403, {
        schemas: [SCHEMA_ERROR],
        status: '403',
        detail: `This endpoint requires the ${SCIM_PERMISSION} permission.`
      })
    }
  })

  // -> Failures are recorded by the error handler above, which has the reason; this is the other half
  app.addHook('onResponse', async (req, reply) => {
    if (reply.statusCode < 400) {
      WIKI.models.scim.recordRequest({
        method: req.method,
        path: req.url,
        status: reply.statusCode,
        message: null
      })
    }
  })

  // ----------------------------------------
  // Discovery
  // ----------------------------------------

  app.get('/v2/ServiceProviderConfig', async (req, reply) =>
    sendScim(reply, 200, {
      ...SERVICE_PROVIDER_CONFIG,
      meta: {
        resourceType: 'ServiceProviderConfig',
        location: `${baseUrlFor(req)}/ServiceProviderConfig`
      }
    })
  )

  app.get('/v2/ResourceTypes', async (req, reply) => {
    const baseUrl = baseUrlFor(req)
    const resources = RESOURCE_TYPES.map((type) => ({
      ...type,
      meta: { resourceType: 'ResourceType', location: `${baseUrl}/ResourceTypes/${type.id}` }
    }))
    return sendScim(reply, 200, WIKI.models.scim.listResponse(resources, resources.length, 1))
  })

  app.get<{ Params: { id: string } }>('/v2/ResourceTypes/:id', async (req, reply) => {
    const type = RESOURCE_TYPES.find((entry) => entry.id === req.params.id)
    if (!type) {
      throw new ScimError(404, `No resource type named '${req.params.id}'.`)
    }
    return sendScim(reply, 200, {
      ...type,
      meta: {
        resourceType: 'ResourceType',
        location: `${baseUrlFor(req)}/ResourceTypes/${type.id}`
      }
    })
  })

  app.get('/v2/Schemas', async (_req, reply) =>
    sendScim(reply, 200, WIKI.models.scim.listResponse(SCHEMAS, SCHEMAS.length, 1))
  )

  app.get<{ Params: { id: string } }>('/v2/Schemas/:id', async (req, reply) => {
    const schema = SCHEMAS.find((entry) => entry.id === req.params.id)
    if (!schema) {
      throw new ScimError(404, `No schema named '${req.params.id}'.`)
    }
    return sendScim(reply, 200, schema)
  })

  // ----------------------------------------
  // Users
  // ----------------------------------------

  /** One user as SCIM describes them, memberships included. */
  async function userResource(req: FastifyRequest, user: Record<string, any>) {
    const memberships = await WIKI.models.scim.membershipsOf([user.id])
    return WIKI.models.scim.toScimUser(user, memberships.get(user.id) ?? [], baseUrlFor(req))
  }

  /** The user this request names, or the 404 that says nothing about why. */
  async function requireUser(id: string): Promise<Record<string, any>> {
    const user = await WIKI.models.scim.getUser(id)
    if (!user) {
      throw new ScimError(404, `No user with id '${id}'.`)
    }
    return user
  }

  app.get<{ Querystring: Record<string, any> }>('/v2/Users', async (req, reply) => {
    const { startIndex, count } = WIKI.models.scim.parsePaging(req.query)
    return sendScim(
      reply,
      200,
      await WIKI.models.scim.listUsers({
        filter: req.query.filter,
        startIndex,
        count,
        baseUrl: baseUrlFor(req)
      })
    )
  })

  app.get<{ Params: { id: string } }>('/v2/Users/:id', async (req, reply) =>
    sendScim(reply, 200, await userResource(req, await requireUser(req.params.id)))
  )

  app.post('/v2/Users', async (req, reply) => {
    const id = await WIKI.models.scim.createUser(resourceBody(req))
    const user = await requireUser(id)

    await audit(req, 'admin', 'createUser', {
      source: 'scim',
      targetUserId: id,
      name: user.name,
      email: user.email,
      externalId: user.externalId
    })

    const resource = await userResource(req, user)
    return sendScim(reply.header('Location', resource.meta.location), 201, resource)
  })

  /**
   * Replace a user, and adopt it if it was not already provisioned.
   *
   * Only the attributes the resource carries are applied. A SCIM PUT is nominally a whole-resource
   * replace, but this wiki has fields SCIM does not describe and no notion of an unset name — so an
   * attribute a connector left out leaves the stored value alone rather than blanking it.
   */
  app.put<{ Params: { id: string } }>('/v2/Users/:id', async (req, reply) => {
    const user = await requireUser(req.params.id)
    const refusal = await systemUserGuard(req, user.id)
    if (refusal) {
      throw asScimError(refusal)
    }

    await WIKI.models.scim.applyUser(user, resourceBody(req))
    const updated = await requireUser(user.id)

    await audit(req, 'admin', 'updateUser', {
      source: 'scim',
      targetUserId: user.id,
      targetName: updated.name,
      targetEmail: updated.email,
      isActive: updated.isActive
    })

    return sendScim(reply, 200, await userResource(req, updated))
  })

  app.patch<{ Params: { id: string } }>('/v2/Users/:id', async (req, reply) => {
    const user = await requireUser(req.params.id)
    const refusal = await systemUserGuard(req, user.id)
    if (refusal) {
      throw asScimError(refusal)
    }

    const fragment = WIKI.models.scim.parseUserPatch(resourceBody(req))
    await WIKI.models.scim.applyUser(user, fragment)
    const updated = await requireUser(user.id)

    await audit(req, 'admin', 'updateUser', {
      source: 'scim',
      targetUserId: user.id,
      targetName: updated.name,
      targetEmail: updated.email,
      isActive: updated.isActive,
      changedFields: Object.keys(fragment)
    })

    return sendScim(reply, 200, await userResource(req, updated))
  })

  /**
   * Deprovision a user.
   *
   * Only for an account the directory owns: one created here and never written by a connector
   * answers 404, which is SCIM's way of saying "not a resource of mine". That is what keeps a token
   * sitting in somebody else's console from emptying the wiki's user list, and it costs nothing —
   * a connector adopts an account the first time it writes to one.
   *
   * What deprovisioning MEANS is the site's `deleteAction` setting. See `models/scim.ts`.
   */
  app.delete<{ Params: { id: string } }>('/v2/Users/:id', async (req, reply) => {
    const user = await requireUser(req.params.id)
    if (!user.isProvisioned) {
      throw new ScimError(
        404,
        `The user '${user.email}' was not created by provisioning, so it cannot be removed by it.`
      )
    }
    const refusal = await systemUserGuard(req, user.id)
    if (refusal) {
      throw asScimError(refusal)
    }

    const action = await WIKI.models.scim.deprovisionUser(user.id)

    await audit(req, 'admin', action === 'delete' ? 'deleteUser' : 'updateUser', {
      source: 'scim',
      deprovisioned: action,
      targetUserId: user.id,
      targetName: user.name,
      targetEmail: user.email
    })

    return reply.code(204).send()
  })

  // ----------------------------------------
  // Groups
  // ----------------------------------------

  async function groupResource(req: FastifyRequest, group: Record<string, any>) {
    const members = await WIKI.models.scim.membersOf([group.id])
    return WIKI.models.scim.toScimGroup(group, members.get(group.id) ?? [], baseUrlFor(req))
  }

  async function requireGroup(id: string): Promise<Record<string, any>> {
    const group = await WIKI.models.scim.getGroup(id)
    if (!group) {
      throw new ScimError(404, `No group with id '${id}'.`)
    }
    return group
  }

  /**
   * Refuse a membership change the caller may not make.
   *
   * Two separate questions, and both have to be asked. `elevatedGroupGuard` is about the GROUP: a
   * SCIM client holds `manage:scim` and not `manage:groups`, so every group carrying an elevated
   * permission is closed to it — which is precisely what stops a directory group called
   * "Administrators" from syncing its membership into the wiki's. `systemUserGuard` is about each
   * PERSON being moved: an account protected by `manage:system` is not re-grouped by anything short
   * of `manage:system`.
   */
  async function guardMembership(
    req: FastifyRequest,
    groupId: string,
    touched: string[]
  ): Promise<void> {
    const full = await WIKI.models.groups.getGroupById(groupId)
    if (!full) {
      throw new ScimError(404, `No group with id '${groupId}'.`)
    }
    const groupRefusal = elevatedGroupGuard(req, full, 'change who belongs to the group')
    if (groupRefusal) {
      throw asScimError(groupRefusal)
    }
    for (const userId of touched) {
      const userRefusal = await systemUserGuard(req, userId)
      if (userRefusal) {
        throw asScimError(userRefusal)
      }
    }
  }

  /**
   * Bring a group's membership to exactly `target`, one assignment at a time.
   *
   * Not `users.setUserGroups`, which replaces one user's whole membership and would take them out of
   * every other group in the wiki. `assignUserToGroup` and its opposite are per membership, and are
   * also where the guest account's fixed membership is enforced.
   */
  async function applyMembership(
    req: FastifyRequest,
    groupId: string,
    target: string[]
  ): Promise<{ added: string[]; removed: string[] }> {
    const current = await WIKI.models.scim.memberIdsOf(groupId)
    const wanted = [...new Set(target)]

    const unknown = await WIKI.models.scim.firstUnknownUser(wanted)
    if (unknown) {
      throw new ScimError(400, `No user with id '${unknown}'.`, 'invalidValue')
    }

    const added = wanted.filter((id) => !current.includes(id))
    const removed = current.filter((id) => !wanted.includes(id))
    if (added.length < 1 && removed.length < 1) {
      return { added, removed }
    }

    await guardMembership(req, groupId, [...added, ...removed])
    for (const userId of added) {
      await WIKI.models.groups.assignUserToGroup(groupId, userId)
    }
    for (const userId of removed) {
      await WIKI.models.groups.unassignUserFromGroup(groupId, userId)
    }
    return { added, removed }
  }

  /** The ids a `members` array names, for a PUT or a create. */
  function memberIdsFrom(resource: Record<string, any>): string[] {
    if (!Array.isArray(resource.members)) {
      return []
    }
    return resource.members.map((entry: any) => {
      const id = typeof entry === 'string' ? entry : entry?.value
      if (typeof id !== 'string' || id.length < 1) {
        throw new ScimError(
          400,
          'Each member must carry a `value` naming a user id.',
          'invalidValue'
        )
      }
      return id
    })
  }

  app.get<{ Querystring: Record<string, any> }>('/v2/Groups', async (req, reply) => {
    const { startIndex, count } = WIKI.models.scim.parsePaging(req.query)
    return sendScim(
      reply,
      200,
      await WIKI.models.scim.listGroups({
        filter: req.query.filter,
        startIndex,
        count,
        baseUrl: baseUrlFor(req)
      })
    )
  })

  app.get<{ Params: { id: string } }>('/v2/Groups/:id', async (req, reply) =>
    sendScim(reply, 200, await groupResource(req, await requireGroup(req.params.id)))
  )

  app.post('/v2/Groups', async (req, reply) => {
    const body = resourceBody(req)
    const members = memberIdsFrom(body)
    const id = await WIKI.models.scim.createGroup(body)
    const group = await requireGroup(id)

    await audit(req, 'admin', 'createGroup', {
      source: 'scim',
      groupId: id,
      name: group.name,
      externalId: group.externalId
    })

    if (members.length > 0) {
      const { added } = await applyMembership(req, id, members)
      if (added.length > 0) {
        await audit(req, 'admin', 'assignUserToGroup', {
          source: 'scim',
          groupId: id,
          name: group.name,
          userIds: added
        })
      }
    }

    const resource = await groupResource(req, await requireGroup(id))
    return sendScim(reply.header('Location', resource.meta.location), 201, resource)
  })

  app.put<{ Params: { id: string } }>('/v2/Groups/:id', async (req, reply) => {
    const group = await requireGroup(req.params.id)
    const body = resourceBody(req)

    const refusal = elevatedGroupGuard(
      req,
      (await WIKI.models.groups.getGroupById(group.id))!,
      'modify the group'
    )
    if (refusal) {
      throw asScimError(refusal)
    }

    await WIKI.models.scim.applyGroup(group, {
      displayName: body.displayName,
      externalId: body.externalId === undefined ? undefined : body.externalId
    })
    // -> A PUT states the membership in full, so anybody it does not name is out of the group
    const { added, removed } = await applyMembership(req, group.id, memberIdsFrom(body))

    await audit(req, 'admin', 'updateGroup', {
      source: 'scim',
      groupId: group.id,
      name: body.displayName ?? group.name,
      added,
      removed
    })

    return sendScim(reply, 200, await groupResource(req, await requireGroup(group.id)))
  })

  app.patch<{ Params: { id: string } }>('/v2/Groups/:id', async (req, reply) => {
    const group = await requireGroup(req.params.id)
    const ops = WIKI.models.scim.parseGroupPatch(resourceBody(req))

    if (ops.displayName !== undefined || ops.externalId !== undefined) {
      const refusal = elevatedGroupGuard(
        req,
        (await WIKI.models.groups.getGroupById(group.id))!,
        'modify the group'
      )
      if (refusal) {
        throw asScimError(refusal)
      }
      await WIKI.models.scim.applyGroup(group, {
        displayName: ops.displayName,
        externalId: ops.externalId
      })
    }

    let changed: { added: string[]; removed: string[] } = { added: [], removed: [] }
    const touchesMembers =
      ops.removeAllMembers ||
      ops.replaceMembers !== undefined ||
      ops.addMembers.length > 0 ||
      ops.removeMembers.length > 0
    if (touchesMembers) {
      const current = await WIKI.models.scim.memberIdsOf(group.id)
      const base = ops.removeAllMembers ? [] : (ops.replaceMembers ?? current)
      const target = [...base, ...ops.addMembers].filter((id) => !ops.removeMembers.includes(id))
      changed = await applyMembership(req, group.id, target)
    }

    await audit(req, 'admin', 'updateGroup', {
      source: 'scim',
      groupId: group.id,
      name: ops.displayName ?? group.name,
      added: changed.added,
      removed: changed.removed
    })

    return sendScim(reply, 200, await groupResource(req, await requireGroup(group.id)))
  })

  /**
   * Delete a group the directory owns.
   *
   * Gated on `isProvisioned` for the same reason a user is, and additionally closed for a built-in
   * group: the guests, users and administrators groups are what anonymous access, the default
   * membership and the root administrator resolve against, and nothing outside the wiki gets to
   * take one away.
   */
  app.delete<{ Params: { id: string } }>('/v2/Groups/:id', async (req, reply) => {
    const group = await requireGroup(req.params.id)
    if (group.isSystem) {
      throw new ScimError(403, `The '${group.name}' group is built in and cannot be deleted.`)
    }
    if (!group.isProvisioned) {
      throw new ScimError(
        404,
        `The group '${group.name}' was not created by provisioning, so it cannot be removed by it.`
      )
    }
    const refusal = elevatedGroupGuard(
      req,
      (await WIKI.models.groups.getGroupById(group.id))!,
      'delete the group'
    )
    if (refusal) {
      throw asScimError(refusal)
    }

    await WIKI.models.scim.deleteGroup(group.id)

    await audit(req, 'admin', 'deleteGroup', {
      source: 'scim',
      groupId: group.id,
      name: group.name
    })

    return reply.code(204).send()
  })
}

export default routes
