/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

// The editor creator to use.
import DecoupledEditorBase from '@ckeditor/ckeditor5-editor-decoupled/src/decouplededitor';

import Alignment from '@ckeditor/ckeditor5-alignment/src/alignment';
import Autoformat from '@ckeditor/ckeditor5-autoformat/src/autoformat';
import BlockQuote from '@ckeditor/ckeditor5-block-quote/src/blockquote';
import Bold from '@ckeditor/ckeditor5-basic-styles/src/bold';
import CKFinder from '@ckeditor/ckeditor5-ckfinder/src/ckfinder';
import Code from '@ckeditor/ckeditor5-basic-styles/src/code.js';
import CodeBlock from '@ckeditor/ckeditor5-code-block/src/codeblock.js';
import Essentials from '@ckeditor/ckeditor5-essentials/src/essentials';
import FontFamily from '@ckeditor/ckeditor5-font/src/fontfamily';
import FontSize from '@ckeditor/ckeditor5-font/src/fontsize';
import Heading from '@ckeditor/ckeditor5-heading/src/heading';
import Highlight from '@ckeditor/ckeditor5-highlight/src/highlight';
import HorizontalLine from '@ckeditor/ckeditor5-horizontal-line/src/horizontalline.js';
import Image from '@ckeditor/ckeditor5-image/src/image';
import ImageCaption from '@ckeditor/ckeditor5-image/src/imagecaption';
import ImageResize from '@ckeditor/ckeditor5-image/src/imageresize';
import ImageStyle from '@ckeditor/ckeditor5-image/src/imagestyle';
import ImageToolbar from '@ckeditor/ckeditor5-image/src/imagetoolbar';
import ImageUpload from '@ckeditor/ckeditor5-image/src/imageupload';
// import Indent from '@ckeditor/ckeditor5-indent/src/indent.js';
// import IndentBlock from '@ckeditor/ckeditor5-indent/src/indentblock.js';
import Italic from '@ckeditor/ckeditor5-basic-styles/src/italic';
import Link from '@ckeditor/ckeditor5-link/src/link';
import List from '@ckeditor/ckeditor5-list/src/list';
import MediaEmbed from '@ckeditor/ckeditor5-media-embed/src/mediaembed';
import Mention from '@ckeditor/ckeditor5-mention/src/mention.js';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import PasteFromOffice from '@ckeditor/ckeditor5-paste-from-office/src/pastefromoffice';
import RemoveFormat from '@ckeditor/ckeditor5-remove-format/src/removeformat';
import SpecialCharacters from '@ckeditor/ckeditor5-special-characters/src/specialcharacters.js';
import SpecialCharactersArrows from '@ckeditor/ckeditor5-special-characters/src/specialcharactersarrows.js';
import SpecialCharactersCurrency from '@ckeditor/ckeditor5-special-characters/src/specialcharacterscurrency.js';
import SpecialCharactersEssentials from '@ckeditor/ckeditor5-special-characters/src/specialcharactersessentials.js';
import SpecialCharactersLatin from '@ckeditor/ckeditor5-special-characters/src/specialcharacterslatin.js';
import SpecialCharactersMathematical from '@ckeditor/ckeditor5-special-characters/src/specialcharactersmathematical.js';
import SpecialCharactersText from '@ckeditor/ckeditor5-special-characters/src/specialcharacterstext.js';
import Strikethrough from '@ckeditor/ckeditor5-basic-styles/src/strikethrough';
import Subscript from '@ckeditor/ckeditor5-basic-styles/src/subscript.js';
import Superscript from '@ckeditor/ckeditor5-basic-styles/src/superscript.js';
import Table from '@ckeditor/ckeditor5-table/src/table';
import TableCellProperties from '@ckeditor/ckeditor5-table/src/tablecellproperties';
import TableProperties from '@ckeditor/ckeditor5-table/src/tableproperties';
import TableToolbar from '@ckeditor/ckeditor5-table/src/tabletoolbar.js';
import TextTransformation from '@ckeditor/ckeditor5-typing/src/texttransformation.js';
import TodoList from '@ckeditor/ckeditor5-list/src/todolist';
import Underline from '@ckeditor/ckeditor5-basic-styles/src/underline';
import UploadAdapter from '@ckeditor/ckeditor5-adapter-ckfinder/src/uploadadapter';
import WordCount from '@ckeditor/ckeditor5-word-count/src/wordcount';

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';

import imageIcon from '@ckeditor/ckeditor5-core/theme/icons/image.svg';
import pencilIcon from '@ckeditor/ckeditor5-core/theme/icons/pencil.svg';
import linkToPageIcon from '../../../static/ckeditor5-svg/link-to-page.svg';
import diagramIcon from '../../../static/ckeditor5-svg/diagram.svg';

export default class DecoupledEditor extends DecoupledEditorBase {}

