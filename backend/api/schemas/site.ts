import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * SITE
   */
  app.addSchema({
    $id: 'Site',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      hostname: {
        type: 'string',
        format: 'hostname'
      },
      isEnabled: {
        type: 'boolean'
      },
      title: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      company: {
        type: 'string'
      },
      contentLicense: {
        type: 'string'
      },
      footerExtra: {
        type: 'string'
      },
      pageExtensions: {
        type: 'array',
        items: {
          type: 'string'
        }
      },
      pageCasing: {
        type: 'boolean'
      },
      discoverable: {
        type: 'boolean'
      },
      defaults: {
        type: 'object',
        properties: {
          tocDepth: {
            type: 'object',
            properties: {
              min: {
                type: 'number'
              },
              max: {
                type: 'number'
              }
            }
          }
        }
      },
      features: {
        type: 'object',
        properties: {
          browse: {
            type: 'boolean'
          },
          ratings: {
            type: 'boolean'
          },
          ratingsMode: {
            type: 'string',
            enum: ['off', 'stars', 'thumbs']
          },
          comments: {
            type: 'boolean'
          },
          contributions: {
            type: 'boolean'
          },
          profile: {
            type: 'boolean'
          },
          reasonForChange: {
            type: 'string',
            enum: ['off', 'optional', 'required']
          },
          search: {
            type: 'boolean'
          }
        }
      },
      uploads: {
        type: 'object',
        properties: {
          conflictBehavior: {
            type: 'string',
            enum: ['overwrite', 'reject', 'new']
          },
          normalizeFilename: {
            type: 'boolean'
          }
        }
      },
      logoUrl: {
        type: 'string'
      },
      logoText: {
        type: 'boolean'
      },
      sitemap: {
        type: 'boolean'
      },
      robots: {
        type: 'object',
        properties: {
          index: {
            type: 'boolean'
          },
          follow: {
            type: 'boolean'
          }
        }
      },
      auth: {
        type: 'object',
        description: 'Login experience for this site. Redirects can be overridden per group.',
        properties: {
          autoLogin: {
            type: 'boolean'
          },
          bypassUnauthorized: {
            type: 'boolean'
          },
          hideLocal: {
            type: 'boolean'
          },
          loginRedirect: {
            type: 'string',
            maxLength: 255
          },
          welcomeRedirect: {
            type: 'string',
            maxLength: 255
          },
          logoutRedirect: {
            type: 'string',
            maxLength: 255
          }
        }
      },
      authStrategies: {
        type: 'array',
        description: 'Which authentication strategies this site offers, in display order.',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            order: {
              type: 'integer',
              minimum: 0
            },
            isVisible: {
              type: 'boolean'
            }
          }
        }
      },
      locales: {
        type: 'object',
        properties: {
          primary: {
            type: 'string'
          },
          active: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          forcePrefix: {
            type: 'boolean'
          },
          showMenu: {
            type: 'boolean',
            description:
              'Whether the sidebar offers a locale selector to switch between the active locales.'
          }
        }
      },
      assets: {
        type: 'object',
        properties: {
          logo: {
            type: 'boolean'
          },
          logoExt: {
            type: 'string'
          },
          favicon: {
            type: 'boolean'
          },
          faviconExt: {
            type: 'string'
          },
          loginBg: {
            type: 'boolean'
          }
        }
      },
      editors: {
        type: 'object',
        description:
          'Per-editor state. `config` is free-form and specific to each editor implementation.',
        properties: {
          asciidoc: {
            type: 'object',
            properties: {
              isActive: {
                type: 'boolean'
              },
              config: {
                type: 'object',
                additionalProperties: true
              }
            }
          },
          markdown: {
            type: 'object',
            properties: {
              isActive: {
                type: 'boolean'
              },
              config: {
                type: 'object',
                additionalProperties: true
              }
            }
          },
          wysiwyg: {
            type: 'object',
            properties: {
              isActive: {
                type: 'boolean'
              },
              config: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        }
      },
      theme: {
        type: 'object',
        properties: {
          dark: {
            type: 'boolean'
          },
          codeBlocksTheme: {
            type: 'string',
            description: 'Name of a highlight.js stylesheet, e.g. `github-dark`.',
            maxLength: 255
          },
          colorPrimary: {
            type: 'string',
            format: 'hexcolor'
          },
          colorSecondary: {
            type: 'string',
            format: 'hexcolor'
          },
          colorAccent: {
            type: 'string',
            format: 'hexcolor'
          },
          colorHeader: {
            type: 'string',
            format: 'hexcolor'
          },
          colorSidebar: {
            type: 'string',
            format: 'hexcolor'
          },
          injectCSS: {
            type: 'string'
          },
          injectHead: {
            type: 'string'
          },
          injectBody: {
            type: 'string'
          },
          contentWidth: {
            type: 'string',
            enum: ['centered', 'full']
          },
          sidebarPosition: {
            type: 'string',
            enum: ['off', 'left', 'right']
          },
          tocPosition: {
            type: 'string',
            enum: ['off', 'left', 'right']
          },
          showPrintBtn: {
            type: 'boolean'
          },
          baseFont: {
            type: 'string'
          },
          contentFont: {
            type: 'string'
          }
        }
      }
    }
  })
}
