<div align="center">

<img src="https://static.requarks.io/logo/wikijs-full.svg" alt="Wiki.js" width="600" />

[![Release](https://img.shields.io/github/release/Requarks/wiki.svg?style=flat&maxAge=3600)](https://github.com/Requarks/wiki/releases)
[![License](https://img.shields.io/badge/license-AGPLv3-blue.svg?style=flat)](https://github.com/requarks/wiki/blob/master/LICENSE)
[![Backers on Open Collective](https://opencollective.com/wikijs/all/badge.svg)](https://opencollective.com/wikijs)
[![Downloads](https://img.shields.io/github/downloads/Requarks/wiki/total.svg?style=flat)](https://github.com/Requarks/wiki/releases)
[![Docker Pulls](https://img.shields.io/docker/pulls/requarks/wiki.svg)](https://hub.docker.com/r/requarks/wiki/)  
[![Build status](https://dev.azure.com/requarks/wiki/_apis/build/status/build)](https://dev.azure.com/requarks/wiki/_build/latest?definitionId=9)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=wiki&metric=alert_status)](https://sonarcloud.io/dashboard?id=wiki)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=wiki&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=wiki)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=wiki&metric=security_rating)](https://sonarcloud.io/dashboard?id=wiki)
[![Standard - JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)  
[![Chat on Slack](https://img.shields.io/badge/slack-requarks-CC2B5E.svg?style=flat&logo=slack)](https://wiki.requarks.io/slack)
[![Twitter Follow](https://img.shields.io/badge/follow-%40requarks-blue.svg?style=flat&logo=twitter)](https://twitter.com/requarks)
[![Subscribe to Newsletter](https://img.shields.io/badge/newsletter-subscribe-yellow.svg?style=flat&logo=mailchimp)](https://wiki.js.org/newsletter)

##### A modern, lightweight and powerful wiki app built on NodeJS

</div>

- **[Official Website](https://wiki.js.org/)**
- **[Documentation](https://docs.requarks.io/)**
- [Requirements](https://docs.requarks.io/install/requirements)
- [Demo](#demo)
- [Change Log](https://docs.requarks.io/releases)
- [Feature Requests](https://wiki.js.org/feedback)
- [Chat with us on Slack](#slack)
- [Translations](#translations) *(We need your help!)*
- [Special Thanks](#special-thanks)
- [Contribute](#contributors)

<h2 align="center">Donate</h2>

<div align="center">

Wiki.js is an open source project that has been made possible due to the generous contributions by community [backers](https://github.com/Requarks/wiki/blob/master/BACKERS.md). If you are interested in supporting this project, please consider [becoming a sponsor](https://github.com/users/NGPixel/sponsorship), [becoming a patron](https://www.patreon.com/requarks), donating to our [OpenCollective](https://opencollective.com/wikijs), via [Paypal](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=FLV5X255Z9CJU&source=url) or via Ethereum (`0xe1d55c19ae86f6bcbfb17e7f06ace96bdbb22cb5`).
  
  [![Become a Sponsor](https://img.shields.io/badge/donate-github-ea4aaa.svg?style=popout&logo=github)](https://github.com/users/NGPixel/sponsorship)
  [![Become a Patron](https://img.shields.io/badge/donate-patreon-orange.svg?style=popout&logo=patreon)](https://www.patreon.com/requarks)
  [![Donate on OpenCollective](https://img.shields.io/badge/donate-open%20collective-blue.svg?style=popout&logo=data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIHdpZHRoPSIyNTZweCIgaGVpZ2h0PSIyNTZweCIgdmlld0JveD0iMCAwIDI1NiAyNTYiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQiPjxnPjxwYXRoIGQ9Ik0yMDkuNzY1MTQ0LDEyOC4xNDk5NzkgQzIwOS43NjUxNDQsMTQ0LjE2MzMgMjA0Ljg2NDM4MSwxNTkuNDg5ODkgMTk2LjQ5ODc0NywxNzIuNzI1MDcyIEwyMjkuOTQ1Njc1LDIwNi4xNzE5OTkgQzI0Ni42ODIxMDUsMTgzLjg1Njc1OSAyNTUuNzI5MzA3LDE1Ni43MTUxNTIgMjU1LjcyOTMwNywxMjguODIxMTAyIEMyNTUuNzI5MzA3LDk5LjU1Njk5MTcgMjQ1Ljk3NDYwMyw3My4wNzEwMjA3IDIyOS4yNTg5NDQsNTEuNDg1ODEyOCBMMTk2LjQ4MzE0LDg0LjIxNDc5NCBDMjA1LjEyMjU2MSw5Ny4yMjI0NjgzIDIwOS43MzY5MDcsMTEyLjQ4NzgxIDIwOS43NDk1MzcsMTI4LjEwMzE1NiBMMjA5Ljc2NTE0NCwxMjguMTQ5OTc5IFoiIGZpbGw9IiNCOEQzRjQiPjwvcGF0aD48cGF0aCBkPSJNMTI3LjUxMzQ4NCwyMTAuMzU0ODE2IEM4Mi4xNDYwODcyLDIxMC4yNjg5NTggNDUuMzg3NTA5NCwxNzMuNTE3MzU4IDQ1LjI5MzAzOTMsMTI4LjE0OTk3OSBDNDUuMzYxNzUwMiw4Mi43NjQzMTM4IDgyLjEyNzg0ODcsNDUuOTg0MjU3IDEyNy41MTM0ODQsNDUuODk4MzE4NiBDMTQ0LjI0NDc1Miw0NS44OTgzMTg2IDE1OS41NzEzNDIsNTAuNzk5MDgxNyAxNzIuMTE5NzkyLDU5LjE2NDcxNTQgTDIwNC44NjQzODEsMjYuMzg4OTExNiBDMTgyLjU0MzY1LDkuNjY2NjUxMjkgMTU1LjQwMzQyOSwwLjYzMDg2MzI5OCAxMjcuNTEzNDg0LDAuNjM2NDk0NDAzIEM1Ny4xMjM1NDM3LDAuNjM2NDk0NDAzIDAsNTcuNzYwMDM4MSAwLDEyOC4xNDk5NzkgQzAsMTk4LjUwODcwNCA1Ny4xMjM1NDM3LDI1NS42NjM0NjMgMTI3LjUxMzQ4NCwyNTUuNjYzNDYzIEMxNTUuNTM3MzUyLDI1NS43NDA4NzYgMTgyLjc3NTk4OSwyNDYuNDA4NTEgMjA0Ljg2NDM4MSwyMjkuMTYxODg0IEwxNzEuNDE3NDU0LDE5NS43MzA1NjQgQzE1OS41NTU3MzQsMjA1LjQ4NTI2OCAxNDQuMjYwMzU5LDIxMC4zNTQ4MTYgMTI3LjUxMzQ4NCwyMTAuMzU0ODE2IEwxMjcuNTEzNDg0LDIxMC4zNTQ4MTYgWiIgZmlsbD0iIzdGQURGMiI+PC9wYXRoPjwvZz48L3N2Zz4=)](https://opencollective.com/wikijs)
  [![Donate via Paypal](https://img.shields.io/badge/donate-paypal-blue.svg?style=popout&logo=paypal)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=FLV5X255Z9CJU&source=url)  
  [![Donate via Ethereum](https://img.shields.io/badge/donate-ethereum-999.svg?style=popout&logo=ethereum&logoColor=CCC)](https://etherscan.io/address/0xe1d55c19ae86f6bcbfb17e7f06ace96bdbb22cb5)
  [![Donate via Bitcoin](https://img.shields.io/badge/donate-bitcoin-ff9900.svg?style=popout&logo=bitcoin&logoColor=CCC)](https://checkout.opennode.com/p/2553c612-f863-4407-82b3-1a7685268747)
  [![Buy a T-Shirt](https://img.shields.io/badge/buy-t--shirts-teal.svg?style=popout&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHg9IjBweCIgeT0iMHB4Igp3aWR0aD0iMjQiIGhlaWdodD0iMjQiCnZpZXdCb3g9IjAgMCAxOTIgMTkyIgpzdHlsZT0iIGZpbGw6IzAwMDAwMDsiPjxnIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0ibm9uemVybyIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1saW5lY2FwPSJidXR0IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIiBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiIHN0cm9rZS1kYXNoYXJyYXk9IiIgc3Ryb2tlLWRhc2hvZmZzZXQ9IjAiIGZvbnQtZmFtaWx5PSJub25lIiBmb250LXdlaWdodD0ibm9uZSIgZm9udC1zaXplPSJub25lIiB0ZXh0LWFuY2hvcj0ibm9uZSIgc3R5bGU9Im1peC1ibGVuZC1tb2RlOiBub3JtYWwiPjxwYXRoIGQ9Ik0wLDE5MnYtMTkyaDE5MnYxOTJ6IiBmaWxsPSJub25lIj48L3BhdGg+PGcgZmlsbD0iIzFhYmM5YyI+PGcgaWQ9InN1cmZhY2UxIj48cGF0aCBkPSJNOTYsMGMtMTUuMjE4NzUsMCAtMjQuNjg3NSwzLjY1NjI1IC0yNS41LDRsLTIyLjUsNy4yNWMtMTAuNDA2MjUsMy4xODc1IC0xOS4wOTM3NSw5LjQzNzUgLTI1LjUsMTguMjVsLTIyLjUsNDIuNWwyNy4yNSwxNi43NWwxMi43NSwtMjR2MTE5LjI1YzAsNC40MDYyNSAyNS4wNjI1LDggNTYsOGMzMC45Mzc1LDAgNTYsLTMuNTkzNzUgNTYsLTh2LTExOS4yNWwxMi43NSwyNGwyNy4yNSwtMTYuNzVsLTIyLjUsLTQyLjVjLTYuNDA2MjUsLTguODEyNSAtMTUuMTU2MjUsLTE1LjA2MjUgLTI0Ljc1LC0xOC4yNWwtMjIuMjUsLTcuMjVjLTAuMTg3NSwwIC0xLjAzMTI1LDEuMzEyNSAtMiwyLjc1bDEuMjUsLTIuNWMwLDAgLTkuODQzNzUsLTQuMjUgLTI1Ljc1LC00LjI1ek05Niw4YzExLjQwNjI1LDAgMTguNDM3NSwyLjI1IDIxLDMuMjVjLTQuNDY4NzUsNS43NSAtMTEuNDA2MjUsMTIuNzUgLTIxLDEyLjc1Yy05LjQwNjI1LDAgLTE2LjQwNjI1LC03LjA2MjUgLTIwLjc1LC0xMi43NWMyLjg3NSwtMS4wNjI1IDkuODc1LC0zLjI1IDIwLjc1LC0zLjI1eiI+PC9wYXRoPjwvZz48L2c+PC9nPjwvc3ZnPg==)](https://wikijs.threadless.com)

</div>

<h2 align="center">Docker</h2>

<div align="center">

Docker is the recommended way to go! Simply use Docker image: `requarks/wiki:2` 

You can also use Docker Compose ([see example](https://github.com/Requarks/wiki/blob/master/dev/examples/docker-compose.yml)) to run Wiki.js with all dependencies.

</div>

<h2 align="center">Demo</h2>

<div align="center">

Check out our [documentation site](https://docs.requarks.io), it's running Wiki.js!

</div>

<h2 align="center">Slack</h2>

<div align="center">

Want to discuss features, ideas or issues? Join our [Slack channel](https://wiki.requarks.io/slack). We are very active and friendly!  

[![Chat on Slack](https://img.shields.io/badge/slack-requarks-CC2B5E.svg?style=flat&logo=slack)](https://wiki.requarks.io/slack)

</div>

<h2 align="center">Twitter</h2>

<div align="center">

Follow our Twitter feed to learn about upcoming updates and new releases!  
[![Twitter Follow](https://img.shields.io/badge/follow-%40requarks-blue.svg?style=popout&logo=twitter)](https://twitter.com/requarks)  

</div>

<h2 align="center">Translations</h2>

We are looking for translators to make Wiki.js UI available in as many languages as possible. If you would like to contribute to this project, [click here](https://lokalise.com/public/2994254859f751ea605a00.03473540/) to gain access to our translation tool, absolutely no coding required! Feel free to contact us on our [Slack channel](https://wiki.requarks.io/slack) if you have any questions.

<h2 align="center">Special Thanks</h2>

![Algolia](https://wiki.js.org/legacy/logo_algolia.png)  
[Algolia](https://www.algolia.com/) for providing access to their incredible search engine.

![Browserstack](https://wiki.js.org/legacy/logo_browserstack.png)  
[Browserstack](https://www.browserstack.com/) for providing access to their great cross-browser testing tools.

![Bugsnag](https://wiki.js.org/legacy/logo-bugsnag.png)  
[Bugsnag](https://www.bugsnag.com/) for providing error monitoring solutions.

![Cloudflare](https://wiki.js.org/legacy/logo_cloudflare.png)  
[Cloudflare](https://www.cloudflare.com/) for providing their great CDN, SSL and advanced networking services.

![DigitalOcean](https://wiki.js.org/legacy/logo_digitalocean.png)  
[DigitalOcean](https://m.do.co/c/5f7445bfa4d0) for providing hosting of the Wiki.js documentation site.

![Icons8](https://static.requarks.io/logo/icons8.svg)  
[Icons8](https://icons8.com/) for providing beautiful icon sets.

![Netlify](https://wiki.js.org/legacy/logo_netlify.png)  
[Netlify](https://www.netlify.com) for providing hosting for landings and blog websites.

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

This project exists thanks to all the people who contribute. [[Contribute]](https://github.com/Requarks/wiki/blob/master/.github/CONTRIBUTING.md).
<a href="https://github.com/Requarks/wiki/graphs/contributors"><img src="https://opencollective.com/wikijs/contributors.svg?width=890" /></a>
