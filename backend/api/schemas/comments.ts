import {
  ANNOTATION_CONTEXT_MAX_LENGTH,
  ANNOTATION_QUOTE_MAX_LENGTH
} from '../../models/comments.ts'
import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * COMMENTS PROVIDER - A comments module as configured for a site
   */
  app.addSchema({
    $id: 'CommentsProvider',
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description:
          'Directory name under `modules/comments`, or `default` for the provider the wiki implements itself.'
      },
      title: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      website: {
        type: 'string',
        description: "The provider's own site."
      },
      icon: {
        type: 'string'
      },
      isBuiltIn: {
        type: 'boolean',
        description:
          'Whether this is the wiki’s own provider. It stores comments here, in the `comments` table, and draws them on a Talk tab beside the article rather than under it.'
      },
      isSelected: {
        type: 'boolean',
        description:
          'Whether this is the provider the site uses. At most one provider is: two comment widgets on a page are two separate discussions of it, and neither is the discussion.'
      },
      requires: {
        type: 'array',
        items: { type: 'string' },
        description:
          'The config keys that must hold a value before the provider can be used. A selected provider missing one of these contributes nothing rather than a widget pointed at no account.'
      },
      props: {
        type: 'object',
        additionalProperties: true,
        description:
          'The configuration fields the module declares, as the admin area renders them. Read-only: what a module needs configured is a property of the module, not of the site.'
      },
      config: {
        type: 'object',
        additionalProperties: true,
        description:
          "The stored value of each prop, completed from the module's defaults. A prop marked sensitive — the built-in provider's Akismet key — is replaced by a fixed mask, and sending that mask back means “leave it as it is”."
      }
    }
  })

  /**
   * COMMENTS PROVIDER INPUT - What a client may change about one provider
   */
  app.addSchema({
    $id: 'CommentsProviderInput',
    type: 'object',
    properties: {
      key: {
        type: 'string'
      },
      config: {
        type: 'object',
        additionalProperties: true,
        description:
          'Values for the props the module declares. Unknown keys are dropped, read-only props are ignored, and a sensitive prop sent back as the mask keeps the value already stored.'
      }
    },
    required: ['key']
  })

  /**
   * COMMENT ANCHOR - Where an annotated passage is in the article
   */
  app.addSchema({
    $id: 'CommentAnchor',
    type: 'object',
    description:
      'The passage, described rather than pointed at, so that it can be found again after the page has been edited. Text is the article as drawn, with every run of whitespace folded into one space. A passage is found while its `exact` text is still in the page; `prefix`, `suffix`, `heading` and `offset` decide between the places it occurs.',
    required: ['exact', 'prefix', 'suffix', 'heading', 'offset'],
    additionalProperties: false,
    properties: {
      exact: {
        type: 'string',
        minLength: 1,
        maxLength: ANNOTATION_QUOTE_MAX_LENGTH,
        description: 'The passage itself.'
      },
      prefix: {
        type: 'string',
        maxLength: ANNOTATION_CONTEXT_MAX_LENGTH,
        description: 'The text just before it.'
      },
      suffix: {
        type: 'string',
        maxLength: ANNOTATION_CONTEXT_MAX_LENGTH,
        description: 'The text just after it.'
      },
      heading: {
        type: 'string',
        nullable: true,
        maxLength: 255,
        description: 'The id of the heading it sat under, or null above the first one.'
      },
      offset: {
        type: 'integer',
        minimum: 0,
        description: 'How far into that heading’s section it started, in characters.'
      }
    }
  })

  /**
   * COMMENT ANNOTATION - One passage of the article a comment is about
   */
  app.addSchema({
    $id: 'CommentAnnotation',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      commentId: { type: 'string', format: 'uuid' },
      position: {
        type: 'integer',
        description: 'Where it comes in its comment, from 0.'
      },
      note: {
        type: 'string',
        description: 'What was said about the passage. Markdown, rendered the way a comment is.'
      },
      anchor: { $ref: 'CommentAnchor#' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      resolvedAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'When it was marked done, or null while it is open.'
      },
      resolvedById: { type: 'string', format: 'uuid', nullable: true },
      resolvedByName: {
        type: 'string',
        nullable: true,
        description: 'Who marked it done, while that account exists.'
      }
    }
  })

  /**
   * COMMENT - One comment on one page, from the built-in provider
   *
   * Neither the email a guest typed nor the address it was posted from is here. Both are stored, for
   * the spam check and for whatever moderation grows out of it, and neither is anybody's to read from
   * an API.
   */
  app.addSchema({
    $id: 'Comment',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      parentId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description:
          'The comment this one answers, or null for one that starts a thread. Replies are one level deep: answering a reply attaches the answer to that reply’s own parent.'
      },
      content: {
        type: 'string',
        description:
          'Markdown source, as it was typed. There is no stored HTML — a comment is rendered in the reader’s browser with raw HTML disabled.'
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Later than `createdAt` for a comment that has been edited.'
      },
      authorId: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Null for a guest, and null again once the account behind it is deleted.'
      },
      authorName: { type: 'string' },
      authorHasAvatar: { type: 'boolean' },
      authorHandle: {
        type: 'string',
        nullable: true,
        description: 'The handle this author is mentioned by, or null if they have not set one.'
      },
      isGuest: { type: 'boolean' },
      isDeleted: {
        type: 'boolean',
        description:
          'Whether this is the placeholder a deleted comment leaves for its replies. It carries nothing of what was deleted: empty content, no author, no annotations.'
      },
      annotations: {
        type: 'array',
        description:
          'The passages of the article this comment is about, in the order they were picked. Only a comment that starts a thread has any.',
        items: { $ref: 'CommentAnnotation#' }
      }
    }
  })

  /**
   * MENTION TARGET - A handle that resolved to somebody
   */
  app.addSchema({
    $id: 'MentionTarget',
    type: 'object',
    properties: {
      handle: { type: 'string' },
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' }
    }
  })
}
