import { sql, type SQL } from 'drizzle-orm'
import { uniq } from 'es-toolkit/array'
import {
  liveCondition,
  maySeeUnpublished,
  maySeeUnpublishedAnywhere
} from '../helpers/publishing.ts'
import type { AccessActor } from './groups.ts'

/**
 * Locale to PostgreSQL text search dictionary, for the languages postgres ships a snowball stemmer
 * for. Anything not listed here falls back to `simple`, which indexes words without stemming — still
 * searchable, just without matching plurals and conjugations.
 *
 * An operator can override or extend this from the admin area, which is what `dictOverrides` is for.
 */
export const DEFAULT_DICTIONARIES: Record<string, string> = {
  ar: 'arabic',
  ca: 'catalan',
  da: 'danish',
  de: 'german',
  el: 'greek',
  en: 'english',
  es: 'spanish',
  et: 'estonian',
  eu: 'basque',
  fi: 'finnish',
  fr: 'french',
  ga: 'irish',
  hi: 'hindi',
  hu: 'hungarian',
  hy: 'armenian',
  id: 'indonesian',
  it: 'italian',
  lt: 'lithuanian',
  ne: 'nepali',
  nl: 'dutch',
  no: 'norwegian',
  pt: 'portuguese',
  ro: 'romanian',
  ru: 'russian',
  sr: 'serbian',
  sv: 'swedish',
  ta: 'tamil',
  tr: 'turkish',
  yi: 'yiddish'
}

/** The dictionary used when a locale has no mapping, or when its mapping is not installed. */
export const FALLBACK_DICTIONARY = 'simple'

export interface SearchConfig {
  termHighlighting: boolean
  dictOverrides: Record<string, string>
}

/** What a rebuild did, per locale, so the caller can report something concrete. */
export interface RebuildResult {
  pages: number
  locales: { locale: string; dictionary: string; pages: number }[]
}

/**
 * How a list of tags is matched against a page's own.
 *
 * `all` is the narrowing sense a filter usually has — each tag added takes pages away — and is what
 * a tag filter alongside a text query means. `any` is the widening one, which is what browsing by
 * tag wants: two tags picked off a list are two things the reader is interested in, not a demand
 * that one page be both.
 */
export const SEARCH_TAGS_MATCH = ['all', 'any'] as const
export type SearchTagsMatch = (typeof SEARCH_TAGS_MATCH)[number]

export const SEARCH_ORDER_BY = [
  'relevancy',
  'id',
  'path',
  'title',
  'createdAt',
  'updatedAt'
] as const
export type SearchOrderBy = (typeof SEARCH_ORDER_BY)[number]

export interface SearchResult {
  id: string
  path: string
  locale: string
  title: string
  description: string | null
  icon: string | null
  /** The color the icon is drawn in — see `PAGE_ICON_COLORS`. Empty for the site's primary color. */
  iconColor: string
  tags: string[]
  createdAt: string
  updatedAt: string
  relevancy: number
  highlight: string | null
}

export interface SearchPagesResult {
  results: SearchResult[]
  totalHits: number
}

export interface SearchPagesParams {
  siteId: string
  query?: string
  path?: string
  locales?: string[]
  tags?: string[]
  /** Whether a page must carry every tag in `tags` (the default) or merely one of them. */
  tagsMatch?: SearchTagsMatch
  editor?: string
  publishState?: string
  /**
   * Only pages this user created, and only pages this user edited last.
   *
   * Two separate columns rather than one "by this person": a page is created once and edited by
   * whoever touched it most recently, and the profile page asks both questions of the same user in
   * two different tabs.
   */
  creatorId?: string
  authorId?: string
  orderBy?: SearchOrderBy
  orderByDirection?: 'asc' | 'desc'
  offset?: number
  limit?: number
  /**
   * Whether a page that is not live (`helpers/publishing.ts`) may be listed, for an `actor` holding
   * `write:pages` or `manage:pages` on it. False — a request without a session — holds every result
   * to live pages.
   */
  unpublished?: boolean
  /**
   * Who is searching, so that a result they could not open never reaches them.
   *
   * Applied to the rows rather than in the query: which pages a rule covers can depend on a regular
   * expression or on a page's tags, neither of which a `WHERE` clause here could express.
   */
  actor?: AccessActor
}

export interface PageSuggestion {
  id: string
  path: string
  locale: string
  title: string
  description: string | null
  icon: string | null
}

