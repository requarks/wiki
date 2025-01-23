<template lang='pug'>
  .editor-ckeditor
    div(ref='toolbarContainer')
    div.contents(ref='editor')
    v-system-bar.editor-ckeditor-sysbar(dark, status, color='grey darken-3')
      .caption.editor-ckeditor-sysbar-locale {{locale.toUpperCase()}}
      .caption.px-3 /{{path}}
      template(v-if='$vuetify.breakpoint.mdAndUp')
        v-spacer
        .caption Visual Editor
        v-spacer
        .caption {{$t('editor:ckeditor.stats', { chars: stats.characters, words: stats.words })}}
    editor-conflict(v-model='isConflict', v-if='isConflict')
    page-selector(mode='select', v-model='insertLinkDialog', :open-handler='insertLinkHandler', :path='path', :locale='locale')
</template>

<script>
import _ from 'lodash'
import { get, sync } from 'vuex-pathify'
import DecoupledEditor from '@requarks/ckeditor5'
// import DecoupledEditor from '../../../../wiki-ckeditor5/build/ckeditor'
import EditorConflict from './ckeditor/conflict.vue'
import { html as beautify } from 'js-beautify/js/lib/beautifier.min.js'
import gql from 'graphql-tag'

/* global siteLangs */

export default {
  components: {
    EditorConflict
  },
  props: {
    save: {
      type: Function,
      default: () => { }
    }
  },
  data() {
    return {
      editor: null,
      stats: {
        characters: 0,
        words: 0
      },
      content: '',
      isConflict: false,
      insertLinkDialog: false
    }
  },
  computed: {
    isMobile() {
      return this.$vuetify.breakpoint.smAndDown
    },
    locale: get('page/locale'),
    path: get('page/path'),
    activeModal: sync('editor/activeModal')
  },
  methods: {
    insertLink() {
      this.insertLinkDialog = true
    },
    insertLinkHandler({ locale, path }) {
      this.editor.execute('link', siteLangs.length > 0 ? `/${locale}/${path}` : `/${path}`)
    },
    async fetchTags(queryText) {
      try {
        // Delay search by 300ms
        await new Promise(resolve => setTimeout(resolve, 500));

        const response = await this.$apollo.query({
          query: gql`
            query {
              pages {
                tags {
                  id
                  tag
                  title
                }
              }
            }
          `
        })

        if (!response.data.pages || !response.data.pages.tags) {
          return [];
        }

        // แปลงเป็น array ของ string แทน object และกรองเฉพาะ tag ที่ไม่ขึ้นต้นด้วย @ หรือ !
        const allTags = response.data.pages.tags
          .filter((tag, index, self) =>
            index === self.findIndex(t => t.id === tag.id) &&
            !tag.tag.startsWith('@') &&
            !tag.tag.startsWith('!')
          )
          .map(t => ({
            text: '#' + t.tag,  // ใช้สำหรับ filter และ insert
            title: t.title || t.tag  // ใช้สำหรับแสดงใน dropdown
          }))
          .filter(tag => tag.text.includes(queryText))
          .map(tag => ({
            id: tag.text,  // ใช้ text เป็น id
            text: tag.text,  // ข้อความที่จะถูกแทรก
            label: tag.title // ข้อความที่จะแสดงใน dropdown
          }));

        // เพิ่มแท็กใหม่ถ้าไม่อยู่ใน autocomplete list และไม่ขึ้นต้นด้วย @ หรือ !
        if (!allTags.some(tag => tag.text === `#${queryText}`) &&
            !queryText.startsWith('@') &&
            !queryText.startsWith('!')) {
          allTags.push({
            id: `#${queryText}`,
            text: `#${queryText}`,
            label: `${queryText}`
          });
        }

        return allTags;
      } catch (err) {
        console.error('Error fetching tags:', err)
        return []
      }
    },
    async fetchPeople(queryText) {
      try {
        // Delay search by 300ms
        await new Promise(resolve => setTimeout(resolve, 500));

        const response = await this.$apollo.query({
          query: gql`
            query {
              pages {
                tags {
                  id
                  tag
                  title
                }
              }
            }
          `
        })

        if (!response.data.pages || !response.data.pages.tags) {
          return [];
        }

        // กรองเฉพาะ tag ที่ขึ้นต้นด้วย @
        const allPeople = response.data.pages.tags
          .filter((tag, index, self) =>
            index === self.findIndex(t => t.id === tag.id) &&
            tag.tag.startsWith('@')
          )
          .map(t => ({
            id: t.tag,
            text: t.tag,
            // ใช้ tag เต็มรูปแบบเป็น label เพื่อให้แสดงชื่อเต็ม
            label: t.title || t.tag
          }))
          // ปรับการ filter ให้ค้นหาได้ทั้งชื่อเต็มและบางส่วน
          .filter(person => {
            const searchText = queryText.toLowerCase();
            return person.text.toLowerCase().includes(searchText) ||
                   person.label.toLowerCase().includes(searchText);
          });

        // เพิ่มคนใหม่ถ้าไม่อยู่ใน list และมีการพิมพ์ข้อความ
        if (queryText && !allPeople.some(person => person.text === `@${queryText}`)) {
          allPeople.push({
            id: `@${queryText}`,
            text: `@${queryText}`,
            label: `@${queryText}`
          });
        }

        return allPeople;
      } catch (err) {
        console.error('Error fetching people:', err)
        return []
      }
    },
    async fetchPlace(queryText) {
      try {
        // Delay search by 300ms
        await new Promise(resolve => setTimeout(resolve, 500));

        const response = await this.$apollo.query({
          query: gql`
            query {
              pages {
                tags {
                  id
                  tag
                  title
                }
              }
            }
          `
        })

        if (!response.data.pages || !response.data.pages.tags) {
          return [];
        }

        // กรองเฉพาะ tag ที่ขึ้นต้นด้วย !
        const allPlaces = response.data.pages.tags
          .filter((tag, index, self) =>
            index === self.findIndex(t => t.id === tag.id) &&
            tag.tag.startsWith('!')
          )
          .map(t => ({
            id: t.tag,
            text: t.tag,
            label: t.title || t.tag.substring(1) // ตัด ! ออกถ้าไม่มี title
          }))
          .filter(place => place.text.toLowerCase().includes(queryText.toLowerCase()));

        // เพิ่มสถานที่ใหม่ถ้าไม่อยู่ใน list
        if (!allPlaces.some(place => place.text === `!${queryText}`)) {
          allPlaces.push({
            id: `!${queryText}`,
            text: `!${queryText}`,
            label: `!${queryText}`
          });
        }

        return allPlaces;
      } catch (err) {
        console.error('Error fetching places:', err)
        return []
      }
    }
  },
  async mounted() {
    this.$store.set('editor/editorKey', 'ckeditor')

    this.editor = await DecoupledEditor.create(this.$refs.editor, {
      language: this.locale,
      placeholder: 'Type the page content here',
      disableNativeSpellChecker: false,
      mention: {
        feeds: [
          {
            marker: '#',
            feed: async (queryText) => {
              return await this.fetchTags(queryText)
            },
            dropdownLimit: 10,
            minimumCharacters: 2,
            itemRenderer: item => {
              const div = document.createElement('div');
              div.classList.add('custom-item', 'hashtag-item');

              // สร้าง <span> สำหรับ hashtag symbol และ text
              const span = document.createElement('span');
              span.classList.add('hashtag-text');
              span.textContent = `#${item.label}`;

              div.appendChild(span);
              return div;
            },
            // เพิ่ม handler สำหรับกรณีที่ผู้ใช้พิมพ์ # แต่ไม่ได้เลือกจาก dropdown
            dropdownOnEmpty: true, // แสดง dropdown แม้ไม่มีผลลัพธ์
            defaultItem: (queryText) => {
              return {
                id: queryText,
                text: `#${queryText}`,
                label: queryText,
                // เพิ่ม class hashtag-text เมื่อแทรกลงไป
                renderer: () => {
                  const span = document.createElement('span');
                  span.classList.add('hashtag-text');
                  span.textContent = `#${queryText}`;
                  return span;
                }
              };
            }
          },
          {
            marker: '@',
            feed: async (queryText) => {
              return await this.fetchPeople(queryText)
            },
            dropdownLimit: 10,
            minimumCharacters: 2,
            // ปรับ itemRenderer ให้แสดงผลเต็มรูปแบบ
            itemRenderer: item => {
              const div = document.createElement('div');
              div.classList.add('custom-item', 'mention-item');

              // แสดงชื่อเต็มรูปแบบ
              const nameSpan = document.createElement('span');
              nameSpan.classList.add('mention-text');
              nameSpan.textContent = item.label;

              div.appendChild(nameSpan);
              return div;
            },
            // ปรับ defaultItem ให้รองรับการพิมพ์ชื่อที่มีเครื่องหมายพิเศษ
            defaultItem: (queryText) => ({
              id: queryText,
              text: `@${queryText}`,
              label: `@${queryText}`
            })
          },
          {
            marker: '!',
            feed: async (queryText) => {
              return await this.fetchPlace(queryText)
            },
            dropdownLimit: 10,
            minimumCharacters: 2,
            itemRenderer: item => {
              const div = document.createElement('div');
              div.classList.add('custom-item', 'place-item');
              div.textContent = item.label;
              return div;
            },
            defaultItem: (queryText) => ({
              id: queryText,
              text: `!${queryText}`,
              label: queryText
            })
          }
        ]
      },
      wordCount: {
        onUpdate: stats => {
          this.stats = {
            characters: stats.characters,
            words: stats.words
          }
        }
      }
    })
    this.$refs.toolbarContainer.appendChild(this.editor.ui.view.toolbar.element)

    if (this.mode !== 'create') {
      this.editor.setData(this.$store.get('editor/content'))
    }

    this.editor.model.document.on('change:data', _.debounce(evt => {
      let content = this.editor.getData();

      // ตรวจสอบ `#` ที่ไม่ได้อยู่ใน `<span>` แล้วเพิ่ม `<span>` ห่อหุ้ม
      content = content.replace(
        /(^|\s)#(\w+)/g,
        (match, space, tag) => `${space}<span class="hashtag-text">#${tag}</span>`
      );

      this.$store.set('editor/content', beautify(content, {
        indent_size: 2,
        end_with_newline: true
      }));
    }, 500));

    this.$root.$on('editorInsert', opts => {
      switch (opts.kind) {
        case 'IMAGE':
          this.editor.execute('imageInsert', {
            source: opts.path
          })
          break
        case 'BINARY':
          this.editor.execute('link', opts.path, {
            linkIsDownloadable: true
          })
          break
        case 'DIAGRAM':
          this.editor.execute('imageInsert', {
            source: `data:image/svg+xml;base64,${opts.text}`
          })
          break
      }
    })

    this.$root.$on('editorLinkToPage', opts => {
      this.insertLink()
    })

    // Handle save conflict
    this.$root.$on('saveConflict', () => {
      this.isConflict = true
    })
    this.$root.$on('overwriteEditorContent', () => {
      this.editor.setData(this.$store.get('editor/content'))
    })
  },
  beforeDestroy() {
    if (this.editor) {
      this.editor.destroy()
      this.editor = null
    }
  }
}
</script>

