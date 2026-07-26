import http from 'node:http'
import https from 'node:https'
import { hooks as hooksTable } from '../db/schema.ts'
import { desc, eq, sql } from 'drizzle-orm'

/**
 * The events a webhook can subscribe to, as offered by the admin area.
 *
 * Only the user events have emit points today — pages, assets and comments are not implemented yet,
 * so subscribing to them stores a subscription that nothing triggers.
 */
export const HOOK_EVENTS = [
  'page:create',
  'page:edit',
  'page:rename',
  'page:delete',
  'asset:upload',
  'asset:edit',
  'asset:rename',
  'asset:delete',
  'comment:new',
  'comment:edit',
  'comment:delete',
  'user:join',
  'user:login',
  'user:logout'
] as const

export type HookEvent = (typeof HOOK_EVENTS)[number]

/**
 * The events something in the server actually emits today.
 *
 * Kept as an explicit list rather than inferred from the prefix, since the page, asset and comment
 * events have no emit point yet. Add an event here when you add its `emit()` call.
 */
export const EMITTED_EVENTS: HookEvent[] = ['user:join', 'user:login', 'user:logout']

/** A webhook as exposed by the API. */
export interface Hook {
  id: string
  name: string
  events: string[]
  url: string
  includeMetadata: boolean
  includeContent: boolean
  acceptUntrusted: boolean
  authHeader: string | null
  state: 'pending' | 'success' | 'error'
  lastErrorMessage: string | null
  createdAt: Date
  updatedAt: Date
}

/** How long a remote endpoint has to answer before the delivery counts as failed. */
const DELIVERY_TIMEOUT = 15000

const hookSelection = {
  id: hooksTable.id,
  name: hooksTable.name,
  events: hooksTable.events,
  url: hooksTable.url,
  includeMetadata: hooksTable.includeMetadata,
  includeContent: hooksTable.includeContent,
  acceptUntrusted: hooksTable.acceptUntrusted,
  authHeader: hooksTable.authHeader,
  state: hooksTable.state,
  lastErrorMessage: hooksTable.lastErrorMessage,
  createdAt: hooksTable.createdAt,
  updatedAt: hooksTable.updatedAt
}

/**
 * POST a JSON body, with control over certificate validation.
 *
 * `node:https` rather than `fetch`: a webhook may legitimately point at an endpoint with a
 * self-signed certificate, and per-request TLS options are not expressible through fetch.
 */
function postJson(
  url: string,
  body: string,
  { authHeader, acceptUntrusted }: { authHeader?: string | null; acceptUntrusted: boolean }
): Promise<{ statusCode: number }> {
  return new Promise((resolve, reject) => {
    let target: URL
    try {
      target = new URL(url)
    } catch {
      reject(new Error(`"${url}" is not a valid URL.`))
      return
    }
    const transport = target.protocol === 'http:' ? http : https

    const req = transport.request(
      target,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          'user-agent': `Wiki.js/${WIKI.version}`,
          ...(authHeader ? { authorization: authHeader } : {})
        },
        timeout: DELIVERY_TIMEOUT,
        ...(target.protocol === 'https:' && acceptUntrusted ? { rejectUnauthorized: false } : {})
      },
      (res) => {
        // -> The body is irrelevant, but it has to be drained for the socket to be released
        res.resume()
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0 }))
      }
    )
    req.on('timeout', () => {
      req.destroy(new Error(`The endpoint did not respond within ${DELIVERY_TIMEOUT / 1000}s.`))
    })
    req.on('error', reject)
    req.end(body)
  })
}

/**
 * Hooks model
 *
 * Webhooks POST a JSON body to a remote endpoint when something happens. Delivery goes through the
 * scheduler rather than the request that triggered it: a slow or broken endpoint must not delay a
 * user's action, and the scheduler already provides retries and a place to see failures.
 */
class Hooks {
  /**
   * Every webhook, newest first
   */
  async getHooks(): Promise<Hook[]> {
    const results = await WIKI.db
      .select(hookSelection)
      .from(hooksTable)
      .orderBy(desc(hooksTable.createdAt))
    return results as Hook[]
  }

  /**
   * A single webhook, or null if there is no such webhook
   */
  async getHookById(id: string): Promise<Hook | null> {
    const results = await WIKI.db
      .select(hookSelection)
      .from(hooksTable)
      .where(eq(hooksTable.id, id))
      .limit(1)
    return (results[0] as Hook) ?? null
  }

