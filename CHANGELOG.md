# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [v1.0.102] - 2018-08-02
### Added
- **Authentication**: Open ID Connection provider (thanks to @sazulo)
- **Localization**: Turkish locale is now available (thanks to @MrSimsek)

### Fixed
- **Misc**: Paths in git commits are no longer escaped (thanks to @EricFromCanada)
- **Uploads**: Fixed potential bug when uploading certain images (thanks to @Gnurdle)

## [v1.0.78] - 2018-02-23
### Fixed
- **Authentication**: Azure AD email getter
- **Logging**: Missing raven dependency for sentry logging

## [v1.0.76] - 2018-02-17
### Fixed
- **Authentication**: Added missing OAuth2 login button
- **UI**: Fixed overflow issue in modal sidebar

## [v1.0.68] - 2018-01-11
### Added
- **Authentication**: Generic OAuth2 authentication provider

## [v1.0.66] - 2018-01-07
### Added
- **Localization**: Swedish locale is now available (thanks to @pontus-andersson)

## Fixed
- **Misc**: Strip /create and /edit when check path permissions

## [v1.0.12] - 2017-11-26
### Added
- **Localization**: Estonian locale is now available (thanks to @vonforum)

### Changed
- **Localization**: Updates to various locales
- **Misc**: Added quotes to sample Slack config to avoid number parsing

## Fixed
- **Git**: ignore .git directory when updating cache

## [v1.0.11] - 2017-10-14
### Added
- **Localization**: Japanese locale is now available (thanks to @johnnyshields)
- **Misc**: Added referrer policy header

## Fixed
- **Authentication**: Fix for name search when using OpenLDAP

## [v1.0.10] - 2017-10-09
### Added
- **Misc**: Ability to delete pages from the UI

## [v1.0.9] - 2017-09-14
### Added
- **Localization**: Persian (farsi) locale is now available (thanks to @ashkang)
- **UI**: Support for right-to-left languages

### Fixed
- **i18n**: Browser locale files not generated properly (ported from dev branch)

## [v1.0.8] - 2017-08-31
### Changed
- **Misc**: Updated dependencies

