import { Analytics } from './analytics.mjs'
import { ApiKey } from './apiKeys.mjs'
import { Asset } from './assets.mjs'
import { Authentication } from './authentication.mjs'
import { CommentProvider } from './commentProviders.mjs'
import { Comment } from './comments.mjs'
import { Group } from './groups.mjs'
import { Hook } from './hooks.mjs'
import { Locale } from './locales.mjs'
import { Navigation } from './navigation.mjs'
import { PageHistory } from './pageHistory.mjs'
import { PageLink } from './pageLinks.mjs'
import { Page } from './pages.mjs'
import { Renderer } from './renderers.mjs'
import { Setting } from './settings.mjs'
import { Site } from './sites.mjs'
import { Storage } from './storage.mjs'
import { Tag } from './tags.mjs'
import { Tree } from './tree.mjs'
import { UserKey } from './userKeys.mjs'
import { User } from './users.mjs'

export default {
  analytics: Analytics,
  apiKeys: ApiKey,
  assets: Asset,
  authentication: Authentication,
  commentProviders: CommentProvider,
  comments: Comment,
  groups: Group,
  hooks: Hook,
  locales: Locale,
  navigation: Navigation,
  pageHistory: PageHistory,
  pageLinks: PageLink,
  pages: Page,
  renderers: Renderer,
  settings: Setting,
  sites: Site,
  storage: Storage,
  tags: Tag,
  tree: Tree,
  userKeys: UserKey,
  users: User
}
