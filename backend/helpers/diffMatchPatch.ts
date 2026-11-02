/**
 * Diff Match and Patch
 * Copyright 2018 The diff-match-patch Authors.
 * https://github.com/google/diff-match-patch
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Original JavaScript implementation by Neil Fraser (fraser@google.com).
 *
 * Modified for Wiki.js: ported to TypeScript and cut down to reading and applying a patch in its
 * text form (`patch_fromText`, `patch_apply` and what they call), with the default settings made
 * constants. The algorithms are unchanged. Upstream is archived, and the `diff-match-patch` npm
 * package that wrapped it has not been updated since 2019, so this is kept here instead.
 */

/**
 * What one tuple of a diff does with its text. `[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'],
 * [DIFF_EQUAL, ' world.']` deletes 'Hello', adds 'Goodbye' and keeps ' world.'.
 */
const DIFF_DELETE = -1
const DIFF_INSERT = 1
const DIFF_EQUAL = 0

type DiffOp = typeof DIFF_DELETE | typeof DIFF_INSERT | typeof DIFF_EQUAL
type Diff = [DiffOp, string]

/** Seconds to map a diff before giving up. */
const DIFF_TIMEOUT = 1.0
/** At what point no match is declared (0.0 = perfection, 1.0 = very loose). */
const MATCH_THRESHOLD = 0.5
/**
 * How far to search for a match: a match this many characters away from the expected location adds
 * 1.0 to its score (0.0 is a perfect match).
 */
const MATCH_DISTANCE = 1000
/**
 * When deleting a large block of text (over ~64 characters), how close the contents have to be to
 * the expected ones (0.0 = perfection, 1.0 = very loose).
 */
const PATCH_DELETE_THRESHOLD = 0.5
/** Chunk size for context length. */
const PATCH_MARGIN = 4
/** The number of bits in an int. */
const MATCH_MAX_BITS = 32

/** One patch operation. */
export class Patch {
  diffs: Diff[] = []
  start1 = 0
  start2 = 0
  length1 = 0
  length2 = 0
}

// ---------------------------------------------------------------------------
// DIFF
// ---------------------------------------------------------------------------

/**
 * Find the differences between two texts. Simplifies the problem by stripping any common prefix or
 * suffix off the texts before diffing.
 *
 * @param checklines If false, don't run a line-level diff first to identify the changed areas. True
 *   is faster and slightly less optimal.
 * @param deadline Time (ms since the epoch) the diff should be complete by. Used for recursive calls.
 */
function diffMain(text1: string, text2: string, checklines = true, deadline?: number): Diff[] {
  // Set a deadline by which time the diff must be complete.
  deadline ??= Date.now() + DIFF_TIMEOUT * 1000

  // Check for equality (speedup).
  if (text1 === text2) {
    return text1 ? [[DIFF_EQUAL, text1]] : []
  }

  // Trim off common prefix (speedup).
  let commonlength = diffCommonPrefix(text1, text2)
  const commonprefix = text1.substring(0, commonlength)
  text1 = text1.substring(commonlength)
  text2 = text2.substring(commonlength)

  // Trim off common suffix (speedup).
  commonlength = diffCommonSuffix(text1, text2)
  const commonsuffix = text1.substring(text1.length - commonlength)
  text1 = text1.substring(0, text1.length - commonlength)
  text2 = text2.substring(0, text2.length - commonlength)

  // Compute the diff on the middle block.
  const diffs = diffCompute(text1, text2, checklines, deadline)

  // Restore the prefix and suffix.
  if (commonprefix) {
    diffs.unshift([DIFF_EQUAL, commonprefix])
  }
  if (commonsuffix) {
    diffs.push([DIFF_EQUAL, commonsuffix])
  }
  diffCleanupMerge(diffs)
  return diffs
}

/**
 * Find the differences between two texts. Assumes that the texts do not have any common prefix or
 * suffix.
 */
function diffCompute(text1: string, text2: string, checklines: boolean, deadline: number): Diff[] {
  if (!text1) {
    // Just add some text (speedup).
    return [[DIFF_INSERT, text2]]
  }

  if (!text2) {
    // Just delete some text (speedup).
    return [[DIFF_DELETE, text1]]
  }

  const longtext = text1.length > text2.length ? text1 : text2
  const shorttext = text1.length > text2.length ? text2 : text1
  const i = longtext.indexOf(shorttext)
  if (i !== -1) {
    // Shorter text is inside the longer text (speedup).
    const diffs: Diff[] = [
      [DIFF_INSERT, longtext.substring(0, i)],
      [DIFF_EQUAL, shorttext],
      [DIFF_INSERT, longtext.substring(i + shorttext.length)]
    ]
    // Swap insertions for deletions if diff is reversed.
    if (text1.length > text2.length) {
      diffs[0][0] = diffs[2][0] = DIFF_DELETE
    }
    return diffs
  }

  if (shorttext.length === 1) {
    // Single character string.
    // After the previous speedup, the character can't be an equality.
    return [
      [DIFF_DELETE, text1],
      [DIFF_INSERT, text2]
    ]
  }

  // Check to see if the problem can be split in two.
  const hm = diffHalfMatch(text1, text2)
  if (hm) {
    // A half-match was found, sort out the return data.
    const [text1A, text1B, text2A, text2B, midCommon] = hm
    // Send both pairs off for separate processing.
    const diffsA = diffMain(text1A, text2A, checklines, deadline)
    const diffsB = diffMain(text1B, text2B, checklines, deadline)
    // Merge the results.
    return diffsA.concat([[DIFF_EQUAL, midCommon]], diffsB)
  }

  if (checklines && text1.length > 100 && text2.length > 100) {
    return diffLineMode(text1, text2, deadline)
  }

  return diffBisect(text1, text2, deadline)
}

/**
 * Do a quick line-level diff on both strings, then rediff the parts for greater accuracy. This
 * speedup can produce non-minimal diffs.
 */
