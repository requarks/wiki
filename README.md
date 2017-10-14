![Wiki.js](https://raw.githubusercontent.com/Requarks/wiki-site/1.0/assets/images/logo.png)

[![Release](https://img.shields.io/github/release/Requarks/wiki.svg?style=flat-square&maxAge=3600)](https://github.com/Requarks/wiki/releases)
[![License](https://img.shields.io/badge/license-AGPLv3-blue.svg?style=flat-square)](https://github.com/requarks/wiki/blob/master/LICENSE)
[![Backers on Open Collective](https://opencollective.com/wikijs/backers/badge.svg)](#backers)
[![Sponsors on Open Collective](https://opencollective.com/wikijs/sponsors/badge.svg)](#sponsors)
[![npm](https://img.shields.io/badge/npm-wiki.js-blue.svg?style=flat-square)](https://www.npmjs.com/package/wiki.js)
[![Downloads](https://img.shields.io/github/downloads/Requarks/wiki/total.svg?style=flat-square)](https://www.npmjs.com/package/wiki.js)  
[![Build Status](https://app.wercker.com/status/fc8e75793b3cf12852314d6bfd83d148/s/master?style=flat-square)](https://app.wercker.com/project/byKey/fc8e75793b3cf12852314d6bfd83d148)
[![Codacy Badge](https://img.shields.io/codacy/grade/1d0217a3153c4595bdedb322263e55c8/master.svg?style=flat-square)](https://www.codacy.com/app/Requarks/wiki)
[![Standard - JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)
[![Chat on Gitter](https://img.shields.io/badge/chat-on_gitter-CC2B5E.svg?style=flat-square&logo=image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAOCAMAAADUg/YpAAAABlBMVEUAAAD///%2Bl2Z/dAAAAAXRSTlMAQObYZgAAABVJREFUeAFjwAUYYTQByAAh0WicAAAFnwAYeB5bLwAAAABJRU5ErkJggg==)](https://gitter.im/Requarks/wiki)
[![Twitter Follow](https://img.shields.io/badge/follow-%40requarks-blue.svg?style=flat-square)](https://twitter.com/requarks)

##### A modern, lightweight and powerful wiki app built on NodeJS, Git and Markdown

- **[Official Website](https://wiki.js.org/)**
- **[Getting Started](https://wiki.js.org/get-started.html)**
- **[Documentation](https://docs.requarks.io/wiki/)**
- [Requirements](#requirements)
- [Change Log](https://github.com/Requarks/wiki/blob/master/CHANGELOG.md)
- [Feature Requests](https://wikijs.canny.io/features)
- [Milestones](#milestones)
- [Chat with us](#gitter)
- [Translations](#translations) *(We need your help!)*
- [Special Thanks](#special-thanks)

<a target='_blank' rel='nofollow' href='https://app.codesponsor.io/link/roGruqDX64HMJwmnvjhaQ7kt/Requarks/wiki'>
  <img alt='Sponsor' width='888' height='68' src='https://app.codesponsor.io/embed/roGruqDX64HMJwmnvjhaQ7kt/Requarks/wiki.svg' />
</a>

## Requirements

Wiki.js can run on virtually all platforms where Node.js can (Windows, Mac, Linux, etc.).

- Node.js **6.11.1** or later
- MongoDB **3.2** or later
- Git **2.7.4** or later
- An empty Git repository (optional)

> Read the full [prerequisites](https://docs.requarks.io/wiki/prerequisites) article for full details.

## Cloud Install

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/requarks/wiki-heroku)

*Docker Cloud, Azure, IBM Bluemix and more coming soon!*

## Docker

A docker Wiki.js image is available on Docker Hub:

[![Docker Image](https://raw.githubusercontent.com/Requarks/wiki-site/master/assets/images/docker-deploy.png)](https://hub.docker.com/r/requarks/wiki/)

You can also use a Dockerfile ([see example](https://github.com/Requarks/wiki/blob/master/tools/Dockerfile)) or Docker Compose ([see example](https://github.com/Requarks/wiki/blob/master/tools/docker-compose.yml)) to run Wiki.js.

## Milestones

Current and upcoming milestones *(major features only, see the [changelog](https://github.com/Requarks/wiki/blob/master/CHANGELOG.md) for complete list of features and bug fixes)*:

### 1.0.11 - Stable
![Progress](http://progressed.io/bar/100)

**Note**: As 2.0 is under development, no new features are being developed in the 1.0 branch.

- [x] Japanese localization
- [x] Fix for name search when using OpenLDAP
- [x] Added referrer policy header

### 2.0.0 - Dev
![Progress](http://progressed.io/bar/35)

**Goals**:
  - Decouple front-end and back-end completely.
  - All operations and queries will be made via GraphQL API.
  - New fully responsive layout, with better customization capabilities.
  - Full localization support, especially for non-latin languages.

**Breaking Changes**: MongoDB is being phased out in favor of PostgreSQL + Redis. An upgrade tool will be provided to migrate existing data to the new system.

- [x] GraphQL API
  - [x] Comments
  - [x] Documents
  - [x] Files
  - [x] Folders
  - [x] Groups
  - [x] Rights
  - [x] Settings
  - [x] Tags
  - [x] Translations
  - [x] Users
- [x] Migrate to PostgreSQL + Redis datastore
- [ ] New Login page
- [ ] History / Revert to previous version
- [ ] Optional Two-Steps Authentication (2FA)
- [x] Docker support + Auto compile/publish to Docker Hub
- [x] Support sub-directory installations (e.g. example.com/wiki)
- [ ] Persist system settings to database instead of file-based
- [ ] User Groups + Better permissions management
- [x] Make use of all available CPU cores, distributed jobs queue
- [ ] Tags per document / folder
- [ ] Comments / Discussion per document
- [ ] Profile page per user
- [ ] Preview changes directly from the editor, without saving
- [x] Modular authentication providers
- [ ] High Availability support (multiple concurrent instances)

### Future

- [ ] Insert Link modal in Editor
- [ ] Better simultaneous user editing handling
- [ ] Upgrade from web UI

## Gitter

Want to discuss features, ideas or issues? Join our [gitter channel](https://gitter.im/Requarks/wiki). We are very active and friendly!

## Twitter

Follow our Twitter feed to learn about upcoming updates and new releases!  
[![Twitter Follow](https://img.shields.io/badge/follow-%40requarks-blue.svg?style=flat-square)](https://twitter.com/requarks)  

## Translations

We are looking for translators to make Wiki.js available in multiple languages. If your language is not listed below and would like to contribute to this project, contact us on our [gitter channel](https://gitter.im/Requarks/wiki) and we'll provide you with the necessary tool to add translations, no coding required!

**Languages that are already translated:**

- [x] English
- [x] Chinese - *Thanks to [@choicky](https://github.com/choicky)*
- [x] Dutch - *Thanks to [@weirdwater](https://github.com/weirdwater)*
- [x] French
- [x] German - *Thanks to [@joetjengerdes](https://github.com/joetjengerdes)*
- [x] Japanese - *Thanks to [@johnnyshields](https://github.com/johnnyshields)*
- [x] Korean - *Thanks to [@junwonpk](https://github.com/junwonpk)*
- [x] Persian - *Thanks to [@ashkang](https://github.com/ashkang)*
- [x] Portuguese - *Thanks to [@felipeplets](https://github.com/felipeplets)*
- [x] Russian - *Thanks to [@efimlosev](https://github.com/efimlosev)*
- [x] Spanish - *Thanks to [@MatiasArriola](https://github.com/MatiasArriola)*

## Special Thanks

![Browserstack](https://wiki.js.org/assets/images/logo_browserstack.png)  
[Browserstack](https://www.browserstack.com/) for providing access to their great cross-browser testing tools.

[![DigitalOcean](https://wiki.js.org/assets/images/logo_digitalocean.png)](https://m.do.co/c/5f7445bfa4d0)  
[DigitalOcean](https://m.do.co/c/5f7445bfa4d0) for providing hosting of the Wiki.js documentation site.

## Contributors

This project exists thanks to all the people who contribute. [[Contribute]](CONTRIBUTING.md).
<a href="graphs/contributors"><img src="https://opencollective.com/wikijs/contributors.svg?width=890" /></a>

## Backers

Thank you to all our backers! 🙏 [[Become a backer](https://opencollective.com/wikijs#backer)]

<a href="https://opencollective.com/wikijs#backers" target="_blank"><img src="https://opencollective.com/wikijs/backers.svg?width=890"></a>

## Sponsors

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
