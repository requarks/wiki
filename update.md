# Wiki.js - tyclipso fork - How to update

## Relevant changes of the fork when updating

- `client/themes/tyclipso/**`
- `server/modules/rendering/html-tyclipso/**`

## Setup dev environment

Follow the instructions at https://docs.requarks.io/dev.
Use the Visual Studio Code workflow to run the dev server.

**In short:**

1. Open the project in Visual Studio Code, with the Dev Container extension installed
2. Reopen the project in the dev-container
3. In the dev container terminal, run ```yarn dev```

### First time: Additional steps

If you set this up for the first time, make sure to:

1. Activate the custom theme (https://docs.requarks.io/en/dev/themes#activate-your-custom-theme)
  - open adminer at http://localhost:3001/, fill in the credentials from `dev/containers/config.yml`
  - in the `settings` table in the `theming` row, set the theme name to `tyclipso`
2. Restart the dev container

## Steps by step: Update

1. Merge `requarks/main` branch into `tyclipso`, resolve merge conflicts if necessary
2. Run the dev containers, for more info checkout [Setup dev environment](#setup-dev-environment) section
3. Check if the changes to the theme are still working as intended
4. Create a new tag consisting of the following parts, e.g. `v2.5.297.1`
  - the official release version (e.g. `v2.5.297`)
  - minor version appendix
5. Upload the merged commits and the new tag, a pipeline job will be started automatically to create a package of the
   new version
