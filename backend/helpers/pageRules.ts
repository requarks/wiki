import type { GroupRule, GroupRuleMatch, GroupRuleMode } from '../models/groups.ts'

/**
 * How a page rule is matched against a page, and which rule wins when several match.
 *
 * ---------------------------------------------------------------------------------------------
 * THE RULES OF PAGE PERMISSIONS
 * ---------------------------------------------------------------------------------------------
 *
 * A group grants page permissions through rules, never as a blanket. Every rule names a set of
 * permissions (`roles`), a way of addressing pages (`match`, with either `path` or `tags`), and what
 * it does with them (`mode`). A user's rules are all of their groups' rules pooled together —
 * belonging to a second group can therefore both widen and narrow what the first one said.
 *
 * The two tag kinds read `tags` and ignore `path`; every other kind is the other way round. They are
 * separate fields rather than one reused for both so that a rule keeps whichever it is not currently
 * matching on — changing a rule's kind and changing it back is not a way to lose what it said.
 *
 * **Nothing is granted by default.** A permission nobody wrote a rule for is denied: no rules at all
 * is the same as one DENY rule covering the whole site. This is why an empty group can read nothing.
 *
 * A rule only has a say over a page it is SCOPED to. `sites` and `locales` each name what the rule
 * is limited to, and an empty list means every one of them — so a rule left alone speaks for the
 * whole instance, and one naming a site says nothing at all about the others.
 *
 * When more than one rule names the permission being asked about and matches the page, exactly one
 * of them decides the answer — the most specific. Order in the array means nothing.
 *
 *   1. MATCH TYPE, as bands. From weakest to strongest:
 *
 *        Path Starts With  <  Path Ends With  <  Path Matches Regex  <
 *        Has Any Tag  <  Has All Tags  <  Path Is Exactly
 *
 *      The order runs from the vaguest way of naming pages to the most precise: a prefix is a whole
 *      branch of the tree, a tag is something somebody put ON the page to say what it is, and an
 *      exact path is one page and nothing else.
 *
 *      Three BANDS, because path length below only settles a contest inside one of them: the three
 *      path-shaped kinds, then the two tag kinds, then Path Is Exactly. A tag rule therefore beats a
 *      prefix rule however deep that prefix is — `confidential` is denied under `docs` as surely as
 *      anywhere else, and a guests group denying the whole site can still be opened on the pages
 *      tagged `public` — while naming a page outright still beats saying what it is tagged.
 *
 *      A tag rule has no path, so without the bands it would score zero at step 2 and lose to every
 *      rule that named one, which is every rule a group starts with.
 *
 *   2. SPECIFICITY, highest first, within a band. A rule addressing `geography/countries` beats one
 *      addressing `geography`, because it says something about a smaller part of the site. Measured
 *      as the length of the path the rule addresses, so the deeper of two paths always wins, and a
 *      rule for the whole site (empty path) is the least specific thing there is. Tag rules address
 *      no path, so they all score zero and this settles nothing between them.
 *
 *   3. MATCH TYPE AGAIN, to separate two kinds sharing a band at the same specificity: Has All Tags
 *      beats Has Any Tag, since every tag in a list is a stronger claim than any one of them, and a
 *      regex beats a suffix beats a prefix.
 *
 *   4. MODE, when two rules are equally specific and of the same kind:
 *
 *        ALLOW  <  DENY  <  FORCE ALLOW
 *
 *      An ALLOW grants the permission. A DENY overrides any ALLOW. A FORCE ALLOW overrides any DENY,
 *      which is what makes a hole in an otherwise closed branch possible.
 *
 * The four are applied in that order: mode only settles a tie between rules of the same kind at the
 * same specificity, so a DENY on `geography` does NOT override an ALLOW on `geography/countries` —
 * the deeper rule was more specific and had already won. And a path rule cannot make a hole in a tag
 * rule unless it names the page exactly; otherwise it takes another tag rule — a FORCE ALLOW on the
 * tag, or taking the tag off the page.
 *
 * ---------------------------------------------------------------------------------------------
 *
 * `manage:system` is not evaluated here: it bypasses this entirely, and does so before any rule is
 * read. See `models/groups.ts`.
 */

/**
 * A page as a rule sees it.
 *
 * `siteId` and `locale` scope it, `path` places it, and `tags` are what a tag rule matches on.
 *
 * `siteId` is REQUIRED, and deliberately so: a rule limited to particular sites has to be able to
 * tell whether this page is in one of them, and a reference that could leave it out would apply
 * every such rule to every site the moment a caller forgot. There is no page anywhere in this
 * codebase that does not belong to a site, so nothing is being asked for that is not in hand.
 */
export interface RulePageRef {
  siteId: string
  path: string
  locale?: string
  tags?: string[]
}

/**
 * Match kinds from weakest to strongest. The index IS the priority, so the order of this array is
 * the order documented above.
 */
const MATCH_PRIORITY: GroupRuleMatch[] = ['START', 'END', 'REGEX', 'TAG', 'TAGALL', 'EXACT']

