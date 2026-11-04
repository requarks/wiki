"use strict";
var DetranSSOClientModule = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // packages/detran-sso-client/src/index.ts
  var index_exports = {};
  __export(index_exports, {
    DEFAULT_ENTRA_TENANT_ID: () => DEFAULT_ENTRA_TENANT_ID,
    DEFAULT_INTRANET_PROD_URL: () => DEFAULT_INTRANET_PROD_URL,
    DETRAN_SSO_EVENTS: () => DETRAN_SSO_EVENTS,
    DetranAppLauncherElement: () => DetranAppLauncherElement,
    DetranSSO: () => DetranSSO,
    attachAxiosInterceptor: () => attachAxiosInterceptor,
    createDetranFetch: () => createDetranFetch,
    default: () => index_default,
    registerDetranAppLauncher: () => registerDetranAppLauncher
  });

  // packages/detran-sso-client/src/constants.ts
  var DEFAULT_ENTRA_TENANT_ID = "e5d3ae7c-9b38-48de-a087-f6734a287574";
  var DEFAULT_INTRANET_PROD_URL = "https://intranet.detran.mg.gov.br";
  var DETRAN_SSO_EVENTS = {
    UNAUTHORIZED: "detran:sso:unauthorized",
    LOGIN_HINT_DETECTED: "detran:sso:login-hint",
    APPS_LOADED: "detran:sso:apps-loaded"
  };

  // packages/detran-sso-client/src/client.ts
  var DetranSSO = class {
    constructor(config) {
      this.isInterceptorAttached = false;
      if (!config || !config.appId) {
        throw new Error('[DetranSSO] "appId" \xE9 obrigat\xF3rio na configura\xE7\xE3o (ex: "servicedesk").');
      }
      this.appId = String(config.appId).trim();
      this.intranetUrl = (config.intranetUrl || "").replace(/\/+$/, "");
      this.tenantId = config.tenantId || DEFAULT_ENTRA_TENANT_ID;
      this.autoCleanLoginHint = config.autoCleanLoginHint !== false;
      this.onUnauthorizedCallback = config.onUnauthorized;
      if (!this.intranetUrl) {
        throw new Error('[DetranSSO] "intranetUrl" \xE9 obrigat\xF3ria (ex: "http://localhost:3000" ou "https://intranet.detran.mg.gov.br").');
      }
      if (config.autoIntercept) {
        this.attachFetchInterceptor();
      }
      this.inspectInitialLoginHint();
    }
    /**
     * Constrói a URL de redirecionamento para o login corporativo da Intranet
     *
     * @param options Opções adicionais de redirecionamento
     * @returns URL completa de login com parâmetro returnApp
     */
    getLoginUrl(options) {
      const params = new URLSearchParams();
      params.set("returnApp", this.appId);
      if (options?.redirectPath) {
        params.set("targetPath", options.redirectPath);
      }
      if (options?.extraParams) {
        for (const [key, val] of Object.entries(options.extraParams)) {
          if (val !== void 0 && val !== null) {
            params.set(key, String(val));
          }
        }
      }
      return `${this.intranetUrl}/login?${params.toString()}`;
    }
    /**
     * Redireciona o navegador para a tela de autenticação da Intranet
     *
     * @param options Opções de redirecionamento
     */
    redirectToLogin(options) {
      if (typeof window === "undefined") {
        return;
      }
      const url = this.getLoginUrl(options);
      window.location.href = url;
    }
    /**
     * Extrai o login_hint enviado pela Intranet na URL atual (?login_hint=...)
     *
     * @returns O e-mail informado ou null se ausente
     */
    getLoginHint() {
      if (typeof window === "undefined" || !window.location) {
        return null;
      }
      const searchParams = new URLSearchParams(window.location.search);
      const hint = searchParams.get("login_hint");
      if (hint && this.autoCleanLoginHint) {
        this.clearLoginHint();
      }
      return hint;
    }
    /**
     * Remove o parâmetro login_hint da barra de endereço de forma limpa, sem recarregar
     */
    clearLoginHint() {
      if (typeof window === "undefined" || !window.location || !window.history) {
        return;
      }
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has("login_hint")) {
        currentUrl.searchParams.delete("login_hint");
        const cleanUrl = currentUrl.pathname + (currentUrl.search || "") + (currentUrl.hash || "");
        const title = typeof document !== "undefined" ? document.title : "";
        window.history.replaceState({}, title, cleanUrl);
      }
    }
    /**
     * Redireciona o usuário para o logout corporativo na Intranet
     *
     * @param redirectUri URL de retorno após deslogar (padrão: window.location.origin)
     */
    logout(redirectUri) {
      if (typeof window === "undefined") {
        return;
      }
      const target = redirectUri || window.location.origin;
      const logoutUrl = `${this.intranetUrl}/logout?redirect=${encodeURIComponent(target)}`;
      window.location.href = logoutUrl;
    }
    /**
     * Busca no Hub da Intranet a lista de aplicações satélites autorizadas para o usuário logado
     *
     * @returns Lista de aplicações satélites cadastradas
     */
    async getAuthorizedApps() {
      try {
        const endpoint = `${this.intranetUrl}/api/detran/apps`;
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Accept": "application/json"
          },
          credentials: "include"
        });
        if (!response.ok) {
          return [];
        }
        const data = await response.json();
        const apps = Array.isArray(data.apps) ? data.apps : [];
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
          window.dispatchEvent(new CustomEvent(DETRAN_SSO_EVENTS.APPS_LOADED, { detail: { apps } }));
        }
        return apps;
      } catch {
        return [];
      }
    }
    /**
     * Conecta o interceptor global de window.fetch.
     * Se qualquer requisição retornar HTTP 401 Unauthorized, redireciona para o login corporativo.
     */
    attachFetchInterceptor() {
      if (typeof window === "undefined" || this.isInterceptorAttached) {
        return;
      }
      const originalFetch = window.fetch;
      const self = this;
      window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        if (response && response.status === 401) {
          if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
            window.dispatchEvent(new CustomEvent(DETRAN_SSO_EVENTS.UNAUTHORIZED, {
              detail: {
                appId: self.appId,
                status: 401
              }
            }));
          }
          if (typeof self.onUnauthorizedCallback === "function") {
            self.onUnauthorizedCallback();
          } else {
            self.redirectToLogin();
          }
        }
        return response;
      };
      this.isInterceptorAttached = true;
    }
    /**
     * Verifica se há login_hint presente na carga inicial da página
     */
    inspectInitialLoginHint() {
      if (typeof window === "undefined" || !window.location) {
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const hint = params.get("login_hint");
      if (hint && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent(DETRAN_SSO_EVENTS.LOGIN_HINT_DETECTED, {
          detail: { loginHint: hint }
        }));
      }
    }
  };

  // packages/detran-sso-client/src/ui/app-launcher.ts
  var TEMPLATE_STYLE = `
:host {
  display: inline-block;
  font-family: 'Montserrat', system-ui, -apple-system, sans-serif;
  position: relative;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: inherit;
}

.launcher-button {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.launcher-button:hover {
  background-color: rgba(0, 51, 102, 0.08);
}

.launcher-button:active {
  transform: scale(0.96);
}

.launcher-button svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.dropdown-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 340px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15), 0 2px 6px rgba(0, 0, 0, 0.06);
  border: 1px solid #e2e8f0;
  padding: 16px;
  z-index: 9999;
  display: none;
  animation: fadeIn 0.18s ease-out forwards;
}

.dropdown-panel.open {
  display: block;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 12px;
  margin-bottom: 12px;
}

.panel-title {
  font-size: 13px;
  font-weight: 700;
  color: #003366;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.apps-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  max-height: 380px;
  overflow-y: auto;
}

.app-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 14px 10px;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
  background: #f8fafc;
  color: #1e293b;
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
}

.app-card:hover {
  background: #eef4f9;
  border-color: #cbd5e1;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 51, 102, 0.08);
}

.app-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: #003366;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  font-size: 16px;
}

.app-name {
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.3;
}

.panel-footer {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
  text-align: center;
}

.panel-footer a {
  font-size: 11px;
  color: #64748b;
  text-decoration: none;
  font-weight: 600;
}

.panel-footer a:hover {
  color: #003366;
}

.loading-state, .empty-state {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: #64748b;
}
`;
  var CustomElementBase = typeof HTMLElement !== "undefined" ? HTMLElement : class {
  };
  var DetranAppLauncherElement = class extends CustomElementBase {
    constructor() {
      super();
      this.isOpen = false;
      this.apps = [];
      this.isLoading = false;
      if (typeof this.attachShadow === "function") {
        this.shadow = this.attachShadow({ mode: "open" });
      }
    }
    static get observedAttributes() {
      return ["intranet-url", "app-id"];
    }
    connectedCallback() {
      this.setupInstance();
      this.render();
      this.bindEvents();
    }
    disconnectedCallback() {
      this.unbindEvents();
    }
    setupInstance() {
      const intranetUrl = this.getAttribute("intranet-url") || window?.detranSSO?.intranetUrl || "http://localhost:3000";
      const appId = this.getAttribute("app-id") || window?.detranSSO?.appId || "default";
      this.sso = new DetranSSO({
        appId,
        intranetUrl,
        autoIntercept: false
      });
    }
    bindEvents() {
      this.onOutsideClick = this.onOutsideClick.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      document.addEventListener("click", this.onOutsideClick);
      document.addEventListener("keydown", this.onKeyDown);
    }
    unbindEvents() {
      document.removeEventListener("click", this.onOutsideClick);
      document.removeEventListener("keydown", this.onKeyDown);
    }
    onOutsideClick(event) {
      if (!this.isOpen) return;
      const path = event.composedPath();
      if (!path.includes(this)) {
        this.close();
      }
    }
    onKeyDown(event) {
      if (event.key === "Escape" && this.isOpen) {
        this.close();
      }
    }
    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }
    async open() {
      this.isOpen = true;
      this.updateDropdown();
      if (this.apps.length === 0 && !this.isLoading) {
        this.isLoading = true;
        this.updateDropdown();
        try {
          this.apps = await this.sso?.getAuthorizedApps() || [];
        } finally {
          this.isLoading = false;
          this.updateDropdown();
        }
      }
    }
    close() {
      this.isOpen = false;
      this.updateDropdown();
    }
    render() {
      if (!this.shadow) return;
      this.shadow.innerHTML = `
      <style>${TEMPLATE_STYLE}</style>
      <button class="launcher-button" type="button" aria-label="Aplica\xE7\xF5es Detran-MG" title="Hub de Aplica\xE7\xF5es Detran-MG" aria-expanded="false">
        <svg viewBox="0 0 24 24">
          <path d="M6,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM16,6c0,1.1 0.9,2 2,2s2,-0.9 2,-2 -0.9,-2 -2,-2 -2,0.9 -2,2zM12,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2z"/>
        </svg>
      </button>
      <div class="dropdown-panel" role="menu"></div>
    `;
      const btn = this.shadow.querySelector(".launcher-button");
      btn?.addEventListener("click", () => this.toggle());
      this.updateDropdown();
    }
    updateDropdown() {
      if (!this.shadow) return;
      const panel = this.shadow.querySelector(".dropdown-panel");
      const btn = this.shadow.querySelector(".launcher-button");
      if (!panel || !btn) return;
      btn.setAttribute("aria-expanded", String(this.isOpen));
      if (this.isOpen) {
        panel.classList.add("open");
      } else {
        panel.classList.remove("open");
        return;
      }
      const intranetUrl = this.sso?.intranetUrl || "http://localhost:3000";
      if (this.isLoading) {
        panel.innerHTML = `
        <div class="panel-header">
          <span class="panel-title">Sistemas Detran-MG</span>
        </div>
        <div class="loading-state">Carregando sistemas...</div>
      `;
        return;
      }
      if (this.apps.length === 0) {
        panel.innerHTML = `
        <div class="panel-header">
          <span class="panel-title">Sistemas Detran-MG</span>
        </div>
        <div class="empty-state">Nenhum sistema dispon\xEDvel</div>
        <div class="panel-footer">
          <a href="${intranetUrl}/apps" target="_blank" rel="noopener">Acessar Portal da Intranet \u2192</a>
        </div>
      `;
        return;
      }
      const cardsHtml = this.apps.map((app) => {
        const launchUrl = `${intranetUrl}/sso/${encodeURIComponent(app.id)}`;
        const initial = (app.nome || "A").charAt(0).toUpperCase();
        return `
        <a class="app-card" href="${launchUrl}" target="_blank" rel="noopener">
          <div class="app-icon">${initial}</div>
          <span class="app-name">${this.escapeHtml(app.nome)}</span>
        </a>
      `;
      }).join("");
      panel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">Sistemas Detran-MG</span>
      </div>
      <div class="apps-grid">
        ${cardsHtml}
      </div>
      <div class="panel-footer">
        <a href="${intranetUrl}/apps" target="_blank" rel="noopener">Ver todos os sistemas \u2192</a>
      </div>
    `;
    }
    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
  };
  function registerDetranAppLauncher() {
    if (typeof window !== "undefined" && "customElements" in window) {
      if (!customElements.get("detran-app-launcher")) {
        customElements.define("detran-app-launcher", DetranAppLauncherElement);
      }
    }
  }

  // packages/detran-sso-client/src/interceptors.ts
  function attachAxiosInterceptor(axiosInstance, sso) {
    if (!axiosInstance || !axiosInstance.interceptors || !axiosInstance.interceptors.response) {
      throw new Error("[DetranSSO] A inst\xE2ncia fornecida n\xE3o \xE9 um cliente Axios v\xE1lido.");
    }
    axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status || error?.status;
        if (status === 401) {
          console.warn(`[DetranSSO] Axios interceptou 401 para app "${sso.appId}". Redirecionando...`);
          sso.redirectToLogin();
        }
        return Promise.reject(error);
      }
    );
  }
  function createDetranFetch(sso, customFetch = window.fetch) {
    return async function(...args) {
      const response = await customFetch(...args);
      if (response.status === 401) {
        sso.redirectToLogin();
      }
      return response;
    };
  }

  // packages/detran-sso-client/src/index.ts
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    registerDetranAppLauncher();
    const script = document.currentScript;
    if (script) {
      const appId = script.getAttribute("data-app-id");
      const intranetUrl = script.getAttribute("data-intranet-url");
      const autoIntercept = script.getAttribute("data-auto-intercept") === "true";
      if (appId && intranetUrl) {
        ;
        window.detranSSO = new DetranSSO({
          appId,
          intranetUrl,
          autoIntercept
        });
      }
    }
    ;
    window.DetranSSO = DetranSSO;
  }
  var index_default = DetranSSO;
  return __toCommonJS(index_exports);
})();
