import { usePageStore } from '@/stores/page'

const routes = [
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [{ path: '', component: () => import('@/pages/Login.vue') }]
  },
  {
    path: '/a/:alias',
    component: () => import('@/layouts/MainLayout.vue'),
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
    component: () => import('@/layouts/ProfileLayout.vue'),
    children: [
      { path: '', redirect: '/_profile/info' },
      { path: 'info', component: () => import('@/pages/ProfileInfo.vue') },
      { path: 'avatar', component: () => import('@/pages/ProfileAvatar.vue') },
      { path: 'auth', component: () => import('@/pages/ProfileAuth.vue') },
      { path: 'groups', component: () => import('@/pages/ProfileGroups.vue') }
    ]
  },
  {
    path: '/_inbox',
    component: () => import('@/layouts/InboxLayout.vue'),
    children: [
      { path: '', redirect: '/_inbox/messages' },
      { path: 'messages', component: () => import('@/pages/InboxMessages.vue') },
      { path: 'watching', component: () => import('@/pages/InboxWatching.vue') },
      /*
        The submission being reviewed is in the URL, so a review can be linked to -- which is what a
        notification about one will have to do. Optional, since the same screen without it is the
        queue.
      */
      { path: 'review/:submissionId?', component: () => import('@/pages/InboxReview.vue') }
    ]
  },
  {
    path: '/_search',
    component: () => import('@/pages/Search.vue')
  },
  /*
    Browse the site by tag. The selection is in the query (`?t=a,b`) rather than in the path, so a
    set of tags is a link that can be handed to somebody -- see `pages/Tags.vue`.
  */
  {
    path: '/_tags',
    component: () => import('@/pages/Tags.vue')
  },
  /*
    The public profile of one user. `/_user` is shared with the server, which serves avatars at
    `/_user/<id>/avatar` -- both `backend/index.ts` and the dev proxy in `frontend/vite.config.js`
    split the segment the same way, so this route only ever sees the profile half.
  */
  {
    path: '/_user/:userId',
    component: () => import('@/pages/UserProfile.vue')
  },
  {
    path: '/_admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    children: [
      { path: '', redirect: '/_admin/dashboard' },
      { path: 'dashboard', component: () => import('@/pages/AdminDashboard.vue') },
      { path: 'sites', component: () => import('@/pages/AdminSites.vue') },
      // -> Site
      { path: ':siteid/general', component: () => import('@/pages/AdminGeneral.vue') },
      { path: ':siteid/approvals', component: () => import('@/pages/AdminApprovals.vue') },
      { path: ':siteid/analytics/:id?', component: () => import('@/pages/AdminAnalytics.vue') },
      { path: ':siteid/blocks', component: () => import('@/pages/AdminBlocks.vue') },
      { path: ':siteid/comments/:id?', component: () => import('@/pages/AdminComments.vue') },
      { path: ':siteid/editors', component: () => import('@/pages/AdminEditors.vue') },
      { path: ':siteid/locale', component: () => import('@/pages/AdminLocale.vue') },
      { path: ':siteid/login', component: () => import('@/pages/AdminLogin.vue') },
      { path: ':siteid/navigation', component: () => import('@/pages/AdminNavigation.vue') },
      { path: ':siteid/storage/:id?', component: () => import('@/pages/AdminStorage.vue') },
      { path: ':siteid/theme', component: () => import('@/pages/AdminTheme.vue') },
      // -> Users
      { path: 'auth', component: () => import('@/pages/AdminAuth.vue') },
      { path: 'groups/:id?/:section?', component: () => import('@/pages/AdminGroups.vue') },
      { path: 'users/:id?/:section?', component: () => import('@/pages/AdminUsers.vue') },
      // -> System
      { path: 'api', component: () => import('@/pages/AdminApi.vue') },
      { path: 'audit', component: () => import('@/pages/AdminAudit.vue') },
      { path: 'extensions', component: () => import('@/pages/AdminExtensions.vue') },
      { path: 'icons', component: () => import('@/pages/AdminIcons.vue') },
      { path: 'instances', component: () => import('@/pages/AdminInstances.vue') },
      { path: 'mail', component: () => import('@/pages/AdminMail.vue') },
      { path: 'mcp', component: () => import('@/pages/AdminMcp.vue') },
      { path: 'metrics', component: () => import('@/pages/AdminMetrics.vue') },
      { path: 'rendering', component: () => import('@/pages/AdminRendering.vue') },
      { path: 'scheduler', component: () => import('@/pages/AdminScheduler.vue') },
      { path: 'search', component: () => import('@/pages/AdminSearch.vue') },
      { path: 'security', component: () => import('@/pages/AdminSecurity.vue') },
      { path: 'system', component: () => import('@/pages/AdminSystem.vue') },
      { path: 'terminal', component: () => import('@/pages/AdminTerminal.vue') },
      { path: 'utilities', component: () => import('@/pages/AdminUtilities.vue') },
      { path: 'webhooks', component: () => import('@/pages/AdminWebhooks.vue') },
      { path: 'flags', component: () => import('@/pages/AdminFlags.vue') }
    ]
  },
  {
    path: '/_error/:action?',
    component: () => import('@/pages/ErrorGeneric.vue')
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
    children: [{ path: '', component: () => import('../pages/Index.vue') }]
  },
  // --------------------------------
  // PAGE VERSION
  // --------------------------------
  /*
    One recorded version of a page, read on its own. Addressed by the version alone -- a version URL is
    a link somebody was handed, and the page it came off is exactly what the reader is asking to be
    told, so a URL that already had to name it is one they could not have been given.

    Its own layout rather than `MainLayout`: a snapshot is reached from a link rather than browsed to,
    so there is no navigation sidebar beside it. See `VersionLayout.vue`.
  */
  {
    path: '/_version/:versionId',
    component: () => import('@/layouts/VersionLayout.vue'),
    children: [{ path: '', component: () => import('@/pages/PageVersion.vue') }]
  },
  // --------------------------------
  // EDIT
  // --------------------------------
  {
    path: '/_edit/:pagePath?',
    component: () => import('../layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('../pages/Index.vue') }]
  },
  // -----------------------
  // STANDARD PAGE CATCH-ALL
  // -----------------------
  {
    path: '/:catchAll(.*)*',
    component: () => import('../layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('../pages/Index.vue') }]
  }
]

export default routes
