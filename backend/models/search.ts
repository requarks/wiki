import { sql } from 'drizzle-orm'

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

export const SEARCH_ORDER_BY = ['relevancy', 'title', 'updatedAt'] as const
export type SearchOrderBy = (typeof SEARCH_ORDER_BY)[number]

export interface SearchResult {
  id: string
  path: string
  locale: string
  title: string
  description: string | null
  icon: string | null
  tags: string[]
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
  editor?: string
  publishState?: string
  orderBy?: SearchOrderBy
  orderByDirection?: 'asc' | 'desc'
  offset?: number
  limit?: number
  /** Restrict to what a reader with no session may see: published, and not password protected. */
  publicOnly?: boolean
  /** Whether unpublished pages belong in the results, which is an editor's view of the wiki. */
  includeDrafts?: boolean
}

/**
 * Markers `ts_headline` wraps a matched term in.
 *
 * Control characters, because the excerpt is page text that may itself contain anything: it is HTML
 * escaped before these are turned into tags, so a page whose text reads `<script>` cannot come back as
 * markup. Anything that could occur in real text would defeat that.
 */
const HL_START = '\u0002'
const HL_STOP = '\u0003'

/** Escape the LIKE wildcards, so that a path filter is a prefix rather than a pattern. */
function escapeLikePrefix(value: string): string {
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
    return sql`(CASE p.locale::text ${sql.join(arms, sql` `)} ELSE ${sql.raw(`'${FALLBACK_DICTIONARY}'`)} END)::regconfig`
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
    editor = '',
    publishState = '',
    orderBy = 'relevancy',
    orderByDirection = 'desc',
    offset = 0,
    limit = 25,
    publicOnly = false,
    includeDrafts = false
  }: SearchPagesParams): Promise<SearchPagesResult> {
    const terms = query.trim()
    const hasQuery = terms.length > 0

    // -> Only the locales in play need an arm in the dictionary CASE
    const siteLocales: string[] = WIKI.sites[siteId]?.config?.locales?.active ?? ['en']
    const searchedLocales = locales.length > 0 ? locales : siteLocales
    const dict = this.dictionaryExpression(
      searchedLocales,
      hasQuery ? await this.getAvailableDictionaries() : []
    )
    const tsQuery = sql`websearch_to_tsquery(${dict}, ${terms})`

    const conditions = [sql`p."siteId" = ${siteId}`, sql`p."isSearchable" = true`]
    if (hasQuery) {
      conditions.push(sql`p.ts @@ ${tsQuery}`)
    }
    if (publicOnly) {
      // -> Matches what a page view shows an anonymous reader, so that search cannot surface a page
      //    that could not then be opened
      conditions.push(sql`p."publishState" = 'published'`)
      conditions.push(sql`p.password IS NULL`)
    } else if (!includeDrafts) {
      conditions.push(sql`p."publishState" <> 'draft'`)
    }
    if (publishState) {
      conditions.push(sql`p."publishState" = ${publishState}`)
    }
    if (path) {
      conditions.push(sql`p.path LIKE ${`${escapeLikePrefix(path)}%`}`)
    }
    if (locales.length > 0) {
      // -> `sql.param`, because a bare array is expanded into a list of placeholders rather than
      //    bound as one array value
      conditions.push(sql`p.locale::text = ANY(${sql.param(locales)}::text[])`)
    }
    if (tags.length > 0) {
      conditions.push(sql`p.tags @> ${sql.param(tags)}::text[]`)
    }
    if (editor) {
      conditions.push(sql`p.editor = ${editor}`)
    }

    const direction = orderByDirection === 'asc' ? sql`ASC` : sql`DESC`
    // -> Every page ranks 0 without a query, which would leave the order down to the planner
    const effectiveOrderBy = orderBy === 'relevancy' && !hasQuery ? 'updatedAt' : orderBy
    const ordering = {
      relevancy: sql`relevancy ${direction}, p."updatedAt" DESC`,
      title: sql`p.title ${direction}`,
      updatedAt: sql`p."updatedAt" ${direction}`
    }[effectiveOrderBy]

    const { termHighlighting } = this.getConfig()
    const highlight =
      hasQuery && termHighlighting
        ? sql`ts_headline(${dict}, coalesce(p."searchContent", ''), ${tsQuery},
            ${`StartSel=${HL_START},StopSel=${HL_STOP},MaxWords=25,MinWords=10,MaxFragments=1`})`
        : sql`NULL`

    const rows = await WIKI.db.execute(sql`
      SELECT
        p.id,
        p.path,
        p.locale::text AS locale,
        p.title,
        p.description,
        p.icon,
        p.tags,
        to_char(p."updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt",
        ${hasQuery ? sql`ts_rank(p.ts, ${tsQuery})` : sql`0`} AS relevancy,
        ${highlight} AS highlight,
        COUNT(*) OVER() AS "totalHits"
      FROM pages p
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY ${ordering}
      LIMIT ${limit} OFFSET ${offset}
    `)

    const result = ((rows.rows ?? rows) as any[]).map((row) => ({
      id: row.id as string,
      path: row.path as string,
      locale: row.locale as string,
      title: row.title as string,
      description: row.description ?? null,
      icon: row.icon ?? null,
      tags: (row.tags ?? []) as string[],
      updatedAt: row.updatedAt as string,
      relevancy: Number(row.relevancy ?? 0),
      // -> Escaped first, so the only markup that survives is the emphasis postgres marked
      highlight: row.highlight
        ? escapeHtml(row.highlight as string)
            .replaceAll(HL_START, '<b>')
            .replaceAll(HL_STOP, '</b>')
        : null
    }))

    return {
      results: result,
      totalHits: Number((rows.rows ?? rows)[0]?.totalHits ?? 0)
    }
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
    const localeRows = await WIKI.db.execute(
      sql`SELECT DISTINCT locale::text AS locale FROM pages ORDER BY locale`
    )
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
        WHERE locale::text = ${locale}
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
