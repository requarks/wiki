# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [2.0.0-beta.84] - 2019-03-24
### Added
- Added Search Engine - Algolia
- Added Search Engine - Elasticsearch

### Fixed
- Fixed error when saving navigation in admin area
- Fixed guest search failing because of missing global permissions
- Fixed PostgreSQL search engine indexing issues

### Changed
- Improved search suggestions from sanitized content
- Search engine deactivate handler is now being called on engine switch
- Markdown editor UI improvements for insert actions (wip)

## [2.0.0-beta.68] - 2019-03-17
### Added
- Added Search Results overlay
- Added Search Engine - DB Basic
- Added Search Engine - DB PostgreSQL
- Added Search Engine - Azure Search
- Added Search Engine - AWS CloudSearch
- Added Git changes processing (add/modify/delete)
- Added Storage last sync date in status panel
- Added Dev Flags
- Added HTTPS server option
- Added HTTP to HTTPS redirect server option

### Fixed
- Fixed SQLite migrations

### Changed
- Split admin dev section into separate pages

## [2.0.0-beta.42] - 2019-02-17
### Added
- Added Patreon link in Contribute admin page
- Added Theme Code Injection functionality
- Added Theme CSS Injection code minification
- Added Page Delete functionality
- Dev locale .yml files in `server/locales` are now loaded
- Added SQLite dependencies in Docker image
- Added rate limiting to login mutations

### Fixed
- Fixed root admin refresh token fail
- Fixed error page metadata title warning
- Fixed telemetry
- Await page render job to complete before resolving
- Fixed JSON fields for MariaDB
- Fixed MSSQL driver support

### Changed
- Moved Insert Media button in Markdown editor
- Use semver for DB migrations ordering

## [2.0.0-beta.11] - 2019-01-20
- First beta release

[2.0.0-beta.84]: https://github.com/Requarks/wiki/releases/tag/2.0.0-beta.84
[2.0.0-beta.68]: https://github.com/Requarks/wiki/releases/tag/2.0.0-beta.68
[2.0.0-beta.42]: https://github.com/Requarks/wiki/releases/tag/2.0.0-beta.42
[2.0.0-beta.11]: https://github.com/Requarks/wiki/releases/tag/2.0.0-beta.11
