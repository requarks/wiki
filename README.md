<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://static.requarks.io/logo/wikijs-full-darktheme.svg">
  <img alt="Wiki.js" src="https://static.requarks.io/logo/wikijs-full.svg" width="600">
</picture>

[![License](https://img.shields.io/badge/license-AGPLv3-blue.svg?style=flat)](https://github.com/requarks/wiki/blob/master/LICENSE)
[![Standard - JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-green.svg?style=flat&logo=javascript&logoColor=white)](http://standardjs.com/)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/ngpixel?logo=github&color=ea4aaa)](https://github.com/users/NGPixel/sponsorship)
[![Open Collective backers and sponsors](https://img.shields.io/opencollective/all/wikijs?label=backers&color=218bff&logo=opencollective&logoColor=white)](https://opencollective.com/wikijs)  

##### Next Generation Open Source Wiki

</div>

- **[Official Website](https://beta.js.wiki)**
- **[Documentation](https://beta.js.wiki/docs)**

:red_square: :warning: :warning: :red_square:   
**THIS IS A VERY BUGGY, INCOMPLETE AND NON-SECURE DEVELOPMENT BRANCH!**  
**USE AT YOUR OWN RISK! THERE'S NO UPGRADE PATH FROM THIS BUILD AND NO SUPPORT IS PROVIDED!**  
:red_square: :warning: :warning: :red_square:

The current stable release (2.x) is available at https://js.wiki

---

- [Using VS Code Dev Environment](#using-vs-code-dev-environment) *(recommended)*
  - [Requirements](#requirements)
  - [Usage](#usage)
  - [Backend Development](#backend-development)
  - [Frontend Development](#frontend-development)
  - [pgAdmin](#pgadmin)
- [Generic Setup](#generic-setup)
  - [Requirements](#requirements-1)
  - [Usage](#usage-1)

## Using VS Code Dev Environment

### Requirements

- [VS Code](https://code.visualstudio.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Windows-only:** [WSL 2](https://learn.microsoft.com/en-us/windows/wsl/install) + [WSL Integration](https://docs.docker.com/desktop/wsl/) enabled in Docker Desktop

### Usage

1. Clone the project.
1. Open the project in VS Code.
1. Make sure you have **Dev Containers** extension installed. (On Windows, you need the **WSL** VS Code extension as well.)
1. Reopen the project in container (from the popup in the lower-right corner of the screen when opening the project, or via the Command Palette (Ctrl+Shift+P *or* F1) afterwards).
1. Once in container mode, make a copy of `config.sample.yml` and rename it to `config.yml`. There's no need to edit the file, the default values are ok.
1. Two terminals should automatically launch in the lower part of the screen. If this isn't the case, from the Command Palette, run the task "Create terminals":
    - Launch the Command Palette (Ctrl+Shift+P *or* F1)
    - Type `Run Task` and press <kbd>Enter</kbd>
    - Select the task "Create terminals" and press Enter
1. In the right-side terminal (Frontend), run the command:
    ```sh
    npm run build
    ```
1. In the left-side terminal (Backend), run the command:
    ```sh
    npm run start
    ```
1. Open your browser to `http://localhost:3000`
1. Login using the default administrator user:
    - Email: `admin@example.com`
    - Password: `12345678`

> **DO NOT** report bugs. This build is **VERY** buggy and **VERY** incomplete. Absolutely **NO** support is provided either.

### Backend Development

From the left-side terminal (Backend), run the command:

```sh
npm run dev
```

This will launch the server and automatically restart upon modification of any server files.

Only precompiled client assets are served in this mode. See the sections below on how to modify the frontend and run in SPA (Single Page Application) mode.

### Frontend Development

> Make sure you are running `npm run dev` in the left-side terminal (Backend) first! Requests still need to be forwarded to the server, even in SPA mode!

If you wish to modify any frontend content (under `/frontend`), you need to start the Quasar Dev Server in the right-side terminal (Frontend):

```sh
npm run dev
```

You can then access the site at `http://localhost:3001`. Notice the port being `3001` rather than `3000`. The app runs in a SPA (single-page application) mode and automatically hot-reload any modified component. Any requests made to the `/_api` endpoint are automatically forwarded to the server running on port `3000`, which is why both must be running at the same time.

Any change you make to the frontend will not be reflected on port 3000 until you run the command `npm run build` in the right-side terminal.

### pgAdmin

A web version of pgAdmin (a PostgreSQL administration tool) is available at `http://localhost:8000`. Use the login `dev@js.wiki` / `123123` to login.

The server **dev** should already be available under **Servers**. If that's not the case, add a new one with the following settings:

- Hostname: `db`
- Port: `5432`
- Username: `postgres`
- Password: `postgres`
- Database: `postgres`

## Generic Setup

### Requirements

- PostgreSQL **16** or later
- Node.js **24.x** or later

### Usage

1. Clone the project
1. Make a copy of `config.sample.yml` and rename it to `config.yml`
1. Edit `config.yml` and fill in the database details. **You need an empty PostgreSQL database.**
1. Run the following commands to install dependencies and generate the client assets:
    ```sh
    cd backend
    npm install
    cd ../ux
    npm install
    npm run build
    cd ../blocks
    npm install
    npm run build
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
