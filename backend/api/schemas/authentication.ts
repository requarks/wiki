import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * AUTH LOGIN RESULT - Where a login attempt got to, and what the client must do next
   */
  app.addSchema({
    $id: 'AuthLoginResult',
    type: 'object',
    properties: {
      ok: {
        type: 'boolean'
      },
      authenticated: {
        type: 'boolean',
        description: 'Present, and true, only once the session is actually logged in.'
      },
      nextAction: {
        type: 'string',
        enum: ['redirect', 'changePassword', 'provideTfa', 'setupTfa'],
        description:
          'What the client has to do to finish. Anything other than `redirect` means the attempt is not a login yet and has to be continued with `continuationToken`.'
      },
      continuationToken: {
        type: 'string',
        description: 'Stands for this half-finished login. Sent back with whatever it asked for.'
      },
      tfaQRImage: {
        type: 'string',
        description:
          'For `setupTfa` only: the `otpauth://` URI as an SVG QR code, to be rendered as-is.'
      },
      redirect: {
        type: 'string',
        description: 'Where to send the user once logged in. A path within this wiki, or a URL.'
      }
    }
  })

  /**
   * AUTH MODULE - An authentication module as found on disk
   */
  app.addSchema({
    $id: 'AuthModule',
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Directory name under `modules/authentication`.'
      },
      title: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      logo: {
        type: 'string'
      },
      icon: {
        type: 'string'
      },
      color: {
        type: 'string'
      },
      vendor: {
        type: 'string'
      },
      website: {
        type: 'string'
      },
      isAvailable: {
        type: 'boolean'
      },
      useForm: {
        type: 'boolean',
        description: 'Whether logging in through it means submitting a username and password.'
      },
      usernameType: {
        type: 'string'
      },
      props: {
        type: 'object',
        additionalProperties: true,
        description:
          'The module configuration, declared in its `definition.yml`: each entry carries a `type`, `title`, `hint`, `default` and the display hints the admin area renders a control from. A `readOnly` prop is shown but cannot be changed, and is silently kept at its stored value when written to.'
      },
      refs: {
        type: 'object',
        additionalProperties: true,
        description:
          'Read-only values the administrator needs to configure the other side, such as a callback URL. `{host}` and `{id}` are placeholders for the wiki origin and the strategy ID.'
      }
    }
  })

  /**
   * AUTH STRATEGY - A configured instance of a module
   */
  app.addSchema({
    $id: 'AuthStrategy',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      module: {
        type: 'string',
        description: 'Key of the module this strategy is an instance of.'
      },
      displayName: {
        type: 'string'
      },
      isEnabled: {
        type: 'boolean'
      },
      registration: {
        type: 'boolean'
      },
      allowedEmailRegex: {
        type: 'string'
      },
      autoEnrollGroups: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid'
        }
      },
      config: {
        type: 'object',
        additionalProperties: true,
        description:
          'Values for the module props, completed with the module defaults for any prop that has none stored yet.'
      }
    }
  })

  /**
   * AUTH STRATEGY INPUT - Used both ways: to create a strategy, and as a partial update
   */
  app.addSchema({
    $id: 'AuthStrategyInput',
    type: 'object',
    properties: {
      module: {
        type: 'string',
        maxLength: 255,
        description:
          'Only on create, and only a module that exists on disk. Cannot be changed after.'
      },
      displayName: {
        type: 'string',
        maxLength: 255,
        description: 'Defaults to the module title on create.'
      },
      isEnabled: {
        type: 'boolean'
      },
      registration: {
        type: 'boolean',
        description: 'Stored but not enforced: self-registration is not implemented yet.'
      },
      allowedEmailRegex: {
        type: 'string',
        maxLength: 255,
        description:
          'Must be a valid regular expression. Stored but not enforced, as it only applies to self-registration.'
      },
      autoEnrollGroups: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid'
        },
        description:
          'Groups a self-registered user would join. The guests group is refused. Stored but not enforced, as above.'
      },
      config: {
        type: 'object',
        additionalProperties: true,
        description:
          'Values for the module props. Validated against what the module declares: an unknown key is dropped, a wrong type is refused, and a read-only prop keeps its stored value.'
      }
    }
  })
}