function diffLineMode(text1: string, text2: string, deadline: number): Diff[] {
  // Scan the text on a line-by-line basis first.
  const a = diffLinesToChars(text1, text2)
  text1 = a.chars1
  text2 = a.chars2
  const linearray = a.lineArray

  const diffs = diffMain(text1, text2, false, deadline)

  // Convert the diff back to original text.
  diffCharsToLines(diffs, linearray)
  // Eliminate freak matches (e.g. blank lines)
  diffCleanupSemantic(diffs)

  // Rediff any replacement blocks, this time character-by-character.
  // Add a dummy entry at the end.
  diffs.push([DIFF_EQUAL, ''])
  let pointer = 0
  let countDelete = 0
  let countInsert = 0
  let textDelete = ''
  let textInsert = ''
  while (pointer < diffs.length) {
    switch (diffs[pointer][0]) {
      case DIFF_INSERT:
        countInsert++
        textInsert += diffs[pointer][1]
        break
      case DIFF_DELETE:
        countDelete++
        textDelete += diffs[pointer][1]
        break
      case DIFF_EQUAL:
        // Upon reaching an equality, check for prior redundancies.
        if (countDelete >= 1 && countInsert >= 1) {
          // Delete the offending records and add the merged ones.
          diffs.splice(pointer - countDelete - countInsert, countDelete + countInsert)
          pointer = pointer - countDelete - countInsert
          const subDiff = diffMain(textDelete, textInsert, false, deadline)
          for (let j = subDiff.length - 1; j >= 0; j--) {
            diffs.splice(pointer, 0, subDiff[j])
          }
          pointer = pointer + subDiff.length
        }
        countInsert = 0
        countDelete = 0
        textDelete = ''
        textInsert = ''
        break
    }
    pointer++
  }
  diffs.pop() // Remove the dummy entry at the end.

  return diffs
}

/**
 * Find the 'middle snake' of a diff, split the problem in two and return the recursively
 * constructed diff. See Myers 1986 paper: An O(ND) Difference Algorithm and Its Variations.
 */
function diffBisect(text1: string, text2: string, deadline: number): Diff[] {
  // Cache the text lengths to prevent multiple calls.
  const text1Length = text1.length
  const text2Length = text2.length
  const maxD = Math.ceil((text1Length + text2Length) / 2)
  const vOffset = maxD
  const vLength = 2 * maxD
  // Setting all elements to -1 is faster than mixing integers and undefined.
  const v1 = Array.from({ length: vLength }, () => -1)
  const v2 = Array.from({ length: vLength }, () => -1)
  v1[vOffset + 1] = 0
  v2[vOffset + 1] = 0
  const delta = text1Length - text2Length
  // If the total number of characters is odd, then the front path will collide with the reverse
  // path.
  const front = delta % 2 !== 0
  // Offsets for start and end of k loop. Prevents mapping of space beyond the grid.
  let k1start = 0
  let k1end = 0
  let k2start = 0
  let k2end = 0
  for (let d = 0; d < maxD; d++) {
    // Bail out if deadline is reached.
    if (Date.now() > deadline) {
      break
    }

    // Walk the front path one step.
    for (let k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
      const k1Offset = vOffset + k1
      let x1: number
      if (k1 === -d || (k1 !== d && v1[k1Offset - 1] < v1[k1Offset + 1])) {
        x1 = v1[k1Offset + 1]
      } else {
        x1 = v1[k1Offset - 1] + 1
      }
      let y1 = x1 - k1
      while (x1 < text1Length && y1 < text2Length && text1.charAt(x1) === text2.charAt(y1)) {
        x1++
        y1++
      }
      v1[k1Offset] = x1
      if (x1 > text1Length) {
        // Ran off the right of the graph.
        k1end += 2
      } else if (y1 > text2Length) {
        // Ran off the bottom of the graph.
        k1start += 2
      } else if (front) {
        const k2Offset = vOffset + delta - k1
        if (k2Offset >= 0 && k2Offset < vLength && v2[k2Offset] !== -1) {
          // Mirror x2 onto top-left coordinate system.
          const x2 = text1Length - v2[k2Offset]
          if (x1 >= x2) {
            // Overlap detected.
            return diffBisectSplit(text1, text2, x1, y1, deadline)
          }
        }
      }
    }

    // Walk the reverse path one step.
    for (let k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
      const k2Offset = vOffset + k2
      let x2: number
      if (k2 === -d || (k2 !== d && v2[k2Offset - 1] < v2[k2Offset + 1])) {
        x2 = v2[k2Offset + 1]
      } else {
        x2 = v2[k2Offset - 1] + 1
      }
      let y2 = x2 - k2
      while (
        x2 < text1Length &&
        y2 < text2Length &&
        text1.charAt(text1Length - x2 - 1) === text2.charAt(text2Length - y2 - 1)
      ) {
        x2++
        y2++
      }
      v2[k2Offset] = x2
      if (x2 > text1Length) {
        // Ran off the left of the graph.
        k2end += 2
      } else if (y2 > text2Length) {
        // Ran off the top of the graph.
        k2start += 2
      } else if (!front) {
        const k1Offset = vOffset + delta - k2
        if (k1Offset >= 0 && k1Offset < vLength && v1[k1Offset] !== -1) {
          const x1 = v1[k1Offset]
          const y1 = vOffset + x1 - k1Offset
          // Mirror x2 onto top-left coordinate system.
          x2 = text1Length - x2
          if (x1 >= x2) {
            // Overlap detected.
            return diffBisectSplit(text1, text2, x1, y1, deadline)
          }
        }
      }
    }
  }
  // Diff took too long and hit the deadline or number of diffs equals number of characters, no
  // commonality at all.
  return [
    [DIFF_DELETE, text1],
    [DIFF_INSERT, text2]
  ]
}

/** Given the location of the 'middle snake', split the diff in two parts and recurse. */
function diffBisectSplit(
  text1: string,
  text2: string,
  x: number,
  y: number,
  deadline: number
): Diff[] {
  const text1a = text1.substring(0, x)
  const text2a = text2.substring(0, y)
  const text1b = text1.substring(x)
  const text2b = text2.substring(y)

  // Compute both diffs serially.
  const diffs = diffMain(text1a, text2a, false, deadline)
  const diffsb = diffMain(text1b, text2b, false, deadline)

  return diffs.concat(diffsb)
}

/**
 * Split two texts into an array of strings. Reduce the texts to a string of hashes where each
 * Unicode character represents one line. The zeroth element of `lineArray` is intentionally blank.
 */