## [v1.0.7] - 2017-08-29
### Fixed
- **Authentication**: Azure AD client Id is now referenced correctly ([#219](https://github.com/Requarks/wiki/issues/219))
- **Git**: Git Branch is now referenced correctly ([#215](https://github.com/Requarks/wiki/issues/215))

## [v1.0.6] - 2017-08-10
### Fixed
- **Authentication**: LDAP no longer cause the social login text to appear on the login screen.
- **Misc**: Browser locales are now generated for non-english languages
- **Misc**: Renaming or moving a page is now removing the old entry in the All Pages navigation

## [v1.0.5] - 2017-08-06
### Fixed
- **Misc**: public access always false if using env var string

## [v1.0.4] - 2017-07-26
### Fixed
- **Misc**: Some installations (e.g. Heroku) would not install all dependencies

## [v1.0.3] - 2017-07-23
### Fixed
- **Misc**: Revert to npm install (Yarn may cause permissions + hang issues)

## [v1.0.1] - 2017-07-22
### Changed
- **Misc**: Switch to Yarn for npm dependencies installation

### Fixed
- **Misc**: JS/CSS is now loading properly in Safari (macOS/iOS)
- **Misc**: Process termination handling
- **Search**: siteRoot is now properly parsed in search results href

## [v1.0.0-beta.13] - 2017-07-09
### Added
- **Admin**: Added Host Information section to System Info page
- **Admin**: Added Color Theme page to modify look and feel
- **Editor**: Linebreaks are now rendered, can be disabled via config option
- **Localization**: German locale is now available (thanks to @joetjengerdes)
- **UI**: Support for color themes, code blocks dark/light + colorize on/off

### Changed
- **Editor**: TeX and MathML is now rendered server-side to SVG
- **UI**: Updated icons to Nucleo icon set
- **Misc**: Updated dependencies

### Fixed
- **Configuration Wizard**: Git version check is now handled properly when using 2 or 3 version precision
- **Editor**: Blockquotes are now displayed in their correct color stylings
- **Misc**: 'Entry does not exist' page now display sub-pages separator correctly
- **Misc**: Locked dependencies to patch instead of minor version
- **Misc**: Saving a page no longer crash the search index engine

## [v1.0.0-beta.12] - 2017-06-10
### Added
- **Deploy**: Heroku support
- **Localization**: All UI text elements are now localized
- **Localization**: Chinese locale is now available (thanks to @choicky)
- **Localization**: Korean locale is now available (thanks to @junwonpk)
- **Localization**: Portuguese locale is now available (thanks to @felipeplets)
- **Localization**: Russian locale is now available (thanks to @efimlosev)
- **Localization**: Spanish locale is now available (thanks to @MatiasArriola)
- **Misc**: Copy to clipboard modal when clicking on header anchor
- **Print**: Optimized layout and colors for print view

### Changed
- **Misc**: Refactored all client-side code into Vue components
- **Misc**: Updated dependencies
- **UI**: Reveal 'Top of Page' only on scroll + icon only
- **UI**: Updated navigation buttons design
- **UI**: Updated editor toolbar + page design

### Fixed
- **Configuration Wizard**: Public option is now saved properly in config file
- **Configuration Wizard**: Git check no longer fails when unable to remove existing remotes
- **Editor**: Large size content can now be saved up to 1 MB
- **Editor**: Editor no longer fails to initialize if it contains unescaped mustache content
- **Misc**: Page content no longer renders non-highlighted HTML content enclosed in code blocks
- **Misc**: Empty anchors no longer crash the rendering process
- **Misc**: Commented headers no longer appear in page contents
- **Misc**: CJK + Arabic validators are now working properly
- **Move**: It is now possible to move a page to non-existant sub-directory (or deeper)
- **Search**: Content is now indexed properly and handles more scenarios
- **Search**: CJK search terms are no longer stripped
- **UI**: Markdown is now stripped from page contents items
- **UI**: Page contents no longer disappear when scrolling down

## [v1.0.0-beta.11] - 2017-04-29
### Added
- **Auth**: Azure AD authentication provider is now available
- **Auth**: Can now specify Read Access by default for all providers (except Local)
- **Configuration Wizard**: Added Public Access option
- **Git**: Commits author is now set to current user
- **Navigation**: All Pages section
- **UI**: Beatiful new logo!
- **View**: MathML and TeX math equations support

### Changed
- **Auth**: Provider Strategies are now only loaded if enabled
- **Misc**: Server files are now in their own /server path
- **Misc**: Trailing slashes in URL are now removed
- **Misc**: Updated dependencies
- **UI**: Footer is now always at the bottom of the page (but not fixed)

### Fixed
- **Configuration Wizard**: Git version detection no longer fails on MacOS
- **Init**: Malformed config file is now being reported correctly
- **Init**: Git remote is now always updated to current settings
- **Misc**: CJK (Chinese, Japanese & Korean) characters are now fully supported for pages, content and uploads
- **UI**: Move dialog is no longer crashing and preventing further actions
- **UI**: Scrollbar is no longer always shown in code blocks
- **Search**: Search is now working for guest users when public mode is enabled

## [v1.0.0-beta.10] - 2017-04-08
### Added
- **Installation**: Wiki.js can now install via local tarball
- **Installation**: RAM check during install to prevent crashing due to low memory

### Changed
- Updated dependencies + snyk policy

### Fixed
- **UI**: Code blocks longer than page width are now displayed with scrollbars
- **Configuration Wizard**: Git version check no longer fails if between 2.7.4 and 2.11.0
- **Init**: Admin account is no longer attempted to be created during init

## [v1.0.0-beta.9] - 2017-04-05
### Added
- Interactive setup
- **Auth**: GitHub and Slack authentication providers are now available
- **Auth**: LDAP authentication provider is now available
- **Logs**: Support for the logging services: Bugsnag, Loggly, Papertrail, Rollbar and Sentry
- **Config**: Can now use ENV variable to specify DB connection string ($VARNAME as db value in config.yml)

### Changed
- **Native Compilation Removal**: Replaced farmhash with md5
- **Native Compilation Removal**: Replaced leveldown with memdown
- **Native Compilation Removal**: Replaced sharp with jimp
- **Sidebar**: Contents is now Page Contents
- **Sidebar**: Start is now Top of Page
- **UI**: Content headers are now showing an anchor icon instead of a #
- **Dev**: Replaced Gulp with Fuse-box

### Fixed
- **Auth**: Authentication would fail if email has uppercase chars and provider callback is in lowercase
- **Markdown**: Fixed potential crash on markdown processing of video links
- **Search**: Search index should now update upon article creation
- **Search**: Search results are no longer duplicated upon article update
- **UI**: Missing icons on login page
- **UI**: Image alignement center and right should now behave correctly
- **Uploads**: Error notification when upload is too large for server
- **Uploads**: Fix uploads and temp-uploads folder permissions on unix-based systems

## [v1.0.0-beta.8] - 2017-02-19
### Added
- Automated Upgrade / Re-install feature UI only
- npm installation improvements

### Fixed
- wiki executable shortcut on linux
- Settings page is now displaying the correct current version

## [v1.0.0-beta.7] - 2017-02-14
### Fixed
- npm installation fixes

## [v1.0.0-beta.6] - 2017-02-14
### Added
- Settings page UI
- Automated process management
- npm automatic site installation

## [v1.0-beta.5] - 2017-02-12
### Added
- Offline mode (no remote git sync) can now be enabled by setting `git: false` in config.yml
- Improved search engine (Now using search-index engine instead of MongoDB text search)

### Changed
- Cache is now flushed when starting / restarting the server

## [v1.0-beta.4] - 2017-02-11
### Fixed
- Fixed folder name typo during uploads folder permissions check
- Fixed SSH authentication for Git

### Changed
- Removed separate OAuth authentication option. Select basic authentication to use tokens.

## [v1.0-beta.3] - 2017-02-10
### Added
- Change log
- Added .editorconfig, .eslintrc.json and .pug-lintrc.json for code linting
- Added Create / Authorize User feature
- Added Delete / De-authorize User feature
- Added Login as... button to Forbidden page

### Fixed
- Fixed issue with social accounts with empty name
- Fixed standard error page styling

### Changed
- Updated dependencies + snyk policy
- Conversion to Standard JS compliant code
- Accounts that are not pre-authorized are no longer added with no rights

## [v1.0-beta.2] - 2017-01-30
### Added
- Save own profile under My Account

### Changed
- Updated dependencies + snyk policy

[v1.0.102]: https://github.com/Requarks/wiki/releases/tag/v1.0.102
[v1.0.78]: https://github.com/Requarks/wiki/releases/tag/v1.0.78
[v1.0.76]: https://github.com/Requarks/wiki/releases/tag/v1.0.76
[v1.0.68]: https://github.com/Requarks/wiki/releases/tag/v1.0.68
[v1.0.66]: https://github.com/Requarks/wiki/releases/tag/v1.0.66
[v1.0.12]: https://github.com/Requarks/wiki/releases/tag/v1.0.12
[v1.0.11]: https://github.com/Requarks/wiki/releases/tag/v1.0.11
[v1.0.10]: https://github.com/Requarks/wiki/releases/tag/v1.0.10
[v1.0.9]: https://github.com/Requarks/wiki/releases/tag/v1.0.9
[v1.0.8]: https://github.com/Requarks/wiki/releases/tag/v1.0.8
[v1.0.7]: https://github.com/Requarks/wiki/releases/tag/v1.0.7
[v1.0.6]: https://github.com/Requarks/wiki/releases/tag/v1.0.6
[v1.0.5]: https://github.com/Requarks/wiki/releases/tag/v1.0.5
[v1.0.4]: https://github.com/Requarks/wiki/releases/tag/v1.0.4
[v1.0.3]: https://github.com/Requarks/wiki/releases/tag/v1.0.3
[v1.0.1]: https://github.com/Requarks/wiki/releases/tag/v1.0.1
[v1.0.0-beta.13]: https://github.com/Requarks/wiki/releases/tag/v1.0.0-beta.13
[v1.0.0-beta.12]: https://github.com/Requarks/wiki/releases/tag/v1.0.0-beta.12
[v1.0.0-beta.11]: https://github.com/Requarks/wiki/releases/tag/v1.0.0-beta.11
[v1.0.0-beta.10]: https://github.com/Requarks/wiki/releases/tag/v1.0.0-beta.10
[v1.0.0-beta.9]: https://github.com/Requarks/wiki/releases/tag/v1.0.0-beta.9
[v1.0.0-beta.8]: https://github.com/Requarks/wiki/releases/tag/v1.0.0-beta.8
[v1.0.0-beta.7]: https://github.com/Requarks/wiki/releases/tag/v1.0.0-beta.7
[v1.0.0-beta.6]: https://github.com/Requarks/wiki/releases/tag/v1.0.0-beta.6
[v1.0-beta.5]: https://github.com/Requarks/wiki/releases/tag/v1.0-beta.5
[v1.0-beta.4]: https://github.com/Requarks/wiki/releases/tag/v1.0-beta.4
[v1.0-beta.3]: https://github.com/Requarks/wiki/releases/tag/v1.0-beta.3
[v1.0-beta.2]: https://github.com/Requarks/wiki/releases/tag/v1.0-beta.2
