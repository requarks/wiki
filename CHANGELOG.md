# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [2.0.0-beta.XX] - 2018-XX-XX
### Added
- Added Git changes processing (add/modify/delete)
- Added Storage last sync date in status panel
- Added Dev Flags
- Added HTTP to HTTPS redirect server option

### Fixed
- Fixed SQLite migrations

### Changed
- Split admin dev section into separate pages

## [2.0.0-beta.42] - 2018-02-17
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

## [2.0.0-beta.11] - 2018-01-20
- First beta release

[2.0.0-beta.42]: https://github.com/Requarks/wiki/releases/tag/2.0.0-beta.42
[2.0.0-beta.11]: https://github.com/Requarks/wiki/releases/tag/2.0.0-beta.11
