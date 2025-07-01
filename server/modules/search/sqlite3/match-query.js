const _ = require('lodash')
/*
 * Full text query preprocessor for sqlite3 FTS similar to pg-tsquery.
 * Converts input string into internal sqlite match query
 * FTS info: https://www.sqlite.org/fts5.html#full_text_query_syntax
 */

/*
| input                                 | output |
| ---                                   | ---    |
| `foo bar`                             | `foo bar` |
| `foo -bar`, `foo !bar`, `foo + !bar`  | `foo NOT bar` |
| `foo bar,bip`, `foo+bar | bip`       | `(foo bar) OR bip` |
| `foo (bar,bip)`, `foo+(bar|bip)`     | `foo (bar OR bip)` |
| `foo*,bar* bana*`                    | `(foo *) or (bar *  bana*)` |
*/

module.exports = {
  parse(input) {
    const p = new MatchQueryParser()
    const v = p.parse(input)

    const negated = v.negated
    /*
     * Since sqlite does not support top level negated MATCH queries
     * calling function need to create negated sql query like
     * select * not in (select ... match)
     */
    if (negated) {
      v.negated = false
    }
    return {
      negated,
      str: v.toString()
    }
  }
}

class Token {
  constructor(type, value) {
    this.type = type
    this.value = value
  }
}

class Node {
  constructor({ type, value, negated = false, args, parNode = undefined, star = false }) {
    this.type = type
    this.value = value
    this.negated = negated
    this.star = star
    this.args = args
    if (this.args) {
      this.args.forEach(item => { item.parNode = this })
    }
    this.parNode = parNode
  }

  toString() {
    let s = ''
    if (this.type === 'id') {
      s = `"${this.value}"`
      if (this.star) {
        s += '*'
      }
    } else {
      let separator = ''

      if (this.type === 'and') {
        separator = ' AND '
      } else if (this.type === 'or') {
        separator = ' OR '
      } else {
        throw new Error('should not reach')
      }

      if (this.args && this.args.length > 0) {
        this.args.forEach(item => {
          if (s !== '') {
            if (item.negated && this.type === 'and') {
              s += ' '
            } else {
              s += separator
            }
          }
          s += item
        })
      }
      if (this.parNode !== undefined || this.negated) {
        s = `(${s})`
      }
    }
    if (this.negated) {
      s = 'NOT ' + s
    }
    return s
  }
}

function negateNodeType(node) {
  if (node.type === 'or') {
    return 'and'
  } else if (node.type === 'and') {
    return 'or'
  } else {
    throw new Error('should not reach')
  }
}

function negateNodes(lst) {
  lst.forEach(item => {
    if (!(item instanceof Node)) {
      throw new Error('should not reach')
    }
    item.negated = !item.negated
  })
}