<style lang="scss">
$editor-height: calc(100vh - 64px - 24px);
$editor-height-mobile: calc(100vh - 56px - 16px);

.editor-ckeditor {
  background-color: mc('grey', '200');
  flex: 1 1 50%;
  display: flex;
  flex-flow: column nowrap;
  height: $editor-height;
  max-height: $editor-height;
  position: relative;

  @at-root .theme--dark & {
    background-color: mc('grey', '900');
  }

  @include until($tablet) {
    height: $editor-height-mobile;
    max-height: $editor-height-mobile;
  }

  &-sysbar {
    padding-left: 0;

    &-locale {
      background-color: rgba(255, 255, 255, .25);
      display: inline-flex;
      padding: 0 12px;
      height: 24px;
      width: 63px;
      justify-content: center;
      align-items: center;
    }
  }

  .contents {
    table {
      margin: inherit;
    }

    pre>code {
      background-color: unset;
      color: unset;
      padding: .15em;
    }
  }

  .ck.ck-toolbar {
    border: none;
    justify-content: center;
    background-color: mc('grey', '300');
    color: #FFF;
  }

  .ck.ck-toolbar__items {
    justify-content: center;
  }

  >.ck-editor__editable {
    background-color: mc('grey', '100');
    overflow-y: auto;
    overflow-x: hidden;
    padding: 2rem;
    box-shadow: 0 0 5px hsla(0, 0, 0, .1);
    margin: 1rem auto 0;
    width: calc(100vw - 256px - 16vw);
    min-height: calc(100vh - 64px - 24px - 1rem - 40px);
    border-radius: 5px;

    @at-root .theme--dark & {
      background-color: #303030;
      color: #FFF;
    }

    @include until($widescreen) {
      width: calc(100vw - 2rem);
      margin: 1rem 1rem 0 1rem;
      min-height: calc(100vh - 64px - 24px - 1rem - 40px);
    }

    @include until($tablet) {
      width: 100%;
      margin: 0;
      min-height: calc(100vh - 56px - 24px - 76px);
    }

    &.ck.ck-editor__editable:not(.ck-editor__nested-editable).ck-focused {
      border-color: #FFF;
      box-shadow: 0 0 10px rgba(mc('blue', '700'), .25);

      @at-root .theme--dark & {
        border-color: #444;
        border-bottom: none;
        box-shadow: 0 0 10px rgba(#000, .25);
      }
    }

    &.ck .ck-editor__nested-editable.ck-editor__nested-editable_focused,
    &.ck .ck-editor__nested-editable:focus,
    .ck-widget.table td.ck-editor__nested-editable.ck-editor__nested-editable_focused,
    .ck-widget.table th.ck-editor__nested-editable.ck-editor__nested-editable_focused {
      background-color: mc('grey', '100');

      @at-root .theme--dark & {
        background-color: mc('grey', '900');
      }
    }
  }
}

.hashtag-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;

  .hashtag-symbol {
    color: #ce5c19; // สีน้ำเงิน
    font-weight: bold;
    margin-right: 2px;
  }

  .hashtag-text {
    color: #333;
  }
}

