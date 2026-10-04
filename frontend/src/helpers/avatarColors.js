/**
 * The colours an avatar without a picture is drawn in, so that two people in one discussion are not
 * the same blue circle with a different letter in it.
 *
 * Twenty, in hue order around the wheel: ten Material tones from the palette in `css/tailwind.css`,
 * and between them the ten `avatar-*` fills declared beside it for the hues Material does not offer
 * at a usable depth. Every one keeps a white initial legible -- the circle is drawn the same in both
 * themes, so it has to hold its own against white text rather than against the page.
 */
export const AVATAR_COLORS = [
  'pink-8',
  'red-8',
  'brown-9',
  'deep-orange-9',
  'avatar-orange',
  'avatar-amber',
  'avatar-olive',
  'avatar-lime',
  'green-9',
  'avatar-sea',
  'teal-8',
  'cyan-9',
  'avatar-ocean',
  'blue-8',
  'avatar-slate',
  'indigo-9',
  'avatar-violet',
  'purple-8',
  'avatar-magenta',
  'avatar-plum'
]

/**
 * The colour for one person, the same every time it is asked.
 *
 * Derived from the key rather than stored, so nothing has to be assigned or remembered: FNV-1a over
 * the string, which spreads short and similar keys (sequential ids, two names a letter apart) across
 * the palette where a plain character sum would bunch them.
 *
 * @param {string} key What identifies the person -- a user id, or for a guest, their name.
 * @returns {string} A palette name, as `<w-avatar :color>` takes it.
 */
export function avatarColorFor(key) {
  let hash = 0x811c9dc5
  for (const char of key ?? '') {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return AVATAR_COLORS[(hash >>> 0) % AVATAR_COLORS.length]
}
