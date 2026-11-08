/**
 * The search box's query syntax, turned into the text `to_tsquery` parses.
 *
 * | Typed        | Means                                  | Becomes                 |
 * | ------------ | -------------------------------------- | ----------------------- |
 * | `foo bar`    | both words                             | `'foo' & 'bar'`         |
 * | `-foo`       | not the word — also `!foo`             | `!'foo'`                |
 * | `foo*`       | any word starting with it              | `'foo':*`               |
 * | `foo,bar`    | either word — also `foo\|bar`, `foo or bar` | `('foo' \| 'bar')` |
 * | `"foo bar"`  | the words next to each other, in order | `'foo bar'`             |
 *
 * OR binds tighter than AND, so `foo,bar baz` is "foo or bar, and baz": the comma reads as part of
 * one term, and the spelled-out `or` follows it for consistency.
 *
 * Postgres' own `websearch_to_tsquery` has no prefix operator, which is why this exists. It does the
 * splitting into operands only; each operand is passed as a quoted string, which `to_tsquery` runs
 * through the dictionary like any other text — so stemming, stop words and splitting `foo-bar` or
 * `node.js` into lexemes stay postgres' business, and nothing typed can reach the tsquery syntax.
 *
 * Every other character is ordinary text, and the dictionary's parser discards the punctuation.
 *
 * @returns An empty string when nothing searchable was typed, which `to_tsquery` reads as a query
 *   matching nothing.
 */
export function toTsQueryText(input: string): string {
  // -> Each inner list is ORed, and the lists are ANDed
  const groups: string[][] = []
  let orPending = false

  const add = (operand: string) => {
    const last = groups.at(-1)
    if (orPending && last) {
      last.push(operand)
    } else {
      groups.push([operand])
    }
    orPending = false
  }

  let idx = 0
  while (idx < input.length) {
    const char = input[idx]
    if (/\s/.test(char)) {
      idx++
      continue
    }
    if (char === ',' || char === '|') {
      orPending = true
      idx++
      continue
    }

    // -> `-` or `!` negates only at the start of a term; inside a word (`foo-bar`) it is text
    const negated = char === '-' || char === '!'
    if (negated) {
      idx++
    }

    let operand: string | null
    if (input[idx] === '"') {
      // -> An unclosed quote runs to the end
      const close = input.indexOf('"', idx + 1)
      const end = close < 0 ? input.length : close
      operand = quoteOperand(input.slice(idx + 1, end), false)
      idx = end + 1
    } else {
      const start = idx
      while (idx < input.length && !/[\s,|"]/.test(input[idx])) {
        idx++
      }
      const word = input.slice(start, idx)
      if (!negated && word.toLowerCase() === 'or') {
        orPending = true
        continue
      }
      operand = quoteOperand(word.replaceAll('*', ''), word.endsWith('*'))
    }

    // -> Nothing searchable in it: `''` is a syntax error, and the operators around it still apply
    if (operand) {
      add(negated ? `!${operand}` : operand)
    }
  }

  return groups.map((group) => (group.length > 1 ? `(${group.join(' | ')})` : group[0])).join(' & ')
}

/**
 * One operand as a `to_tsquery` quoted string, or null when it has no letter or digit for the
 * dictionary to make a lexeme of.
 */
function quoteOperand(text: string, prefix: boolean): string | null {
  if (!/[\p{L}\p{N}]/u.test(text)) {
    return null
  }
  const escaped = text.trim().replaceAll('\\', '\\\\').replaceAll("'", "''")
  return `'${escaped}'${prefix ? ':*' : ''}`
}