function diffLinesToChars(
  text1: string,
  text2: string
): { chars1: string; chars2: string; lineArray: string[] } {
  const lineArray: string[] = [] // e.g. lineArray[4] == 'Hello\n'
  const lineHash = new Map<string, number>() // e.g. lineHash['Hello\n'] == 4

  // '\x00' is a valid character, but various debuggers don't like it.
  // So we'll insert a junk entry to avoid generating a null character.
  lineArray[0] = ''

  // Allocate 2/3rds of the space for text1, the rest for text2.
  let maxLines = 40000

  /**
   * Split a text into an array of strings. Reduce the texts to a string of hashes where each Unicode
   * character represents one line. Modifies lineArray and lineHash through being a closure.
   */
  function munge(text: string): string {
    let chars = ''
    // Walk the text, pulling out a substring for each line.
    // text.split('\n') would would temporarily double our memory footprint.
    // Modifying text would create many large strings to garbage collect.
    let lineStart = 0
    let lineEnd = -1
    // Keeping our own length variable is faster than looking it up.
    let lineArrayLength = lineArray.length
    while (lineEnd < text.length - 1) {
      lineEnd = text.indexOf('\n', lineStart)
      if (lineEnd === -1) {
        lineEnd = text.length - 1
      }
      let line = text.substring(lineStart, lineEnd + 1)

      const hash = lineHash.get(line)
      if (hash !== undefined) {
        chars += String.fromCharCode(hash)
      } else {
        if (lineArrayLength === maxLines) {
          // Bail out at 65535 because
          // String.fromCharCode(65536) == String.fromCharCode(0)
          line = text.substring(lineStart)
          lineEnd = text.length
        }
        chars += String.fromCharCode(lineArrayLength)
        lineHash.set(line, lineArrayLength)
        lineArray[lineArrayLength++] = line
      }
      lineStart = lineEnd + 1
    }
    return chars
  }

  const chars1 = munge(text1)
  maxLines = 65535
  const chars2 = munge(text2)
  return { chars1, chars2, lineArray }
}

/** Rehydrate the text in a diff from a string of line hashes to real lines of text. */
function diffCharsToLines(diffs: Diff[], lineArray: string[]): void {
  for (const diff of diffs) {
    const chars = diff[1]
    const text: string[] = []
    for (let j = 0; j < chars.length; j++) {
      text[j] = lineArray[chars.charCodeAt(j)]
    }
    diff[1] = text.join('')
  }
}

/** The number of characters common to the start of each string. */
function diffCommonPrefix(text1: string, text2: string): number {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1.charAt(0) !== text2.charAt(0)) {
    return 0
  }
  // Binary search.
  // Performance analysis: https://neil.fraser.name/news/2007/10/09/
  let pointermin = 0
  let pointermax = Math.min(text1.length, text2.length)
  let pointermid = pointermax
  let pointerstart = 0
  while (pointermin < pointermid) {
    if (text1.substring(pointerstart, pointermid) === text2.substring(pointerstart, pointermid)) {
      pointermin = pointermid
      pointerstart = pointermin
    } else {
      pointermax = pointermid
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin)
  }
  return pointermid
}

/** The number of characters common to the end of each string. */
function diffCommonSuffix(text1: string, text2: string): number {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1.charAt(text1.length - 1) !== text2.charAt(text2.length - 1)) {
    return 0
  }
  // Binary search.
  // Performance analysis: https://neil.fraser.name/news/2007/10/09/
  let pointermin = 0
  let pointermax = Math.min(text1.length, text2.length)
  let pointermid = pointermax
  let pointerend = 0
  while (pointermin < pointermid) {
    if (
      text1.substring(text1.length - pointermid, text1.length - pointerend) ===
      text2.substring(text2.length - pointermid, text2.length - pointerend)
    ) {
      pointermin = pointermid
      pointerend = pointermin
    } else {
      pointermax = pointermid
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin)
  }
  return pointermid
}

/** The number of characters common to the end of the first string and the start of the second. */
function diffCommonOverlap(text1: string, text2: string): number {
  // Cache the text lengths to prevent multiple calls.
  const text1Length = text1.length
  const text2Length = text2.length
  // Eliminate the null case.
  if (text1Length === 0 || text2Length === 0) {
    return 0
  }
  // Truncate the longer string.
  if (text1Length > text2Length) {
    text1 = text1.substring(text1Length - text2Length)
  } else if (text1Length < text2Length) {
    text2 = text2.substring(0, text1Length)
  }
  const textLength = Math.min(text1Length, text2Length)
  // Quick check for the worst case.
  if (text1 === text2) {
    return textLength
  }

  // Start by looking for a single character match and increase length until no match is found.
  // Performance analysis: https://neil.fraser.name/news/2010/11/04/
  let best = 0
  let length = 1
  for (;;) {
    const pattern = text1.substring(textLength - length)
    const found = text2.indexOf(pattern)
    if (found === -1) {
      return best
    }
    length += found
    if (found === 0 || text1.substring(textLength - length) === text2.substring(0, length)) {
      best = length
      length++
    }
  }
}

type HalfMatch = [string, string, string, string, string]

/**
 * Do the two texts share a substring which is at least half the length of the longer text? This
 * speedup can produce non-minimal diffs.
 *
 * @returns The prefix of text1, the suffix of text1, the prefix of text2, the suffix of text2 and the
 *   common middle, or null if there was no match.
 */
function diffHalfMatch(text1: string, text2: string): HalfMatch | null {
  const longtext = text1.length > text2.length ? text1 : text2
  const shorttext = text1.length > text2.length ? text2 : text1
  if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
    return null // Pointless.
  }

  /**
   * Does a substring of shorttext exist within longtext such that the substring is at least half the
   * length of longtext?
   *
   * @param i Start index of quarter length substring within longtext.
   * @returns The prefix of longtext, the suffix of longtext, the prefix of shorttext, the suffix of
   *   shorttext and the common middle, or null if there was no match.
   */
  function halfMatchI(longtext: string, shorttext: string, i: number): HalfMatch | null {
    // Start with a 1/4 length substring at position i as a seed.
    const seed = longtext.substring(i, i + Math.floor(longtext.length / 4))
    let j = -1
    let bestCommon = ''
    let bestLongtextA = ''
    let bestLongtextB = ''
    let bestShorttextA = ''
    let bestShorttextB = ''
    while ((j = shorttext.indexOf(seed, j + 1)) !== -1) {
      const prefixLength = diffCommonPrefix(longtext.substring(i), shorttext.substring(j))
      const suffixLength = diffCommonSuffix(longtext.substring(0, i), shorttext.substring(0, j))
      if (bestCommon.length < suffixLength + prefixLength) {
        bestCommon =
          shorttext.substring(j - suffixLength, j) + shorttext.substring(j, j + prefixLength)
        bestLongtextA = longtext.substring(0, i - suffixLength)
        bestLongtextB = longtext.substring(i + prefixLength)
        bestShorttextA = shorttext.substring(0, j - suffixLength)
        bestShorttextB = shorttext.substring(j + prefixLength)
      }
    }
    if (bestCommon.length * 2 >= longtext.length) {
      return [bestLongtextA, bestLongtextB, bestShorttextA, bestShorttextB, bestCommon]
    }
    return null
  }

  // First check if the second quarter is the seed for a half-match.
  const hm1 = halfMatchI(longtext, shorttext, Math.ceil(longtext.length / 4))
  // Check again based on the third quarter.
  const hm2 = halfMatchI(longtext, shorttext, Math.ceil(longtext.length / 2))
  let hm: HalfMatch
  if (!hm1 && !hm2) {
    return null
  } else if (!hm2) {
    hm = hm1!
  } else if (!hm1) {
    hm = hm2
  } else {
    // Both matched. Select the longest.
    hm = hm1[4].length > hm2[4].length ? hm1 : hm2
  }

  // A half-match was found, sort out the return data.
  if (text1.length > text2.length) {
    return [hm[0], hm[1], hm[2], hm[3], hm[4]]
  }
  return [hm[2], hm[3], hm[0], hm[1], hm[4]]
}

