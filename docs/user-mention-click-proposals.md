# User-Mention Click Feature Proposals for CapWiki

## Business Goal
- Enhance CapWiki’s feature set to compete with Confluence
- Improve user experience and engagement

## Implementable Suggestions

### 1. Dedicated User Profile Page
Clicking a user mention opens a profile page showing only publicly visible information such as display name, role, bio, and contributions. Users can control what appears there through their privacy settings. The profile serves as a shared space for collaboration links and contact details.

**Technical feasibility:**
- Requires routing and a new profile page component
- Aligns with standard wiki navigation and user management
- Can integrate with existing user management systems

### 2. User Profile Popup
When a user-mention is clicked, a modal or floating card appears near the mention. This popup displays the user's avatar, name, role, contact information, and quick actions such as sending a message, following the user, or viewing their full profile. The popup is designed to be non-intrusive and context-aware, allowing users to access essential information and actions without leaving the current page. It can be closed by clicking outside or pressing a close button. This feature enhances engagement by making user information easily accessible and actionable.

**Technical feasibility:**
- Requires asynchronous fetching of user data (e.g., via API call)
- Uses a Vue component for rendering the popup
- Can leverage existing modal libraries for accessibility and responsiveness

### 3. Sidebar User Info Panel
Clicking a user-mention opens a sidebar panel on the right or left side of the screen. The sidebar provides detailed information about the user, including their profile, recent activity, contributions to CapWiki, and links to profile settings or collaboration tools. The sidebar remains open until manually closed, allowing users to browse through the information and interact with the user’s content. This approach is ideal for users who want more context or wish to explore a user’s history and contributions in depth.

**Technical feasibility:**
- Requires a sidebar component and routing logic
- Can reuse sidebar patterns from other CapWiki features
- Needs to handle dynamic content loading and responsive design

### 4. Inline Expandable Details
The user-mention expands in place within the page to show a brief summary of the user, such as their avatar, name, role, and last activity. This expansion is collapsible, meaning users can toggle it open or closed without navigating away. A link to the full profile is provided for further exploration. This feature is lightweight and keeps the user in context, making it suitable for quick lookups and minimal disruption to the reading flow.

**Technical feasibility:**
- Implemented with a collapsible Vue component
- Minimal impact on page layout
- Can use transition effects for smooth expansion/collapse

### 5. Tooltip with Quick Info
Hovering over or clicking a user-mention shows a tooltip with basic information, such as the user’s name, avatar, and role. The tooltip may include links to more details or actions. Tooltips are lightweight, non-intrusive, and ideal for quick reference without interrupting the user’s workflow. They can be triggered by mouse events or keyboard navigation for accessibility.

**Technical feasibility:**
- Simple to implement with tooltip libraries
- Lightweight and non-intrusive
- Can be enhanced for accessibility and keyboard support

## Inspiration from Other Wikis
- **Confluence:** Profile popups, dedicated profile pages
- **MediaWiki/GitHub:** Tooltips, profile pages
- **Notion:** Inline popups, sidebar panels

## Risks
- Some options may require backend changes
- UI consistency and accessibility must be ensured
- Stakeholder disagreement on preferred UX

## Acceptance Criteria
- At least three implementable suggestions documented
- Technical feasibility assessed for each
- Documentation includes links to relevant research

## Next Steps
- Discuss proposals with team and works council
- Gather feedback from stakeholders
- Validate technical feasibility and finalize documentation

---

**Links to relevant research:**
- [Confluence User Profile](https://confluence.atlassian.com/doc/user-profiles-139448.html)
- [MediaWiki User Pages](https://www.mediawiki.org/wiki/Help:User_page)
- [GitHub User Mentions](https://docs.github.com/en/get-started/writing-on-github/mentioning-people-and-teams-in-github)
- [Notion User Mentions](https://www.notion.so/help/user-mentions)
