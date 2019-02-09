## IMPORTANT

Localization files are not stored into files!

Contact us on Gitter to request access to the translation web service: https://gitter.im/Requarks/wiki

## Development Mode

If you need to add new keys and test them live, simply create a {LANG}.yml file in this folder containing the values you want to test. e.g.:

### en.yml
```yml
admin:
  api.title: 'API Access'
  auth.title: 'Authentication'
```

The official localization keys will still be loaded first, but your local files will overwrite any existing keys (and add new ones).

Note that you must restart Wiki.js to load any changes made to the files, which happens automatically on save when in dev mode.