/** Reduce the number of edits by eliminating semantically trivial equalities. */
function diffCleanupSemantic(diffs: Diff[]): void {
  let changes = false
  const equalities: number[] = [] // Stack of indices where equalities are found.
  let equalitiesLength = 0 // Keeping our own length var is faster in JS.
  let lastEquality: string | null = null
  // Always equal to diffs[equalities[equalitiesLength - 1]][1]
  let pointer = 0 // Index of current position.
  // Number of characters that changed prior to the equality.
  let lengthInsertions1 = 0
  let lengthDeletions1 = 0
  // Number of characters that changed after the equality.
  let lengthInsertions2 = 0
  let lengthDeletions2 = 0
  while (pointer < diffs.length) {
    if (diffs[pointer][0] === DIFF_EQUAL) {
      // Equality found.
      equalities[equalitiesLength++] = pointer
      lengthInsertions1 = lengthInsertions2
      lengthDeletions1 = lengthDeletions2
      lengthInsertions2 = 0
      lengthDeletions2 = 0
      lastEquality = diffs[pointer][1]
    } else {
      // An insertion or deletion.
      if (diffs[pointer][0] === DIFF_INSERT) {
        lengthInsertions2 += diffs[pointer][1].length
      } else {
        lengthDeletions2 += diffs[pointer][1].length
      }
      // Eliminate an equality that is smaller or equal to the edits on both sides of it.
      if (
        lastEquality &&
        lastEquality.length <= Math.max(lengthInsertions1, lengthDeletions1) &&
        lastEquality.length <= Math.max(lengthInsertions2, lengthDeletions2)
      ) {
        // Duplicate record.
        diffs.splice(equalities[equalitiesLength - 1], 0, [DIFF_DELETE, lastEquality])
        // Change second copy to insert.
        diffs[equalities[equalitiesLength - 1] + 1][0] = DIFF_INSERT
        // Throw away the equality we just deleted.
        equalitiesLength--
        // Throw away the previous equality (it needs to be reevaluated).
        equalitiesLength--
        pointer = equalitiesLength > 0 ? equalities[equalitiesLength - 1] : -1
        lengthInsertions1 = 0 // Reset the counters.
        lengthDeletions1 = 0
        lengthInsertions2 = 0
        lengthDeletions2 = 0
        lastEquality = null
        changes = true
      }
    }
    pointer++
  }

  // Normalize the diff.
  if (changes) {
    diffCleanupMerge(diffs)
  }
  diffCleanupSemanticLossless(diffs)

  // Find any overlaps between deletions and insertions.
  // e.g: <del>abcxxx</del><ins>xxxdef</ins>
  //   -> <del>abc</del>xxx<ins>def</ins>
  // e.g: <del>xxxabc</del><ins>defxxx</ins>
  //   -> <ins>def</ins>xxx<del>abc</del>
  // Only extract an overlap if it is as big as the edit ahead or behind it.
  pointer = 1
  while (pointer < diffs.length) {
    if (diffs[pointer - 1][0] === DIFF_DELETE && diffs[pointer][0] === DIFF_INSERT) {
      const deletion = diffs[pointer - 1][1]
      const insertion = diffs[pointer][1]
      const overlapLength1 = diffCommonOverlap(deletion, insertion)
      const overlapLength2 = diffCommonOverlap(insertion, deletion)
      if (overlapLength1 >= overlapLength2) {
        if (overlapLength1 >= deletion.length / 2 || overlapLength1 >= insertion.length / 2) {
          // Overlap found. Insert an equality and trim the surrounding edits.
          diffs.splice(pointer, 0, [DIFF_EQUAL, insertion.substring(0, overlapLength1)])
          diffs[pointer - 1][1] = deletion.substring(0, deletion.length - overlapLength1)
          diffs[pointer + 1][1] = insertion.substring(overlapLength1)
          pointer++
        }
      } else if (overlapLength2 >= deletion.length / 2 || overlapLength2 >= insertion.length / 2) {
        // Reverse overlap found.
        // Insert an equality and swap and trim the surrounding edits.
        diffs.splice(pointer, 0, [DIFF_EQUAL, deletion.substring(0, overlapLength2)])
        diffs[pointer - 1][0] = DIFF_INSERT
        diffs[pointer - 1][1] = insertion.substring(0, insertion.length - overlapLength2)
        diffs[pointer + 1][0] = DIFF_DELETE
        diffs[pointer + 1][1] = deletion.substring(overlapLength2)
        pointer++
      }
      pointer++
    }
    pointer++
  }
}

// Define some regex patterns for matching boundaries.
const NON_ALPHANUMERIC_REGEX = /[^a-zA-Z0-9]/
const WHITESPACE_REGEX = /\s/
const LINEBREAK_REGEX = /[\r\n]/
const BLANKLINE_END_REGEX = /\n\r?\n$/
const BLANKLINE_START_REGEX = /^\r?\n\r?\n/

/**
 * Given two strings, compute a score representing whether the internal boundary falls on logical
 * boundaries. Scores range from 6 (best) to 0 (worst).
 */
function diffCleanupSemanticScore(one: string, two: string): number {
  if (!one || !two) {
    // Edges are the best.
    return 6
  }

  // Each port of this function behaves slightly differently due to subtle differences in each
  // language's definition of things like 'whitespace'. Since this function's purpose is largely
  // cosmetic, the choice has been made to use each language's native features rather than force
  // total conformity.
  const char1 = one.charAt(one.length - 1)
  const char2 = two.charAt(0)
  const nonAlphaNumeric1 = NON_ALPHANUMERIC_REGEX.test(char1)
  const nonAlphaNumeric2 = NON_ALPHANUMERIC_REGEX.test(char2)
  const whitespace1 = nonAlphaNumeric1 && WHITESPACE_REGEX.test(char1)
  const whitespace2 = nonAlphaNumeric2 && WHITESPACE_REGEX.test(char2)
  const lineBreak1 = whitespace1 && LINEBREAK_REGEX.test(char1)
  const lineBreak2 = whitespace2 && LINEBREAK_REGEX.test(char2)
  const blankLine1 = lineBreak1 && BLANKLINE_END_REGEX.test(one)
  const blankLine2 = lineBreak2 && BLANKLINE_START_REGEX.test(two)

  if (blankLine1 || blankLine2) {
    // Five points for blank lines.
    return 5
  } else if (lineBreak1 || lineBreak2) {
    // Four points for line breaks.
    return 4
  } else if (nonAlphaNumeric1 && !whitespace1 && whitespace2) {
    // Three points for end of sentences.
    return 3
  } else if (whitespace1 || whitespace2) {
    // Two points for whitespace.
    return 2
  } else if (nonAlphaNumeric1 || nonAlphaNumeric2) {
    // One point for non-alphanumeric.
    return 1
  }
  return 0
}

