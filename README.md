<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://static.requarks.io/logo/wikijs-full-darktheme.svg">
  <img alt="Wiki.js" src="https://static.requarks.io/logo/wikijs-full.svg" width="600">
</picture>

![GitHub Release](https://img.shields.io/github/v/release/requarks/wiki?include_prereleases&filter=3.0.0-beta.*&style=flat&logo=wiki.js&cacheSeconds=300)
[![License](https://img.shields.io/badge/license-AGPLv3-blue.svg?style=flat)](https://github.com/requarks/wiki/blob/master/LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/ngpixel?logo=github&color=ea4aaa)](https://github.com/users/NGPixel/sponsorship)
[![Open Collective backers and sponsors](https://img.shields.io/opencollective/all/wikijs?label=backers&color=218bff&logo=opencollective&logoColor=white)](https://opencollective.com/wikijs)  
[![Chat on Discord](https://img.shields.io/badge/discord-join-8D96F6.svg?style=flat&logo=discord&logoColor=white)](https://discord.gg/rcxt9QS2jd)
[![Follow on Bluesky](https://img.shields.io/badge/bluesky-%40js.wiki-blue.svg?style=flat&logo=bluesky&logoColor=white)](https://bsky.app/profile/js.wiki)
[![Follow on Telegram](https://img.shields.io/badge/telegram-%40wiki__js-blue.svg?style=flat&logo=telegram)](https://t.me/wiki_js)
[![Reddit](https://img.shields.io/badge/reddit-%2Fr%2Fwikijs-orange?logo=reddit&logoColor=white)](https://www.reddit.com/r/wikijs/)

##### Next Generation Open Source Wiki

</div>

- **[Official Website](https://beta.js.wiki)**
- **[Documentation](https://docs.js.wiki)**

> [!CAUTION]
> This is a beta version of the upcoming 3.0 release. **DO NOT USE IN PRODUCTION!**
> The current stable release (2.x) is available at https://js.wiki

Important Notes:
- There's no upgrade path to or from this version.
- Do not open discussions about buttons or features not working. This is expected.
- There's no support provided. Use at your own risk.

<h2 align="center">Donate</h2>

<div align="center">

Wiki.js is an open source project that has been made possible due to the generous contributions by community [backers](https://beta.js.wiki/backers). If you are interested in supporting this project, please consider [becoming a sponsor](https://github.com/users/NGPixel/sponsorship), [becoming a patron](https://www.patreon.com/requarks), donating to our [OpenCollective](https://opencollective.com/wikijs), via [Paypal](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=FLV5X255Z9CJU&source=url) or via Ethereum (`0xe1d55c19ae86f6bcbfb17e7f06ace96bdbb22cb5`).
  
  [![Become a Sponsor](https://img.shields.io/badge/donate-github-ea4aaa.svg?style=popout&logo=github)](https://github.com/users/NGPixel/sponsorship)
  [![Become a Patron](https://img.shields.io/badge/donate-patreon-orange.svg?style=popout&logo=patreon)](https://www.patreon.com/requarks)
  [![Donate on OpenCollective](https://img.shields.io/badge/donate-open%20collective-blue.svg?style=popout&logo=data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIHdpZHRoPSIyNTZweCIgaGVpZ2h0PSIyNTZweCIgdmlld0JveD0iMCAwIDI1NiAyNTYiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNaWQiPjxnPjxwYXRoIGQ9Ik0yMDkuNzY1MTQ0LDEyOC4xNDk5NzkgQzIwOS43NjUxNDQsMTQ0LjE2MzMgMjA0Ljg2NDM4MSwxNTkuNDg5ODkgMTk2LjQ5ODc0NywxNzIuNzI1MDcyIEwyMjkuOTQ1Njc1LDIwNi4xNzE5OTkgQzI0Ni42ODIxMDUsMTgzLjg1Njc1OSAyNTUuNzI5MzA3LDE1Ni43MTUxNTIgMjU1LjcyOTMwNywxMjguODIxMTAyIEMyNTUuNzI5MzA3LDk5LjU1Njk5MTcgMjQ1Ljk3NDYwMyw3My4wNzEwMjA3IDIyOS4yNTg5NDQsNTEuNDg1ODEyOCBMMTk2LjQ4MzE0LDg0LjIxNDc5NCBDMjA1LjEyMjU2MSw5Ny4yMjI0NjgzIDIwOS43MzY5MDcsMTEyLjQ4NzgxIDIwOS43NDk1MzcsMTI4LjEwMzE1NiBMMjA5Ljc2NTE0NCwxMjguMTQ5OTc5IFoiIGZpbGw9IiNCOEQzRjQiPjwvcGF0aD48cGF0aCBkPSJNMTI3LjUxMzQ4NCwyMTAuMzU0ODE2IEM4Mi4xNDYwODcyLDIxMC4yNjg5NTggNDUuMzg3NTA5NCwxNzMuNTE3MzU4IDQ1LjI5MzAzOTMsMTI4LjE0OTk3OSBDNDUuMzYxNzUwMiw4Mi43NjQzMTM4IDgyLjEyNzg0ODcsNDUuOTg0MjU3IDEyNy41MTM0ODQsNDUuODk4MzE4NiBDMTQ0LjI0NDc1Miw0NS44OTgzMTg2IDE1OS41NzEzNDIsNTAuNzk5MDgxNyAxNzIuMTE5NzkyLDU5LjE2NDcxNTQgTDIwNC44NjQzODEsMjYuMzg4OTExNiBDMTgyLjU0MzY1LDkuNjY2NjUxMjkgMTU1LjQwMzQyOSwwLjYzMDg2MzI5OCAxMjcuNTEzNDg0LDAuNjM2NDk0NDAzIEM1Ny4xMjM1NDM3LDAuNjM2NDk0NDAzIDAsNTcuNzYwMDM4MSAwLDEyOC4xNDk5NzkgQzAsMTk4LjUwODcwNCA1Ny4xMjM1NDM3LDI1NS42NjM0NjMgMTI3LjUxMzQ4NCwyNTUuNjYzNDYzIEMxNTUuNTM3MzUyLDI1NS43NDA4NzYgMTgyLjc3NTk4OSwyNDYuNDA4NTEgMjA0Ljg2NDM4MSwyMjkuMTYxODg0IEwxNzEuNDE3NDU0LDE5NS43MzA1NjQgQzE1OS41NTU3MzQsMjA1LjQ4NTI2OCAxNDQuMjYwMzU5LDIxMC4zNTQ4MTYgMTI3LjUxMzQ4NCwyMTAuMzU0ODE2IEwxMjcuNTEzNDg0LDIxMC4zNTQ4MTYgWiIgZmlsbD0iIzdGQURGMiI+PC9wYXRoPjwvZz48L3N2Zz4=)](https://opencollective.com/wikijs)
  [![Donate via Paypal](https://img.shields.io/badge/donate-paypal-blue.svg?style=popout&logo=paypal)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=FLV5X255Z9CJU&source=url)  
  [![Donate via Ethereum](https://img.shields.io/badge/donate-ethereum-999.svg?style=popout&logo=ethereum&logoColor=CCC)](https://etherscan.io/address/0xe1d55c19ae86f6bcbfb17e7f06ace96bdbb22cb5)
  [![Buy a T-Shirt](https://img.shields.io/badge/buy-t--shirts-teal.svg?style=popout&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHg9IjBweCIgeT0iMHB4Igp3aWR0aD0iMjQiIGhlaWdodD0iMjQiCnZpZXdCb3g9IjAgMCAxOTIgMTkyIgpzdHlsZT0iIGZpbGw6IzAwMDAwMDsiPjxnIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0ibm9uemVybyIgc3Ryb2tlPSJub25lIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1saW5lY2FwPSJidXR0IiBzdHJva2UtbGluZWpvaW49Im1pdGVyIiBzdHJva2UtbWl0ZXJsaW1pdD0iMTAiIHN0cm9rZS1kYXNoYXJyYXk9IiIgc3Ryb2tlLWRhc2hvZmZzZXQ9IjAiIGZvbnQtZmFtaWx5PSJub25lIiBmb250LXdlaWdodD0ibm9uZSIgZm9udC1zaXplPSJub25lIiB0ZXh0LWFuY2hvcj0ibm9uZSIgc3R5bGU9Im1peC1ibGVuZC1tb2RlOiBub3JtYWwiPjxwYXRoIGQ9Ik0wLDE5MnYtMTkyaDE5MnYxOTJ6IiBmaWxsPSJub25lIj48L3BhdGg+PGcgZmlsbD0iIzFhYmM5YyI+PGcgaWQ9InN1cmZhY2UxIj48cGF0aCBkPSJNOTYsMGMtMTUuMjE4NzUsMCAtMjQuNjg3NSwzLjY1NjI1IC0yNS41LDRsLTIyLjUsNy4yNWMtMTAuNDA2MjUsMy4xODc1IC0xOS4wOTM3NSw5LjQzNzUgLTI1LjUsMTguMjVsLTIyLjUsNDIuNWwyNy4yNSwxNi43NWwxMi43NSwtMjR2MTE5LjI1YzAsNC40MDYyNSAyNS4wNjI1LDggNTYsOGMzMC45Mzc1LDAgNTYsLTMuNTkzNzUgNTYsLTh2LTExOS4yNWwxMi43NSwyNGwyNy4yNSwtMTYuNzVsLTIyLjUsLTQyLjVjLTYuNDA2MjUsLTguODEyNSAtMTUuMTU2MjUsLTE1LjA2MjUgLTI0Ljc1LC0xOC4yNWwtMjIuMjUsLTcuMjVjLTAuMTg3NSwwIC0xLjAzMTI1LDEuMzEyNSAtMiwyLjc1bDEuMjUsLTIuNWMwLDAgLTkuODQzNzUsLTQuMjUgLTI1Ljc1LC00LjI1ek05Niw4YzExLjQwNjI1LDAgMTguNDM3NSwyLjI1IDIxLDMuMjVjLTQuNDY4NzUsNS43NSAtMTEuNDA2MjUsMTIuNzUgLTIxLDEyLjc1Yy05LjQwNjI1LDAgLTE2LjQwNjI1LC03LjA2MjUgLTIwLjc1LC0xMi43NWMyLjg3NSwtMS4wNjI1IDkuODc1LC0zLjI1IDIwLjc1LC0zLjI1eiI+PC9wYXRoPjwvZz48L2c+PC9nPjwvc3ZnPg==)](https://wikijs.threadless.com)

</div>

<h2 align="center">Gold Tier Sponsors</h2>

<div align="center">
<table>
  <tbody>
    <tr>
      <td align="center" valign="middle" width="444">
        <a href="https://trans-zero.com/" target="_blank">
          <img src="https://cdn.js.wiki/images/sponsors/transzero.png">
        </a>
      </td>
    </tr>
  </tbody>
</table>
</div>

<h2 align="center">GitHub Sponsors</h2>

Support this project by becoming a sponsor. Your name and a link to your website will be listed on the [backers](https://beta.js.wiki/backers) page on the Wiki.js website! [[Become a sponsor](https://github.com/users/NGPixel/sponsorship)]

<div align="center">
<table>
  <tbody>
    <tr>
      <td align="center" valign="middle" width="444">
        <a href="https://www.stellarhosted.com/" target="_blank">
          <img src="https://cdn.js.wiki/images/sponsors/stellarhosted.png">
        </a>
      </td>
    </tr>
  </tbody>
</table>
</div>

<div align="center">
<table>
  <tbody>
    <tr>
      <td align="center" valign="middle" width="130">
        <a href="https://acceleanation.com/" target="_blank">
          <img src="https://avatars.githubusercontent.com/u/41210718?s=200&v=4">
        </a>
      </td>
      <td align="center" valign="middle" width="130">
        <a href="https://github.com/alexksso" target="_blank">
          Alexander Casassovici<br />(@alexksso)
        </a>
      </td>
      <td align="center" valign="middle" width="130">
        <a href="https://github.com/broxen" target="_blank">
          Broxen<br />(@broxen)
        </a>
      </td>
      <td align="center" valign="middle" width="130">
        <a href="https://github.com/xDacon" target="_blank">
          Dacon<br />(@xDacon)
        </a>
      </td>
      <td align="center" valign="middle" width="130">
        <a href="https://github.com/DonNabla" target="_blank">
          Maxime Pierre<br />(@DonNabla)
        </a>
      </td>
      <td align="center" valign="middle" width="130">
        <a href="https://github.com/GigabiteLabs" target="_blank">
          <img src="https://static.requarks.io/sponsors/gigabitelabs-148x129.png">
        </a>
      </td>
      <td align="center" valign="middle" width="130">
        <a href="https://www.hostwiki.com/" target="_blank">
          <img src="https://cdn.js.wiki/images/sponsors/hostwiki.png">
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle" width="130">
        <a href="https://github.com/JayDaley" target="_blank">
          Jay Daley<br />(@JayDaley)
        </a>
      </td>
      <td align="center" valign="middle" width="130">
        <a href="https://github.com/idokka" target="_blank">
          Oleksii<br />(@idokka)
        </a>
      </td>
      <td align="center" valign="middle" width="130">
        <a href="https://www.openhost-network.com/" target="_blank">
          <img src="https://avatars.githubusercontent.com/u/114218287?s=200&v=4">
        </a>
      </td>
      <td align="center" valign="middle" width="130">
        <a href="https://www.prevo.ch/" target="_blank">
          <img src="https://avatars.githubusercontent.com/u/114394792?v=4">
        </a>
      </td>
      <td align="center" valign="middle" width="130">
        <a href="https://github.com/shanekearney" target="_blank">
          Shane Kearney<br />(@shanekearney)
        </a>
      </td>
      <td align="center" valign="middle" width="130">
        <a href="http://www.taicep.org/" target="_blank">
          <img src="https://avatars.githubusercontent.com/u/160072306?v=4">
        </a>
      </td>
      <td align="center" valign="middle" width="130"></td>
    </tr>
  </tbody>
</table>

<h2 align="center">Special Thanks</h2>

<img src="https://beta.js.wiki/images/thanks/browserstack.svg" width="40" />

[Browserstack](https://www.browserstack.com/) for providing access to their great cross-browser testing tools.

<img src="https://beta.js.wiki/images/thanks/cloudflare.svg" width="40" />

[Cloudflare](https://www.cloudflare.com/) for providing their great CDN, SSL and advanced networking services.

<img src="https://beta.js.wiki/images/thanks/icons8.svg" width="40" />

[Icons8](https://icons8.com/) for providing access to their beautiful icon sets.

<img src="https://beta.js.wiki/images/thanks/crowdin.svg" width="40" />

[CrowdIn](https://crowdin.com/) for providing access to their great localization tool.

<img src="https://beta.js.wiki/images/thanks/porkbun.svg" width="40" />

[Porkbun](https://www.porkbun.com) for providing domain registration services.

<img src="https://beta.js.wiki/images/thanks/productbridge.svg" width="40" />

[ProductBridge](https://productbridge.io/) for providing access to their great feedback portal tool.
