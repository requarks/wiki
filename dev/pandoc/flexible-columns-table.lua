-- fixed-width-tables.lua
-- Dynamic longtables with proportional width, LaTeX escaping, and column splitting

local MIN_CM = 2.0
local CM_TO_PT = 28.45
local LINEWIDTH_PT = 455

local MAX_COLS_PER_TABLE = 5  -- 🧠 customize this!

-- Escape LaTeX special characters
local function escape_latex(s)
    s = s:gsub("\\", "\\textbackslash{}")
    s = s:gsub("%%", "\\%%")
    s = s:gsub("&", "\\&")
    s = s:gsub("%$", "\\textdollar{}")
    s = s:gsub("#", "\\#")
    s = s:gsub("_", "\\_")
    s = s:gsub("{", "\\{")
    s = s:gsub("}", "\\}")
    s = s:gsub("%^", "\\^{}")
    s = s:gsub("~", "\\~{}")
    return s
  end

local function cellText(cell)
  return escape_latex(pandoc.utils.stringify(cell))
end

local function cellLength(cell)
  return string.len(pandoc.utils.stringify(cell))
end

local function getMaxCols(tbl)
  local maxCols = 0
  for _, row in ipairs(tbl.head.rows or {}) do
    maxCols = math.max(maxCols, #row.cells)
  end
  for _, row in ipairs(tbl.bodies[1].body or {}) do
    maxCols = math.max(maxCols, #row.cells)
  end
  return maxCols
end

-- Generate LaTeX column specs (p{X\linewidth}) for a slice of columns
local function getColumnSpecs(tbl, colIndices)
  local lengths = {}
  local total = 0
  local row = tbl.bodies[1] and tbl.bodies[1].body and tbl.bodies[1].body[1]

  for _, i in ipairs(colIndices) do
    local len = 1
    if row and row.cells[i] then
      len = math.max(cellLength(row.cells[i]), 1)
    end
    table.insert(lengths, len)
    total = total + len
  end

  local rawWidths = {}
  for _, len in ipairs(lengths) do
    table.insert(rawWidths, (len / total) * LINEWIDTH_PT)
  end

  local adjusted = {}
  local totalAdjusted = 0
  local minPt = MIN_CM * CM_TO_PT
  for _, w in ipairs(rawWidths) do
    local wAdj = math.max(w, minPt)
    table.insert(adjusted, wAdj)
    totalAdjusted = totalAdjusted + wAdj
  end

  local spec = {}
  for _, w in ipairs(adjusted) do
    local frac = w / totalAdjusted
    local widthStr = string.format("%.4f\\linewidth", frac)
    table.insert(spec, ">{\\raggedright\\arraybackslash}p{" .. widthStr .. "}")
  end

  return spec
end

-- Render one table chunk for a slice of columns
local function stringifyRow(row, colIndices)
  local out = {}
  for _, i in ipairs(colIndices) do
    local cell = row.cells[i]
    table.insert(out, cell and cellText(cell) or "")
  end
  return table.concat(out, " & ") .. " \\\\"
end

local function renderChunk(tbl, colStart, colEnd, chunkIndex, totalChunks)
  local colIndices = {}
  for i = colStart, colEnd do table.insert(colIndices, i) end
  local colspec = table.concat(getColumnSpecs(tbl, colIndices), " ")

  local latex = {}
  table.insert(latex, string.format("%% Table chunk %d of %d", chunkIndex, totalChunks))
  table.insert(latex, "\\begin{longtable}{" .. colspec .. "}")
  table.insert(latex, "\\toprule")

  -- Header (fallback if missing)
  local headerRow = (tbl.head and tbl.head.rows and tbl.head.rows[1])
  if headerRow then
    table.insert(latex, stringifyRow(headerRow, colIndices))
    table.insert(latex, "\\midrule")
    table.insert(latex, "\\endhead")
  else
    -- No header: skip \endhead block
    table.insert(latex, "\\endfirsthead") -- avoid LaTeX error
  end

  -- Body
  for _, row in ipairs(tbl.bodies[1].body or {}) do
    table.insert(latex, stringifyRow(row, colIndices))
  end

  table.insert(latex, "\\bottomrule")
  table.insert(latex, "\\end{longtable}")
  return table.concat(latex, "\n")
end

-- Main entry
function Table(tbl)
  local maxCols = getMaxCols(tbl)
  local chunks = {}

  if maxCols <= MAX_COLS_PER_TABLE then
    table.insert(chunks, renderChunk(tbl, 1, maxCols, 1, 1))
  else
    local totalChunks = math.ceil(maxCols / MAX_COLS_PER_TABLE)
    local chunkIndex = 1
    for i = 1, maxCols, MAX_COLS_PER_TABLE do
      local j = math.min(i + MAX_COLS_PER_TABLE - 1, maxCols)
      table.insert(chunks, renderChunk(tbl, i, j, chunkIndex, totalChunks))
      chunkIndex = chunkIndex + 1
    end
  end

  return pandoc.RawBlock("latex", table.concat(chunks, "\n\n"))
end
