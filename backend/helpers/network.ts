/**
 * Where a request came from, as far as the network is concerned.
 *
 * The classes an operator picks from when deciding who may scrape without credentials. They are
 * about reachability, not identity: `local` is this machine, `private` is a network somebody had to
 * already be inside, and `external` is everything else — including anything unrecognisable, since
 * an address that cannot be placed must not land in the more permissive class.
 *
 * And the other direction: `isPublicAddress` is whether the wiki may connect somewhere a URL it did
 * not write pointed it at.
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

/*
  Everything the wiki must not be talked into connecting to on somebody else's say-so: the ranges
  IANA marks as not globally reachable, which is wider than `local` + `private` above. Those answer
  where a CLIENT is, and a client never arrives from 0.0.0.0 or a multicast group; a URL can name
  either.
*/
const nonPublic = new net.BlockList()
// -> "This network": 0.0.0.0 is connected to as the local host on Linux
nonPublic.addSubnet('0.0.0.0', 8)
nonPublic.addSubnet('10.0.0.0', 8)
// -> Carrier-grade NAT (RFC 6598), which is also where some clouds put their internal services
nonPublic.addSubnet('100.64.0.0', 10)
nonPublic.addSubnet('127.0.0.0', 8)
nonPublic.addSubnet('169.254.0.0', 16)
nonPublic.addSubnet('172.16.0.0', 12)
nonPublic.addSubnet('192.0.0.0', 24)
nonPublic.addSubnet('192.0.2.0', 24)
nonPublic.addSubnet('192.168.0.0', 16)
nonPublic.addSubnet('198.18.0.0', 15)
nonPublic.addSubnet('198.51.100.0', 24)
nonPublic.addSubnet('203.0.113.0', 24)
// -> Multicast, and the reserved block above it up to and including the broadcast address
nonPublic.addSubnet('224.0.0.0', 3)
// -> Unspecified, loopback and the deprecated IPv4-compatible form, which embeds any IPv4 address
nonPublic.addSubnet('::', 96, 'ipv6')
// -> NAT64 (RFC 6052 / RFC 8215), 6to4 and Teredo: each reaches an IPv4 address it embeds, and that
//    address can be any of the above
nonPublic.addSubnet('64:ff9b::', 96, 'ipv6')
nonPublic.addSubnet('64:ff9b:1::', 48, 'ipv6')
nonPublic.addSubnet('2001::', 32, 'ipv6')
nonPublic.addSubnet('2002::', 16, 'ipv6')
nonPublic.addSubnet('2001:db8::', 32, 'ipv6')
nonPublic.addSubnet('fc00::', 7, 'ipv6')
// -> Link-local, and the site-local block it replaced (RFC 3879)
nonPublic.addSubnet('fe80::', 9, 'ipv6')
nonPublic.addSubnet('ff00::', 8, 'ipv6')

/**
 * Whether an address is on the public internet, and so one the wiki may connect to because a URL
 * somebody else wrote pointed there.
 *
 * Anything that is not an IP address at all is not public: this is asked before connecting, so the
 * case that cannot be placed has to be the refused one. IPv4-mapped IPv6 addresses are judged as the
 * IPv4 address they carry.
 */
export function isPublicAddress(ip: string): boolean {
  const type = net.isIPv6(ip) ? 'ipv6' : net.isIPv4(ip) ? 'ipv4' : null
  if (!type) {
    return false
  }
  return !nonPublic.check(ip, type)
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
 * The compiled form of each list asked about, so that a per-request check is one `check()` call.
 *
 * Keyed on the entries themselves rather than invalidated by whoever writes the setting: a list
 * lives in a config blob that any instance may change, and a cache that has to be told is a cache
 * that will one day not be. Emptied once it holds more than a handful — there are only a couple of
 * such lists in the wiki, so anything past that is the old versions of lists that have since changed.
 */
const compiledLists = new Map<string, net.BlockList>()
const MAX_COMPILED_LISTS = 8

function compile(entries: readonly string[]): net.BlockList {
  const key = entries.join('\n')
  const cached = compiledLists.get(key)
  if (cached) {
    return cached
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
  if (compiledLists.size >= MAX_COMPILED_LISTS) {
    compiledLists.clear()
  }
  compiledLists.set(key, list)
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
