import { and, asc, eq, inArray, isNotNull, ne, or, sql } from 'drizzle-orm'
import {
  glossaryTermRelations as relationsTable,
  glossaryTerms as termsTable,
  pages as pagesTable,
  users as usersTable
} from '../db/schema.ts'

/**
 * How much a term may carry. Shared with the route schemas, which are what actually enforce it.
 *
 * Per `dev/specs/glossary.md` §3.4. A name — the term, an alias, the expansion, the category, the
 * documentation label — is a varchar(255) column or an entry like one.
 */
export const GLOSSARY_NAME_MAX_LENGTH = 255
export const GLOSSARY_ALIASES_MAX = 50
export const GLOSSARY_DEFINITION_MAX_LENGTH = 10000
export const GLOSSARY_REFERENCES_MAX = 20
export const GLOSSARY_RELATED_MAX = 50

/** An external reference: a link out, with an optional label the URL stands in for. */
export interface GlossaryReference {
  url: string
  label: string
}

/** What a create or a save carries. `locale` is fixed at creation, so a save never names one. */
export interface GlossaryTermInput {
  term: string
  expansion?: string | null
  definition?: string
  aliases?: string[]
  relatedTerms?: string[]
  documentationPath?: string | null
  documentationLabel?: string | null
  references?: GlossaryReference[]
  caseSensitive?: boolean
  autoLink?: boolean
  category?: string | null
}

/**
 * A term as the sidebar lists it.
 *
 * The two case and linking flags are here although the sidebar draws neither: they are what the
 * auto-link list (`autoLinkList`, spec §9) is cut from, and the list is the one place a client sees
 * every term of a locale at once.
 */
export interface GlossaryTermSummary {
  id: string
  term: string
  expansion: string | null
  aliases: string[]
  category: string | null
  caseSensitive: boolean
  autoLink: boolean
}

/** A term in full, as the main panel shows it and the form edits it. */
export interface GlossaryTerm extends GlossaryTermSummary {
  siteId: string
  locale: string
  definition: string
  references: GlossaryReference[]
  relatedTerms: Array<{ id: string; term: string }>
  /**
   * The documentation page, resolved. Null when the term names none; `exists: false` when it names a
   * path with no page, which the view says rather than offering a dead link.
   */
  documentation: {
    path: string
    label: string | null
    title: string | null
    exists: boolean
  } | null
  author: { id: string; name: string } | null
  createdAt: string
  /** At millisecond precision — what a save hands back as `expectedUpdatedAt`. */
  updatedAt: string
}

/**
 * Why a write was refused, for the route to turn into a status code.
 *
 * Results rather than thrown errors, because two of them carry something the client needs beyond a
 * message: who already holds a name, and the term as somebody else just saved it.
 */
export type GlossaryWriteResult =
  | { ok: true; term: GlossaryTerm; changedFields: string[] }
  | { ok: false; reason: 'notFound' }
  | { ok: false; reason: 'invalidRelated' }
  | {
      ok: false
      reason: 'nameTaken'
      /** Which of the caller's fields holds the clashing name. */
      field: 'term' | 'aliases'
      name: string
      holder: { id: string; term: string }
    }
  | { ok: false; reason: 'stale'; current: GlossaryTerm }

/** The fields compared to report what a save changed, for the audit log. */
const COMPARED_FIELDS = [
  'term',
  'expansion',
  'definition',
  'aliases',
  'relatedTerms',
  'documentationPath',
  'documentationLabel',
  'references',
  'caseSensitive',
  'autoLink',
  'category'
] as const

/**
 * A name as it is stored and compared: NFC, trimmed, inner whitespace collapsed to one space.
 *
 * So that `REST  API`, `REST API` and a decomposed accent are each one name rather than three that
 * look identical in the sidebar and collide nowhere.
 */
export function normalizeName(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ')
}

/** An optional text field: normalized like a name, with empty meaning absent. */
function optionalName(value: string | null | undefined): string | null {
  const normalized = normalizeName(value ?? '')
  return normalized.length > 0 ? normalized : null
}

/** Compared without leading or trailing slashes, as every page path is stored. */
function normalizePath(value: string | null | undefined): string | null {
  const path = (value ?? '').trim().replace(/^\/+|\/+$/g, '')
  return path.length > 0 ? path : null
}

/**
 * The aliases as they will be stored.
 *
 * Normalized, then with every repeat and every copy of the term's own name dropped silently rather
 * than refused (spec §3.3): saying a name twice is not a mistake worth stopping a save for.
 */
