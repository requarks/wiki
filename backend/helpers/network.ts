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