/**
 * Look for single edits surrounded on both sides by equalities which can be shifted sideways to
 * align the edit to a word boundary. e.g: The c<ins>at c</ins>ame. -> The <ins>cat </ins>came.
 */
function diffCleanupSemanticLossless(diffs: Diff[]): void {
  let pointer = 1
  // Intentionally ignore the first and last element (don't need checking).
  while (pointer < diffs.length - 1) {
    if (diffs[pointer - 1][0] === DIFF_EQUAL && diffs[pointer + 1][0] === DIFF_EQUAL) {
      // This is a single edit surrounded by equalities.
      let equality1 = diffs[pointer - 1][1]
      let edit = diffs[pointer][1]
      let equality2 = diffs[pointer + 1][1]

      // First, shift the edit as far left as possible.
      const commonOffset = diffCommonSuffix(equality1, edit)
      if (commonOffset) {
        const commonString = edit.substring(edit.length - commonOffset)
        equality1 = equality1.substring(0, equality1.length - commonOffset)
        edit = commonString + edit.substring(0, edit.length - commonOffset)
        equality2 = commonString + equality2
      }

      // Second, step character by character right, looking for the best fit.
      let bestEquality1 = equality1
      let bestEdit = edit
      let bestEquality2 = equality2
      let bestScore =
        diffCleanupSemanticScore(equality1, edit) + diffCleanupSemanticScore(edit, equality2)
      while (edit.charAt(0) === equality2.charAt(0)) {
        equality1 += edit.charAt(0)
        edit = edit.substring(1) + equality2.charAt(0)
        equality2 = equality2.substring(1)
        const score =
          diffCleanupSemanticScore(equality1, edit) + diffCleanupSemanticScore(edit, equality2)
        // The >= encourages trailing rather than leading whitespace on edits.
        if (score >= bestScore) {
          bestScore = score
          bestEquality1 = equality1
          bestEdit = edit
          bestEquality2 = equality2
        }
      }

      if (diffs[pointer - 1][1] !== bestEquality1) {
        // We have an improvement, save it back to the diff.
        if (bestEquality1) {
          diffs[pointer - 1][1] = bestEquality1
        } else {
          diffs.splice(pointer - 1, 1)
          pointer--
        }
        diffs[pointer][1] = bestEdit
        if (bestEquality2) {
          diffs[pointer + 1][1] = bestEquality2
        } else {
          diffs.splice(pointer + 1, 1)
          pointer--
        }
      }
    }
    pointer++
  }
}

/**
 * Reorder and merge like edit sections. Merge equalities. Any edit section can move as long as it
 * doesn't cross an equality.
 */
function diffCleanupMerge(diffs: Diff[]): void {
  // Add a dummy entry at the end.
  diffs.push([DIFF_EQUAL, ''])
  let pointer = 0
  let countDelete = 0
  let countInsert = 0
  let textDelete = ''
  let textInsert = ''
  let commonlength: number
  while (pointer < diffs.length) {
    switch (diffs[pointer][0]) {
      case DIFF_INSERT:
        countInsert++
        textInsert += diffs[pointer][1]
        pointer++
        break
      case DIFF_DELETE:
        countDelete++
        textDelete += diffs[pointer][1]
        pointer++
        break
      case DIFF_EQUAL:
        // Upon reaching an equality, check for prior redundancies.
        if (countDelete + countInsert > 1) {
          if (countDelete !== 0 && countInsert !== 0) {
            // Factor out any common prefixies.
            commonlength = diffCommonPrefix(textInsert, textDelete)
            if (commonlength !== 0) {
              if (
                pointer - countDelete - countInsert > 0 &&
                diffs[pointer - countDelete - countInsert - 1][0] === DIFF_EQUAL
              ) {
                diffs[pointer - countDelete - countInsert - 1][1] += textInsert.substring(
                  0,
                  commonlength
                )
              } else {
                diffs.splice(0, 0, [DIFF_EQUAL, textInsert.substring(0, commonlength)])
                pointer++
              }
              textInsert = textInsert.substring(commonlength)
              textDelete = textDelete.substring(commonlength)
            }
            // Factor out any common suffixies.
            commonlength = diffCommonSuffix(textInsert, textDelete)
            if (commonlength !== 0) {
              diffs[pointer][1] =
                textInsert.substring(textInsert.length - commonlength) + diffs[pointer][1]
              textInsert = textInsert.substring(0, textInsert.length - commonlength)
              textDelete = textDelete.substring(0, textDelete.length - commonlength)
            }
          }
          // Delete the offending records and add the merged ones.
          pointer -= countDelete + countInsert
          diffs.splice(pointer, countDelete + countInsert)
          if (textDelete.length) {
            diffs.splice(pointer, 0, [DIFF_DELETE, textDelete])
            pointer++
          }
          if (textInsert.length) {
            diffs.splice(pointer, 0, [DIFF_INSERT, textInsert])
            pointer++
          }
          pointer++
        } else if (pointer !== 0 && diffs[pointer - 1][0] === DIFF_EQUAL) {
          // Merge this equality with the previous one.
          diffs[pointer - 1][1] += diffs[pointer][1]
          diffs.splice(pointer, 1)
        } else {
          pointer++
        }
        countInsert = 0
        countDelete = 0
        textDelete = ''
        textInsert = ''
        break
    }
  }
  if (diffs[diffs.length - 1][1] === '') {
    diffs.pop() // Remove the dummy entry at the end.
  }

  // Second pass: look for single edits surrounded on both sides by equalities which can be shifted
  // sideways to eliminate an equality. e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC
  let changes = false
  pointer = 1
  // Intentionally ignore the first and last element (don't need checking).
  while (pointer < diffs.length - 1) {
    if (diffs[pointer - 1][0] === DIFF_EQUAL && diffs[pointer + 1][0] === DIFF_EQUAL) {
      // This is a single edit surrounded by equalities.
      if (
        diffs[pointer][1].substring(diffs[pointer][1].length - diffs[pointer - 1][1].length) ===
        diffs[pointer - 1][1]
      ) {
        // Shift the edit over the previous equality.
        diffs[pointer][1] =
          diffs[pointer - 1][1] +
          diffs[pointer][1].substring(0, diffs[pointer][1].length - diffs[pointer - 1][1].length)
        diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1]
        diffs.splice(pointer - 1, 1)
        changes = true
      } else if (
        diffs[pointer][1].substring(0, diffs[pointer + 1][1].length) === diffs[pointer + 1][1]
      ) {
        // Shift the edit over the next equality.
        diffs[pointer - 1][1] += diffs[pointer + 1][1]
        diffs[pointer][1] =
          diffs[pointer][1].substring(diffs[pointer + 1][1].length) + diffs[pointer + 1][1]
        diffs.splice(pointer + 1, 1)
        changes = true
      }
    }
    pointer++
  }
  // If shifts were made, the diff needs reordering and another shift sweep.
  if (changes) {
    diffCleanupMerge(diffs)
  }
}

