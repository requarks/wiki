# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [v1.0.0-beta.10] - 2017-04-08
### Added
- Installation: Wiki.js can now install via local tarball
- Installation: RAM check during install to prevent crashing due to low memory

### Changed
- Updated dependencies + snyk policy

### Fixed
- UI: Code blocks longer than page width are now displayed with scrollbars
- Configuration Wizard: Git version check no longer fails if between 2.7.4 and 2.11.0
- Init: Admin account is no longer attempted to be created during init

## [v1.0.0-beta.9] - 2017-04-05
### Added
- Interactive setup
- Auth: GitHub and Slack authentication providers are now available
- Auth: LDAP authentication provider is now available
- Logs: Support for the logging services: Bugsnag, Loggly, Papertrail, Rollbar and Sentry
- Config: Can now use ENV variable to specify DB connection string ($VARNAME as db value in config.yml)

### Changed
- Native Compilation Removal: Replaced farmhash with md5
- Native Compilation Removal: Replaced leveldown with memdown
- Native Compilation Removal: Replaced sharp with jimp
- Sidebar: Contents is now Page Contents
- Sidebar: Start is now Top of Page
- UI: Content headers are now showing an anchor icon instead of a #
- Dev: Replaced Gulp with Fuse-box

### Fixed
- Auth: Authentication would fail if email has uppercase chars and provider callback is in lowercase
- Markdown: Fixed potential crash on markdown processing of video links
- Search: Search index should now update upon article creation
- Search: Search results are no longer duplicated upon article update
- UI: Missing icons on login page
- UI: Image alignement center and right should now behave correctly
- Uploads: Error notification when upload is too large for server
- Uploads: Fix uploads and temp-uploads folder permissions on unix-based systems

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

[Unreleased]: https://github.com/Requarks/wiki/compare/v1.0-beta.4...HEAD
[v1.0-beta.4]: https://github.com/Requarks/wiki/releases/tag/v1.0-beta.4
[v1.0-beta.3]: https://github.com/Requarks/wiki/releases/tag/v1.0-beta.3
[v1.0-beta.2]: https://github.com/Requarks/wiki/releases/tag/v1.0-beta.2
