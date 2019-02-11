<div align="center">

<img src="https://beta.requarks.io/svg/logo.svg" alt="Wiki.js" width="375" />

[![Release](https://img.shields.io/github/release/Requarks/wiki.svg?style=flat&maxAge=3600)](https://github.com/Requarks/wiki/releases)
[![License](https://img.shields.io/badge/license-AGPLv3-blue.svg?style=flat)](https://github.com/requarks/wiki/blob/master/LICENSE)
[![Backers on Open Collective](https://opencollective.com/wikijs/backers/badge.svg)](#backers)
[![Sponsors on Open Collective](https://opencollective.com/wikijs/sponsors/badge.svg)](#sponsors)
[![Downloads](https://img.shields.io/github/downloads/Requarks/wiki/total.svg?style=flat)](https://www.npmjs.com/package/wiki.js)
[![Docker Pulls](https://img.shields.io/docker/pulls/requarks/wiki.svg)](https://hub.docker.com/r/requarks/wiki/)  
[![Build status](https://dev.azure.com/requarks/wiki/_apis/build/status/build)](https://dev.azure.com/requarks/wiki/_build/latest?definitionId=9)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/1d0217a3153c4595bdedb322263e55c8)](https://www.codacy.com/app/Requarks/wiki)
[![Standard - JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)
[![Chat on Gitter](https://img.shields.io/badge/chat-on_gitter-CC2B5E.svg?style=flat&logo=image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAOCAMAAADUg/YpAAAABlBMVEUAAAD///%2Bl2Z/dAAAAAXRSTlMAQObYZgAAABVJREFUeAFjwAUYYTQByAAh0WicAAAFnwAYeB5bLwAAAABJRU5ErkJggg==)](https://gitter.im/Requarks/wiki)
[![Twitter Follow](https://img.shields.io/badge/follow-%40requarks-blue.svg?style=flat)](https://twitter.com/requarks)

##### A modern, lightweight and powerful wiki app built on NodeJS

</div>

# :white_check_mark: STABLE v1.x version
  
**This repository is for the 2.0 BETA of Wiki.js.**  
It is highly recommended to use the 1.x version until a stable version of 2.0 is released. An easy and quick upgrade path will be provided to migrate from 1.x to 2.0.

:point_right: **[Go to version 1.x instead](https://github.com/Requarks/wiki-v1)** :point_left:

**Version 2.0 should NOT be used in production! Once again, please use 1.x for now!**

---

# :construction: UNSTABLE v2.0 BETA version

**This version is for testing and development purposes only!** It is not ready for production and is still missing critical features. You cannot migrate 1.x data at this time!

- **[Official Website](https://wiki.js.org/)** *(Coming soon, pointing to 1.x for now)*
- **[Documentation](https://docs-beta.requarks.io/)**
- [Requirements](#requirements)
- [Demo](#demo)
- [Change Log](https://github.com/Requarks/wiki/blob/dev/CHANGELOG.md)
- [Feature Requests](https://requests.requarks.io/wiki)
- [Milestones](#milestones)
- [Chat with us](#gitter)
- [T-Shirts Shop](#t-shirts-shop)
- [Translations](#translations) *(We need your help!)*
- [Special Thanks](#special-thanks)
- [Contribute](#contributors)

<h2 align="center">Donate</h2>

Wiki.js is an open source project that has been made possible due to the generous contributions by community [backers](https://github.com/Requarks/wiki/blob/master/BACKERS.md). If you are interested in supporting this project, please consider [becoming a patron](https://www.patreon.com/requarks) or donating to our [OpenCollective](https://opencollective.com/wikijs).

<a href="https://www.patreon.com/requarks">
  <img src="https://c5.patreon.com/external/logo/become_a_patron_button.png" alt="Become a Patron" />
</a>

<h2 align="center">Requirements</h2>

Wiki.js can run on virtually all platforms where Node.js can (Windows, Mac, Linux, etc.) or using Docker!

- Node.js **10.12** or later
- One of the following supported database engines:
  - MySQL **5.7.8** or later
  - PostgreSQL **9.5** or later
  - MariaDB **10.2.7** or later
  - Microsoft SQL Server **2012** or later
  - SQLite **3.9** or later
- Redis **3.0** or later

> Read the full [prerequisites](https://docs-beta.requarks.io/install/requirements) article for full details.

<h2 align="center">Docker</h2>

Docker is the recommended way to go! Simply use Docker image: `requarks/wiki:beta` 

You can also use Docker Compose ([see example](https://github.com/Requarks/wiki/blob/master/dev/examples/docker-compose.yml)) to run Wiki.js with all dependencies.

<h2 align="center">Demo</h2>

Check out our [documentation site](https://docs-beta.requarks.io), it's running Wiki.js!

<h2 align="center">Milestones</h2>

:bookmark_tabs: See [project board](https://github.com/Requarks/wiki/projects/5) to keep track of current progress.

<h2 align="center">Gitter</h2>

Want to discuss features, ideas or issues? Join our [gitter channel](https://gitter.im/Requarks/wiki). We are very active and friendly!  
[![Chat on Gitter](https://img.shields.io/badge/chat-on_gitter-CC2B5E.svg?style=flat-square&logo=image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAOCAMAAADUg/YpAAAABlBMVEUAAAD///%2Bl2Z/dAAAAAXRSTlMAQObYZgAAABVJREFUeAFjwAUYYTQByAAh0WicAAAFnwAYeB5bLwAAAABJRU5ErkJggg==)](https://gitter.im/Requarks/wiki)

<h2 align="center">Twitter</h2>

Follow our Twitter feed to learn about upcoming updates and new releases!  
[![Twitter Follow](https://img.shields.io/badge/follow-%40requarks-blue.svg?style=flat-square)](https://twitter.com/requarks)  

<h2 align="center">T-Shirts Shop</h2>

Want to donate to this project but get something in return as well? Check out our amazing t-shirts for men, women and kids, as well as other goodies: [Wiki.js Shop](https://wikijs.threadless.com/)

<h2 align="center">Translations</h2>

We are looking for translators to make Wiki.js UI available in as many languages as possible. If you would like to contribute to this project, contact us on our [gitter channel](https://gitter.im/Requarks/wiki) and we'll provide you access to our translation tool, absolutely no coding required!

<h2 align="center">Special Thanks</h2>

![Algolia](https://wiki.js.org/assets/images/logo_algolia.png)  
[Algolia](https://www.algolia.com/) for providing access to their incredible search engine.

![Browserstack](https://wiki.js.org/assets/images/logo_browserstack.png)  
[Browserstack](https://www.browserstack.com/) for providing access to their great cross-browser testing tools.

![Cloudflare](https://wiki.js.org/assets/images/logo_cloudflare.png)  
[Cloudflare](https://www.cloudflare.com/) for providing their great CDN, SSL and advanced networking services.

[![DigitalOcean](https://wiki.js.org/assets/images/logo_digitalocean.png)](https://m.do.co/c/5f7445bfa4d0)  
[DigitalOcean](https://m.do.co/c/5f7445bfa4d0) for providing hosting of the Wiki.js documentation site.

<h2 align="center">Sponsors</h2>

Support this project by becoming a sponsor. Your logo will show up in the Contribute page of all Wiki.js installations as well as here with a link to your website! [[Become a sponsor](https://opencollective.com/wikijs#sponsor)]

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

<h2 align="center">Backers</h2>

Thank you to all our backers! 🙏 [[Become a backer](https://opencollective.com/wikijs#backer)]

<a href="https://opencollective.com/wikijs#backers" target="_blank"><img src="https://opencollective.com/wikijs/backers.svg?width=890"></a>

<h2 align="center">Contributors</h2>

This project exists thanks to all the people who contribute. [[Contribute]](https://github.com/Requarks/wiki/blob/master/CONTRIBUTING.md).
<a href="https://github.com/Requarks/wiki/graphs/contributors"><img src="https://opencollective.com/wikijs/contributors.svg?width=890" /></a>
