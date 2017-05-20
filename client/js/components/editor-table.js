// By fa93hws (wjun0912@gmail.com)
'use strict'


import $ from 'jquery'
import Vue from 'vue'
import _ from 'lodash'
import * as ace from 'brace'
import 'brace/theme/tomorrow_night'
import 'brace-ext-modelist'

let tableEditor = null;
require('brace/mode/markdown');
// require('brace/mode/html')


module.exports = (mde, mdeModalOpenState) => {
	let vueTable = new Vue({
		el: '#modal-editor-table',
		data: {
			modes : [
				{
					name: "markdown",
					caption : "markdown"
				},
				{
					name: "html",
					caption: "html"
				}
			],
			modeSelected: 'markdown',
			url: "http://www.tablesgenerator.com/markdown_tables",
			initContent: ''
		},
		watch: {
			modeSelected: (val, oldVal) => {
				tableEditor.getSession().setMode('ace/mode/' + val);
				vueTable.url = "http://www.tablesgenerator.com/" + val + "_tables";
			}
		},
		methods: {
			open: (ev) => {
				// alert(vueTable.initContent);
				mdeModalOpenState = true;
				$('#modal-editor-table').addClass('is-active');

				_.delay(() => {
					console.log(vueTable.initContent);
					tableEditor = ace.edit('table-editor');
					tableEditor.setTheme('ace/theme/tomorrow_night');
					tableEditor.getSession().setMode('ace/mode/' + vueTable.modeSelected);
					tableEditor.setOption('hScrollBarAlwaysVisible', false);
					tableEditor.setOption('wrap', true);

					tableEditor.setValue(vueTable.initContent);

					tableEditor.focus();
					tableEditor.renderer.updateFull();
					console.log(tableEditor.getValue());
				}, 300)
			},
			cancel: (ev) => {
				mdeModalOpenState = false;
				$('#modal-editor-table').removeClass('is-active');
				vueTable.initContent = '';
			},
			insertTable: (ev) => {
		        let tableText = '\n' + tableEditor.getValue() + '\n';

        		mde.codemirror.doc.replaceSelection(tableText)
				vueTable.cancel()
			}
		}
	})
	return vueTable
}