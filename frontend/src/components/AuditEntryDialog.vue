<template>
  <w-dialog v-model="dialogVisible" max-width="700px" @hide="onDialogHide">
    <w-card style="min-width: 500px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-event-log.svg" size="sm" class="mr-2" />
        <span>{{ actionLabel }}</span>
      </w-card-section>
      <w-card-section>
        <w-list separator dense>
          <w-item>
            <w-item-section>
              <w-item-label caption>{{ t('admin.audit.field.timestamp') }}</w-item-label>
              <!--
                Named rather than left implied. The list shows these times in the reader's own zone
                without saying so, which is fine while scanning; on the record of a single event it
                matters, since two administrators reading the same entry from different zones would
                otherwise each take their own rendering for the moment it happened.
              -->
              <w-item-label>
                {{ userStore.formatDateTime(t, entry.ts) }}
                <span class="text-grey">({{ userStore.timezoneId() }})</span>
              </w-item-label>
            </w-item-section>
          </w-item>
          <w-item>
            <w-item-section>
              <w-item-label caption>{{ t('admin.audit.field.user') }}</w-item-label>
              <!--
                From `meta.actor`, never from the users table: this is who the account was at the
                time. An entry whose account has since been deleted still reads correctly, and is
                marked as such rather than silently losing its name.
              -->
              <w-item-label>
                {{ entry.meta?.actor?.name || t('admin.audit.anonymous') }}
                <span class="text-grey" v-if="entry.meta?.actor?.email">
                  &lt;{{ entry.meta.actor.email }}&gt;
                </span>
              </w-item-label>
              <w-item-label caption v-if="!entry.userId && entry.meta?.actor?.email">
                {{ t('admin.audit.accountGone') }}
              </w-item-label>
            </w-item-section>
          </w-item>
          <w-item>
            <w-item-section>
              <w-item-label caption>{{ t('admin.audit.field.clientIP') }}</w-item-label>
              <w-item-label class="font-mono">{{ entry.clientIP || '---' }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-item>
            <w-item-section>
              <w-item-label caption>{{ t('admin.audit.field.action') }}</w-item-label>
              <w-item-label class="font-mono">{{ entry.kind }} / {{ entry.action }}</w-item-label>
            </w-item-section>
          </w-item>
        </w-list>
        <div class="text-caption text-grey mt-4 mb-1">{{ t('admin.audit.field.meta') }}</div>
        <!--
          The whole of `meta`, as it is stored. A formatted dump rather than a field list because
          what an entry carries depends entirely on what it records — a page edit names a history
          version, a group change carries the permission set — and inventing a layout per action
          would be sixty layouts.
        -->
        <pre
          class="overflow-x-auto rounded bg-black/5 p-3 text-caption dark:bg-white/5"><code>{{ formattedMeta }}</code></pre>
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          unelevated
          :label="t(`common.actions.close`)"
          color="primary"
          padding="xs md"
          @click="onDialogCancel" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { useUserStore } from '@/stores/user'

// PROPS

const props = defineProps({
  entry: {
    type: Object,
    required: true
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogCancel } = useDialogComponent()

// I18N

const { t } = useI18n()

// STORES

const userStore = useUserStore()

// COMPUTED

/*
  The action key doubles as its own translation key. An action added to the server without a string
  to go with it falls back to the key itself, which still says what happened.
*/
const actionLabel = computed(() =>
  t(`admin.audit.actions.${props.entry.action}`, props.entry.action)
)

const formattedMeta = computed(() => JSON.stringify(props.entry.meta ?? {}, null, 2))
</script>
