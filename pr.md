# **PR: Refactor: Extract page conversion logic to dedicated service**
## **Description**
This Pull Request refactors the Page model by extracting the complex HTML <-> Markdown conversion logic into a dedicated service (PageConverter).
### **Changes**
- Created server/services/page-converter.js: This new service handles all DOM manipulation (Cheerio) and Markdown generation (Turndown).
- Modified server/models/pages.js: Removed dependencies on cheerio, turndown, and turndown-plugin-gfm. The convertPage method now delegates the conversion task to the new service.

### **Benefits:**
- Code Cleanup: The `pages.js` file sheds approximately 80 lines of conversion logic that are unrelated to data persistence (Model responsibility).
- Import Performance: Since `pages.js` is a frequently loaded model, removing heavy dependencies like `cheerio` and `turndown` makes its initial load time lighter and more efficient.
- Maintainability: Future changes to how Markdown/HTML is generated/converted will only require modifying `page-converter.js`, isolating the logic from the core database model.


## **File Changes**
1. [NEW] server/services/page-converter.js
2. [MODIFY] server/models/pages.js