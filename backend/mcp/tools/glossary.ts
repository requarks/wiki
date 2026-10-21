import { normalizePagePath } from '../../helpers/common.ts'
import { callApi } from '../inject.ts'
import { activeLocales, loadReadablePage, pageFields, primaryLocale, toIso } from '../content.ts'
import { jsonResult, ToolError } from '../tool.ts'
import type { McpContext } from '../context.ts'
import type { McpTool } from '../tool.ts'

/**
 * The checks every glossary read makes, in the order the glossary routes make them: the site's
 * switch, `read:glossary` in the locale (a page permission whose rule's path is ignored), and whether
 * the locale is one the site offers.
 *
 * @returns The locale to read in
 */
function readableLocale(ctx: McpContext, locale: string | undefined): string {
  if (!WIKI.models.glossary.isEnabled(ctx.siteId)) {
    throw new ToolError('This site has no glossary.')
  }
  const target = locale || primaryLocale(ctx)
  if (
    !WIKI.models.groups.checkLocaleAccess(ctx.actor, 'read:glossary', ctx.siteId, target) ||
    !activeLocales(ctx).includes(target)
  ) {
    throw new ToolError(`You may not read the glossary in ${target}.`)
  }
  return target
}

const lookupTerm: McpTool<{ name: string; locale?: string }> = {
  name: 'lookup_term',
  title: 'Look up a glossary term',
  description:
    "Looks up a word or an acronym in the wiki's glossary, by its name or any of its aliases, and returns its definition (markdown), its expansion, related terms and the page that documents it. The glossary is where this organisation defines its own vocabulary: look a term up rather than guessing what an internal name means.",
  group: 'glossary',
  category: 'glossary',
  readOnly: true,
  idempotent: true,
  isAvailable: glossaryAvailable,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255, description: 'The term or an alias.' },
      locale: {
        type: 'string',
        maxLength: 10,
        description: "The glossary's locale. The site's primary locale when absent."
      }
    },
    required: ['name'],
    additionalProperties: false
  },
  async run(ctx, args) {
    const locale = readableLocale(ctx, args.locale)
    const id = await WIKI.models.glossary.lookup(ctx.siteId, locale, args.name)
    const term = id ? await WIKI.models.glossary.get(ctx.siteId, id) : null
    if (!term) {
      throw new ToolError(`No glossary term goes by "${args.name}" in ${locale}.`)
    }
    /*
      The documentation page as THIS caller may read it, rather than as the term reports it: the
      glossary resolves the page's title for whoever may read the glossary, and a title is content a
      page rule may be withholding.
    */
    let documentation = null
    if (term.documentation?.exists) {
      const pageId = await WIKI.models.pages.idAtPath(
        ctx.siteId,
        term.locale,
        term.documentation.path
      )
      documentation = pageId
        ? await loadReadablePage(ctx, pageId)
            .then((page) => pageFields(ctx, page))
            .catch(() => null)
        : null
    }
    return jsonResult({
      id: term.id,
      term: term.term,
      locale: term.locale,
      ...(term.expansion ? { expansion: term.expansion } : {}),
      ...(term.aliases.length > 0 ? { aliases: term.aliases } : {}),
      ...(term.category ? { category: term.category } : {}),
      definition: term.definition,
      ...(term.relatedTerms.length > 0
        ? { relatedTerms: term.relatedTerms.map((related) => related.term) }
        : {}),
      ...(documentation ? { documentation } : {}),
      updatedAt: toIso(term.updatedAt)
    })
  }
}

const listTerms: McpTool<{ locale?: string; category?: string; contains?: string }> = {
  name: 'list_terms',
  title: 'List glossary terms',
  description:
    "Every term in the wiki's glossary for a locale, A–Z, with expansions and aliases but not definitions — use `lookup_term` for those. Narrow with `category` or `contains`.",
  group: 'glossary',
  category: 'glossary',
  readOnly: true,
  idempotent: true,
  isAvailable: glossaryAvailable,
  inputSchema: {
    type: 'object',
    properties: {
      locale: { type: 'string', maxLength: 10 },
      category: { type: 'string', maxLength: 255 },
      contains: {
        type: 'string',
        maxLength: 255,
        description: 'Only terms whose name, expansion or an alias contains this text.'
      }
    },
    additionalProperties: false
  },
  async run(ctx, args) {
    const locale = readableLocale(ctx, args.locale)
    const needle = args.contains?.toLowerCase()
    const terms = (await WIKI.models.glossary.list(ctx.siteId, locale)).filter(
      (term) =>
        (!args.category || term.category === args.category) &&
        (!needle ||
          [term.term, term.expansion ?? '', ...term.aliases].some((name) =>
            name.toLowerCase().includes(needle)
          ))
    )
    return jsonResult({
      locale,
      terms: terms.map((term) => ({
        term: term.term,
        ...(term.expansion ? { expansion: term.expansion } : {}),
        ...(term.aliases.length > 0 ? { aliases: term.aliases } : {}),
        ...(term.category ? { category: term.category } : {})
      }))
    })
  }
}

/** Whether the site has a glossary at all; the tools are not listed where it does not. */
function glossaryAvailable(ctx: McpContext): boolean {
  return WIKI.models.glossary.isEnabled(ctx.siteId)
}

/** The fields a term is written with, as an assistant gives them. */
interface TermFields {
  expansion?: string
  definition?: string
  aliases?: string[]
  category?: string
  relatedTerms?: string[]
  documentationPath?: string
}

