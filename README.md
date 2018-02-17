<div align="center">

<img src="https://beta.requarks.io/svg/logo.svg" alt="Wiki.js" width="375" />

[![Release](https://img.shields.io/github/release/Requarks/wiki.svg?style=flat&maxAge=3600)](https://github.com/Requarks/wiki/releases)
[![License](https://img.shields.io/badge/license-AGPLv3-blue.svg?style=flat)](https://github.com/requarks/wiki/blob/master/LICENSE)
[![Backers on Open Collective](https://opencollective.com/wikijs/backers/badge.svg)](#backers)
[![Sponsors on Open Collective](https://opencollective.com/wikijs/sponsors/badge.svg)](#sponsors)
[![Downloads](https://img.shields.io/github/downloads/Requarks/wiki/total.svg?style=flat)](https://www.npmjs.com/package/wiki.js)
[![Docker Pulls](https://img.shields.io/docker/pulls/requarks/wiki.svg)](https://hub.docker.com/r/requarks/wiki/)  
![Build Status](https://requarks.visualstudio.com/_apis/public/build/definitions/5850c090-02b9-4312-b4ce-0e1f5677b574/6/badge)
[![Codacy Badge](https://img.shields.io/codacy/grade/1d0217a3153c4595bdedb322263e55c8/master.svg?style=flat)](https://www.codacy.com/app/Requarks/wiki)
[![Standard - JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)
[![Chat on Gitter](https://img.shields.io/badge/chat-on_gitter-CC2B5E.svg?style=flat&logo=image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAOCAMAAADUg/YpAAAABlBMVEUAAAD///%2Bl2Z/dAAAAAXRSTlMAQObYZgAAABVJREFUeAFjwAUYYTQByAAh0WicAAAFnwAYeB5bLwAAAABJRU5ErkJggg==)](https://gitter.im/Requarks/wiki)
[![Twitter Follow](https://img.shields.io/badge/follow-%40requarks-blue.svg?style=flat)](https://twitter.com/requarks)

##### A modern, lightweight and powerful wiki app built on NodeJS, Git and Markdown

</div>

- **[Official Website](https://wiki.js.org/)**
- **[Getting Started](https://wiki.js.org/get-started.html)**
- **[Documentation](https://docs.requarks.io/wiki/)**
- [Requirements](#requirements)
- [Demo](#demo)
- [Change Log](https://github.com/Requarks/wiki/blob/master/CHANGELOG.md)
- [Feature Requests](https://requests.requarks.io/wiki)
- [Milestones](#milestones)
- [Chat with us](#gitter)
- [Translations](#translations) *(We need your help!)*
- [Special Thanks](#special-thanks)
- [Contribute](#contributors)

<h2 align="center">Requirements</h2>

Wiki.js can run on virtually all platforms where Node.js can (Windows, Mac, Linux, etc.).

- Node.js **6.11.1** or later
- MongoDB **3.2** or later
- Git **2.7.4** or later
- An empty Git repository (optional)

> Read the full [prerequisites](https://docs.requarks.io/wiki/prerequisites) article for full details.

<h2 align="center">Cloud Install</h2>

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/requarks/wiki-heroku)

*Docker Cloud, Azure, IBM Bluemix and more coming soon!*

<h2 align="center">Docker</h2>

A docker Wiki.js image is available on Docker Hub:

[![Docker Image](https://raw.githubusercontent.com/Requarks/wiki-site/master/assets/images/docker-deploy.png)](https://hub.docker.com/r/requarks/wiki/)

You can also use a Dockerfile ([see example](https://github.com/Requarks/wiki/blob/master/tools/Dockerfile)) or Docker Compose ([see example](https://github.com/Requarks/wiki/blob/master/tools/docker-compose.yml)) to run Wiki.js.

<h2 align="center">Demo</h2>

Wiki.js documentation site is actually running Wiki.js! [Check it out &raquo;](https://docs.requarks.io/wiki/)

> <span style="font-size: .8em;">We do not provide a demo with write access because of potential security / spam issues. The best way to try it is to install it on your own server / computer. It's easy!</span>

<h2 align="center">Milestones</h2>

Current and upcoming milestones *(major features only, see the [changelog](https://github.com/Requarks/wiki/blob/master/CHANGELOG.md) for complete list of features and bug fixes)*:

### 1.0.76 - Stable
![Progress](http://progressed.io/bar/100)

**Note**: As 2.0 is under development, no new features are being developed in the 1.0 branch.

- [x] Fixed: Added missing OAuth2 login button
- [x] Fixed: Overflow issue in modal sidebar

### 2.0.0 - Dev
![Progress](http://progressed.io/bar/47)

**Goals**:
  - Decouple front-end and back-end completely.
  - All operations and queries will be made via GraphQL API.
  - New fully responsive layout, with better customization capabilities.
  - Full localization support, especially for non-latin languages.
  
**Release Date**: Q1 2018

**Breaking Changes**:
  - MongoDB is being phased out in favor of PostgreSQL + Redis. An upgrade tool will be provided to migrate existing data to the new system.
  - Node.js 8.9 LTS or later is now the minimum supported version.

**2.0 Milestone**:
- [x] GraphQL API
- [x] Migrate to PostgreSQL + Redis datastore
- [x] Telemetry for analytics and crash reporting (Optional and fully anonymized)
- [x] Docker support + Auto compile/publish to Docker Hub
- [x] Support sub-directory installations (e.g. example.com/wiki)
- [x] Make use of all available CPU cores, distributed jobs queue
- [x] Modular authentication providers (+ new Auth0, Discord and Twitch providers)
- [x] Shared kernel for both app and setup
- [x] Improved installation wizard
- [x] Modular logging providers
- [x] New Login page
- [x] Two-Factor Authentication (2FA)
- [x] New Navigation Concept
- [ ] Themes :rocket:
- [ ] Modular editors :rocket:
  - [ ] SimpleMDE (markdown)
  - [ ] Monaco (code)
- [ ] Modular content parsers/renderers :rocket:
- [ ] Modular search engines
  - [ ] PostgreSQL search engine
- [ ] Modular storage engines :rocket:
  - [ ] Git
  - [ ] Local Disk
- [ ] Multilingual versions of the same page (i18n)
- [ ] History / Revert to previous version
- [ ] Persist system settings to database instead of file-based
- [ ] User Groups + Better permissions management
- [ ] Tags per document / folder

:rocket: = Currently in development

**2.1 Milestone**
- [ ] Comments / Discussion per document
- [ ] Profile page per user
- [ ] Preview changes directly from the editor, without saving
- [ ] Diagrams as code (Mermaid module)
- [ ] Insert Link modal in Markdown Editor
- [ ] Additional storage engines
  - [ ] Dropbox
  - [ ] Google Drive
  - [ ] Amazon S3
  - [ ] Azure Blob Storage
  - [ ] Onedrive
  - [ ] Owncloud
- [ ] Modular Editor: TinyMCE (wysiwyg)

**TBD Milestone**
- [ ] Better simultaneous user editing handling
- [ ] High Availability support (multiple concurrent instances)

<h2 align="center">Gitter</h2>

Want to discuss features, ideas or issues? Join our [gitter channel](https://gitter.im/Requarks/wiki). We are very active and friendly!  
[![Chat on Gitter](https://img.shields.io/badge/chat-on_gitter-CC2B5E.svg?style=flat-square&logo=image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAOCAMAAADUg/YpAAAABlBMVEUAAAD///%2Bl2Z/dAAAAAXRSTlMAQObYZgAAABVJREFUeAFjwAUYYTQByAAh0WicAAAFnwAYeB5bLwAAAABJRU5ErkJggg==)](https://gitter.im/Requarks/wiki)

<h2 align="center">Twitter</h2>

Follow our Twitter feed to learn about upcoming updates and new releases!  
[![Twitter Follow](https://img.shields.io/badge/follow-%40requarks-blue.svg?style=flat-square)](https://twitter.com/requarks)  

<h2 align="center">Translations</h2>

We are looking for translators to make Wiki.js available in multiple languages. If your language is not listed below and would like to contribute to this project, contact us on our [gitter channel](https://gitter.im/Requarks/wiki) and we'll provide you with the necessary tool to add translations, no coding required!

**Languages that are already translated:**

- [x] English
- [x] Chinese - *Thanks to [@choicky](https://github.com/choicky)*
- [x] Czech - *Thanks to [@braniqvranik](https://github.com/braniqvranik)*
- [x] Dutch - *Thanks to [@weirdwater](https://github.com/weirdwater)*
- [x] Estonian - *Thanks to [@vonforum](https://github.com/vonforum)*
- [x] French
- [x] German - *Thanks to [@joetjengerdes](https://github.com/joetjengerdes), [@MyZeD](https://github.com/MyZeD)*
- [x] Greek - *Thanks to [@ekchatzi](https://github.com/ekchatzi)*
- [x] Italian - *Thanks to [@CupCakeArmy](https://github.com/CupCakeArmy)*
- [x] Japanese - *Thanks to [@johnnyshields](https://github.com/johnnyshields), [@JO3QMA](https://github.com/JO3QMA)*
- [x] Korean - *Thanks to [@junwonpk](https://github.com/junwonpk)*
- [x] Persian - *Thanks to [@ashkang](https://github.com/ashkang)*
- [x] Portuguese - *Thanks to [@felipeplets](https://github.com/felipeplets)*
- [x] Russian - *Thanks to [@efimlosev](https://github.com/efimlosev)*
- [x] Slovak - *Thanks to [@braniqvranik](https://github.com/braniqvranik)*
- [x] Spanish - *Thanks to [@MatiasArriola](https://github.com/MatiasArriola)*
- [x] Swedish - *Thanks to [@pontus-andersson](https://github.com/pontus-andersson)*

<h2 align="center">Special Thanks</h2>

![Browserstack](https://wiki.js.org/assets/images/logo_browserstack.png)  
[Browserstack](https://www.browserstack.com/) for providing access to their great cross-browser testing tools.

[![DigitalOcean](https://wiki.js.org/assets/images/logo_digitalocean.png)](https://m.do.co/c/5f7445bfa4d0)  
[DigitalOcean](https://m.do.co/c/5f7445bfa4d0) for providing hosting of the Wiki.js documentation site.

<h2 align="center">Contributors</h2>

This project exists thanks to all the people who contribute. [[Contribute]](https://github.com/Requarks/wiki/blob/master/CONTRIBUTING.md).
<a href="https://github.com/Requarks/wiki/graphs/contributors"><img src="https://opencollective.com/wikijs/contributors.svg?width=890" /></a>

<h2 align="center">Backers</h2>

Thank you to all our backers! 🙏 [[Become a backer](https://opencollective.com/wikijs#backer)]

<a href="https://opencollective.com/wikijs#backers" target="_blank"><img src="https://opencollective.com/wikijs/backers.svg?width=890"></a>

<h2 align="center">Sponsors</h2>

Support this project by becoming a sponsor. Your logo will show up here with a link to your website. [[Become a sponsor](https://opencollective.com/wikijs#sponsor)]

<a href="https://opencollective.com/wikijs/sponsor/0/website" target="_blank"><img src="https://opencollective.com/wikijs/sponsor/0/avatar.svg"></a>
<a href="https://opencollective.com/wikijs/sponsor/1/website" target="_blank"><img src="https://opencollective.com/wikijs/sponsor/1/avatar.svg"></a>
<a href="https://opencollective.com/wikijs/sponsor/2/website" target="_blank"><img src="https://opencollective.com/wikijs/sponsor/2/avatar.svg"></a>
<a href="https://opencollective.com/wikijs/sponsor/3/website" target="_blank"><img src="https://opencollective.com/wikijs/sponsor/3/avatar.svg"></a>
<a href="https://opencollective.com/wikijs/sponsor/4/website" target="_blank"><img src="https://opencollective.com/wikijs/sponsor/4/avatar.svg"></a>
<a href="https://opencollective.com/wikijs/sponsor/5/website" target="_blank"><img src="https://opencollective.com/wikijs/sponsor/5/avatar.svg"></a>
<a href="https://opencollective.com/wikijs/sponsor/6/website" target="_blank"><img src="https://opencollective.com/wikijs/sponsor/6/avatar.svg"></a>
<a href="https://opencollective.com/wikijs/sponsor/7/website" target="_blank"><img src="https://opencollective.com/wikijs/sponsor/7/avatar.svg"></a>
<a href="https://opencollective.com/wikijs/sponsor/8/website" target="_blank"><img src="https://opencollective.com/wikijs/sponsor/8/avatar.svg"></a>
<a href="https://opencollective.com/wikijs/sponsor/9/website" target="_blank"><img src="https://opencollective.com/wikijs/sponsor/9/avatar.svg"></a>
