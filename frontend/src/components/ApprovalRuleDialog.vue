<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="min-width: 650px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-inspection.svg" size="sm" class="mr-2" />
        <span>{{ isEdit ? t('admin.approval.editRule') : t('admin.approval.newRule') }}</span>
      </w-card-section>
      <w-form ref="ruleForm" class="py-2" @submit="save">
        <!--
          No `self-start` on these icons. A field's control carries a symmetric `my-2` -- room for the
          floated label, matched underneath precisely so the box stays centred on the control -- so
          letting both sections centre in the row is what lines the icon up with the field. Pinning
          the icon to the top instead put it 6px above the control it belongs to.
        -->
        <w-item>
          <blueprint-icon icon="rename" />
          <w-item-section>
            <w-input
              ref="iptName"
              v-model="state.name"
              outlined
              dense
              :rules="nameValidation"
              hide-bottom-space
              :label="t(`admin.approval.name`)"
              :hint="t(`admin.approval.nameHint`)"
              lazy-rules="ondemand"
              autofocus />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="filtration" />
          <w-item-section>
            <w-select
              v-model="state.match"
              outlined
              dense
              :options="matchOptions"
              map-options
              emit-value
              option-value="value"
              option-label="label"
              options-dense
              hide-bottom-space
              :label="t(`admin.approval.match`)"
              :hint="t(`admin.approval.matchHint`)" />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon :icon="isTagMatch ? `flag-filled` : `link`" />
          <w-item-section>
            <!--
              One field for both kinds of pattern: a tag mode takes a list of tags rather than a path,
              so only its label, hint and rule change.
            -->
            <w-input
              v-model="state.path"
              outlined
              dense
              :prefix="isTagMatch ? null : `/`"
              :suffix="state.match === `REGEX` ? `/` : null"
              :rules="pathValidation"
              hide-bottom-space
              :label="isTagMatch ? t(`admin.approval.tags`) : t(`admin.approval.path`)"
              :hint="pathHint"
              lazy-rules="ondemand" />
          </w-item-section>
        </w-item>
        <w-separator class="my-2" inset />
        <w-item>
          <blueprint-icon icon="pen" />
          <w-item-section>
            <w-select
              v-model="state.submitterGroups"
              outlined
              dense
              :options="props.groups"
              multiple
              map-options
              emit-value
              option-value="id"
              option-label="name"
              options-dense
              :rules="groupsValidation(t(`admin.approval.submittersRequired`))"
              hide-bottom-space
              :label="t(`admin.approval.submitters`)"
              :hint="t(`admin.approval.submittersHint`)"
              lazy-rules="ondemand" />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="validation" />
          <w-item-section>
            <w-select
              v-model="state.reviewerGroups"
              outlined
              dense
              :options="props.groups"
              multiple
              map-options
              emit-value
              option-value="id"
              option-label="name"
              options-dense
              :rules="groupsValidation(t(`admin.approval.reviewersRequired`))"
              hide-bottom-space
              :label="t(`admin.approval.reviewers`)"
              :hint="t(`admin.approval.reviewersHint`)"
              lazy-rules="ondemand" />
          </w-item-section>
        </w-item>
      </w-form>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="grey"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          :label="isEdit ? t(`common.actions.save`) : t(`common.actions.create`)"
          color="primary"
          padding="xs md"
          :loading="state.isLoading"
          @click="save" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, reactive, ref } from 'vue'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'

// PROPS

const props = defineProps({
  siteId: {
    type: String,
    required: true
  },
  /** The rule being edited, or null to create one. */
  rule: {
    type: Object,
    default: null
  },
  /** The groups to choose from, loaded once by the page rather than per dialog. */
  groups: {
    type: Array,
    default: () => []
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent({
  autofocus: () => iptName.value
})

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  name: props.rule?.name ?? '',
  match: props.rule?.match ?? 'START',
  path: props.rule?.path ?? '',
  submitterGroups: [...(props.rule?.submitterGroups ?? [])],
  reviewerGroups: [...(props.rule?.reviewerGroups ?? [])],
  isLoading: false
})

// REFS

const ruleForm = ref(null)
const iptName = ref(null)

// COMPUTED

const isEdit = computed(() => Boolean(props.rule))

const isTagMatch = computed(() => ['TAG', 'TAGALL'].includes(state.match))

const matchOptions = computed(() => [
  { label: t('admin.approval.matchStart'), value: 'START' },
  { label: t('admin.approval.matchExact'), value: 'EXACT' },
  { label: t('admin.approval.matchEnd'), value: 'END' },
  { label: t('admin.approval.matchRegex'), value: 'REGEX' },
  { label: t('admin.approval.matchTag'), value: 'TAG' },
  { label: t('admin.approval.matchTagAll'), value: 'TAGALL' }
])

// VALIDATION RULES

const nameValidation = [(val) => (val ?? '').trim().length > 0 || t('admin.approval.nameRequired')]

/** What the field is asking for, which is a different thing in each mode -- empty included. */
const pathHint = computed(() => {
  if (isTagMatch.value) {
    return t('admin.approval.tagsHint')
  }
  return state.match === 'START' ? t('admin.approval.pathHintStart') : t('admin.approval.pathHint')
})

const pathValidation = [
  // -> Empty is a real answer for `START`: every path starts with nothing, so the rule covers the
  //    whole site. The server agrees, and refuses it for every other mode -- see `validateRule`.
  (val) =>
    state.match === 'START' ||
    (val ?? '').trim().length > 0 ||
    (isTagMatch.value ? t('admin.approval.tagsRequired') : t('admin.approval.pathRequired')),
  // -> Caught here as well as by the server: a pattern that cannot compile is a rule that silently
  //    covers nothing, and the message is far more useful next to the field
  (val) => {
    if (state.match !== 'REGEX') {
      return true
    }
    try {
      new RegExp(val)
      return true
    } catch (err) {
      return t('admin.approval.pathInvalidRegex', { reason: err.message })
    }
  }
]

const groupsValidation = (message) => [(val) => (val ?? []).length > 0 || message]

// METHODS

async function save() {
  state.isLoading = true
  try {
    const isFormValid = await ruleForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('admin.approval.formInvalid'))
    }

    // -> `isEnabled` is deliberately absent: the list row owns that switch, so a rule saved here keeps
    //    whatever state it already had, and a new one starts enabled
    const payload = {
      name: state.name.trim(),
      match: state.match,
      path: state.path.trim(),
      submitterGroups: state.submitterGroups,
      reviewerGroups: state.reviewerGroups
    }
    const resp = isEdit.value
      ? await API_CLIENT.put(`sites/${props.siteId}/approvals/rules/${props.rule.id}`, {
          json: payload
        }).json()
      : await API_CLIENT.post(`sites/${props.siteId}/approvals/rules`, { json: payload }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }

    notify({
      type: 'positive',
      message: isEdit.value ? t('admin.approval.updateSuccess') : t('admin.approval.createSuccess')
    })
    onDialogOK(resp.rule)
  } catch (err) {
    notify({
      type: 'negative',
      message:
        (await err.response
          ?.json()
          .then((b) => b?.message)
          .catch(() => null)) ?? err.message
    })
  }
  state.isLoading = false
}
</script>