const TERM_FIELD_PROPERTIES = {
  expansion: {
    type: 'string',
    maxLength: 255,
    description: 'What an acronym stands for, e.g. "Single Sign-On" for SSO.'
  },
  definition: {
    type: 'string',
    maxLength: 10000,
    description: 'What it means here, in basic markdown. A sentence or two; link a page for more.'
  },
  aliases: {
    type: 'array',
    maxItems: 20,
    items: { type: 'string', minLength: 1, maxLength: 255 },
    description: 'Other names it goes by. A name another term already holds is refused.'
  },
  category: { type: 'string', maxLength: 255 },
  relatedTerms: {
    type: 'array',
    maxItems: 20,
    items: { type: 'string', minLength: 1, maxLength: 255 },
    description: 'Names of other terms in the same glossary. Replaces the whole list.'
  },
  documentationPath: {
    type: 'string',
    maxLength: 2048,
    description: 'The path of the page that documents it, without a locale prefix.'
  }
} as const

/**
 * A term's related terms as the term routes take them — ids — from the names an assistant knows
 * them by. A name with no term behind it is refused rather than dropped, so that a typo is noticed.
 */
async function relatedIds(ctx: McpContext, locale: string, names: string[]): Promise<string[]> {
  const ids: string[] = []
  for (const name of names) {
    const id = await WIKI.models.glossary.lookup(ctx.siteId, locale, name)
    if (!id) {
      throw new ToolError(
        `No glossary term goes by "${name}" in ${locale}, so it cannot be related.`
      )
    }
    ids.push(id)
  }
  return ids
}

/** A written term as the glossary tools answer with it. */
function termAnswer(term: any) {
  return {
    id: term.id,
    term: term.term,
    locale: term.locale,
    updatedAt: term.updatedAt,
    note: 'Pass this `updatedAt` as `expectedUpdatedAt` to change the term again.'
  }
}

const defineTerm: McpTool<{ term: string; locale?: string } & TermFields> = {
  name: 'define_term',
  title: 'Define a glossary term',
  description:
    "Adds a term to the wiki's glossary: an internal name, acronym or piece of jargon, with what it means here. Look it up first (lookup_term) — a name, or an alias of another term, can only mean one thing per locale. To change a term that exists, use update_term.",
  group: 'glossary',
  category: 'glossary',
  readOnly: false,
  isAvailable: glossaryAvailable,
  inputSchema: {
    type: 'object',
    properties: {
      term: { type: 'string', minLength: 1, maxLength: 255, description: 'The name, as written.' },
      locale: { type: 'string', maxLength: 10 },
      ...TERM_FIELD_PROPERTIES
    },
    required: ['term', 'definition'],
    additionalProperties: false
  },
  async run(ctx, args) {
    const locale = args.locale || primaryLocale(ctx)
    const term = await callApi(ctx, 'POST', `sites/${ctx.siteId}/glossary`, {
      body: {
        locale,
        term: args.term,
        expansion: args.expansion ?? null,
        definition: args.definition ?? '',
        aliases: args.aliases ?? [],
        category: args.category ?? null,
        relatedTerms: await relatedIds(ctx, locale, args.relatedTerms ?? []),
        documentationPath: args.documentationPath ? normalizePagePath(args.documentationPath) : null
      }
    })
    return jsonResult(termAnswer(term))
  }
}

const updateTerm: McpTool<{ id: string; expectedUpdatedAt: string; term?: string } & TermFields> = {
  name: 'update_term',
  title: 'Update a glossary term',
  description:
    'Changes a glossary term — a better definition, a missing alias, a related term. Pass the `id` and `updatedAt` lookup_term gave you (`expectedUpdatedAt`); if somebody saved the term since, nothing is written and you are told, so look it up again. Fields you leave out keep their value.',
  group: 'glossary',
  category: 'glossary',
  readOnly: false,
  isAvailable: glossaryAvailable,
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      expectedUpdatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'The `updatedAt` the term had when you read it.'
      },
      term: { type: 'string', minLength: 1, maxLength: 255, description: 'A new name for it.' },
      ...TERM_FIELD_PROPERTIES
    },
    required: ['id', 'expectedUpdatedAt'],
    additionalProperties: false
  },
  async run(ctx, args) {
    // -> The route replaces the whole term, so what the agent leaves out is filled in from what is
    //    stored. Read as this caller may read it: a term in a locale they may not read is not there
    const current = await WIKI.models.glossary.get(ctx.siteId, args.id)
    if (!current) {
      throw new ToolError('There is no such glossary term.')
    }
    readableLocale(ctx, current.locale)
    const term = await callApi(ctx, 'PUT', `sites/${ctx.siteId}/glossary/${args.id}`, {
      body: {
        expectedUpdatedAt: args.expectedUpdatedAt,
        term: args.term ?? current.term,
        expansion: args.expansion ?? current.expansion,
        definition: args.definition ?? current.definition,
        aliases: args.aliases ?? current.aliases,
        category: args.category ?? current.category,
        relatedTerms: args.relatedTerms
          ? await relatedIds(ctx, current.locale, args.relatedTerms)
          : current.relatedTerms.map((related) => related.id),
        documentationPath:
          args.documentationPath !== undefined
            ? normalizePagePath(args.documentationPath) || null
            : (current.documentation?.path ?? null),
        documentationLabel: current.documentation?.label ?? null,
        references: current.references,
        caseSensitive: current.caseSensitive,
        autoLink: current.autoLink
      }
    })
    return jsonResult(termAnswer(term))
  }
}

export const glossaryTools: McpTool[] = [lookupTerm, listTerms, defineTerm, updateTerm]