export interface SuggestPagesParams {
  siteId: string
  /** What has been typed so far. Every word of it must be in the page's title or its path. */
  query: string
  /**
   * The locale the reader is in, and the only one suggested from: a list offering the same title once
   * per translation is mostly pages the reader cannot read. The full search is where other locales are.
   */
  locale: string
  limit?: number
  /** As in `SearchPagesParams`. */
  unpublished?: boolean
  /** Who is typing. Required: suggestions are only ever the pages this actor could open. */
  actor: AccessActor
}

export interface SuggestPagePathsParams {
  siteId: string
  /** The start of a page path, as typed after the slash of a link: no locale prefix, no leading slash. */
  prefix: string
  /** The locale whose pages are suggested. */
  locale: string
  limit?: number
  /** As in `SearchPagesParams`. */
  unpublished?: boolean
  /** Who is typing. Required: suggestions are only ever the pages this actor could open. */
  actor: AccessActor
}

/** Words of a suggestion query that are matched; the rest are ignored, as typing that much is a search. */
const SUGGEST_MAX_WORDS = 8

/**
 * How many matches a suggestion request reads before applying page rules to them.
 *
 * The rules run per row, in rank order, so a reader who may open most of the wiki is answered from the
 * first handful. The cap is for one who may open almost none of it: they get fewer suggestions, or none,
 * instead of a walk through every page whose title contains the letter they typed.
 */
const SUGGEST_CANDIDATES = 200

/**
 * Markers `ts_headline` wraps a matched term in.
 *
 * Control characters, because the excerpt is page text that may itself contain anything: it is HTML
 * escaped before these are turned into tags, so a page whose text reads `<script>` cannot come back as
 * markup. Anything that could occur in real text would defeat that.
 */
const HL_START = '\u0002'
const HL_STOP = '\u0003'

/** Escape the LIKE wildcards, so that what was typed is matched as text rather than as a pattern. */
function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Search model
 *
 * Search is postgres full-text: every page carries a `ts` tsvector, indexed with GIN. Which
 * dictionary builds that vector depends on the page's locale, which is why the mapping is
 * configurable — using the wrong stemmer for a language quietly degrades results rather than
 * failing.
 */
class Search {
  /**
   * The search configuration, with the shape the API and the admin area expect
   */
  getConfig(): SearchConfig {
    return {
      termHighlighting: WIKI.config.search?.termHighlighting === true,
      dictOverrides: (WIKI.config.search?.dictOverrides ?? {}) as Record<string, string>
    }
  }

  /**
   * The text search configurations this postgres actually has, e.g. `english`, `simple`.
   *
   * Used to validate what an operator maps a locale to: a name postgres does not know would make
   * every `to_tsvector` call fail at rebuild time, long after the setting was saved.
   */
  async getAvailableDictionaries(): Promise<string[]> {
    const rows = await WIKI.db.execute(sql`SELECT cfgname FROM pg_ts_config ORDER BY cfgname`)
    return (rows.rows ?? rows).map((r: any) => r.cfgname as string)
  }

  /**
   * The dictionary to index a locale with, preferring the operator's override
   *
   * @param available Dictionary names postgres knows; an unknown mapping degrades to the fallback
   */
  dictionaryForLocale(locale: string, available: string[]): string {
    const { dictOverrides } = this.getConfig()
    // -> Locales can be regional (`en-US`), while dictionaries are per language
    const language = locale.split(/[-_]/)[0] ?? locale
    const wanted =
      dictOverrides[locale] ?? dictOverrides[language] ?? DEFAULT_DICTIONARIES[language]
    if (wanted && available.includes(wanted)) {
      return wanted
    }
    if (wanted) {
      WIKI.logger.warn(
        `Text search dictionary "${wanted}" for locale ${locale} is not installed — falling back to ${FALLBACK_DICTIONARY}.`
      )
    }
    return FALLBACK_DICTIONARY
  }

