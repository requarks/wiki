/**
 * Type declaration for the Localazy-generated `metadata.js` in this directory.
 *
 * `metadata.js` itself is generated output and stays JavaScript (see `localazy.json`), so this
 * sibling declaration is what lets the rest of the backend import it with `allowJs` disabled.
 * Keep it in sync if the Localazy export shape changes.
 */

export interface LocalazyLanguage {
  language: string
  region: string
  script: string
  isRtl: boolean
  name: string
  localizedName: string
  pluralType: (n: number) => string
}

export interface LocalazyMetadata {
  projectUrl: string
  baseLocale: string
  languages: LocalazyLanguage[]
}

declare const localazyMetadata: LocalazyMetadata
export default localazyMetadata
