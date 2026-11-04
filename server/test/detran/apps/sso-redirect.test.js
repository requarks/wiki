const appsCatalog = require('../../../detran/apps/catalog')

describe('Detran-MG SSO Hub & ?returnApp= Redirection Flow (Unit & Route Handlers)', () => {
  const userAuthenticated = {
    id: 10,
    email: 'danilo.santana@detran.mg.gov.br',
    name: 'Danilo Santana',
    groups: [{ name: 'Colaboradores' }]
  }

  const expectedServicedeskSsoUrl = appsCatalog.buildSsoUrl(appsCatalog.getApp('servicedesk'), userAuthenticated)

  const userGuest = {
    id: 2,
    email: 'guest@example.com',
    name: 'Guest',
    groups: [{ name: 'Guest' }]
  }

  function createMockReq(options = {}) {
    return {
      query: options.query || {},
      cookies: options.cookies || {},
      params: options.params || {},
      user: options.user !== undefined ? options.user : null,
      headers: options.headers || {},
      path: options.path || '/',
      ...options
    }
  }

  function createMockRes() {
    return {
      cookies: {},
      clearedCookies: [],
      statusCode: 200,
      redirectUrl: null,
      renderedView: null,
      renderedData: null,
      jsonData: null,
      locals: { pageMeta: {} },
      status(code) {
        this.statusCode = code
        return this
      },
      cookie(name, value, opts) {
        this.cookies[name] = { value, opts }
        return this
      },
      clearCookie(name) {
        this.clearedCookies.push(name)
        delete this.cookies[name]
        return this
      },
      redirect(url) {
        this.redirectUrl = url
        return this
      },
      render(view, data) {
        this.renderedView = view
        this.renderedData = data
        return this
      },
      json(data) {
        this.jsonData = data
        return this
      }
    }
  }

  describe('1. Handler GET /login com ?returnApp=', () => {
    // Simula a lógica implementada no GET /login do server/controllers/auth.js
    function handleLoginGet(req, res) {
      if (req.query.returnApp && appsCatalog.isValidAppId(req.query.returnApp)) {
        const returnApp = appsCatalog.getApp(req.query.returnApp)
        if (req.user && req.user.id !== 2 && appsCatalog.hasAccess(returnApp, req.user)) {
          return res.redirect(appsCatalog.buildSsoUrl(returnApp, req.user))
        }
        res.cookie('returnApp', req.query.returnApp.trim().toLowerCase(), {
          maxAge: 15 * 60 * 1000,
          path: '/',
          httpOnly: false,
          sameSite: 'lax'
        })
      }
      return res.render('login', {})
    }

    test('Utilizador não autenticado recebe cookie returnApp e tela de login', () => {
      const req = createMockReq({ query: { returnApp: 'servicedesk' }, user: userGuest })
      const res = createMockRes()

      handleLoginGet(req, res)

      expect(res.redirectUrl).toBeNull()
      expect(res.cookies['returnApp']).toBeDefined()
      expect(res.cookies['returnApp'].value).toBe('servicedesk')
      expect(res.renderedView).toBe('login')
    })

    test('Utilizador já autenticado é redirecionado imediatamente com login_hint', () => {
      const req = createMockReq({ query: { returnApp: 'servicedesk' }, user: userAuthenticated })
      const res = createMockRes()

      handleLoginGet(req, res)

      expect(res.redirectUrl).toBe(
        expectedServicedeskSsoUrl
      )
    })

    test('Parâmetro com app inexistente não gera cookie nem redireciona', () => {
      const req = createMockReq({ query: { returnApp: 'malicious-domain' }, user: userGuest })
      const res = createMockRes()

      handleLoginGet(req, res)

      expect(res.redirectUrl).toBeNull()
      expect(res.cookies['returnApp']).toBeUndefined()
    })
  })

  describe('2. Handler Callback de Autenticação (/login/:strategy/callback)', () => {
    // Simula a lógica do callback pós-login implementada no server/controllers/auth.js
    function handleCallback(req, res, authResult) {
      res.cookie('jwt', authResult.jwt)

      const returnAppId = req.cookies['returnApp'] || req.query.returnApp
      if (returnAppId && appsCatalog.isValidAppId(returnAppId)) {
        res.clearCookie('returnApp')
        const targetApp = appsCatalog.getApp(returnAppId)
        const authenticatedUser = authResult.user || req.user
        if (targetApp && authenticatedUser && appsCatalog.hasAccess(targetApp, authenticatedUser)) {
          const ssoUrl = appsCatalog.buildSsoUrl(targetApp, authenticatedUser)
          return res.redirect(ssoUrl)
        }
      }

      return res.redirect('/')
    }

    test('Após autenticação bem-sucedida com cookie returnApp, redireciona para a aplicação satélite com login_hint e limpa cookie', () => {
      const req = createMockReq({
        cookies: { returnApp: 'servicedesk' },
        user: null
      })
      const res = createMockRes()
      const authResult = {
        jwt: 'mock-jwt-token',
        user: userAuthenticated
      }

      handleCallback(req, res, authResult)

      expect(res.clearedCookies).toContain('returnApp')
      expect(res.redirectUrl).toBe(
        expectedServicedeskSsoUrl
      )
    })

    test('Se cookie returnApp for inválido, segue fluxo normal para / sem redirecionamento externo', () => {
      const req = createMockReq({
        cookies: { returnApp: 'hacker-site' },
        user: null
      })
      const res = createMockRes()
      const authResult = {
        jwt: 'mock-jwt-token',
        user: userAuthenticated
      }

      handleCallback(req, res, authResult)

      expect(res.redirectUrl).toBe('/')
    })
  })

  describe('3. Rota de Lançamento Direto /apps/:appId e /sso/:appId', () => {
    // Simula o handler implementado em server/controllers/common.js
    function handleAppLaunch(req, res) {
      const appId = req.params.appId
      if (!appsCatalog.isValidAppId(appId)) {
        return res.redirect('/apps')
      }
      const app = appsCatalog.getApp(appId)
      if (!req.user || req.user.id === 2) {
        res.cookie('returnApp', appId.trim().toLowerCase())
        return res.redirect(`/login?returnApp=${encodeURIComponent(appId)}`)
      }
      if (!appsCatalog.hasAccess(app, req.user)) {
        return res.status(403).render('unauthorized', { action: 'view' })
      }
      return res.redirect(appsCatalog.buildSsoUrl(app, req.user))
    }

    test('Usuário autenticado acessando /apps/servicedesk é redirecionado com login_hint', () => {
      const req = createMockReq({ params: { appId: 'servicedesk' }, user: userAuthenticated })
      const res = createMockRes()

      handleAppLaunch(req, res)

      expect(res.redirectUrl).toBe(
        expectedServicedeskSsoUrl
      )
    })

    test('Usuário não autenticado em /apps/servicedesk grava cookie e é enviado para /login?returnApp=servicedesk', () => {
      const req = createMockReq({ params: { appId: 'servicedesk' }, user: userGuest })
      const res = createMockRes()

      handleAppLaunch(req, res)

      expect(res.cookies['returnApp']).toBeDefined()
      expect(res.cookies['returnApp'].value).toBe('servicedesk')
      expect(res.redirectUrl).toBe('/login?returnApp=servicedesk')
    })
  })

  describe('4. API REST do Catálogo de Aplicações Satélites (/api/detran/apps)', () => {
    // Simula o endpoint implementado em server/controllers/common.js
    function handleGetAppsApi(req, res) {
      const userApps = appsCatalog.listUserApps(req.user)
      return res.json({
        tenantId: appsCatalog.getTenantId(),
        apps: userApps
      })
    }

    test('Retorna lista de aplicações disponíveis com tenantId e resolvedSsoUrl formatada', () => {
      const req = createMockReq({ user: userAuthenticated })
      const res = createMockRes()

      handleGetAppsApi(req, res)

      expect(res.jsonData).toBeDefined()
      expect(res.jsonData.tenantId).toBe('e5d3ae7c-9b38-48de-a087-f6734a287574')
      expect(Array.isArray(res.jsonData.apps)).toBe(true)

      const servicedesk = res.jsonData.apps.find(a => a.id === 'servicedesk')
      expect(servicedesk).toBeDefined()
      expect(servicedesk.resolvedSsoUrl).toBe(
        expectedServicedeskSsoUrl
      )
    })
  })
})