/**
 * `loc` is a location in text1, compute and return the equivalent location in text2.
 * e.g. 'The cat' vs 'The big cat', 1->1, 5->8
 */
function diffXIndex(diffs: Diff[], loc: number): number {
  let chars1 = 0
  let chars2 = 0
  let lastChars1 = 0
  let lastChars2 = 0
  let x: number
  for (x = 0; x < diffs.length; x++) {
    if (diffs[x][0] !== DIFF_INSERT) {
      // Equality or deletion.
      chars1 += diffs[x][1].length
    }
    if (diffs[x][0] !== DIFF_DELETE) {
      // Equality or insertion.
      chars2 += diffs[x][1].length
    }
    if (chars1 > loc) {
      // Overshot the location.
      break
    }
    lastChars1 = chars1
    lastChars2 = chars2
  }
  // Was the location was deleted?
  if (diffs.length !== x && diffs[x][0] === DIFF_DELETE) {
    return lastChars2
  }
  // Add the remaining character length.
  return lastChars2 + (loc - lastChars1)
}

/** The source text (all equalities and deletions). */
function diffText1(diffs: Diff[]): string {
  return diffs
    .filter((diff) => diff[0] !== DIFF_INSERT)
    .map((diff) => diff[1])
    .join('')
}

/** The destination text (all equalities and insertions). */
function diffText2(diffs: Diff[]): string {
  return diffs
    .filter((diff) => diff[0] !== DIFF_DELETE)
    .map((diff) => diff[1])
    .join('')
}

/** The Levenshtein distance: the number of inserted, deleted or substituted characters. */
function diffLevenshtein(diffs: Diff[]): number {
  let levenshtein = 0
  let insertions = 0
  let deletions = 0
  for (const [op, data] of diffs) {
    switch (op) {
      case DIFF_INSERT:
        insertions += data.length
        break
      case DIFF_DELETE:
        deletions += data.length
        break
      case DIFF_EQUAL:
        // A deletion and an insertion is one substitution.
        levenshtein += Math.max(insertions, deletions)
        insertions = 0
        deletions = 0
        break
    }
  }
  levenshtein += Math.max(insertions, deletions)
  return levenshtein
}

// ---------------------------------------------------------------------------
// MATCH
// ---------------------------------------------------------------------------

/**
 * Locate the best instance of `pattern` in `text` near `loc`.
 *
 * @returns Best match index or -1.
 */
function matchMain(text: string, pattern: string, loc: number): number {
  loc = Math.max(0, Math.min(loc, text.length))
  if (text === pattern) {
    // Shortcut (potentially not guaranteed by the algorithm)
    return 0
  } else if (!text.length) {
    // Nothing to match.
    return -1
  } else if (text.substring(loc, loc + pattern.length) === pattern) {
    // Perfect match at the perfect spot! (Includes case of null pattern)
    return loc
  }
  // Do a fuzzy compare.
  return matchBitap(text, pattern, loc)
}

/**
 * Locate the best instance of `pattern` in `text` near `loc` using the Bitap algorithm.
 *
 * @returns Best match index or -1.
 */
function matchBitap(text: string, pattern: string, loc: number): number {
  if (pattern.length > MATCH_MAX_BITS) {
    throw new Error('Pattern too long for this browser.')
  }

  // Initialise the alphabet.
  const s = matchAlphabet(pattern)

  /**
   * Compute and return the score for a match with `e` errors and `x` location (0.0 = good, 1.0 =
   * bad). Accesses loc and pattern through being a closure.
   */
  function matchBitapScore(e: number, x: number): number {
    const accuracy = e / pattern.length
    const proximity = Math.abs(loc - x)
    return accuracy + proximity / MATCH_DISTANCE
  }

  // Highest score beyond which we give up.
  let scoreThreshold = MATCH_THRESHOLD
  // Is there a nearby exact match? (speedup)
  let bestLoc = text.indexOf(pattern, loc)
  if (bestLoc !== -1) {
    scoreThreshold = Math.min(matchBitapScore(0, bestLoc), scoreThreshold)
    // What about in the other direction? (speedup)
    bestLoc = text.lastIndexOf(pattern, loc + pattern.length)
    if (bestLoc !== -1) {
      scoreThreshold = Math.min(matchBitapScore(0, bestLoc), scoreThreshold)
    }
  }

  // Initialise the bit arrays.
  const matchmask = 1 << (pattern.length - 1)
  bestLoc = -1

  let binMin: number
  let binMid: number
  let binMax = pattern.length + text.length
  let lastRd: number[] = []
  for (let d = 0; d < pattern.length; d++) {
    // Scan for the best match; each iteration allows for one more error.
    // Run a binary search to determine how far from 'loc' we can stray at this error level.
    binMin = 0
    binMid = binMax
    while (binMin < binMid) {
      if (matchBitapScore(d, loc + binMid) <= scoreThreshold) {
        binMin = binMid
      } else {
        binMax = binMid
      }
      binMid = Math.floor((binMax - binMin) / 2 + binMin)
    }
    // Use the result from this iteration as the maximum for the next.
    binMax = binMid
    let start = Math.max(1, loc - binMid + 1)
    const finish = Math.min(loc + binMid, text.length) + pattern.length

    // -> Sparse as upstream has it: an unset entry is `undefined`, which a bitwise operator reads as 0
    const rd: number[] = []
    rd[finish + 1] = (1 << d) - 1
    for (let j = finish; j >= start; j--) {
      // The alphabet (s) is a sparse hash: a character not in the pattern matches nothing.
      const charMatch = s.get(text.charAt(j - 1)) ?? 0
      if (d === 0) {
        // First pass: exact match.
        rd[j] = ((rd[j + 1] << 1) | 1) & charMatch
      } else {
        // Subsequent passes: fuzzy match.
        rd[j] =
          (((rd[j + 1] << 1) | 1) & charMatch) |
          (((lastRd[j + 1] | lastRd[j]) << 1) | 1) |
          lastRd[j + 1]
      }
      if (rd[j] & matchmask) {
        const score = matchBitapScore(d, j - 1)
        // This match will almost certainly be better than any existing match. But check anyway.
        if (score <= scoreThreshold) {
          // Told you so.
          scoreThreshold = score
          bestLoc = j - 1
          if (bestLoc > loc) {
            // When passing loc, don't exceed our current distance from loc.
            start = Math.max(1, 2 * loc - bestLoc)
          } else {
            // Already passed loc, downhill from here on in.
            break
          }
        }
      }
    }
    // No hope for a (better) match at greater error levels.
    if (matchBitapScore(d + 1, loc) > scoreThreshold) {
      break
    }
    lastRd = rd
  }
  return bestLoc
}

