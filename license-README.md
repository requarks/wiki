**Steps when performing deep license scan:**
1. Generate new yarn license.
**Code to generate new license report**
`yarn licenses list --production --recursive --json > results.json`

	Last generated yarn license in [Legal](https://capgemini.sharepoint.com/:f:/r/sites/TPO-BU-Germany/TPOInternal/TPO/Projects/Confluence%20Replacement/2.0%20-%20Legal?csf=1&web=1&e=r4V7rj) e.g. yarnmodernlicenses-v30062025.json

2. **IMPORTANT**: Manually edit the generated yarn license file e.g results.json and Replace the version of highlight "10.3.1" with "10.3.1-patch". Reason: The colleagues from the legal team need to know that this version is modified (patched) and the patch does not exist online.

3. Send the file to the legal colleagues and request a new deep license scan. The Legal Team provides a report detailing dependencies with incompatible licenses, along with suggestions for removal or updates.

	Last deep license scan "OSS Inventory" in [Legal](https://capgemini.sharepoint.com/:f:/r/sites/TPO-BU-Germany/TPOInternal/TPO/Projects/Confluence%20Replacement/2.0%20-%20Legal?csf=1&web=1&e=r4V7rj) e.g. OSS-Inventory-CG_wikijs_20250701.xlsx
  
 4. Review & Apply in code the needed changes and repeat the process till all dependencies have compatible license.
  
> Info about which licenses are compatible can be found in the last deep license scan output in [Legal](https://capgemini.sharepoint.com/:f:/r/sites/TPO-BU-Germany/TPOInternal/TPO/Projects/Confluence%20Replacement/2.0%20-%20Legal?csf=1&web=1&e=r4V7rj). LegalEvaluationProject.xls contains a summary.


