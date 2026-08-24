<template>
  <w-dialog v-model="dialogVisible" max-width="480px" @hide="onDialogHide">
    <w-card style="min-width: 420px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-crayon.svg" size="sm" class="mr-2" />
        <span>{{ t('localeAliasesDialog.title') }}</span>
      </w-card-section>
      <w-card-section>
        <div class="text-body2">
          {{ t('localeAliasesDialog.hint', { name: props.locale.name }) }}
        </div>
      </w-card-section>
      <!--
        `self-start` on both icons: each field shows a hint line underneath, so the row is taller than
        the field and the icon belongs against the first of them, not the middle of both. See the note
        in `ApiKeyCreateDialog`.

        The 6px with it lands the icon where the New Site dialog's puts it. What an icon lines up with
        is the field's TEXT LINE, not its outline: a floating label takes the top of the box, so the
        text sits about 3px below the outline's middle and an icon centred on the outline reads as
        riding high. The fields there get that for free -- they pass `hide-bottom-space`, so the
        section is exactly the field and plain centring finds the text -- while these have a hint line
        under them and have to be told.
      -->
      <div class="pb-2">
        <w-item>
          <blueprint-icon icon="rename" class="self-start mt-1.5" />
          <w-item-section>
            <w-input
              outlined
              dense
              v-model="state.customName"
              :label="t('localeAliasesDialog.nameLabel')"
              :placeholder="props.locale.nativeName"
              :hint="t('localeAliasesDialog.nameHint')"
              @keyup.enter="save" />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="code" class="self-start mt-1.5" />
          <w-item-section>
            <w-input
              outlined
              dense
              v-model="state.customCode"
              :label="t('localeAliasesDialog.codeLabel')"
              :placeholder="props.locale.derivedCode"
              :hint="t('localeAliasesDialog.codeHint')"
              @keyup.enter="save" />
          </w-item-section>
        </w-item>
      </div>
      <w-card-section class="pt-0">
        <div class="text-body2 text-negative">
          {{ t('localeAliasesDialog.warning') }}
        </div>
      </w-card-section>
      <w-card-actions class="card-actions">
        <!-- -> Only offered when there is something stored to clear; emptying either field already
                saves as "use the derived one" -->
        <w-btn
          v-if="props.locale.customName || props.locale.customCode"
          flat
          color="grey"
          padding="xs md"
          :label="t(`localeAliasesDialog.reset`)"
          :disabled="state.isSaving"
          @click="reset" />
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="grey"
          padding="xs md"
          :disabled="state.isSaving"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          :label="t(`common.actions.save`)"
          color="primary"
          padding="xs md"
          :loading="state.isSaving"
          @click="save" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { reactive } from 'vue'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'

// PROPS

const props = defineProps({
  locale: {
    type: Object,
    required: true
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// I18N

const { t } = useI18n()

// DATA

// -> What the locale actually goes by, override or not, so each field starts from what the admin
//    sees rather than from a blank they have to guess the meaning of. Saving one back unchanged
//    stores no override -- the server takes "the derived form" as "no override".
const state = reactive({
  customName: props.locale.displayName ?? '',
  customCode: props.locale.displayCode ?? '',
  isSaving: false
})

// METHODS

async function save() {
  await submit(state.customName, state.customCode)
}

async function reset() {
  await submit('', '')
}

async function submit(customName, customCode) {
  if (state.isSaving) {
    return
  }
  state.isSaving = true
  try {
    await API_CLIENT.put(`locales/${props.locale.code}/aliases`, {
      json: {
        customName: customName.trim() || null,
        customCode: customCode.trim() || null
      }
    })
    notify({
      type: 'positive',
      message: t('localeAliasesDialog.saveSuccess')
    })
    onDialogOK()
  } catch (err) {
    notify({
      type: 'negative',
      message: apiErrorMessage(err)
    })
  }
  state.isSaving = false
}
</script>
