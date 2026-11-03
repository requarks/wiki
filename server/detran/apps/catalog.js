const _ = require('lodash')

/* global WIKI */

/**
 * Catálogo Padrão de Aplicações Satélites da Intranet Detran-MG
 * Todas autenticadas sob o mesmo Tenant Microsoft Entra ID (e5d3ae7c-9b38-48de-a087-f6734a287574).
 */
const DEFAULT_APPS = [
  {
    id: 'servicedesk',
    nome: 'Service Desk',
    icone: 'mdi-headset',
    descricao: 'Central de Chamados, Suporte de TI e Atendimento aos Servidores',
    ssoStartUrl: 'https://detran-desk-epeveqghavdheva9.westus3-01.azurewebsites.net/api/auth/sso/start',
    allowedGroups: [] // Vazio = liberado para todos os utilizadores autenticados
  },
  {
    id: 'wikijs',
    nome: 'Intranet Wiki',
    icone: 'mdi-book-open-page-variant',
    descricao: 'Gestão de Conteúdo, Normativos e Base de Conhecimento Institucional',
    ssoStartUrl: '/',
    allowedGroups: []
  }
]

/**
 * Tenant ID corporativo da Intranet no Microsoft Entra ID
 */
const ENTRA_ID_TENANT_ID = 'e5d3ae7c-9b38-48de-a087-f6734a287574'

class AppsCatalog {
  constructor(customApps = null) {
    this.customApps = customApps
  }

  /**
   * Obtém o catálogo ativo (config.yml ou padrão)
   *
   * @returns {Array<Object>}
   */
  getCatalog() {
    if (this.customApps && Array.isArray(this.customApps)) {
      return this.customApps
    }

    if (typeof WIKI !== 'undefined' && WIKI.config) {
      if (Array.isArray(WIKI.config.internalApps) && WIKI.config.internalApps.length > 0) {
        return WIKI.config.internalApps
      }
      if (Array.isArray(WIKI.config.satellites) && WIKI.config.satellites.length > 0) {
        return WIKI.config.satellites
      }
    }

    return DEFAULT_APPS
  }

  /**
   * Busca uma aplicação pelo identificador único (id)
   *
   * @param {string} appId
   * @returns {Object|null}
   */
  getApp(appId) {
    if (!appId || typeof appId !== 'string') {
      return null
    }

    const cleanId = appId.trim().toLowerCase()
    const catalog = this.getCatalog()
    return catalog.find(app => (app.id || '').toLowerCase() === cleanId) || null
  }

  /**
   * Verifica se o identificador pertence a uma aplicação válida
   *
   * @param {string} appId
   * @returns {boolean}
   */
  isValidAppId(appId) {
    return this.getApp(appId) !== null
  }

  /**
   * Valida se o utilizador possui permissão para acessar a aplicação satélite
   *
   * @param {Object} app
   * @param {Object} user
   * @returns {boolean}
   */
  hasAccess(app, user) {
    if (!app) {
      return false
    }

    // Apenas utilizadores autenticados (id != 2 / guest)
    if (!user || user.id === 2) {
      return false
    }

    // Administradores globais têm acesso irrestrito
    if (Array.isArray(user.permissions) && user.permissions.includes('manage:system')) {
      return true
    }

    // Se allowedGroups não foi definido ou está vazio, acesso liberado a todos autenticados
    if (!app.allowedGroups || !Array.isArray(app.allowedGroups) || app.allowedGroups.length === 0) {
      return true
    }

    // Extrai os grupos associados ao utilizador
    let userGroupNames = []
    if (Array.isArray(user.groups)) {
      userGroupNames = user.groups.map(g => (typeof g === 'string' ? g : g.name || '')).filter(Boolean)
    }

    // Se algum grupo do utilizador coincidir com allowedGroups
    const hasGroup = _.intersection(
      userGroupNames.map(g => g.toLowerCase()),
      app.allowedGroups.map(g => (g || '').toLowerCase())
    ).length > 0

    return hasGroup
  }

  /**
   * Lista todas as aplicações permitidas para o utilizador
   *
   * @param {Object} user
   * @returns {Array<Object>}
   */
  listUserApps(user) {
    const catalog = this.getCatalog()
    return catalog
      .filter(app => this.hasAccess(app, user))
      .map(app => ({
        ...app,
        resolvedSsoUrl: this.buildSsoUrl(app, user)
      }))
  }

  /**
   * Constrói a URL de redirecionamento SSO adicionando a dica de login do utilizador
   * Formato: ?login_hint=${encodeURIComponent(user.email)}
   *
   * @param {Object} app
   * @param {Object} user
   * @returns {string}
   */
  buildSsoUrl(app, user) {
    if (!app || !app.ssoStartUrl) {
      return '/'
    }

    let url = app.ssoStartUrl.trim()

    // Se a aplicação é a própria intranet wiki ('/' ou URL local)
    if (url === '/' || url === '' || url.startsWith('/')) {
      return url || '/'
    }

    // Se possuir usuário autenticado com email, anexa login_hint
    const email = user && user.email ? user.email.trim() : null
    if (email) {
      const separator = url.includes('?') ? '&' : '?'
      url = `${url}${separator}login_hint=${encodeURIComponent(email)}`
    }

    return url
  }

  /**
   * Retorna o Tenant ID do Entra ID configurado
   */
  getTenantId() {
    return ENTRA_ID_TENANT_ID
  }
}

module.exports = new AppsCatalog()
module.exports.AppsCatalog = AppsCatalog
module.exports.DEFAULT_APPS = DEFAULT_APPS
module.exports.ENTRA_ID_TENANT_ID = ENTRA_ID_TENANT_ID