  /**
   * A SQL expression giving the text search dictionary to use for each row.
   *
   * The vector on a page was built with its own locale's dictionary, so the query has to be parsed
   * with the same one — an English query stemmed as French matches nothing. Postgres accepts a
   * `regconfig` expression, so the mapping travels with the row rather than being fixed per query.
   *
   * @param locales Locales the search covers, which is what the CASE needs arms for
   * @param available Dictionary names postgres knows
   */
  private dictionaryExpression(locales: string[], available: string[]) {
    const arms = locales.map((locale) => {
      const dictionary = this.dictionaryForLocale(locale, available)
      // -> Both sides are checked values: the locale is compared as a parameter, and the dictionary
      //    name is one postgres itself reported
      return sql`WHEN ${locale} THEN ${sql.raw(`'${dictionary}'`)}`
    })
    if (arms.length < 1) {
      return sql`${sql.raw(`'${FALLBACK_DICTIONARY}'`)}::regconfig`
    }
    return sql`(CASE p.locale ${sql.join(arms, sql` `)} ELSE ${sql.raw(`'${FALLBACK_DICTIONARY}'`)} END)::regconfig`
  }

  /**
   * A text query over the pages of ONE locale, for a caller narrowing its own SQL with it — a
   * feedback board's search, which is a filter on a listing rather than a ranked search of the site.
   *
   * Parsed with the dictionary the locale's pages were indexed with, as `searchPages` does it. One
   * locale means one dictionary, so there is no CASE to build.
   *
   * @param match `all` reads the terms the way the search box does (`websearch_to_tsquery`); `any`
   *   ORs the words instead, for a query whose words need not all be there — two people rarely
   *   describe the same idea in the same words. Quotes and a leading `-` are dropped first, since
   *   they mean something to the websearch syntax and nothing to a list of words.
   */
  async tsQueryFor(locale: string, terms: string, match: 'all' | 'any' = 'all'): Promise<SQL> {
    const dictionary = this.dictionaryForLocale(locale, await this.getAvailableDictionaries())
    const text =
      match === 'any'
        ? terms
            .replace(/["-]/g, ' ')
            .split(/\s+/)
            .filter((word) => word.length > 0 && word.toLowerCase() !== 'or')
            .join(' or ')
        : terms
    return sql`websearch_to_tsquery(${sql.raw(`'${dictionary}'`)}::regconfig, ${text})`
  }

  /**
   * Full-text search over the pages of a site.
   *
   * The text query is optional: with only tags or filters this is a browse rather than a search, which
   * is what a query of nothing but `#tags` amounts to. Ranking needs matched terms, so ordering by
   * relevancy without a query falls back to the most recently updated.
   *
   * `isSearchable` is honoured for everyone — a page excluded from search was excluded on purpose.
   */
  async searchPages({
    siteId,
    query = '',
    path = '',
    locales = [],
    tags = [],
    tagsMatch = 'all',
    editor = '',
    publishState = '',
    creatorId = '',
    authorId = '',
    orderBy = 'relevancy',
    orderByDirection = 'desc',
    offset = 0,
    limit = 25,
    unpublished = false,
    actor
  }: SearchPagesParams): Promise<SearchPagesResult> {
    const terms = query.trim()
    const hasQuery = terms.length > 0

    // -> Only the locales in play need an arm in the dictionary CASE
    const siteLocales: string[] = WIKI.sites[siteId]?.config?.locales?.active ?? ['en']
    const searchedLocales = locales.length > 0 ? locales : siteLocales
    /*
      No terms means no query to parse, and therefore no dictionary to parse it with.

      Both arguments are withheld together on purpose. Passing the locales while claiming nothing is
      installed -- which is what an empty `available` says -- made every locale resolve to the
      fallback and warn that its dictionary was missing, on a code path that never uses the answer.
      That warning was the one in the logs: `english` is installed, nobody had looked.
    */
    const dict = hasQuery
      ? this.dictionaryExpression(searchedLocales, await this.getAvailableDictionaries())
      : this.dictionaryExpression([], [])
    const tsQuery = sql`websearch_to_tsquery(${dict}, ${terms})`

    const conditions = [sql`p."siteId" = ${siteId}`, sql`p."isSearchable" = true`]
    if (hasQuery) {
      conditions.push(sql`p.ts @@ ${tsQuery}`)
    }
    /*
      Matches what the page view shows, so that search cannot surface a page that could not then be
      opened. Who may see a page that is not live is a page rule's answer, so it is settled per row
      below; a searcher who holds neither permission anywhere is held to live pages here instead.
    */
    const liveNow = liveCondition({
      publishState: sql`p."publishState"`,
      publishStartDate: sql`p."publishStartDate"`,
      publishEndDate: sql`p."publishEndDate"`
    })
    const checkUnpublished = unpublished && !!actor && maySeeUnpublishedAnywhere(actor)
    if (!checkUnpublished) {
      conditions.push(liveNow)
    }
    if (hasQuery) {
      /*
        A protected page is findable by name, not by what it says — for every searcher, including
        whoever could open it without the password: a search result is not the page, and one rule for
        everybody is what keeps the results from depending on who is asking.

        `indexPage` stores the three parts of a page under distinct weights — title `A`, description
        `B`, body `C` — so `ts_filter` can drop the body and ask whether the query still matches. A
        protected page therefore surfaces when the terms are in its title or description, both of which
        it shows to everyone anyway, and stays out when they are only in the text behind the password.
        Otherwise a search for a distinctive phrase would confirm the phrase is in there, which is the
        thing the password is for.

        Written with the cheap test first: for a page with no password the OR short-circuits and
        `ts_filter` never runs.
      */
      conditions.push(sql`(p.password IS NULL OR ts_filter(p.ts, '{a,b}') @@ ${tsQuery})`)
    }
    if (publishState) {
      conditions.push(sql`p."publishState" = ${publishState}`)
    }
    if (path) {
      conditions.push(sql`p.path LIKE ${`${escapeLike(path)}%`}`)
    }
    if (locales.length > 0) {
      // -> `sql.param`, because a bare array is expanded into a list of placeholders rather than
      //    bound as one array value
      conditions.push(sql`p.locale = ANY(${sql.param(locales)}::text[])`)
    }
    if (tags.length > 0) {
      // -> `@>` is contains-all, `&&` is overlaps; both are indexable the same way
      conditions.push(
        tagsMatch === 'any'
          ? sql`p.tags && ${sql.param(tags)}::text[]`
          : sql`p.tags @> ${sql.param(tags)}::text[]`
      )
    }
    if (editor) {
      conditions.push(sql`p.editor = ${editor}`)
    }
    if (creatorId) {
      conditions.push(sql`p."creatorId" = ${creatorId}`)
    }
    if (authorId) {
      conditions.push(sql`p."authorId" = ${authorId}`)
    }

    const direction = orderByDirection === 'asc' ? sql`ASC` : sql`DESC`
    // -> Every page ranks 0 without a query, which would leave the order down to the planner
    const effectiveOrderBy = orderBy === 'relevancy' && !hasQuery ? 'updatedAt' : orderBy
    const ordering = {
      relevancy: sql`relevancy ${direction}, p."updatedAt" DESC`,
      id: sql`p.id ${direction}`,
      /*
        A path is only unique within a locale, so two translations of the same page would otherwise
        come back in whatever order the planner chose -- and swap places between two requests for the
        same list. The locale settles it.
      */
      path: sql`p.path ${direction}, p.locale ASC`,
      title: sql`p.title ${direction}`,
      createdAt: sql`p."createdAt" ${direction}`,
      updatedAt: sql`p."updatedAt" ${direction}`
    }[effectiveOrderBy]

    const { termHighlighting } = this.getConfig()
    const headline = sql`ts_headline(${dict}, coalesce(p."searchContent", ''), ${tsQuery},
      ${`StartSel=${HL_START},StopSel=${HL_STOP},MaxWords=25,MinWords=10,MaxFragments=1`})`
    /*
      The excerpt is cut from the page's own text, which is what the password covers, so a protected
      page never has one. `CASE` rather than a filter on the rows: the page still belongs in the
      results, it just arrives without the part the password covers.
    */
    const highlight =
      !hasQuery || !termHighlighting
        ? sql`NULL`
        : sql`CASE WHEN p.password IS NULL THEN ${headline} ELSE NULL END`

    const where = sql.join(conditions, sql` AND `)
    /*
      A protected page is ranked on its title and description alone, for the reason it is only matched
      on them: a rank lifted by a term in its body would say the term is in there. Decided per row, so
      a page with no password is ranked on everything, as before.
    */
    const relevancy = hasQuery
      ? sql`ts_rank(CASE WHEN p.password IS NULL THEN p.ts ELSE ts_filter(p.ts, '{a,b}') END, ${tsQuery})`
      : sql`0`

    /*
      Which pages this searcher may read is decided BEFORE the results are paged, never after.

      A page rule can be a regular expression or a set of tags, so the deciding rule is only knowable
      per row and cannot go in the `WHERE`. Filtering the rows of one `LIMIT`ed batch instead used to
      leave that batch short -- or empty, with a Load More under it -- and a total still counting every
      page the searcher had been refused, which is itself a statement about pages they may not see. A
      title and a count are content too.

      So with rules to apply, the first query ranks every match but reads only what a rule looks at,
      and the second fetches the full row -- excerpt included, the expensive part -- for the one batch
      that is returned. An actor who is above the rules gets the database's own paging and count.
    */
    const checkRules = !!actor && !actor.permissions.includes('manage:system')

    let pageIds: string[]
    let totalHits: number
    if (checkRules) {
      const candidates = await WIKI.db.execute(sql`
        SELECT p.id, p.path, p.locale, p.tags, ${liveNow} AS "isLive", ${relevancy} AS relevancy
        FROM pages p
        WHERE ${where}
        ORDER BY ${ordering}
      `)
      const readable = ((candidates.rows ?? candidates) as any[]).filter((row) =>
        this.mayList(actor, siteId, row)
      )
      pageIds = readable.slice(offset, offset + limit).map((row) => row.id as string)
      totalHits = readable.length
    } else {
      const candidates = await WIKI.db.execute(sql`
        SELECT p.id, ${relevancy} AS relevancy, COUNT(*) OVER() AS "totalHits"
        FROM pages p
        WHERE ${where}
        ORDER BY ${ordering}
        LIMIT ${limit} OFFSET ${offset}
      `)
      const rows = (candidates.rows ?? candidates) as any[]
      pageIds = rows.map((row) => row.id as string)
      totalHits = Number(rows[0]?.totalHits ?? 0)
    }

    if (pageIds.length < 1) {
      return { results: [], totalHits }
    }

    const rows = await WIKI.db.execute(sql`
      SELECT
        p.id,
        p.path,
        p.locale,
        p.title,
        p.description,
        p.icon,
        p.config->>'iconColor' AS "iconColor",
        p.tags,
        to_char(p."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
        to_char(p."updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt",
        ${relevancy} AS relevancy,
        ${highlight} AS highlight
      FROM pages p
      WHERE p.id = ANY(${sql.param(pageIds)}::uuid[])
    `)
    // -> `ANY` answers in whatever order the planner likes; the order is the first query's
    const byId = new Map(((rows.rows ?? rows) as any[]).map((row) => [row.id as string, row]))

    const result = pageIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((row) => ({
        id: row.id as string,
        path: row.path as string,
        locale: row.locale as string,
        title: row.title as string,
        description: row.description ?? null,
        icon: row.icon ?? null,
        iconColor: (row.iconColor as string | null) ?? '',
        tags: (row.tags ?? []) as string[],
        createdAt: row.createdAt as string,
        updatedAt: row.updatedAt as string,
        relevancy: Number(row.relevancy ?? 0),
        // -> Escaped first, so the only markup that survives is the emphasis postgres marked
        highlight: row.highlight
          ? escapeHtml(row.highlight as string)
              .replaceAll(HL_START, '<b>')
              .replaceAll(HL_STOP, '</b>')
          : null
      }))

    return { results: result, totalHits }
  }

  /**
   * Pages to offer while a query is being typed, best match first.
   *
   * In one locale, the reader's. Titles and paths only — never the body, which is what the full search is for, and which is what a
   * password covers. Every word typed has to occur somewhere in the title or the path, in any order, so
   * a word in the middle of a title finds it as readily as the first one. A match on the whole phrase
   * ranks above one on scattered words, the start of a word above the middle of one, and a title above
   * a path.
   *
   * Exact for whoever asks, as `searchPages` is: the same page rules, the same handling of pages that are
   * not live, the same `isSearchable`. Nothing is suggested from a shared index, so nothing a reader may
   * not open can leak through one. What makes that affordable is that only `limit` pages are needed —
   * the candidates are checked in rank order and the walk stops as soon as enough of them pass.
   */
  async suggestPages({
    siteId,
    query,
    locale,
    limit = 8,
    unpublished = false,
    actor
  }: SuggestPagesParams): Promise<PageSuggestion[]> {
    const phrase = query.trim().toLowerCase().replace(/\s+/g, ' ')
    const words = uniq(phrase.split(' ').filter(Boolean)).slice(0, SUGGEST_MAX_WORDS)
    if (words.length < 1) {
      return []
    }
    // -> A page path has hyphens where its title has spaces
    const pathPhrase = phrase.replaceAll(' ', '-')

    const liveNow = liveCondition({
      publishState: sql`p."publishState"`,
      publishStartDate: sql`p."publishStartDate"`,
      publishEndDate: sql`p."publishEndDate"`
    })
    const conditions = [
      sql`p."siteId" = ${siteId}`,
      sql`p.locale = ${locale}`,
      sql`p."isSearchable" = true`
    ]
    if (!(unpublished && maySeeUnpublishedAnywhere(actor))) {
      conditions.push(liveNow)
    }
    // -> `ILIKE` on the title, plain `LIKE` on the path, which is lowercase already. Both are answered
    //    by the trigram indexes on the two columns.
    const inTitle = words.map((word) => sql`p.title ILIKE ${`%${escapeLike(word)}%`}`)
    for (const [idx, word] of words.entries()) {
      conditions.push(sql`(${inTitle[idx]} OR p.path LIKE ${`%${escapeLike(word)}%`})`)
    }

    const rank = sql`CASE
      WHEN lower(p.title) = ${phrase} OR p.path = ${pathPhrase} THEN 0
      WHEN lower(p.title) LIKE ${`${escapeLike(phrase)}%`} THEN 1
      WHEN lower(p.title) LIKE ${`% ${escapeLike(phrase)}%`} THEN 2
      WHEN lower(p.title) LIKE ${`%${escapeLike(phrase)}%`} THEN 3
      WHEN ${sql.join(inTitle, sql` AND `)} THEN 4
      ELSE 5
    END`

    const checkRules = !actor.permissions.includes('manage:system')
    const candidates = await WIKI.db.execute(sql`
      SELECT p.id, p.path, p.locale, p.title, p.description, p.icon, p.tags, ${liveNow} AS "isLive"
      FROM pages p
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY ${rank}, length(p.title), lower(p.title), p.path
      LIMIT ${checkRules ? SUGGEST_CANDIDATES : limit}
    `)

    const suggestions: PageSuggestion[] = []
    for (const row of (candidates.rows ?? candidates) as any[]) {
      if (suggestions.length >= limit) {
        break
      }
      if (checkRules && !this.mayList(actor, siteId, row)) {
        continue
      }
      suggestions.push({
        id: row.id as string,
        path: row.path as string,
        locale: row.locale as string,
        title: row.title as string,
        description: row.description ?? null,
        icon: row.icon ?? null
      })
    }
    return suggestions
  }

  /**
   * Pages whose path starts with what has been typed, for completing a link as it is written.
   *
   * Not `suggestPages` with another query: a link is written by its path, so that is the only thing
   * matched, and a page marked as not searchable is still a page somebody may link to — the link
   * picker's tree lists it too. The access rules are the same, though, and so is the bounded number
   * of candidates they are applied to.
   *
   * Shallowest first, so that `/guides` offers `guides` and its siblings before whatever is three
   * folders below them.
   */
  async suggestPagePaths({
    siteId,
    prefix,
    locale,
    limit = 5,
    unpublished = false,
    actor
  }: SuggestPagePathsParams): Promise<PageSuggestion[]> {
    const liveNow = liveCondition({
      publishState: sql`p."publishState"`,
      publishStartDate: sql`p."publishStartDate"`,
      publishEndDate: sql`p."publishEndDate"`
    })
    const conditions = [sql`p."siteId" = ${siteId}`, sql`p.locale = ${locale}`]
    if (!(unpublished && maySeeUnpublishedAnywhere(actor))) {
      conditions.push(liveNow)
    }
    // -> Paths are stored lowercase and NFC, so the prefix is put in the same form
    const typed = prefix.normalize('NFC').toLowerCase()
    if (typed) {
      conditions.push(sql`p.path LIKE ${`${escapeLike(typed)}%`}`)
    }

    const checkRules = !actor.permissions.includes('manage:system')
    const candidates = await WIKI.db.execute(sql`
      SELECT p.id, p.path, p.locale, p.title, p.description, p.icon, p.tags, ${liveNow} AS "isLive"
      FROM pages p
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY length(p.path) - length(replace(p.path, '/', '')), p.path
      LIMIT ${checkRules ? SUGGEST_CANDIDATES : limit}
    `)

    const suggestions: PageSuggestion[] = []
    for (const row of (candidates.rows ?? candidates) as any[]) {
      if (suggestions.length >= limit) {
        break
      }
      if (checkRules && !this.mayList(actor, siteId, row)) {
        continue
      }
      suggestions.push({
        id: row.id as string,
        path: row.path as string,
        locale: row.locale as string,
        title: row.title as string,
        description: row.description ?? null,
        icon: row.icon ?? null
      })
    }
    return suggestions
  }

  /**
   * Whether a page row may be listed to this actor: readable under its page rules, and either live or
   * one this actor may see while it is not. The row needs `path`, `locale`, `tags` and `isLive`.
   *
   * Callers skip this for `manage:system`, which is above the rules and whose query already decided
   * whether pages that are not live are in it.
   */
  private mayList(actor: AccessActor, siteId: string, row: any): boolean {
    const ref = {
      siteId,
      path: row.path as string,
      locale: row.locale as string,
      tags: (row.tags ?? []) as string[]
    }
    return (
      WIKI.models.groups.checkAccess(actor, 'read:pages', ref) &&
      (row.isLive === true || maySeeUnpublished(actor, ref))
    )
  }

  /**
   * Recompute the search vector of every page.
   *
   * Grouped by locale, since the dictionary is chosen per locale. Title and description are weighted
   * above the body so that a page whose title matches outranks one that merely mentions the term.
   *
   * Runs over every page rather than only searchable ones: whether a page shows up in results is
   * decided at query time by `isSearchableComputed`, and keeping the vector current means flipping a
   * page back to searchable needs no reindex.
   */
  async rebuildIndex(): Promise<RebuildResult> {
    const available = await this.getAvailableDictionaries()
    const localeRows = await WIKI.db.execute(sql`SELECT DISTINCT locale FROM pages ORDER BY locale`)
    const locales = ((localeRows.rows ?? localeRows) as any[]).map((r) => r.locale as string)

    WIKI.logger.info(`Rebuilding the search index for ${locales.length} locale(s)...`)
    const result: RebuildResult = { pages: 0, locales: [] }

    for (const locale of locales) {
      const dictionary = this.dictionaryForLocale(locale, available)
      // -> The dictionary name is an identifier in `to_tsvector`, and it is only ever one of the
      //    names postgres itself reported, so it cannot carry anything unexpected
      const updated = await WIKI.db.execute(sql`
        UPDATE pages SET ts =
          setweight(to_tsvector(${sql.raw(`'${dictionary}'`)}, coalesce(title, '')), 'A') ||
          setweight(to_tsvector(${sql.raw(`'${dictionary}'`)}, coalesce(description, '')), 'B') ||
          setweight(to_tsvector(${sql.raw(`'${dictionary}'`)}, coalesce("searchContent", '')), 'C')
        WHERE locale = ${locale}
      `)
      const pages = updated.rowCount ?? 0
      result.pages += pages
      result.locales.push({ locale, dictionary, pages })
      WIKI.logger.info(
        `Reindexed ${pages} page(s) in ${locale} using the ${dictionary} dictionary.`
      )
    }

    WIKI.logger.info(`Search index rebuild completed: ${result.pages} page(s) [ OK ]`)
    return result
  }

  /**
   * Recompute one page's search vector, after it was created or edited.
   *
   * Same weighting as a full rebuild — title above description above body — so that a page saved
   * today ranks against pages last indexed by a rebuild rather than alongside them.
   *
   * Never throws: a page that saved correctly must not report failure because its index entry could
   * not be written, and the next rebuild puts it right.
   */
  async indexPage(id: string, locale: string): Promise<void> {
    try {
      const dictionary = this.dictionaryForLocale(locale, await this.getAvailableDictionaries())
      // -> The dictionary name is an identifier in `to_tsvector`, and it is only ever one of the
      //    names postgres itself reported, so it cannot carry anything unexpected
      const dict = sql.raw(`'${dictionary}'`)
      await WIKI.db.execute(sql`
        UPDATE pages SET ts =
          setweight(to_tsvector(${dict}, coalesce(title, '')), 'A') ||
          setweight(to_tsvector(${dict}, coalesce(description, '')), 'B') ||
          setweight(to_tsvector(${dict}, coalesce("searchContent", '')), 'C')
        WHERE id = ${id}
      `)
    } catch (err: any) {
      WIKI.logger.warn(`Failed to update the search index for page ${id}: ${err.message}`)
    }
  }
}

export const search = new Search()
