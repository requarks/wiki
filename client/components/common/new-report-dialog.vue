<template lang="pug">
  v-dialog(
    v-model='isShown'
    max-width='850px'
    overlay-color='blue darken-4'
    overlay-opacity='.7'
    )
    v-card.new-report-dialog
      .dialog-header.is-blue
        v-icon.mr-3(color='white') mdi-file-chart-outline
        .body-1 New Report
        v-spacer
        v-btn(icon, dark, @click='close')
          v-icon mdi-close

      v-card-text.pa-4
        v-form(ref='form', v-model='valid')
          v-row
            v-col(cols='12', md='6')
              .overline.mb-2 Generation Options
              v-text-field(
                v-model='form.snapshot'
                label='Snapshot ID'
                :rules='[v => !!v || "Snapshot is required"]'
                required
                outlined
                dense
              )
              v-text-field(
                v-model='form.sg_snapshot'
                label='SG Snapshot ID (Optional)'
                outlined
                dense
              )
              v-checkbox(
                v-model='form.mobile'
                label='Mobile'
                dense
              )
              v-checkbox(
                v-model='form.cao'
                label='CAO'
                dense
              )

            v-col(cols='12', md='6')
              .overline.mb-2 Report Details
              v-text-field(
                v-model='form.book.couchbase.customer'
                label='Customer'
                :rules='[v => !!v || "Customer is required"]'
                required
                outlined
                dense
              )
              v-text-field(
                v-model='form.book.author'
                label='Author'
                :rules='[v => !!v || "Author is required"]'
                required
                outlined
                dense
              )
              v-text-field(
                v-model='form.book.couchbase.email'
                label='Email'
                :rules='[v => !!v || "Email is required"]'
                required
                outlined
                dense
              )
              v-text-field(
                v-model='form.book.couchbase.role'
                label='Role'
                :rules='[v => !!v || "Role is required"]'
                required
                outlined
                dense
              )
              v-text-field(
                v-model='form.book.couchbase.service'
                label='Service'
                :rules='[v => !!v || "Service is required"]'
                required
                outlined
                dense
              )
              v-menu(
                v-model='dateMenu'
                :close-on-content-click='false'
                :nudge-right='40'
                transition='scale-transition'
                offset-y
                min-width='290px'
              )
                template(v-slot:activator='{ on, attrs }')
                  v-text-field(
                    v-model='form.book.couchbase.serviceDate'
                    label='Service Date'
                    prepend-icon='mdi-calendar'
                    readonly
                    v-bind='attrs'
                    v-on='on'
                    :rules='[v => !!v || "Service Date is required"]'
                    required
                    outlined
                    dense
                  )
                v-date-picker(v-model='form.book.couchbase.serviceDate', @input='dateMenu = false')
              v-combobox(
                v-model='attendees'
                label='Attendees'
                multiple
                chips
                deletable-chips
                small-chips
                :rules='[v => v.length > 0 || "Attendees are required"]'
                required
                outlined
                dense
                hint='Type and press enter to add'
                persistent-hint
              )

      v-card-chin
        v-spacer
        v-btn(text, @click='close') Cancel
        v-btn.px-4(color='primary', @click='createReport', :loading='loading', :disabled='!valid')
          v-icon(left) mdi-check
          span Create Report
</template>

<script>
import { get } from 'vuex-pathify'

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      valid: true,
      loading: false,
      dateMenu: false,
      attendees: [],
      form: {
        snapshot: '',
        sg_snapshot: '',
        mobile: false,
        cao: false,
        book: {
          author: '',
          couchbase: {
            customer: '',
            email: '',
            role: 'Solutions Architect',
            service: 'Architecture Review',
            serviceDate: new Date().toISOString().substr(0, 10)
          }
        }
      }
    }
  },
  computed: {
    userName: get('user/name'),
    userEmail: get('user/email'),
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    }
  },
  watch: {
    isShown(val) {
      if (val) {
        this.form.book.author = this.userName
        this.form.book.couchbase.email = this.userEmail
      }
    }
  },
  methods: {
    close() {
      this.isShown = false
    },
    async createReport() {
      if (!this.$refs.form.validate()) return

      this.loading = true

      const payload = {
        generation: {
          snapshot: this.form.snapshot,
          sg_snapshot: this.form.sg_snapshot,
          mobile: this.form.mobile,
          cao: this.form.cao
        },
        book: {
          author: this.form.book.author,
          couchbase: {
            ...this.form.book.couchbase,
            attendees: this.attendees
          }
        }
      }

      try {
        const response = await fetch('/n8n/webhook/generate-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        if (response.ok) {
          const data = await response.json()
          if (data && data.path) {
            window.location.assign(data.path)
            this.close()
          } else {
            this.$store.commit('showNotification', {
              message: 'Report generation started successfully',
              style: 'success',
              icon: 'check'
            })
            this.close()
          }
        } else {
          throw new Error('Failed to generate report')
        }
      } catch (error) {
        console.error('Report generation error:', error)
        this.$store.commit('showNotification', {
          message: 'Failed to generate report',
          style: 'error',
          icon: 'alert'
        })
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style lang='scss'>
.new-report-dialog {
  .v-card__text {
    padding-top: 20px !important;
  }
}
</style>
