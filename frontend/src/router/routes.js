import { usePageStore } from '@/stores/page'

const routes = [
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [{ path: '', component: () => import('@/pages/Login.vue') }]
  },
  /*
    The two short links to a page, which resolve and send the reader on rather than drawing anything:
    `/a/<alias>` names it by the alias somebody chose for it, `/i/<id>` by the id it was born with.

    Neither is a page path — see `RESERVED_ROOT` in `helpers/pagePaths.js`, and the matching set on the
    server — so neither is locale-prefixed on the way in. What they answer with IS prefixed, because
    the page they point at may be in any locale and the path alone does not say which.
  */
  {
    path: '/a/:alias',
    component: () => import('@/layouts/MainLayout.vue'),
    beforeEnter: async (to) => {
      const pageStore = usePageStore()
      try {
        return await pageStore.pageAlias(to.params.alias)
      } catch {
        return '/_error/notfound'
      }
    }
  },
  {
    path: '/i/:pageId',
    component: () => import('@/layouts/MainLayout.vue'),
    beforeEnter: async (to) => {
      const pageStore = usePageStore()
      try {
        return await pageStore.pageById(to.params.pageId)
      } catch {
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
      { path: ':siteid/storage/:id?', component: () => import('@/pages/AdminStorage.vue') },
      { path: ':siteid/theme', component: () => import('@/pages/AdminTheme.vue') },
      // -> Users
      { path: 'auth', component: () => import('@/pages/AdminAuth.vue') },
      { path: 'groups/:id?/:section?', component: () => import('@/pages/AdminGroups.vue') },
      { path: 'users/:id?/:section?', component: () => import('@/pages/AdminUsers.vue') },
      { path: 'scim', component: () => import('@/pages/AdminScim.vue') },
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
  /*
    Editing a page has a path of its own, and that is what makes the editor a screen rather than a
    mode: opening it is a navigation, and so is every way out of it -- the site logo, a link in the
    sidebar, the back button. It is also what lets an editor URL be reloaded and linked.

    `(.*)` because a page path is not one segment: `notes/api/errors` is an ordinary page, and a bare
    `:pagePath` would match only the first segment of it and drop the rest into no route at all.
  */
  {
    path: '/_edit/:pagePath(.*)?',
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
