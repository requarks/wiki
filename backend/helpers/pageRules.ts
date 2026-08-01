import type { GroupRule, GroupRuleMatch, GroupRuleMode } from '../models/groups.ts'

/**
 * How a page rule is matched against a page, and which rule wins when several match.
 *
 * ---------------------------------------------------------------------------------------------
 * THE RULES OF PAGE PERMISSIONS
 * ---------------------------------------------------------------------------------------------
 *
 * A group grants page permissions through rules, never as a blanket. Every rule names a set of
 * permissions (`roles`), a way of addressing pages (`match` + `path`), and what it does with them
 * (`mode`). A user's rules are all of their groups' rules pooled together — belonging to a second
 * group can therefore both widen and narrow what the first one said.
 *
 * **Nothing is granted by default.** A permission nobody wrote a rule for is denied: no rules at all
 * is the same as one DENY rule covering the whole site. This is why an empty group can read nothing.
 *
 * When more than one rule names the permission being asked about and matches the page, exactly one
 * of them decides the answer — the most specific. Order in the array means nothing.
 *
 *   1. SPECIFICITY, highest first. A rule addressing `geography/countries` beats one addressing
 *      `geography`, because it says something about a smaller part of the site. Measured as the
 *      length of the path the rule addresses, so the deeper of two paths always wins, and a rule for
 *      the whole site (empty path) is the least specific thing there is. Tag rules address no path
 *      at all and are therefore never more specific than a path rule.
 *
 *   2. MATCH TYPE, when two rules are equally specific. From weakest to strongest:
 *
 *        Has Any Tag  <  Has All Tags  <  Path Starts With  <  Path Ends With  <
 *        Path Matches Regex  <  Path Is Exactly
 *
 *      The order runs from the vaguest way of naming pages to the most precise: a tag is a property
 *      a page happens to have, a prefix is a whole branch of the tree, and an exact path is one page
 *      and nothing else.
 *
 *   3. MODE, when two rules are equally specific and of the same kind:
 *
 *        ALLOW  <  DENY  <  FORCE ALLOW
 *
 *      An ALLOW grants the permission. A DENY overrides any ALLOW. A FORCE ALLOW overrides any DENY,
 *      which is what makes a hole in an otherwise closed branch possible.
 *
 * The three are applied in that order: mode only settles a tie between rules of the same kind at the
 * same specificity, so a DENY on `geography` does NOT override an ALLOW on `geography/countries` —
 * the deeper rule was more specific and had already won.
 *
 * ---------------------------------------------------------------------------------------------
 *
 * `manage:system` is not evaluated here: it bypasses this entirely, and does so before any rule is
 * read. See `models/groups.ts`.
 */

/** A page as a rule sees it. `locale` and `path` place it; `tags` are what tag rules match on. */
export interface RulePageRef {
  path: string
  locale?: string
  tags?: string[]
}

/**
 * Match kinds from weakest to strongest, used to break a tie between equally specific rules. The
 * index IS the priority, so the order of this array is the order documented above.
 */
const MATCH_PRIORITY: GroupRuleMatch[] = ['TAG', 'TAGALL', 'START', 'END', 'REGEX', 'EXACT']

/** Modes from weakest to strongest, used to break a tie between rules of the same kind. */
const MODE_PRIORITY: GroupRuleMode[] = ['ALLOW', 'DENY', 'FORCEALLOW']

/** Tags are written on a rule as a comma-separated list, in the field a path would otherwise use. */
function ruleTags(rule: GroupRule): string[] {
  return rule.path
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
}

/** Compared without leading slashes on either side, since neither is stored with one. */
function normalizePath(value: string): string {
  return value.replace(/^\/+/, '')
}

/**
 * How much of the site a rule is talking about, as a number where higher is narrower.
 *
 * The length of the path it addresses. A tag rule addresses no path, so it scores zero and can never
 * out-specify a rule that names one — matching the ordering above, where tags are the vaguest way of
 * naming a page.
 */
function specificityOf(rule: GroupRule): number {
  if (rule.match === 'TAG' || rule.match === 'TAGALL') {
    return 0
  }
  return normalizePath(rule.path).length
}

/** Whether a rule addresses this page at all, ignoring what it then says about it. */
export function ruleMatchesPage(rule: GroupRule, page: RulePageRef): boolean {
  // -> A rule may be limited to particular locales; an empty list means every one of them
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
  let winnerRank: [number, number, number] = [-1, -1, -1]

  for (const rule of rules) {
    if (!rule.roles?.includes(permission) || !ruleMatchesPage(rule, page)) {
      continue
    }
    const rank: [number, number, number] = [
      specificityOf(rule),
      MATCH_PRIORITY.indexOf(rule.match),
      MODE_PRIORITY.indexOf(rule.mode)
    ]
    // -> Strictly greater, so the first rule of an otherwise identical pair wins and the outcome
    //    does not depend on the order they happen to arrive in
    if (
      rank[0] > winnerRank[0] ||
      (rank[0] === winnerRank[0] &&
        (rank[1] > winnerRank[1] || (rank[1] === winnerRank[1] && rank[2] > winnerRank[2])))
    ) {
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