class MatchQueryParser {
  constructor() {
    this.tokenRegex = /^([",!*()-])/
    this.phraseSeparator = ' '
    this.terms = /[ \t,!*()-]/
    this.knownLexemes = {
      '-': 'not', '!': 'not', 'not': 'not',
      '&': 'and', 'and': 'and',
      ',': 'or', 'or': 'or', '|': 'or'
    }
  }

  asKeywordToken(s) {
    const k = s.toLowerCase()
    if (!_.has(this.knownLexemes, k)) {
      return undefined
    }
    return new Token(this.knownLexemes[k], s)
  }

  intNextToken() {
    let tail = this.input.substring(this.idx).trimStart()
    if (!tail) {
      return undefined
    }

    tail = tail.trimStart()
    this.idx = this.input.length - tail.length

    const m = tail.match(this.tokenRegex)
    if (m) {
      if (m[0] === '"') {
        const idx = tail.indexOf('"', 1)
        if (idx === -1) {
          tail = tail.substring(1)
          this.idx = this.input.length
        } else {
          tail = tail.substring(1, idx)
          this.idx += idx + 1
        }
        return new Token('id', tail)
      }
      this.idx += m[0].length
      const keyword = this.asKeywordToken(m[0])
      return keyword || new Token(m[0], m[0])
    }

    // this is literal string, find next valid token start
    const idx = tail.search(this.terms)
    if (idx > 0) {
      tail = tail.substring(0, idx)
    }
    this.idx += tail.length

    const keyword = this.asKeywordToken(tail)
    return keyword || new Token('id', tail)
  }

  nextToken() {
    this.tok = this.intNextToken()
    return this.tok
  }

  match(v) {
    if (this.tok === undefined) {
      return false
    }
    return this.tok.type === v
  }

  eat(v) {
    if (!this.match(v)) {
      return false
    }
    this.nextToken()
    return true
  }

  setParent(node, par) {
    if (node === undefined) {
      return undefined
    }

    node.parNode = par
    if (!node.args) {
      return
    }

    node.args.forEach(item => {
      if (item instanceof Node) {
        this.setParent(item, node)
      }
    })
  }

  /*
   * Sqlite3 `NOT` operator is binary but our input search string
   * have unary not ('!', '-') operators so we need to preprocess request
   * and rearange some items to generate valid queries
   */
  preprocess(node) {
    if (node === undefined || node.args === undefined) {
      return node
    }

    node.args.forEach(item => {
      if (item instanceof Node) {
        this.preprocess(item)
      }
    })

    // try to rearrange items
    const l = []
    let nl = []
    node.args.forEach(item => {
      if (item.negated) {
        nl.push(item)
      } else {
        l.push(item)
      }
    })

    if (l.length === 0 && nl.length > 1) {
      /* invert node type if all children are negated */
      node.negated = !node.negated
      node.type = negateNodeType(node)
      negateNodes(node.args)
      return node
    } else if (nl.length > 1) {
      // merge multiple negated nodes into one, since NOT(A & B) = NOT(A) | NOT(B)
      negateNodes(nl)
      nl = [
        new Node({
          type: negateNodeType(node),
          parNode: node,
          negated: true,
          args: nl

        })
      ]
    }
    node.args = l.concat(nl)

    return node
  }

  parse(str) {
    this.input = str
    this.tok = undefined
    this.idx = 0

    this.nextToken()
    const o = this.parseOr()
    this.setParent(o, undefined)
    return this.preprocess(o)
  }

  parseOr() {
    let o = this.parseAnd()
    if (!o) {
      return undefined
    } else if (!this.match('or')) {
      return o
    }

    const l = [o]

    while (this.eat('or')) {
      o = this.parseAnd()
      if (!o) {
        break
      }
      l.push(o)
    }
    return new Node({
      type: 'or',
      args: l
    })
  }

  parseAnd() {
    let o = this.parseLit()
    if (!o) {
      return undefined
    }

    const l = [o]
    while (true) {
      this.eat('and') // optional 'and' keyword
      o = this.parseLit()
      if (!o) {
        break
      }
      l.push(o)
    }
    if (l.length === 1) {
      return l[0]
    }

    return new Node({
      type: 'and',
      args: l
    })
  }

  parseLit() {
    let o = this.tok
    let negated = false
    let star = false

    if (o === undefined) {
      return o
    }

    if (this.eat('not')) {
      if (this.tok === undefined) {
        return new Node({
          type: 'id',
          negated: false,
          value: o.value
        })
      }
      negated = true
      o = this.tok
    }

    if (this.eat('(')) {
      const n = this.parseOr()
      if (!this.eat(')') || n === undefined) {
        return undefined
      }
      n.negated = negated
      return n
    }
    if (['and', 'or', '(', ')'].indexOf(o.type) >= 0) {
      return undefined
    }

    this.nextToken()
    if (this.eat('*')) {
      star = true
    }

    return new Node({
      type: 'id',
      negated,
      star,
      value: o.value
    })
  }
}
