// By fa93hws (wjun0912@gmail.com)
'use strict'


import $ from 'jquery'
import Vue from 'vue'
import _ from 'lodash'
import Handsontable from 'handsontable'
// It seems that handsontable does not fully support ES6 and the js file is copy&past and included in editor-table.pug

let tableEditor = null;


module.exports = (alerts, mde, mdeModalOpenState) => {
	let vueTable = new Vue({
		el: '#modal-editor-table',
		data: {
			table:null,
			row:2,
			col:2,
			initContent:'',
			prefixContent:'',
			resContent:''

		},
		watch: {
			modeSelected: (val, oldVal) => {
				tableEditor.getSession().setMode('ace/mode/' + val);
				vueTable.url = "http://www.tablesgenerator.com/" + val + "_tables";
			}
		},
		methods: {
			open: (ev) => {
				mdeModalOpenState = true;

				$('#modal-editor-table').addClass('is-active');
				let tableEditorArea = document.getElementById('table-editor');
				let pw = tableEditorArea.parentElement.clientWidth;
				let ph = tableEditorArea.parentElement.parentHeight;
				tableEditorArea.innerHTML= "";
				let tableData = [
					["", "","","","",""],["", "","","","",""],["", "","","","",""],["", "","","","",""],["", "","","","",""]
				];
				if (vueTable.initContent!==""){
					try{
						let mdTable = vueTable.initContent;
						let tokens = require('markdown-it')().parse(mdTable.join('\n'), {});
						tableData = [];
						let trOpen = false;
						let tdOpen = false;
						let row = -1;
						for (let i=0; i<tokens.length;i++){
							let token = tokens[i];
							if (token.type == "inline")
								tableData[row].push(token.content);
							if (token.tag == "tr" && token.type == "tr_open"){
								tableData.push([]);
								row++;
							}
						}
					}
					catch(err){
						alerts.pushError('Invalid selection', 'Not Markdown table format');
						vueTable.cancel();
					}
				}
				_.delay(() => {
					vueTable.table = new Handsontable(tableEditorArea,{
						width: pw * 0.75,
						height: ph * 1.2,
				    	minSpareCols: 1,
  						minSpareRows: 1,
						data:tableData,
						contextMenu: true,
					  	rowHeaders: true,
  						colHeaders: true,
  						fixedColumnsLeft: 1,
  						fixedRowsTop:1
					});
					vueTable.getTableSize();
					let hooks = Handsontable.hooks.getRegistered();
					hooks.forEach(function(hook) {
					    if (hook === 'afterCreateRow' || hook === 'afterRemoveRow' || hook === 'afterCreateCol' || hook === 'afterRemoveCol') {
					    	vueTable.getTableSize();
					    }
				  	});
				}, 300)
			},
			cancel: (ev) => {
				mdeModalOpenState = false;
				$('#modal-editor-table').removeClass('is-active');
				vueTable.initContent = '';
				mde.codemirror.focus();
			},
			insertTable: (ev) => {
				let rawData = vueTable.table.getSourceData();
				// remove empty rows and cols
				let emptyCols = vueTable.table.countEmptyCols(true);
				let emptyRows = vueTable.table.countEmptyRows(true);
				let data = [];
				for (let i = 0; i < rawData.length - emptyRows;i++){
					data.push([]);
					for (let j = 0; j < rawData[0].length - emptyCols;j++){
						if (rawData[i][j] && rawData[i][j].indexOf("|")>-1){
							rawData[i][j] = rawData[i][j].replace("|","&#124;");
						}
						data[i].push(rawData[i][j]);
					}
				}
				let mdTable = require('markdown-table')(data);
				console.log(vueTable.prefixContent);
				console.log(vueTable.resContent);
				if(vueTable.prefixContent && vueTable.prefixContent!="")
					mdTable = vueTable.prefixContent.join("\r\n") + "\r\n" + mdTable;
				if(vueTable.resContent && vueTable.resContent!="")
					mdTable += "\r\n" + vueTable.resContent.join("\r\n");
		        mde.codemirror.doc.replaceSelection( mdTable);
        		vueTable.cancel();
			},
			rowAdd:(ev)=>{
				vueTable.table.alter('insert_row');
				vueTable.getTableSize();
			},
			rowMinus:(ev)=>{
				vueTable.table.alter('remove_row',vueTable.row-1);
				vueTable.getTableSize();
			},
			colAdd:(ev)=>{
				vueTable.table.alter('insert_col');
				vueTable.getTableSize();
			},
			colMinus:(ev)=>{
				vueTable.table.alter('remove_col',vueTable.col-1);
				vueTable.getTableSize();
			},
			setTableSize:(ev)=>{
				let row = vueTable.table.countRows();
				let col = vueTable.table.countCols();
				let rowChange = vueTable.row - row;
				let colChange = vueTable.col - col;
				if (rowChange == 0 && colChange == 0){
					getTableSize();
					return;
				}
				if (rowChange > 0)
					vueTable.table.alter('insert_row',row-1,rowChange);
				else if (rowChange <0)
					vueTable.table.alter('remove_row',row+rowChange,-rowChange);
				if (colChange > 0)
					vueTable.table.alter('insert_col',col-1,colChange);
				else if (colChange <0)
					vueTable.table.alter('remove_col',col+colChange,-colChange);

			},
			getTableSize:()=>{
				vueTable.row = vueTable.table.countRows();
				vueTable.col = vueTable.table.countCols();
			}
		}
	})
	return vueTable
}