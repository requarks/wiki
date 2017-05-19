// By fa93hws (wjun0912@gmail.com)
'use strict'


import $ from 'jquery'
import Vue from 'vue'
import _ from 'lodash'
import * as ace from 'brace'
import 'brace/theme/tomorrow_night'
import 'brace/mode/markdown'
import 'brace-ext-modelist'

let tableEditor = null;


module.exports = (mde, mdeModalOpenState) => {
	let modelist = ace.acequire('ace/ext/modelist')
	let vueTable = new Vue({
		el: '#modal-editor-table',
		data: {
			// modes: modelist.modesByName,
			modes : [{SpreadSheet:{name:"SpreadSheet",mode:"",extensions:"",caption:"S"}}],
			modeSelected: 'Text',
			initContent: ''
		},
		watch: {
			modeSelected: (val, oldVal) => {
				loadAceMode(val).done(() => {
					alert("1");
					// ace.acequire('ace/mode/' + val)
					// tableEditor.getSession().setMode('ace/mode/' + val)
				})
			}
		},
		methods: {
			open: (ev) => {
			mdeModalOpenState = true;
				$('#modal-editor-table').addClass('is-active');

				// _.delay(() => {
				// 	tableEditor = ace.edit('table-editor');
				// 	tableEditor.setTheme('ace/theme/tomorrow_night');
				// 	tableEditor.getSession().setMode('ace/mode/' + 'text');
				// 	tableEditor.setOption('fontSize', '14px');
				// 	tableEditor.setOption('hScrollBarAlwaysVisible', false);
				// 	tableEditor.setOption('wrap', true);

				// 	tableEditor.setValue("");

				// 	tableEditor.focus()
				// 	tableEditor.renderer.updateFull()
				// }, 300)
			},
			cancel: (ev) => {
				mdeModalOpenState = false;
				$('#modal-editor-table').removeClass('is-active');
				vueTable.initContent = '';
			},
			insertTable: (ev) => {
				vueTable.cancel()
			}
		}
	})
	return vueTable
}