// สำหรับ Dark theme
.theme--dark {
  .hashtag-item {
    .hashtag-symbol {
      color: #64b5f6; // สีน้ำเงินอ่อนสำหรับ dark theme
    }

    .hashtag-text {
      color: #fff;
    }
  }
}

.ck-content {
  .hashtag-text {
    color: #1976d2 !important;
    font-weight: 500;
  }

  p {
    span:not(.mention):not(.hashtag-text) {
      &:matches([textContent^="#"]) {
        color: #1976d2 !important;
        font-weight: 500;
      }
    }
  }
}

// Dark theme
.theme--dark .ck-content {
  .hashtag-text {
    color: #64b5f6 !important;
  }

  p {
    span:not(.mention):not(.hashtag-text) {
      &:matches([textContent^="#"]) {
        color: #64b5f6 !important;
      }
    }
  }
}

.mention-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;

  .mention-text {
    color: #333;
    &:hover {
      color: #1976d2;
    }
  }
}

.theme--dark {
  .mention-item {
    .mention-text {
      color: #fff;
      &:hover {
        color: #64b5f6;
      }
    }
  }
}

// สำหรับ mention ในเนื้อหา
.ck-content {
  .mention {
    background: unset;
    color: #1976d2 !important;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
      cursor: pointer;
    }
  }
}

.theme--dark .ck-content {
  .mention {
    color: #64b5f6 !important;
  }
}
</style>
