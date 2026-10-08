-- Every ltree label in the tree becomes the hex of the UTF-8 bytes of the folder name it used to be
-- written as (`encodeTreeLabel` in helpers/common.ts), so that a folder name may hold characters an
-- ltree label cannot. Each label is converted on its own: the path keeps its depth and its order, and
-- only how each level is spelled changes. The root's empty path has no labels and is left alone.
UPDATE "tree"
SET "folderPath" = (
  SELECT string_agg(encode(convert_to("label", 'UTF8'), 'hex'), '.' ORDER BY "position")
  FROM unnest(string_to_array("tree"."folderPath"::text, '.')) WITH ORDINALITY AS "labels"("label", "position")
)::ltree
WHERE nlevel("folderPath") > 0;
