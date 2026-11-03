const catalog = require('../../../detran/apps/catalog')
const { AppsCatalog } = catalog

describe('Detran-MG Apps Catalog & SSO Helper (Entra ID)', () => {
  const userValid = {
    id: 10,
    email: 'servidor.teste@detran.mg.gov.br',
    name: 'Servidor Teste',
    groups: [{ name: 'Colaboradores' }]
  }

  const userRestricted = {
    id: 11,
    email: 'ti.teste@detran.mg.gov.br',
    name: 'TI Teste',
    groups: [{ name: 'TI' }]
  }

  const userAdmin = {
    id: 1,
    email: 'admin@detran.mg.gov.br',
    name: 'Admin',
    permissions: ['manage:system'],
    groups: [{ name: 'Administrators' }]
  }

  const userGuest = {
    id: 2,
    email: 'guest@example.com',
    name: 'Guest',
    groups: [{ name: 'Guest' }]
  }

  describe('1. Catálogo e Configuração Padrão', () => {
    test('deve conter o Tenant ID do Microsoft Entra ID correto', () => {
      expect(catalog.getTenantId()).toBe('e5d3ae7c-9b38-48de-a087-f6734a287574')
    })

    test('deve listar aplicações padrão (servicedesk e wikijs)', () => {
      const apps = catalog.getCatalog()
      expect(Array.isArray(apps)).toBe(true)
      expect(apps.length).toBeGreaterThanOrEqual(2)

      const servicedesk = apps.find(a => a.id === 'servicedesk')
      expect(servicedesk).toBeDefined()
      expect(servicedesk.nome).toBe('Service Desk')
      expect(servicedesk.icone).toBe('mdi-headset')
      expect(servicedesk.ssoStartUrl).toBe('https://detran-desk-epeveqghavdheva9.westus3-01.azurewebsites.net/api/auth/sso/start')

      const wikijs = apps.find(a => a.id === 'wikijs')
      expect(wikijs).toBeDefined()
      expect(wikijs.nome).toBe('Intranet Wiki')
    })

    test('deve permitir catálogo customizado na instância AppsCatalog', () => {
      const customApps = [
        { id: 'rh', nome: 'Portal RH', ssoStartUrl: 'https://rh.detran.mg.gov.br/sso', allowedGroups: [] }
      ]
      const customInstance = new AppsCatalog(customApps)
      expect(customInstance.getCatalog()).toEqual(customApps)
      expect(customInstance.getApp('rh')).toBeDefined()
      expect(customInstance.getApp('servicedesk')).toBeNull()
    })
  })

  describe('2. Validação e Busca de Aplicações', () => {
    test('getApp deve encontrar a aplicação com case-insensitive e trim', () => {
      const app = catalog.getApp('  SERVICEDESK  ')
      expect(app).not.toBeNull()
      expect(app.id).toBe('servicedesk')
    })

    test('getApp deve retornar null para IDs desconhecidos ou vazios', () => {
      expect(catalog.getApp('app-desconhecida')).toBeNull()
      expect(catalog.getApp('')).toBeNull()
      expect(catalog.getApp(null)).toBeNull()
    })

    test('isValidAppId deve validar a presença da app no catálogo', () => {
      expect(catalog.isValidAppId('servicedesk')).toBe(true)
      expect(catalog.isValidAppId('wikijs')).toBe(true)
      expect(catalog.isValidAppId('malicious-app')).toBe(false)
    })
  })

  describe('3. Controle de Acesso Baseado em Grupos (hasAccess)', () => {
    test('não deve conceder acesso a usuários não autenticados ou Guest (id: 2)', () => {
      const app = catalog.getApp('servicedesk')
      expect(catalog.hasAccess(app, null)).toBe(false)
      expect(catalog.hasAccess(app, userGuest)).toBe(false)
    })

    test('deve conceder acesso a todos os autenticados quando allowedGroups estiver vazio', () => {
      const app = catalog.getApp('servicedesk')
      expect(catalog.hasAccess(app, userValid)).toBe(true)
    })

    test('deve respeitar allowedGroups quando especificado', () => {
      const customCatalog = new AppsCatalog([
        {
          id: 'sis-gestao',
          nome: 'Sistema de Gestão',
          ssoStartUrl: 'https://gestao.detran.mg.gov.br/sso',
          allowedGroups: ['TI', 'Diretoria']
        }
      ])
      const restrictedApp = customCatalog.getApp('sis-gestao')

      expect(customCatalog.hasAccess(restrictedApp, userRestricted)).toBe(true) // tem grupo 'TI'
      expect(customCatalog.hasAccess(restrictedApp, userValid)).toBe(false) // não tem grupo
    })

    test('administrador global sempre possui acesso mesmo com restrição de grupos', () => {
      const customCatalog = new AppsCatalog([
        {
          id: 'sis-financeiro',
          nome: 'Sistema Financeiro',
          ssoStartUrl: 'https://fin.detran.mg.gov.br/sso',
          allowedGroups: ['Financeiro']
        }
      ])
      const app = customCatalog.getApp('sis-financeiro')
      expect(customCatalog.hasAccess(app, userAdmin)).toBe(true)
    })

    test('listUserApps deve filtrar e retornar somente aplicações permitidas', () => {
      const customCatalog = new AppsCatalog([
        { id: 'publica', nome: 'Geral', ssoStartUrl: 'https://geral.detran.mg.gov.br', allowedGroups: [] },
        { id: 'ti-only', nome: 'Ferramenta TI', ssoStartUrl: 'https://ti.detran.mg.gov.br', allowedGroups: ['TI'] }
      ])

      const appsParaServidorComum = customCatalog.listUserApps(userValid)
      expect(appsParaServidorComum.map(a => a.id)).toEqual(['publica'])

      const appsParaTI = customCatalog.listUserApps(userRestricted)
      expect(appsParaTI.map(a => a.id)).toEqual(['publica', 'ti-only'])
    })
  })

  describe('4. Geração de URLs SSO com login_hint (buildSsoUrl)', () => {
    test('deve anexar ?login_hint=email quando a URL não possuir query params', () => {
      const app = {
        id: 'servicedesk',
        ssoStartUrl: 'https://servicedesk.detran.mg.gov.br/api/auth/sso/start'
      }
      const ssoUrl = catalog.buildSsoUrl(app, userValid)
      expect(ssoUrl).toBe('https://servicedesk.detran.mg.gov.br/api/auth/sso/start?login_hint=servidor.teste%40detran.mg.gov.br')
    })

    test('deve anexar &login_hint=email quando a URL já possuir query params', () => {
      const app = {
        id: 'servicedesk',
        ssoStartUrl: 'https://servicedesk.detran.mg.gov.br/api/auth/sso/start?tenant=e5d3ae7c-9b38-48de-a087-f6734a287574'
      }
      const ssoUrl = catalog.buildSsoUrl(app, userValid)
      expect(ssoUrl).toBe('https://servicedesk.detran.mg.gov.br/api/auth/sso/start?tenant=e5d3ae7c-9b38-48de-a087-f6734a287574&login_hint=servidor.teste%40detran.mg.gov.br')
    })

    test('deve manter a URL sem login_hint se user não possuir email', () => {
      const app = {
        id: 'servicedesk',
        ssoStartUrl: 'https://servicedesk.detran.mg.gov.br/api/auth/sso/start'
      }
      const ssoUrl = catalog.buildSsoUrl(app, { id: 10 })
      expect(ssoUrl).toBe('https://servicedesk.detran.mg.gov.br/api/auth/sso/start')
    })

    test('deve retornar a própria rota local caso a aplicação seja interna (ex: /)', () => {
      const app = {
        id: 'wikijs',
        ssoStartUrl: '/'
      }
      expect(catalog.buildSsoUrl(app, userValid)).toBe('/')
    })
  })
})
