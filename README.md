<div align="center">

<img src="https://static.requarks.io/logo/wikijs-full.svg" alt="Wiki.js" width="600" />

[![License](https://img.shields.io/badge/license-AGPLv3-blue.svg?style=flat)](https://github.com/requarks/wiki/blob/master/LICENSE)
[![Standard - JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-green.svg?style=flat&logo=javascript&logoColor=white)](http://standardjs.com/)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/ngpixel?logo=github&color=ea4aaa)](https://github.com/users/NGPixel/sponsorship)
[![Open Collective backers and sponsors](https://img.shields.io/opencollective/all/wikijs?label=backers&color=218bff&logo=opencollective&logoColor=white)](https://opencollective.com/wikijs)  
[![Chat on Slack](https://img.shields.io/badge/slack-requarks-CC2B5E.svg?style=flat&logo=slack)](https://wiki.requarks.io/slack)
[![Twitter Follow](https://img.shields.io/badge/follow-%40requarks-blue.svg?style=flat&logo=twitter)](https://twitter.com/requarks)
[![Reddit](https://img.shields.io/badge/reddit-%2Fr%2Fwikijs-orange?logo=reddit&logoColor=white)](https://www.reddit.com/r/wikijs/)
[![Subscribe to Newsletter](https://img.shields.io/badge/newsletter-subscribe-yellow.svg?style=flat&logo=mailchimp)](https://blog.js.wiki/subscribe)

##### Next Generation Open Source Wiki

</div>

- **[Official Website](https://next.js.wiki/)**
- **[Documentation](https://next.js.wiki/docs/)**

:red_square: :warning: :warning:  
**THIS IS A VERY BUGGY, INCOMPLETE AND NON-SECURE DEVELOPMENT BRANCH! USE AT YOUR OWN RISK! THERE'S NO UPGRADE PATH FROM THIS BUILD AND NO SUPPORT IS PROVIDED.**  
:warning: :warning: :red_square:

The current stable release (2.x) is available at https://js.wiki

---

- [Generic Setup](#generic-setup)
  - [Requirements](#requirements)
  - [Usage](#usage)
- [Using VS Code Dev Environment](#using-vs-code-dev-environment) *(recommended)*
  - [Requirements](#requirements-1)
  - [Usage](#usage-1)
  - [Server Development](#server-development)
  - [Frontend Development (Quasar/Vue 3)](#frontend-development-quasarvue-3)
  - [Legacy Frontend Development (Vuetify/Vue 2)](#legacy-frontend-development-vuetifyvue-2)
  - [pgAdmin](#pgadmin)

## Generic Setup

### Requirements

- Node.js **18.x** or later
- Yarn
- PostgreSQL **11** or later

### Usage

1. Clone the project
1. Make a copy of `config.sample.yml` and rename it to `config.yml`
1. Edit `config.yml` and fill in the database details. **You need an empty PostgreSQL database.**
1. Run the following commands to install dependencies and generate the client assets:
    ```sh
    yarn
    yarn legacy:build
    cd ux
    yarn
    yarn build
    cd ..
    ```
1. Run this command to start the server:
    ```sh
    node server
    ```
1. In your browser, navigate to `http://localhost:3000` *(or the IP/hostname of the server and the PORT you defined earlier.)*
1. Login using the default administrator user:
    - Email: `admin@example.com`
    - Password: `12345678`

> **DO NOT** report bugs. This build is **VERY** buggy and **VERY** incomplete. Absolutely **NO** support is provided either.

## Using VS Code Dev Environment

### Requirements

- VS Code
- Docker Desktop
- **Windows-only:** WSL 2 + WSL Integration enabled in Docker Desktop

### Usage

1. Clone the project
1. Open the project in VS Code
1. Make sure you have **Dev Containers** extension installed. (On Windows, you need the **WSL** VS Code extension as well.)
1. Reopen the project in container (from the popup in the lower-right corner of the screen when opening the project, or via the Command Palette (Ctrl+Shift+P) afterwards).
1. Once in container mode, run the task "Create terminals" from the Command Palette:
    - Launch the Command Palette (Ctrl+Shift+P)
    - Type "Run Task" and press Enter
    - Select the task "Create terminals" and press Enter
1. Two terminals will launch in split-screen mode at the bottom of the screen. **Server** on the left and **UX** on the right.
1. In the left-side terminal (Server), run the command:
    ```sh
    yarn legacy:build
    ```
1. In the right-side terminal (UX), run the command:
    ```sh
    yarn build
    ```
1. Back in the left-side terminal (Server), run the command:
    ```sh
    yarn dev
    ```
1. Open your browser to `http://localhost:3000`
1. Login using the default administrator user:
    - Email: `admin@example.com`
    - Password: `12345678`

> **DO NOT** report bugs. This build is **VERY** buggy and **VERY** incomplete. Absolutely **NO** support is provided either.

### Server Development

From the left-side terminal (Server), run the command:

```sh
yarn dev
```

This will launch the server and automatically restart upon modification of any server files.

Only precompiled client assets are served in this mode. See the sections below on how to modify the frontend and run in SPA (Single Page Application) mode.

### Frontend Development (Quasar/Vue 3)

> Make sure you are running `yarn dev` in the left-side terminal (Server) first! Requests still need to be forwarded to the server, even in SPA mode!

If you wish to modify any frontend content (under `/ux`), you need to start the Quasar Dev Server in the right-side terminal (UX):

```sh
yarn dev
```

You can then access the site at `http://localhost:3001`. Notice the port being `3001` rather than `3000`. The app runs in a SPA (single-page application) mode and automatically hot-reload any modified component. Any requests made to the `/graphql` endpoint are automatically forwarded to the server running on port `3000`, which is why both must be running at the same time.

Note that not all sections/features are available from this mode, notably the page editing features which still relies on the old client code (Vuetify/Vue 2). For example, trying to edit a page will simply not work. You must use the normal mode (port 3000) to edit pages as it relies on legacy client code. As more features gets ported / developed for Vue 3, they will become available in the SPA mode.

Any change you make to the frontend will not be reflected on port 3000 until you run the command `yarn build` in the right-side terminal.

### Legacy Frontend Development (Vuetify/Vue 2)

Client code from Wiki.js 2.x is located under `/client`. Some sections still rely on this legacy code (notably the page editing features). Code is gradually being removed from this location and replaced with newer code in `/ux`.

In the unlikely event that you need to modify legacy code and regenerate the old client files, you can do so by running in this command in the left-side terminal (Server):
```sh
yarn legacy:build
```

Then run `yarn dev` to start the server again.

### pgAdmin

A web version of pgAdmin (a PostgreSQL administration tool) is available at `http://localhost:8000`. Use the login `dev` / `123123` to login.

The server **dev** should already be available under **Servers**. If that's not the case, add a new one with the following settings:

- Hostname: `db`
- Port: `5432`
- Username: `postgres`
- Password: `postgres`
- Database: `postgres`