  /**
   * Create a webhook. It starts out pending: no event has reached it yet.
   *
   * @returns The new webhook's ID
   */
  async createHook(values: {
    name: string
    events: string[]
    url: string
    includeMetadata?: boolean
    includeContent?: boolean
    acceptUntrusted?: boolean
    authHeader?: string
  }): Promise<string> {
    const result = await WIKI.db
      .insert(hooksTable)
      .values({
        name: values.name,
        events: values.events,
        url: values.url,
        includeMetadata: values.includeMetadata ?? true,
        includeContent: values.includeContent ?? false,
        acceptUntrusted: values.acceptUntrusted ?? false,
        authHeader: values.authHeader ?? null,
        state: 'pending'
      })
      .returning({ id: hooksTable.id })
    return result[0].id
  }

  /**
   * Update a webhook.
   *
   * Changing where or what it sends resets the state to pending: the previous outcome says nothing
   * about the new configuration.
   *
   * @returns Whether a webhook was updated
   */
  async updateHook(id: string, patch: Record<string, any>): Promise<boolean> {
    const values: Record<string, any> = { ...patch, updatedAt: sql`now()` }
    if (patch.url !== undefined || patch.events !== undefined || patch.authHeader !== undefined) {
      values.state = 'pending'
      values.lastErrorMessage = null
    }
    const result = await WIKI.db.update(hooksTable).set(values).where(eq(hooksTable.id, id))
    return (result.rowCount ?? 0) > 0
  }

  /**
   * Delete a webhook
   *
   * @returns Whether a webhook was deleted
   */
  async deleteHook(id: string): Promise<boolean> {
    const result = await WIKI.db.delete(hooksTable).where(eq(hooksTable.id, id))
    return (result.rowCount ?? 0) > 0
  }

  /**
   * Queue a delivery for every webhook subscribed to an event.
   *
   * Safe to call from anywhere, including request handlers: it only writes jobs, and it never throws
   * — a webhook problem must not fail the action that triggered it.
   *
   * @param data Event-specific payload. `metadata` and `content` are stripped per webhook, according
   *             to what each one asked for.
   * @returns How many deliveries were queued
   */
  async emit(event: HookEvent, data: Record<string, any> = {}): Promise<number> {
    try {
      const subscribed = await WIKI.db
        .select({
          id: hooksTable.id,
          includeMetadata: hooksTable.includeMetadata,
          includeContent: hooksTable.includeContent
        })
        .from(hooksTable)
        .where(sql`${event} = ANY(${hooksTable.events})`)

      let queued = 0
      for (const hook of subscribed) {
        const { metadata, content, ...rest } = data
        const payload = {
          ...rest,
          ...(hook.includeMetadata && metadata !== undefined ? { metadata } : {}),
          ...(hook.includeContent && content !== undefined ? { content } : {})
        }
        const added = await WIKI.scheduler.addJob({
          task: 'dispatchWebhook',
          payload: { hookId: hook.id, event, data: payload }
        })
        if (added?.id) {
          queued++
        }
      }
      return queued
    } catch (err: any) {
      WIKI.logger.warn(`Failed to queue webhook deliveries for ${event}: ${err.message}`)
      return 0
    }
  }

  /**
   * Deliver one event to one webhook, recording the outcome on the webhook.
   *
   * Called by the `dispatchWebhook` task. Throws on failure so that the scheduler retries it.
   */
  async deliver({
    hookId,
    event,
    data
  }: {
    hookId: string
    event: string
    data: Record<string, any>
  }): Promise<void> {
    const hook = await this.getHookById(hookId)
    if (!hook) {
      // -> Deleted between queueing and delivery; nothing to do and nothing to retry
      WIKI.logger.info(`Webhook ${hookId} no longer exists, skipping delivery of ${event}.`)
      return
    }

    const body = JSON.stringify({
      event,
      sentAt: Temporal.Now.instant().toString({ smallestUnit: 'millisecond' }),
      instance: WIKI.INSTANCE_ID,
      data
    })

    try {
      const { statusCode } = await postJson(hook.url, body, {
        authHeader: hook.authHeader,
        acceptUntrusted: hook.acceptUntrusted
      })
      if (statusCode < 200 || statusCode > 299) {
        throw new Error(`The endpoint answered with HTTP ${statusCode}.`)
      }
      await WIKI.db
        .update(hooksTable)
        .set({ state: 'success', lastErrorMessage: null })
        .where(eq(hooksTable.id, hook.id))
      WIKI.logger.debug(`Delivered ${event} to webhook ${hook.name} [ OK ]`)
    } catch (err: any) {
      await WIKI.db
        .update(hooksTable)
        .set({ state: 'error', lastErrorMessage: err.message })
        .where(eq(hooksTable.id, hook.id))
      WIKI.logger.warn(`Failed to deliver ${event} to webhook ${hook.name}: ${err.message}`)
      // -> Rethrown so the job fails and the scheduler retries with its usual backoff
      throw err
    }
  }
}

export const hooks = new Hooks()