function cleanAliases(aliases: string[] | undefined, term: string): string[] {
  const seen = new Set([term.toLowerCase()])
  const out: string[] = []
  for (const alias of aliases ?? []) {
    const name = normalizeName(alias)
    const key = name.toLowerCase()
    if (name.length < 1 || seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(name)
  }
  return out
}

/** References with both halves trimmed, and any without a URL dropped. */
function cleanReferences(references: GlossaryReference[] | undefined): GlossaryReference[] {
  return (references ?? [])
    .map((ref) => ({ url: (ref.url ?? '').trim(), label: normalizeName(ref.label ?? '') }))
    .filter((ref) => ref.url.length > 0)
}

/** A transaction, or the database outside one. Every read here works inside a write's transaction. */
type Executor = typeof WIKI.db | Parameters<Parameters<typeof WIKI.db.transaction>[0]>[0]

/** `updatedAt` as the API carries it. JS dates are milliseconds, which is the precision promised. */
function iso(value: Date): string {
  return value.toISOString()
}

/**
 * Glossary model. See `dev/specs/glossary.md`.
 */
class Glossary {
  /**
   * Whether the site has a glossary at all — `features.glossary`, General → Features.
   *
   * On unless switched off, the way `backlinks` and `comments` read: the switch exists to turn it off.
   */
  isEnabled(siteId: string): boolean {
    return WIKI.sites[siteId]?.config?.features?.glossary !== false
  }

  /** Whether a locale is one this site offers, which is the only kind a term may be written in. */
  isActiveLocale(siteId: string, locale: string): boolean {
    const active: string[] = WIKI.sites[siteId]?.config?.locales?.active ?? []
    return active.includes(locale)
  }

  /** Every term of a locale, A–Z, as the sidebar lists them. */
  async list(siteId: string, locale: string): Promise<GlossaryTermSummary[]> {
    return WIKI.db
      .select({
        id: termsTable.id,
        term: termsTable.term,
        expansion: termsTable.expansion,
        aliases: termsTable.aliases,
        category: termsTable.category,
        caseSensitive: termsTable.caseSensitive,
        autoLink: termsTable.autoLink
      })
      .from(termsTable)
      .where(and(eq(termsTable.siteId, siteId), eq(termsTable.locale, locale)))
      .orderBy(sql`lower(${termsTable.term})`, asc(termsTable.term))
  }

  /**
   * Whether terms are linked where they occur in page text — `features.glossaryAutoLink`. On unless
   * switched off, as `isEnabled` reads, and nothing at all while the glossary itself is off.
   */
  isAutoLinkEnabled(siteId: string): boolean {
    return (
      this.isEnabled(siteId) && WIKI.sites[siteId]?.config?.features?.glossaryAutoLink !== false
    )
  }

  /**
   * What the glossary of a locale looks like right now, as cheaply as it can be asked: how many terms
   * and when the latest was saved. Every write changes one or the other — a delete the count, a create
   * or a save `updatedAt` — so this is what the auto-link list's ETag is made of (spec §9), and what
   * spares a reader re-downloading the list on every page.
   */
  async version(siteId: string, locale: string): Promise<{ count: number; latestAt: string }> {
    const [row] = await WIKI.db
      .select({
        count: sql<number>`count(*)::int`,
        latestAt: sql<string | null>`max(${termsTable.updatedAt})`
      })
      .from(termsTable)
      .where(and(eq(termsTable.siteId, siteId), eq(termsTable.locale, locale)))
    return { count: row?.count ?? 0, latestAt: String(row?.latestAt ?? '') }
  }

  /**
   * The terms a page in this locale links automatically: those with `autoLink` on, with exactly what
   * the matcher needs and the expansion, which a link carries as its title. Longest name first is the
   * matcher's business, since it has the aliases to weigh too.
   */
  async autoLinkList(
    siteId: string,
    locale: string
  ): Promise<
    Array<Pick<GlossaryTermSummary, 'id' | 'term' | 'expansion' | 'aliases' | 'caseSensitive'>>
  > {
    return WIKI.db
      .select({
        id: termsTable.id,
        term: termsTable.term,
        expansion: termsTable.expansion,
        aliases: termsTable.aliases,
        caseSensitive: termsTable.caseSensitive
      })
      .from(termsTable)
      .where(
        and(
          eq(termsTable.siteId, siteId),
          eq(termsTable.locale, locale),
          eq(termsTable.autoLink, true)
        )
      )
  }

  /** The categories in use in a locale, for the form's suggestions. */
  async categories(siteId: string, locale: string): Promise<string[]> {
    const rows = await WIKI.db
      .selectDistinct({ category: termsTable.category })
      .from(termsTable)
      .where(
        and(
          eq(termsTable.siteId, siteId),
          eq(termsTable.locale, locale),
          isNotNull(termsTable.category)
        )
      )
    return rows
      .map((row) => row.category as string)
      .sort((a, b) => a.localeCompare(b, locale, { sensitivity: 'base' }))
  }

  /**
   * The term a name or an alias belongs to, for a `?glossary=` link (spec §7).
   *
   * Aliases count, so that a term renamed with its old name kept as an alias keeps its old links.
   */
  async lookup(siteId: string, locale: string, name: string): Promise<string | null> {
    const wanted = normalizeName(name)
    if (wanted.length < 1) {
      return null
    }
    const rows = await WIKI.db
      .select({ id: termsTable.id })
      .from(termsTable)
      .where(
        and(
          eq(termsTable.siteId, siteId),
          eq(termsTable.locale, locale),
          or(
            sql`lower(${termsTable.term}) = lower(${wanted})`,
            sql`EXISTS (SELECT 1 FROM unnest(${termsTable.aliases}) AS a WHERE lower(a) = lower(${wanted}))`
          )
        )
      )
      // -> The term's own name before an alias, should a race ever have let both exist
      .orderBy(sql`lower(${termsTable.term}) = lower(${wanted}) DESC`)
      .limit(1)
    return rows[0]?.id ?? null
  }

  /** The locale a term is in, which is what every permission over it is asked about. */
  async localeOf(siteId: string, id: string): Promise<string | null> {
    const rows = await WIKI.db
      .select({ locale: termsTable.locale })
      .from(termsTable)
      .where(and(eq(termsTable.id, id), eq(termsTable.siteId, siteId)))
      .limit(1)
    return rows[0]?.locale ?? null
  }

  /** A term in full, or null when there is none with this id on this site. */
  async get(siteId: string, id: string, tx: Executor = WIKI.db): Promise<GlossaryTerm | null> {
    const rows = await tx
      .select({
        row: termsTable,
        authorName: usersTable.name
      })
      .from(termsTable)
      .leftJoin(usersTable, eq(usersTable.id, termsTable.authorId))
      .where(and(eq(termsTable.id, id), eq(termsTable.siteId, siteId)))
      .limit(1)
    if (rows.length < 1) {
      return null
    }
    const { row, authorName } = rows[0]

    // -> Both sides of the pair table: a relation is one row whichever term it was saved from
    const related = await tx
      .select({ id: termsTable.id, term: termsTable.term })
      .from(relationsTable)
      .innerJoin(
        termsTable,
        sql`${termsTable.id} = CASE WHEN ${relationsTable.termId} = ${id} THEN ${relationsTable.relatedId} ELSE ${relationsTable.termId} END`
      )
      .where(or(eq(relationsTable.termId, id), eq(relationsTable.relatedId, id)))
      .orderBy(sql`lower(${termsTable.term})`)

    let documentation: GlossaryTerm['documentation'] = null
    if (row.documentationPath) {
      const page = await tx
        .select({ title: pagesTable.title })
        .from(pagesTable)
        .where(
          and(
            eq(pagesTable.siteId, siteId),
            eq(pagesTable.locale, row.locale),
            eq(pagesTable.path, row.documentationPath)
          )
        )
        .limit(1)
      documentation = {
        path: row.documentationPath,
        label: row.documentationLabel,
        title: page[0]?.title ?? null,
        exists: page.length > 0
      }
    }

    return {
      id: row.id,
      siteId: row.siteId,
      locale: row.locale,
      term: row.term,
      expansion: row.expansion,
      definition: row.definition,
      aliases: row.aliases,
      category: row.category,
      caseSensitive: row.caseSensitive,
      autoLink: row.autoLink,
      references: (row.references ?? []) as GlossaryReference[],
      relatedTerms: related,
      documentation,
      author: row.authorId && authorName ? { id: row.authorId, name: authorName } : null,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt)
    }
  }

  /**
   * Create a term.
   *
   * @param actorId The account creating it, or null for an API key
   */
  async create(
    siteId: string,
    locale: string,
    input: GlossaryTermInput,
    actorId: string | null
  ): Promise<GlossaryWriteResult> {
    return WIKI.db.transaction(async (tx) => {
      const values = this.#valuesFrom(input)
      const refused = await this.#checkWrite(tx, siteId, locale, null, values, input)
      if (refused) {
        return refused
      }
      // -> Both dates from JS rather than `now()`, so that what is stored is the millisecond value a
      //    save will name as `expectedUpdatedAt` — postgres would keep microseconds
      const now = new Date()
      const [created] = await tx
        .insert(termsTable)
        .values({
          ...values,
          siteId,
          locale,
          creatorId: actorId,
          authorId: actorId,
          createdAt: now,
          updatedAt: now
        })
        .returning({ id: termsTable.id })
      await this.#replaceRelations(tx, created.id, input.relatedTerms ?? [])
      const term = (await this.get(siteId, created.id, tx)) as GlossaryTerm
      return { ok: true, term, changedFields: [] }
    })
  }

  /**
   * Replace a term, provided nobody else has saved it since `expectedUpdatedAt` (spec §5.2).
   *
   * The compare is made by the UPDATE itself, so there is no window between checking and writing.
   */
  async update(
    siteId: string,
    id: string,
    input: GlossaryTermInput,
    expectedUpdatedAt: string,
    actorId: string | null
  ): Promise<GlossaryWriteResult> {
    return WIKI.db.transaction(async (tx) => {
      const before = await this.get(siteId, id, tx)
      if (!before) {
        return { ok: false, reason: 'notFound' }
      }
      const values = this.#valuesFrom(input)
      const refused = await this.#checkWrite(tx, siteId, before.locale, id, values, input)
      if (refused) {
        return refused
      }
      const expected = new Date(expectedUpdatedAt)
      const updated = await tx
        .update(termsTable)
        .set({ ...values, authorId: actorId, updatedAt: new Date() })
        .where(
          and(
            eq(termsTable.id, id),
            eq(termsTable.siteId, siteId),
            sql`date_trunc('milliseconds', ${termsTable.updatedAt}) = ${expected.toISOString()}::timestamp`
          )
        )
        .returning({ id: termsTable.id })
      if (updated.length < 1) {
        return { ok: false, reason: 'stale', current: before }
      }
      await this.#replaceRelations(tx, id, input.relatedTerms ?? [])
      const term = (await this.get(siteId, id, tx)) as GlossaryTerm
      return { ok: true, term, changedFields: this.#changedFields(before, term) }
    })
  }

  /** Delete a term. Its relations go with it, by cascade. Returns what was deleted, for the log. */
  async remove(siteId: string, id: string): Promise<{ term: string; locale: string } | null> {
    const deleted = await WIKI.db
      .delete(termsTable)
      .where(and(eq(termsTable.id, id), eq(termsTable.siteId, siteId)))
      .returning({ term: termsTable.term, locale: termsTable.locale })
    return deleted[0] ?? null
  }

  /**
   * Follow a page that moved with `updateLinks`: every term documented by it now points where it went
   * (spec §5.3).
   *
   * Only the terms in the page's OLD locale can be pointing at it, since a documentation page is in
   * its term's own locale. A move within that locale rewrites their path; a move to another locale
   * clears it, label and all, because the page is no longer one those terms may name.
   *
   * Not asked about per term, unlike the pages relinked beside it: whoever moves a page with
   * `updateLinks` has asked for what pointed at it to follow. `updatedAt` is bumped on each, so a form
   * open on one of them is refused with a 409 rather than saving the old path back.
   *
   * @returns The ids of the terms rewritten and of those cleared
   */
  async relinkDocumentation(
    siteId: string,
    previous: { locale: string; path: string },
    next: { locale: string; path: string }
  ): Promise<{ updated: string[]; cleared: string[] }> {
    const sameLocale = previous.locale === next.locale
    const rows = await WIKI.db
      .update(termsTable)
      .set(
        sameLocale
          ? { documentationPath: next.path, updatedAt: new Date() }
          : { documentationPath: null, documentationLabel: null, updatedAt: new Date() }
      )
      .where(
        and(
          eq(termsTable.siteId, siteId),
          eq(termsTable.locale, previous.locale),
          eq(termsTable.documentationPath, previous.path)
        )
      )
      .returning({ id: termsTable.id })
    const ids = rows.map((row) => row.id)
    return sameLocale ? { updated: ids, cleared: [] } : { updated: [], cleared: ids }
  }

  /** The columns a create or a save writes, normalized. */
  #valuesFrom(input: GlossaryTermInput) {
    const term = normalizeName(input.term)
    const documentationPath = normalizePath(input.documentationPath)
    return {
      term,
      expansion: optionalName(input.expansion),
      definition: (input.definition ?? '').trim(),
      aliases: cleanAliases(input.aliases, term),
      documentationPath,
      // -> A label for no link would be stored and never shown, then come back on the next link set
      documentationLabel: documentationPath ? optionalName(input.documentationLabel) : null,
      references: cleanReferences(input.references),
      caseSensitive: input.caseSensitive ?? false,
      autoLink: input.autoLink ?? true,
      category: optionalName(input.category)
    }
  }

  /**
   * Everything that can refuse a write before it is made: the names, then the related terms.
   *
   * Inside the write's transaction. Two saves racing to claim the same ALIAS can still both pass —
   * no index reaches into the arrays — and that is accepted (spec §3.3): the next edit of either term
   * is refused, which surfaces it.
   */
  async #checkWrite(
    tx: Executor,
    siteId: string,
    locale: string,
    selfId: string | null,
    values: { term: string; aliases: string[] },
    input: GlossaryTermInput
  ): Promise<GlossaryWriteResult | null> {
    const names = [values.term, ...values.aliases]
    const clashes = await tx
      .select({ id: termsTable.id, term: termsTable.term, aliases: termsTable.aliases })
      .from(termsTable)
      .where(
        and(
          eq(termsTable.siteId, siteId),
          eq(termsTable.locale, locale),
          selfId ? ne(termsTable.id, selfId) : undefined,
          or(
            sql`lower(${termsTable.term}) IN (SELECT lower(n) FROM unnest(${sql.param(names)}::text[]) AS n)`,
            sql`EXISTS (SELECT 1 FROM unnest(${termsTable.aliases}) AS a WHERE lower(a) IN (SELECT lower(n) FROM unnest(${sql.param(names)}::text[]) AS n))`
          )
        )
      )
      .limit(1)
    if (clashes.length > 0) {
      const holder = clashes[0]
      const taken = new Set([holder.term, ...holder.aliases].map((n) => n.toLowerCase()))
      // -> Which of the caller's names it was, so the form can mark the right field. The term first:
      //    a clash on the name itself is the one to fix before any alias
      const name = names.find((n) => taken.has(n.toLowerCase())) ?? values.term
      return {
        ok: false,
        reason: 'nameTaken',
        field: name === values.term ? 'term' : 'aliases',
        name,
        holder: { id: holder.id, term: holder.term }
      }
    }

    const related = [...new Set(input.relatedTerms ?? [])]
    if (related.length > 0) {
      if (selfId && related.includes(selfId)) {
        return { ok: false, reason: 'invalidRelated' }
      }
      const found = await tx
        .select({ id: termsTable.id })
        .from(termsTable)
        .where(
          and(
            inArray(termsTable.id, related),
            eq(termsTable.siteId, siteId),
            eq(termsTable.locale, locale)
          )
        )
      if (found.length !== related.length) {
        return { ok: false, reason: 'invalidRelated' }
      }
    }
    return null
  }

  /**
   * Make a term's related terms exactly these, from both sides.
   *
   * Every pair touching the term is replaced, so taking B out of A's list takes A out of B's. Each pair
   * is written smaller id first, which is what the table's check requires and what makes it one row.
   */
  async #replaceRelations(tx: Executor, id: string, relatedIds: string[]): Promise<void> {
    await tx
      .delete(relationsTable)
      .where(or(eq(relationsTable.termId, id), eq(relationsTable.relatedId, id)))
    const pairs = [...new Set(relatedIds)]
      .filter((other) => other !== id)
      .map((other) =>
        id < other ? { termId: id, relatedId: other } : { termId: other, relatedId: id }
      )
    if (pairs.length > 0) {
      await tx.insert(relationsTable).values(pairs).onConflictDoNothing()
    }
  }

  /** Which fields a save changed — names only, never values (spec §8). */
  #changedFields(before: GlossaryTerm, after: GlossaryTerm): string[] {
    const shape = (term: GlossaryTerm) => ({
      term: term.term,
      expansion: term.expansion,
      definition: term.definition,
      aliases: term.aliases,
      relatedTerms: term.relatedTerms.map((r) => r.id).sort(),
      documentationPath: term.documentation?.path ?? null,
      documentationLabel: term.documentation?.label ?? null,
      references: term.references,
      caseSensitive: term.caseSensitive,
      autoLink: term.autoLink,
      category: term.category
    })
    const a = shape(before)
    const b = shape(after)
    return COMPARED_FIELDS.filter((field) => JSON.stringify(a[field]) !== JSON.stringify(b[field]))
  }
}

export const glossary = new Glossary()
