/**
 * GET a URL that somebody other than an administrator wrote, without letting it point inward.
 *
 * A picture claim at an identity provider is the user's to edit at many of them, so the wiki going
 * to fetch it is the wiki making a request on that user's behalf. Only the public internet may be
 * reached that way: never this machine, the network it sits on, or a cloud's metadata service —
 * not directly, not through a name that resolves there, and not through a public URL that redirects
 * there — unless the caller passes ranges an administrator opened for it.
 *
 * `node:http` rather than `fetch`, for the `lookup` option: it is what lets the address that was
 * checked be the address connected to (see `publicLookup`).
 */

import dns from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import type { IncomingMessage } from 'node:http'
import type { LookupFunction } from 'node:net'
import { isPublicAddress, matchesIpRanges } from './network.ts'

const MAX_REDIRECTS = 5
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/**
 * Whether an address may be connected to: a public one, or one inside a range an administrator
 * opened. The guard on `allow` matters — `matchesIpRanges` reads an empty list as "everything".
 */
function mayConnect(ip: string, allow: readonly string[]): boolean {
  return isPublicAddress(ip) || (allow.length > 0 && matchesIpRanges(ip, allow))
}

/** Why `mayConnect` said no, for the log: which of its two tests the address failed. */
function refusal(allow: readonly string[]): string {
  return allow.length > 0
    ? 'is neither a public address nor in the allowed ranges'
    : 'is not a public address, and no private ranges are allowed'
}

/**
 * The resolver every connection is made through: the name is looked up as it would be anyway, and
 * refused when any of its addresses may not be connected to.
 *
 * Checking here, rather than resolving first and connecting after, is what closes DNS rebinding —
 * there is no second lookup between the check and the connection for a short-lived record to answer
 * differently. ANY rather than all, because a name with one public and one private address would
 * otherwise reach the private one whenever the connection happened to try it first.
 */
function lookupFor(allow: readonly string[]): LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) {
        callback(err, '')
        return
      }
      const refused = addresses.find((a) => !mayConnect(a.address, allow))
      if (refused) {
        callback(
          new Error(`${hostname} resolves to ${refused.address}, which ${refusal(allow)}`),
          ''
        )
        return
      }
      if (options.all) {
        callback(null, addresses)
      } else {
        callback(null, addresses[0].address, addresses[0].family)
      }
    })
  }
}

/**
 * One request, with no redirect followed.
 */
function getOnce(
  target: URL,
  signal: AbortSignal,
  allow: readonly string[]
): Promise<IncomingMessage> {
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return Promise.reject(new Error(`a ${target.protocol} URL is not one to fetch`))
  }
  // -> A connection to an address literal never calls `lookup`, so a literal is checked here instead
  const host = target.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host) && !mayConnect(host, allow)) {
    return Promise.reject(new Error(`${host} ${refusal(allow)}`))
  }
  return new Promise((resolve, reject) => {
    const transport = target.protocol === 'http:' ? http : https
    const req = transport.get(
      target,
      {
        // -> No pooling: a kept-alive socket was connected by whichever request opened it, and that
        //    may have been one that never went through `publicLookup`
        agent: false,
        lookup: lookupFor(allow),
        signal,
        headers: { 'user-agent': `Wiki.js/${WIKI.version}` }
      },
      resolve
    )
    req.on('error', reject)
  })
}

/**
 * Download a URL from the public internet, following redirects and checking every hop.
 *
 * @param url - Any URL; only http(s) to a public address is fetched
 * @param limit - Bytes past which the body is abandoned. It is counted as it arrives rather than
 *   read off `content-length`, which is only the sender's claim about the size
 * @param timeout - Milliseconds for the whole download, redirects included
 * @param allow - Non-public addresses that may be reached all the same, as single addresses or
 *   CIDR ranges. Empty allows none
 * @returns The body of the final response, which must have been a 2xx
 */
export async function fetchPublic(
  url: string,
  { limit, timeout, allow = [] }: { limit: number; timeout: number; allow?: readonly string[] }
): Promise<Buffer> {
  const signal = AbortSignal.timeout(timeout)
  let target = new URL(url)
  for (let hop = 0; ; hop++) {
    const res = await getOnce(target, signal, allow)
    const status = res.statusCode ?? 0
    if (REDIRECT_STATUSES.has(status) && res.headers.location) {
      res.resume()
      if (hop >= MAX_REDIRECTS) {
        throw new Error(`it redirected more than ${MAX_REDIRECTS} times`)
      }
      target = new URL(res.headers.location, target)
      continue
    }
    if (status < 200 || status > 299) {
      res.resume()
      throw new Error(`the server answered ${status}`)
    }
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of res as AsyncIterable<Buffer>) {
      size += chunk.byteLength
      if (size > limit) {
        throw new Error(`it is larger than ${Math.round(limit / 1024 / 1024)} MB`)
      }
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }
}
