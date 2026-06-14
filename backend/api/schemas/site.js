export async function registerSchemas(app) {
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
          search: {
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
        properties: {
          asciidoc: {
            type: 'boolean'
          },
          markdown: {
            type: 'boolean'
          },
          wysiwyg: {
            type: 'boolean'
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
            format: 'hexcolor'
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
          showSharingMenu: {
            type: 'boolean'
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