/* global WIKI */

class LinkToPage extends Plugin {
  init() {
    const editor = this.editor;

    editor.ui.componentFactory.add( 'linkToPage', locale => {
      const view = new ButtonView( locale );

      view.set( {
        label: 'Insert Link to Page',
        icon: linkToPageIcon,
        tooltip: true
      } );

      view.on( 'execute', () => {
        WIKI.$emit( 'editorLinkToPage' );
      } );

      return view;
    } );
  }
}

class InsertAsset extends Plugin {
  init() {
    const editor = this.editor;

    editor.ui.componentFactory.add( 'insertAsset', locale => {
      const view = new ButtonView( locale );

      view.set( {
        label: 'Insert Assets',
        icon: imageIcon,
        tooltip: true
      } );

      view.on( 'execute', () => {
        WIKI.$store.set( 'editor/activeModal', 'editorModalMedia' );
      } );

      return view;
    } );
  }
}

class InsertDiagram extends Plugin {
  init() {
    const editor = this.editor;

    editor.ui.componentFactory.add('insertDiagram', locale => {
      const button = new ButtonView( locale );

      button.set( {
        label: 'Insert diagram',
        icon: diagramIcon,
        tooltip: true
    } );

    button.on( 'execute', () => {
      WIKI.$emit('insertDiagram');
  } );

    return button;
    } );
  }
}

class EditDiagram extends Plugin {
  init() {
    const editor = this.editor;

    editor.ui.componentFactory.add('editDiagram', locale => {
      const button = new ButtonView( locale );

                button.set( {
                  label: 'Edit diagram',
                  icon: pencilIcon,
                  tooltip: true
                } );

      button.on( 'execute', () => {
        WIKI.$emit('editDiagram');
      } );

      return button;
    } );
  }
}

// Plugins to include in the build.
DecoupledEditor.builtinPlugins = [
  Alignment,
  Autoformat,
  BlockQuote,
  Bold,
  CKFinder,
  Code,
  CodeBlock,
  EditDiagram,
  Essentials,
  FontFamily,
  FontSize,
  Heading,
  Highlight,
  HorizontalLine,
  Image,
  ImageCaption,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  // Indent,
  // IndentBlock,
  InsertAsset,
  InsertDiagram,
  Italic,
  Link,
  LinkToPage,
  List,
  MediaEmbed,
  Mention,
  Paragraph,
  PasteFromOffice,
  RemoveFormat,
  SpecialCharacters,
  SpecialCharactersArrows,
  SpecialCharactersCurrency,
  SpecialCharactersEssentials,
  SpecialCharactersLatin,
  SpecialCharactersMathematical,
  SpecialCharactersText,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TableCellProperties,
  TableProperties,
  TableToolbar,
  TextTransformation,
  TodoList,
  Underline,
  UploadAdapter,
  WordCount
];

// Editor configuration.
DecoupledEditor.defaultConfig = {
  toolbar: {
    items: [
      'heading',
      '|',
      'fontsize',
      'fontfamily',
      '|',
      'bold',
      'italic',
      'underline',
      'strikethrough',
      'subscript',
      'superscript',
      'highlight',
      '|',
      'alignment',
      '|',
      'numberedList',
      'bulletedList',
      'todoList',
      '|',
      'specialCharacters',
      'linkToPage',
      'link',
      'blockquote',
      'insertAsset',
      'insertTable',
      'insertDiagram',
      'code',
      'codeBlock',
      'mediaEmbed',
      'horizontalLine',
      '|',
      'removeFormat',
      '|',
      'undo',
      'redo'
    ]
  },
  heading: {
    options: [
      { model: 'paragraph', title: 'Paragraph', class: '' },
      { model: 'heading1', view: 'h1', title: 'Heading 1', class: '' },
      { model: 'heading2', view: 'h2', title: 'Heading 2', class: '' },
      { model: 'heading3', view: 'h3', title: 'Heading 3', class: '' },
      { model: 'heading4', view: 'h4', title: 'Heading 4', class: '' },
      { model: 'heading5', view: 'h5', title: 'Heading 5', class: '' },
      { model: 'heading6', view: 'h6', title: 'Heading 6', class: '' }
    ]
  },
  image: {
    styles: [
      'full',
      'alignLeft',
      'alignRight'
    ],
    toolbar: [
      'imageStyle:alignLeft',
      'imageStyle:full',
      'imageStyle:alignRight',
      '|',
      'imageTextAlternative',
      '|',
      'editDiagram'
    ]
  },
  table: {
    contentToolbar: [
      'tableColumn',
      'tableRow',
      'mergeTableCells',
      'tableCellProperties',
      'tableProperties'
    ]
  },
  // This value must be kept in sync with the language defined in webpack.dev.js and webpack.prod.js.
  language: 'en'
};