/** Initialise the alphabet for the Bitap algorithm: each character's locations in `pattern`. */
function matchAlphabet(pattern: string): Map<string, number> {
  const s = new Map<string, number>()
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern.charAt(i)
    s.set(char, (s.get(char) ?? 0) | (1 << (pattern.length - i - 1)))
  }
  return s
}

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

/** A copy of an array of patches that shares nothing with it. */
function patchDeepCopy(patches: Patch[]): Patch[] {
  return patches.map((patch) => {
    const patchCopy = new Patch()
    patchCopy.diffs = patch.diffs.map((diff): Diff => [diff[0], diff[1]])
    patchCopy.start1 = patch.start1
    patchCopy.start2 = patch.start2
    patchCopy.length1 = patch.length1
    patchCopy.length2 = patch.length2
    return patchCopy
  })
}

/**
 * Merge a set of patches onto the text.
 *
 * @returns The patched text, and whether each patch could be applied.
 */
export function patchApply(patches: Patch[], text: string): [string, boolean[]] {
  if (patches.length === 0) {
    return [text, []]
  }

  // Deep copy the patches so that no changes are made to originals.
  patches = patchDeepCopy(patches)

  const nullPadding = patchAddPadding(patches)
  text = nullPadding + text + nullPadding

  patchSplitMax(patches)
  // delta keeps track of the offset between the expected and actual location of the previous patch.
  // If there are patches expected at positions 10 and 20, but the first patch was found at 12, delta
  // is 2 and the second patch has an effective expected position of 22.
  let delta = 0
  const results: boolean[] = []
  for (let x = 0; x < patches.length; x++) {
    const expectedLoc = patches[x].start2 + delta
    const text1 = diffText1(patches[x].diffs)
    let startLoc: number
    let endLoc = -1
    if (text1.length > MATCH_MAX_BITS) {
      // patchSplitMax will only provide an oversized pattern in the case of a monster delete.
      startLoc = matchMain(text, text1.substring(0, MATCH_MAX_BITS), expectedLoc)
      if (startLoc !== -1) {
        endLoc = matchMain(
          text,
          text1.substring(text1.length - MATCH_MAX_BITS),
          expectedLoc + text1.length - MATCH_MAX_BITS
        )
        if (endLoc === -1 || startLoc >= endLoc) {
          // Can't find valid trailing context. Drop this patch.
          startLoc = -1
        }
      }
    } else {
      startLoc = matchMain(text, text1, expectedLoc)
    }
    if (startLoc === -1) {
      // No match found. :(
      results[x] = false
      // Subtract the delta for this failed patch from subsequent patches.
      delta -= patches[x].length2 - patches[x].length1
    } else {
      // Found a match. :)
      results[x] = true
      delta = startLoc - expectedLoc
      let text2: string
      if (endLoc === -1) {
        text2 = text.substring(startLoc, startLoc + text1.length)
      } else {
        text2 = text.substring(startLoc, endLoc + MATCH_MAX_BITS)
      }
      if (text1 === text2) {
        // Perfect match, just shove the replacement text in.
        text =
          text.substring(0, startLoc) +
          diffText2(patches[x].diffs) +
          text.substring(startLoc + text1.length)
      } else {
        // Imperfect match. Run a diff to get a framework of equivalent indices.
        const diffs = diffMain(text1, text2, false)
        if (
          text1.length > MATCH_MAX_BITS &&
          diffLevenshtein(diffs) / text1.length > PATCH_DELETE_THRESHOLD
        ) {
          // The end points match, but the content is unacceptably bad.
          results[x] = false
        } else {
          diffCleanupSemanticLossless(diffs)
          let index1 = 0
          let index2 = 0
          for (const mod of patches[x].diffs) {
            if (mod[0] !== DIFF_EQUAL) {
              index2 = diffXIndex(diffs, index1)
            }
            if (mod[0] === DIFF_INSERT) {
              // Insertion
              text =
                text.substring(0, startLoc + index2) + mod[1] + text.substring(startLoc + index2)
            } else if (mod[0] === DIFF_DELETE) {
              // Deletion
              text =
                text.substring(0, startLoc + index2) +
                text.substring(startLoc + diffXIndex(diffs, index1 + mod[1].length))
            }
            if (mod[0] !== DIFF_DELETE) {
              index1 += mod[1].length
            }
          }
        }
      }
    }
  }
  // Strip the padding off.
  text = text.substring(nullPadding.length, text.length - nullPadding.length)
  return [text, results]
}

/**
 * Add some padding on text start and end so that edges can match something. Intended to be called
 * only from within `patchApply`.
 *
 * @returns The padding string added to each side.
 */
