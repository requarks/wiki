/**
 * Runtime brand-color theming.
 *
 * Writes the `--q-*` custom properties that `css/tailwind.css` chains its brand color tokens to, so
 * a single call here recolors every Tailwind `bg-primary` / `text-accent` utility in the app.
 *
 * The `--q-` prefix is retained deliberately: Quasar's own colour classes read the same properties,
 * which is what keeps migrated and un-migrated screens showing one consistent theme while both
 * styling systems are installed. The prefix is just a name once Quasar is gone -- renaming it would
 * mean touching every consumer for no behavioural gain.
 *
 * @param {string} name Color name without the prefix, e.g. `primary`.
 * @param {string} value Any CSS color.
 */
export function setCssVar(name, value) {
  if (!value) {
    return
  }
  document.documentElement.style.setProperty(`--q-${name}`, value)
}
