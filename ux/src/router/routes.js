import { usePageStore } from 'src/stores/page'

const routes = [
  {
    path: '/login',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      { path: '', component: () => import('pages/Login.vue') }
    ]
  },
  {
    path: '/a/:alias',
    component: () => import('../layouts/MainLayout.vue'),
    beforeEnter: async (to, from) => {
      const pageStore = usePageStore()
      try {
        const pathPath = await pageStore.pageAlias(to.params.alias)
        return `/${pathPath}`
      } catch (err) {
        return '/_error/notfound'
      }
    }
  },
  {
    path: '/_profile',
    component: () => import('layouts/ProfileLayout.vue'),
    children: [
      { path: '', redirect: '/_profile/info' },
      { path: 'info', component: () => import('src/pages/ProfileInfo.vue') },
      { path: 'avatar', component: () => import('src/pages/ProfileAvatar.vue') },
      { path: 'auth', component: () => import('src/pages/ProfileAuth.vue') },
      { path: 'groups', component: () => import('src/pages/ProfileGroups.vue') }
    ]
  },
  {
    path: '/_search',
    component: () => import('src/pages/Search.vue')
  },
  {
    path: '/_admin',
    component: () => import('layouts/AdminLayout.vue'),
    children: [
      { path: '', redirect: '/_admin/dashboard' },
      { path: 'dashboard', component: () => import('pages/AdminDashboard.vue') },
      { path: 'sites', component: () => import('pages/AdminSites.vue') },
      // -> Site
      { path: ':siteid/general', component: () => import('pages/AdminGeneral.vue') },
      { path: ':siteid/blocks', component: () => import('pages/AdminBlocks.vue') },
      { path: ':siteid/editors', component: () => import('pages/AdminEditors.vue') },
      { path: ':siteid/locale', component: () => import('pages/AdminLocale.vue') },
      { path: ':siteid/login', component: () => import('pages/AdminLogin.vue') },
      { path: ':siteid/navigation', component: () => import('pages/AdminNavigation.vue') },
      { path: ':siteid/storage/:id?', component: () => import('pages/AdminStorage.vue') },
      { path: ':siteid/theme', component: () => import('pages/AdminTheme.vue') },
      // -> Users
      { path: 'auth', component: () => import('pages/AdminAuth.vue') },
      { path: 'groups/:id?/:section?', component: () => import('pages/AdminGroups.vue') },
      { path: 'users/:id?/:section?', component: () => import('pages/AdminUsers.vue') },
      // -> System
      { path: 'api', component: () => import('pages/AdminApi.vue') },
      { path: 'extensions', component: () => import('pages/AdminExtensions.vue') },
      { path: 'icons', component: () => import('pages/AdminIcons.vue') },
      { path: 'instances', component: () => import('pages/AdminInstances.vue') },
      { path: 'mail', component: () => import('pages/AdminMail.vue') },
      { path: 'rendering', component: () => import('pages/AdminRendering.vue') },
      { path: 'scheduler', component: () => import('pages/AdminScheduler.vue') },
      { path: 'search', component: () => import('pages/AdminSearch.vue') },
      { path: 'security', component: () => import('pages/AdminSecurity.vue') },
      { path: 'system', component: () => import('pages/AdminSystem.vue') },
      { path: 'terminal', component: () => import('pages/AdminTerminal.vue') },
      { path: 'utilities', component: () => import('pages/AdminUtilities.vue') },
      { path: 'webhooks', component: () => import('pages/AdminWebhooks.vue') },
      { path: 'flags', component: () => import('pages/AdminFlags.vue') }
    ]
  },
  {
    path: '/_error/:action?',
    component: () => import('pages/ErrorGeneric.vue')
  },
  // {
  //   path: '/_unknown-site',
  //   component: () => import('../pages/UnknownSite.vue')
  // },

  // --------------------------------
  // CREATE
  // --------------------------------
  {
    path: '/_create/:editor?',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('../pages/Index.vue') }
    ]
  },
  // --------------------------------
  // EDIT
  // --------------------------------
  {
    path: '/_edit/:pagePath?',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('../pages/Index.vue') }
    ]
  },
  // -----------------------
  // STANDARD PAGE CATCH-ALL
  // -----------------------
  {
    path: '/:catchAll(.*)*',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('../pages/Index.vue') }
    ]
  }
]

export default routes
