/**
 * The shared component library.
 *
 * Registered globally in `boot/components.js`, so templates use `<w-btn>` / `<w-card>` without
 * importing anything -- the same ergonomics Quasar's auto-import gave, which is what keeps the
 * migration diffs to the tags themselves.
 *
 * Every component here is deliberately scoped to how this app actually uses it rather than to the
 * full API of the component it replaces; see the note at the top of each file where they differ.
 */
import WAvatar from './WAvatar.vue'
import WBadge from './WBadge.vue'
import WBanner from './WBanner.vue'
import WBar from './WBar.vue'
import WBreadcrumbs from './WBreadcrumbs.vue'
import WBtn from './WBtn.vue'
import WBtnGroup from './WBtnGroup.vue'
import WBtnToggle from './WBtnToggle.vue'
import WCard from './WCard.vue'
import WCardActions from './WCardActions.vue'
import WCardHeader from './WCardHeader.vue'
import WCardSection from './WCardSection.vue'
import WCheckbox from './WCheckbox.vue'
import WChip from './WChip.vue'
import WCircularProgress from './WCircularProgress.vue'
import WColorPicker from './WColorPicker.vue'
import WConfirmDialog from './WConfirmDialog.vue'
import WDate from './WDate.vue'
import WDialog from './WDialog.vue'
import WDrawer from './WDrawer.vue'
import WExpansionItem from './WExpansionItem.vue'
import WFooter from './WFooter.vue'
import WForm from './WForm.vue'
import WHeader from './WHeader.vue'
import WIcon from './WIcon.vue'
import WInnerLoading from './WInnerLoading.vue'
import WInput from './WInput.vue'
import WItem from './WItem.vue'
import WItemLabel from './WItemLabel.vue'
import WItemSection from './WItemSection.vue'
import WLayout from './WLayout.vue'
import WLinearProgress from './WLinearProgress.vue'
import WList from './WList.vue'
import WMenu from './WMenu.vue'
import WPage from './WPage.vue'
import WPageContainer from './WPageContainer.vue'
import WPopupEdit from './WPopupEdit.vue'
import WPageScroller from './WPageScroller.vue'
import WPagination from './WPagination.vue'
import WRadio from './WRadio.vue'
import WRange from './WRange.vue'
import WRating from './WRating.vue'
import WScrollArea from './WScrollArea.vue'
import WSelect from './WSelect.vue'
import WSeparator from './WSeparator.vue'
import WSignal from './WSignal.vue'
import WSpace from './WSpace.vue'
import WSpinner from './WSpinner.vue'
import WTab from './WTab.vue'
import WTabPanel from './WTabPanel.vue'
import WTabPanels from './WTabPanels.vue'
import WTable from './WTable.vue'
import WTabs from './WTabs.vue'
import WTd from './WTd.vue'
import WToggle from './WToggle.vue'
import WToolbar from './WToolbar.vue'
import WToolbarTitle from './WToolbarTitle.vue'
import WTooltip from './WTooltip.vue'
import WTree from './WTree.vue'

export const sharedComponents = {
  WAvatar,
  WBadge,
  WBanner,
  WBar,
  WBreadcrumbs,
  WBtn,
  WBtnGroup,
  WBtnToggle,
  WCard,
  WCardActions,
  WCardHeader,
  WCardSection,
  WCheckbox,
  WChip,
  WCircularProgress,
  WColorPicker,
  WConfirmDialog,
  WDate,
  WDialog,
  WDrawer,
  WExpansionItem,
  WFooter,
  WForm,
  WHeader,
  WIcon,
  WInnerLoading,
  WInput,
  WItem,
  WItemLabel,
  WItemSection,
  WLayout,
  WLinearProgress,
  WList,
  WMenu,
  WPage,
  WPageContainer,
  WPopupEdit,
  WPageScroller,
  WPagination,
  WRadio,
  WRange,
  WRating,
  WScrollArea,
  WSelect,
  WSeparator,
  WSignal,
  WSpace,
  WSpinner,
  WTab,
  WTabPanel,
  WTabPanels,
  WTable,
  WTabs,
  WTd,
  WToggle,
  WToolbar,
  WToolbarTitle,
  WTooltip,
  WTree
}

/** @param {import('vue').App} app */
export function registerSharedComponents(app) {
  for (const [name, component] of Object.entries(sharedComponents)) {
    app.component(name, component)
  }
}