/**
 * Which band of the ordering each kind sits in, weakest first — step 1 above.
 *
 * Path length settles a contest only INSIDE a band, which is the whole point of having them: a tag
 * rule names no path, so measuring it against one would put it below every rule that did.
 */
const MATCH_BAND: Record<GroupRuleMatch, number> = {
  START: 0,
  END: 0,
  REGEX: 0,
  TAG: 1,
  TAGALL: 1,
  EXACT: 2
}

/** Modes from weakest to strongest, used to break a tie between rules of the same kind. */
const MODE_PRIORITY: GroupRuleMode[] = ['ALLOW', 'DENY', 'FORCEALLOW']

/** The kinds that address pages by tag rather than by path. */
const TAG_MATCHES: GroupRuleMatch[] = ['TAG', 'TAGALL']

/**
 * The tags a rule addresses, as they are compared.
 *
 * Lowercased here rather than on the way in, because the page's own tags are stored as they were
 * typed: a page tagged `Meeting` and a rule naming `meeting` are the same tag, and the wiki has no
 * canonical case to hold either of them to.
 */
function ruleTags(rule: GroupRule): string[] {
  return (rule.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean)
}

/** Compared without leading slashes on either side, since neither is stored with one. */
function normalizePath(value: string): string {
  return value.replace(/^\/+/, '')
}

/**
 * How much of the site a rule is talking about, as a number where higher is narrower.
 *
 * The length of the path it addresses. A tag rule addresses no path, so every one of them scores
 * zero — which says nothing about it, since this is only ever read against another rule of the same
 * band and both tag kinds are in the same one.
 */
function specificityOf(rule: GroupRule): number {
  if (TAG_MATCHES.includes(rule.match)) {
    return 0
  }
  return normalizePath(rule.path).length
}

/**
 * A rule as a sortable key: the four steps documented above, strongest first in each position.
 *
 * Compared lexicographically by `outranks`, so adding a step is adding an entry here rather than
 * another branch in the comparison.
 */
function rankOf(rule: GroupRule): number[] {
  return [
    MATCH_BAND[rule.match],
    specificityOf(rule),
    MATCH_PRIORITY.indexOf(rule.match),
    MODE_PRIORITY.indexOf(rule.mode)
  ]
}

/**
 * Whether `a` beats `b`, comparing the ranks position by position.
 *
 * Strictly greater, so two identical ranks leave the incumbent in place: the first rule of an
 * otherwise identical pair wins and the outcome does not depend on the order they arrived in.
 */
function outranks(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return a[i] > b[i]
    }
  }
  return false
}

/** Whether a rule addresses this page at all, ignoring what it then says about it. */
export function ruleMatchesPage(rule: GroupRule, page: RulePageRef): boolean {
  // -> A rule may be limited to particular sites; an empty list means every one of them
  if (rule.sites?.length > 0 && !rule.sites.includes(page.siteId)) {
    return false
  }

  // -> And to particular locales, the same way. Unlike the site, a reference may leave the locale
  //    out — an asset addressed by path alone — and such a page is not one a locale rule excludes
  if (rule.locales?.length > 0 && page.locale && !rule.locales.includes(page.locale)) {
    return false
  }

  const pagePath = normalizePath(page.path)
  const rulePath = normalizePath(rule.path)
  const pageTags = (page.tags ?? []).map((tag) => tag.toLowerCase())

  switch (rule.match) {
    case 'START':
      return pagePath.startsWith(rulePath)
    case 'EXACT':
      return pagePath === rulePath
    case 'END':
      return pagePath.endsWith(rulePath)
    case 'REGEX':
      try {
        return new RegExp(rulePath).test(pagePath)
      } catch {
        // -> A rule that cannot compile addresses nothing, rather than everything
        return false
      }
    case 'TAG':
      return ruleTags(rule).some((tag) => pageTags.includes(tag))
    case 'TAGALL': {
      const tags = ruleTags(rule)
      return tags.length > 0 && tags.every((tag) => pageTags.includes(tag))
    }
    default:
      return false
  }
}

/**
 * The rule that decides a permission for a page, out of everything the caller's groups say.
 *
 * @param rules Every rule from every group the caller belongs to, pooled
 * @param permission The single permission being asked about, e.g. `read:pages`
 * @returns The deciding rule, or null when nothing addresses this — which means denied
 */
export function resolvePageRule(
  rules: GroupRule[],
  permission: string,
  page: RulePageRef
): GroupRule | null {
  let winner: GroupRule | null = null
  let winnerRank: number[] | null = null

  for (const rule of rules) {
    if (!rule.roles?.includes(permission) || !ruleMatchesPage(rule, page)) {
      continue
    }
    const rank = rankOf(rule)
    if (!winnerRank || outranks(rank, winnerRank)) {
      winner = rule
      winnerRank = rank
    }
  }

  return winner
}

/**
 * Whether the caller's rules grant a permission on a page.
 *
 * @returns False when no rule addresses it, which is the default for everything.
 */
export function rulesAllow(rules: GroupRule[], permission: string, page: RulePageRef): boolean {
  const rule = resolvePageRule(rules, permission, page)
  return rule ? rule.mode !== 'DENY' : false
}