function patchAddPadding(patches: Patch[]): string {
  const paddingLength = PATCH_MARGIN
  let nullPadding = ''
  for (let x = 1; x <= paddingLength; x++) {
    nullPadding += String.fromCharCode(x)
  }

  // Bump all the patches forward.
  for (const patch of patches) {
    patch.start1 += paddingLength
    patch.start2 += paddingLength
  }

  // Add some padding on start of first diff.
  let patch = patches[0]
  let diffs = patch.diffs
  if (diffs.length === 0 || diffs[0][0] !== DIFF_EQUAL) {
    // Add nullPadding equality.
    diffs.unshift([DIFF_EQUAL, nullPadding])
    patch.start1 -= paddingLength // Should be 0.
    patch.start2 -= paddingLength // Should be 0.
    patch.length1 += paddingLength
    patch.length2 += paddingLength
  } else if (paddingLength > diffs[0][1].length) {
    // Grow first equality.
    const extraLength = paddingLength - diffs[0][1].length
    diffs[0][1] = nullPadding.substring(diffs[0][1].length) + diffs[0][1]
    patch.start1 -= extraLength
    patch.start2 -= extraLength
    patch.length1 += extraLength
    patch.length2 += extraLength
  }

  // Add some padding on end of last diff.
  patch = patches[patches.length - 1]
  diffs = patch.diffs
  if (diffs.length === 0 || diffs[diffs.length - 1][0] !== DIFF_EQUAL) {
    // Add nullPadding equality.
    diffs.push([DIFF_EQUAL, nullPadding])
    patch.length1 += paddingLength
    patch.length2 += paddingLength
  } else if (paddingLength > diffs[diffs.length - 1][1].length) {
    // Grow last equality.
    const extraLength = paddingLength - diffs[diffs.length - 1][1].length
    diffs[diffs.length - 1][1] += nullPadding.substring(0, extraLength)
    patch.length1 += extraLength
    patch.length2 += extraLength
  }

  return nullPadding
}

/**
 * Look through the patches and break up any which are longer than the maximum limit of the match
 * algorithm. Intended to be called only from within `patchApply`.
 */
function patchSplitMax(patches: Patch[]): void {
  const patchSize = MATCH_MAX_BITS
  for (let x = 0; x < patches.length; x++) {
    if (patches[x].length1 <= patchSize) {
      continue
    }
    const bigpatch = patches[x]
    // Remove the big old patch.
    patches.splice(x--, 1)
    let start1 = bigpatch.start1
    let start2 = bigpatch.start2
    let precontext = ''
    while (bigpatch.diffs.length !== 0) {
      // Create one of several smaller patches.
      const patch = new Patch()
      let empty = true
      patch.start1 = start1 - precontext.length
      patch.start2 = start2 - precontext.length
      if (precontext !== '') {
        patch.length1 = patch.length2 = precontext.length
        patch.diffs.push([DIFF_EQUAL, precontext])
      }
      while (bigpatch.diffs.length !== 0 && patch.length1 < patchSize - PATCH_MARGIN) {
        const diffType = bigpatch.diffs[0][0]
        let diffText = bigpatch.diffs[0][1]
        if (diffType === DIFF_INSERT) {
          // Insertions are harmless.
          patch.length2 += diffText.length
          start2 += diffText.length
          patch.diffs.push(bigpatch.diffs.shift()!)
          empty = false
        } else if (
          diffType === DIFF_DELETE &&
          patch.diffs.length === 1 &&
          patch.diffs[0][0] === DIFF_EQUAL &&
          diffText.length > 2 * patchSize
        ) {
          // This is a large deletion. Let it pass in one chunk.
          patch.length1 += diffText.length
          start1 += diffText.length
          empty = false
          patch.diffs.push([diffType, diffText])
          bigpatch.diffs.shift()
        } else {
          // Deletion or equality. Only take as much as we can stomach.
          diffText = diffText.substring(0, patchSize - patch.length1 - PATCH_MARGIN)
          patch.length1 += diffText.length
          start1 += diffText.length
          if (diffType === DIFF_EQUAL) {
            patch.length2 += diffText.length
            start2 += diffText.length
          } else {
            empty = false
          }
          patch.diffs.push([diffType, diffText])
          if (diffText === bigpatch.diffs[0][1]) {
            bigpatch.diffs.shift()
          } else {
            bigpatch.diffs[0][1] = bigpatch.diffs[0][1].substring(diffText.length)
          }
        }
      }
      // Compute the head context for the next patch.
      precontext = diffText2(patch.diffs)
      precontext = precontext.substring(precontext.length - PATCH_MARGIN)
      // Append the end context for this patch.
      const postcontext = diffText1(bigpatch.diffs).substring(0, PATCH_MARGIN)
      if (postcontext !== '') {
        patch.length1 += postcontext.length
        patch.length2 += postcontext.length
        if (patch.diffs.length !== 0 && patch.diffs[patch.diffs.length - 1][0] === DIFF_EQUAL) {
          patch.diffs[patch.diffs.length - 1][1] += postcontext
        } else {
          patch.diffs.push([DIFF_EQUAL, postcontext])
        }
      }
      if (!empty) {
        patches.splice(++x, 0, patch)
      }
    }
  }
}

/**
 * Parse a textual representation of patches (GNU diff's format, the body escaped with `%xx`).
 *
 * @throws If the text is not a valid patch.
 */
export function patchFromText(textline: string): Patch[] {
  const patches: Patch[] = []
  if (!textline) {
    return patches
  }
  const text = textline.split('\n')
  let textPointer = 0
  const patchHeader = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@$/
  while (textPointer < text.length) {
    const m = text[textPointer].match(patchHeader)
    if (!m) {
      throw new Error('Invalid patch string: ' + text[textPointer])
    }
    const patch = new Patch()
    patches.push(patch)
    patch.start1 = Number.parseInt(m[1], 10)
    if (m[2] === '') {
      patch.start1--
      patch.length1 = 1
    } else if (m[2] === '0') {
      patch.length1 = 0
    } else {
      patch.start1--
      patch.length1 = Number.parseInt(m[2], 10)
    }

    patch.start2 = Number.parseInt(m[3], 10)
    if (m[4] === '') {
      patch.start2--
      patch.length2 = 1
    } else if (m[4] === '0') {
      patch.length2 = 0
    } else {
      patch.start2--
      patch.length2 = Number.parseInt(m[4], 10)
    }
    textPointer++

    while (textPointer < text.length) {
      const sign = text[textPointer].charAt(0)
      let line: string
      try {
        line = decodeURI(text[textPointer].substring(1))
      } catch {
        // Malformed URI sequence.
        throw new Error('Illegal escape in patch_fromText: ' + text[textPointer].substring(1))
      }
      if (sign === '-') {
        // Deletion.
        patch.diffs.push([DIFF_DELETE, line])
      } else if (sign === '+') {
        // Insertion.
        patch.diffs.push([DIFF_INSERT, line])
      } else if (sign === ' ') {
        // Minor equality.
        patch.diffs.push([DIFF_EQUAL, line])
      } else if (sign === '@') {
        // Start of next patch.
        break
      } else if (sign !== '') {
        // A blank line is skipped; anything else is not a patch.
        throw new Error('Invalid patch mode "' + sign + '" in: ' + line)
      }
      textPointer++
    }
  }
  return patches
}
