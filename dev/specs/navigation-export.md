# Navigation menu export

**Status:** implemented, format version 1.
**Implemented by:** [`frontend/src/components/NavEditOverlay.vue`](../../frontend/src/components/NavEditOverlay.vue)
(`exportItems` writes, `importItems` and the functions after it read).

The navigation editor (**Edit Menu Items**, opened from a page's sidebar or from **Administration →
Navigation**) can save the menu on screen to a JSON file, and read such a file back into any menu: on
the same site, on another site of the same wiki, or on another wiki. The **…** menu under the item list
holds both actions.

Both run entirely in the browser. The export is the editor's current state, saved or not. The import
only changes what the editor shows, so nothing is stored until **Save**, and Save goes through the
same validation as any other edit.

---

## 1. File

A UTF-8 JSON document, saved as `navigation.json` with the type `application/json`:

```json
{
  "format": "wikijs-navigation",
  "version": 1,
  "groups": [
    { "id": "7e5e1c0e-…", "name": "Editors" }
  ],
  "items": [
    { "type": "header", "label": "Guides", "visibilityGroups": [] },
    {
      "type": "link",
      "label": "Getting Started",
      "icon": "mdi:rocket-launch-outline",
      "target": "/guides/getting-started",
      "openInNewWindow": false,
      "expandByDefault": true,
      "visibilityGroups": [],
      "children": [
        {
          "type": "link",
          "label": "Installation",
          "icon": "mdi:text-box-outline",
          "target": "/guides/install",
          "openInNewWindow": false,
          "visibilityGroups": ["7e5e1c0e-…"]
        }
      ]
    },
    { "type": "separator", "visibilityGroups": [] },
    {
      "type": "menu",
      "label": "Reference",
      "icon": "mdi:folder-outline",
      "targetNavId": "c1a4…",
      "targetPath": "reference",
      "showLink": true,
      "visibilityGroups": []
    }
  ]
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `format` | string | Always `"wikijs-navigation"`. An import refuses any other value. |
| `version` | integer | The version of this shape, currently `1`. An import refuses any other value. See [§5](#5-changing-the-format). |
| `groups` | array | `{ id, name }` for each group named by an item's `visibilityGroups`, so that an import on another wiki can find the group by name ([§3.2](#32-visibility-groups)). May leave out a group whose name the exporter could not read (the group list failed to load). |
| `items` | array | The menu's top-level items, in order. At least one. |

---

## 2. Items

An item is the stored navigation item (`NavigationItem` in `backend/models/navigation.ts`, which is what
`PUT …/navigation/…` accepts) **without its `id`**. An import always assigns new ids, since a file
imported twice into one menu would otherwise put the same id on two rows.

Every item has:

| Field | Type | Meaning |
| --- | --- | --- |
| `type` | `"header"` \| `"link"` \| `"menu"` \| `"separator"` | Required. Any other value makes the file invalid. |
| `visibilityGroups` | string[] | Ids of the groups the item is limited to. Empty means visible to everyone. |

By type:

- **`header`**: `label` (string).
- **`link`**: `label`, `icon`, `target` (a path on the wiki, or an `http://`, `https://` or `mailto:`
  address; the server refuses anything else on Save), `openInNewWindow` (boolean). A top-level link
  also has `expandByDefault` (boolean) and `children` (array, possibly empty).
- **`menu`**: opens another navigation menu in the sidebar. `label`, `icon`, `showLink` (boolean),
  `targetNavId` (the id of the menu it opens, or `null` if none was picked) and `targetPath` (the path
  of the page or folder owning that menu, without a leading slash; `""` for a locale's root menu;
  `null` if unknown). `targetPath` is only in the export. The stored item has no such field, and the
  editor gets it from the server when it loads the menu.
- **`separator`**: nothing beyond the common fields.

`icon` is an Iconify reference (`prefix:name`) or an `img:` path, as everywhere else in navigation.

**Nesting is one level deep, and only for links.** `children` appears only on a top-level `link` and
holds only `link` items, which have no `children` or `expandByDefault` of their own. A file breaking
this is refused whole, because the editor cannot show such an item and the user could not fix it
before saving. The editor's own list is flat (a nested row has `isNested` and belongs to the link above
it), so an export refuses a list where a nested row has no link above it, as Save does.

**Values are read leniently.** A missing or mistyped `label`, `icon` or `target` gets the value a newly
added item of that type starts with. A missing boolean is `false`, except `showLink`, which defaults to
`true`. Unknown fields are ignored.

---

## 3. Import

The file is checked as a whole (§1 and §2) before anything changes. If the menu on screen already has
items, the user chooses to **replace** them or **add** the imported items after them. Otherwise the
imported items simply replace the empty list.

Some values only mean something on the wiki that exported them. The import looks for each one again
on this wiki. Whatever it cannot find is left in a state the editor already flags, so it never reaches
a reader by accident.

### 3.1 Menu targets

Each `menu` item is matched against the menus this editor may pick (what `GET
/sites/:siteId/navigation/targets?locale=` returns for the locale of the menu being edited, minus that
menu itself):

1. the menu with the same id as `targetNavId`, which is the case when importing on the same site;
2. otherwise the menu whose owner is at `targetPath`, ignoring leading and trailing slashes.

If neither matches, the item is imported with no target. The editor shows its warning icon and Save
refuses until a target is picked. A notification gives how many items this happened to.

### 3.2 Visibility groups

Groups belong to the whole wiki, not to a site, so on the same wiki the ids still apply. Each id in an
item's `visibilityGroups` is matched to a group of this wiki:

1. the group with that id;
2. otherwise the group whose name equals the name `groups` records for that id, ignoring case and
   surrounding whitespace.

Ids that match nothing are dropped, which can only narrow who sees the item. **If none of an item's
groups match, it keeps the ids from the file instead**: it is then limited to groups that do not exist
here, and is hidden from everyone until someone changes its visibility. Dropping them all would make it
visible to everyone, the opposite of what its exporter set up. A notification gives how many items this
happened to.

If this editor could not load the group list, nothing can be matched, and every item limited to groups
keeps its ids from the file.

### 3.3 Icons

After the items are in place, the import sends every Iconify reference among them to `POST
/icons/materialize`, as the icon picker does when an icon is picked, so this wiki stores them and serves
them without the Iconify API. An icon that cannot be stored (its set is not enabled here, say) is still
imported, but may not display. A notification gives how many.

---

## 4. What is not exported

- The menu's **mode** (inherit, override, hide) and where it applies. That belongs to the page or
  folder, not to the items, and is chosen in the editor that imports.
- Item ids (see §2).
- Anything about the exporting site or locale. A file does not record where it came from.

---

## 5. Changing the format

Add an optional field without changing `version` when an older importer can safely ignore it: it is
lenient about values and ignores unknown fields.

Change anything an older importer would misread (a field's meaning, a nesting rule, a new item
`type`) by increasing `version`, and make the importer accept every version it can still read. An
importer refuses a version it does not know rather than guessing.
