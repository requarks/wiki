/**
 * Where a request came from, as far as the network is concerned.
 *
 * The classes an operator picks from when deciding who may scrape without credentials. They are
 * about reachability, not identity: `local` is this machine, `private` is a network somebody had to
 * already be inside, and `external` is everything else — including anything unrecognisable, since
 * an address that cannot be placed must not land in the more permissive class.
 */

import net from 'node:net'

export const CLIENT_IP_CLASSES = ['local', 'private', 'external'] as const
export type ClientIpClass = (typeof CLIENT_IP_CLASSES)[number]

/*
  `net.BlockList` rather than parsing addresses by hand: it takes CIDR subnets directly, and it
  matches an IPv4 rule against the IPv4-mapped IPv6 form of the same address (`::ffff:127.0.0.1`),
  which is what a dual-stack listener hands over for an IPv4 client. Verified, not assumed.
*/

const loopback = new net.BlockList()
loopback.addSubnet('127.0.0.0', 8)
loopback.addAddress('::1', 'ipv6')

const privateNetworks = new net.BlockList()
// -> RFC 1918
privateNetworks.addSubnet('10.0.0.0', 8)
privateNetworks.addSubnet('172.16.0.0', 12)
privateNetworks.addSubnet('192.168.0.0', 16)
// -> Link-local (RFC 3927 / RFC 4291): unroutable, so it is reached from the same segment only
privateNetworks.addSubnet('169.254.0.0', 16)
privateNetworks.addSubnet('fe80::', 10, 'ipv6')
// -> Unique local addresses (RFC 4193), the IPv6 equivalent of the RFC 1918 ranges
privateNetworks.addSubnet('fc00::', 7, 'ipv6')

/**
 * Which class an address falls in.
 *
 * Anything that is not an IP address at all — a unix socket, an empty value — is `external`: this
 * decides whether a request may skip authentication, so the unknown case has to be the strict one.
 *
 * Note that what an address MEANS depends on the `trustProxy` security setting. With it off, a wiki
 * behind a reverse proxy sees every request as coming from the proxy, so a scrape from the far side
 * of the internet reads as whatever the proxy's own address is.
 */
export function classifyClientIp(ip: string | null | undefined): ClientIpClass {
  if (!ip) {
    return 'external'
  }
  const type = net.isIPv6(ip) ? 'ipv6' : net.isIPv4(ip) ? 'ipv4' : null
  if (!type) {
    return 'external'
  }
  if (loopback.check(ip, type)) {
    return 'local'
  }
  if (privateNetworks.check(ip, type)) {
    return 'private'
  }
  return 'external'
}

/**
 * One entry of an operator-written address list: a single address or a CIDR subnet.
 *
 * Kept as the pieces `net.BlockList` needs rather than as the string, so that the thing which
 * validates an entry and the thing which matches against it cannot disagree about what it meant.
 */
export interface IpRange {
  address: string
  /** Absent for a single address, which is matched exactly. */
  prefix?: number
  family: 'ipv4' | 'ipv6'
}

/**
 * Read one entry of an address list.
 *
 * Accepts `203.0.113.4`, `203.0.113.0/24`, `2001:db8::1` and `2001:db8::/32`. Everything else is
 * rejected, including a prefix that is not a number or is wider than the family allows — an entry
 * that cannot be understood must not be quietly dropped from a list whose whole job is to say who
 * may through, in either direction: dropped from an allow list it locks somebody out, and the
 * operator has no way to see which entry did it.
 *
 * @returns The parsed range, or null when the entry is not one
 */
export function parseIpRange(entry: string): IpRange | null {
  const trimmed = entry.trim()
  if (trimmed.length < 1) {
    return null
  }
  const slash = trimmed.lastIndexOf('/')
  const address = slash === -1 ? trimmed : trimmed.slice(0, slash)
  const family = net.isIPv6(address) ? 'ipv6' : net.isIPv4(address) ? 'ipv4' : null
  if (!family) {
    return null
  }
  if (slash === -1) {
    return { address, family }
  }
  const raw = trimmed.slice(slash + 1)
  // -> `Number` rather than `parseInt`, which would read `24abc` as 24
  const prefix = /^\d+$/.test(raw) ? Number(raw) : Number.NaN
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > (family === 'ipv6' ? 128 : 32)) {
    return null
  }
  return { address, prefix, family }
}

/**
 * The compiled form of the last list asked about, so that a per-request check is one `check()` call.
 *
 * Keyed on the entries themselves rather than invalidated by whoever writes the setting: the list
 * lives in a config blob that any instance may change, and a cache that has to be told is a cache
 * that will one day not be. One slot is enough — there is one such list in the wiki.
 */
let compiledKey: string | null = null
let compiled: net.BlockList | null = null

function compile(entries: readonly string[]): net.BlockList {
  const key = entries.join('\n')
  if (compiledKey === key && compiled) {
    return compiled
  }
  const list = new net.BlockList()
  for (const entry of entries) {
    const range = parseIpRange(entry)
    if (!range) {
      // -> Refused when it was saved; reaching here means it was written straight to the database
      WIKI.logger.warn(`Ignoring an unreadable address range in a configured list: ${entry}`)
      continue
    }
    if (range.prefix === undefined) {
      list.addAddress(range.address, range.family)
    } else {
      list.addSubnet(range.address, range.prefix, range.family)
    }
  }
  compiledKey = key
  compiled = list
  return list
}

/**
 * Whether an address falls inside an operator-written list of ranges.
 *
 * An EMPTY list means no restriction and everything matches — the setting being unset cannot be the
 * setting being at its most restrictive, or turning a feature on would lock everybody out of it.
 * Anything that is not an IP address at all never matches a non-empty list, which is the strict
 * answer for the case that cannot be placed.
 */
export function matchesIpRanges(
  ip: string | null | undefined,
  entries: readonly string[]
): boolean {
  if (entries.length < 1) {
    return true
  }
  if (!ip) {
    return false
  }
  const family = net.isIPv6(ip) ? 'ipv6' : net.isIPv4(ip) ? 'ipv4' : null
  if (!family) {
    return false
  }
  return compile(entries).check(ip, family)
}
