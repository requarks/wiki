**Steps when performing deep license scan:**
1. Generate new yarn license.
**Code to generate new license report**
`yarn licenses list --production --recursive --json > results.json`

	Last generated yarn license in [Legal](https://capgemini.sharepoint.com/sites/TPO-BU-Germany/TPOInternal/Forms/AllItems.aspx?OR=Teams%2DHL&CT=1709040940384&clickparams=eyJBcHBOYW1lIjoiVGVhbXMtRGVza3RvcCIsIkFwcFZlcnNpb24iOiIyOC8yNDAxMDQxNzUwNCIsIkhhc0ZlZGVyYXRlZFVzZXIiOmZhbHNlfQ%3D%3D&id=%2Fsites%2FTPO%2DBU%2DGermany%2FTPOInternal%2FProjects%2FConfluence%20Replacement%2F2%2E0%20%2D%20Legal&viewid=9020b70a%2Ded0a%2D4251%2Da067%2D6e78b2d2bc33)

2. Send the file to the legal colleagues and request a new deep license scan. The Legal Team provides a report detailing dependencies with incompatible licenses, along with suggestions for removal or updates.

	Last deep license scan "OSS Inventory" in [Legal](https://capgemini.sharepoint.com/sites/TPO-BU-Germany/TPOInternal/Forms/AllItems.aspx?OR=Teams%2DHL&CT=1709040940384&clickparams=eyJBcHBOYW1lIjoiVGVhbXMtRGVza3RvcCIsIkFwcFZlcnNpb24iOiIyOC8yNDAxMDQxNzUwNCIsIkhhc0ZlZGVyYXRlZFVzZXIiOmZhbHNlfQ%3D%3D&id=%2Fsites%2FTPO%2DBU%2DGermany%2FTPOInternal%2FProjects%2FConfluence%20Replacement%2F2%2E0%20%2D%20Legal&viewid=9020b70a%2Ded0a%2D4251%2Da067%2D6e78b2d2bc33)
  
  3. Review & Apply in code the needed changes and repeat the process till all dependencies have compatible license.
  
> Info about which licenses are compatible can be found in the last deep license scan output in [Legal](https://capgemini.sharepoint.com/sites/TPO-BU-Germany/TPOInternal/Forms/AllItems.aspx?OR=Teams%2DHL&CT=1709040940384&clickparams=eyJBcHBOYW1lIjoiVGVhbXMtRGVza3RvcCIsIkFwcFZlcnNpb24iOiIyOC8yNDAxMDQxNzUwNCIsIkhhc0ZlZGVyYXRlZFVzZXIiOmZhbHNlfQ%3D%3D&id=%2Fsites%2FTPO%2DBU%2DGermany%2FTPOInternal%2FProjects%2FConfluence%20Replacement%2F2%2E0%20%2D%20Legal&viewid=9020b70a%2Ded0a%2D4251%2Da067%2D6e78b2d2bc33)
{.is-info}

