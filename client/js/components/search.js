"use strict";

jQuery( document ).ready(function( $ ) {

	if($('#search-input').length) {

		$('#search-input').focus();

		Vue.transition('slide', {
			enterClass: 'slideInDown',
			leaveClass: 'fadeOutUp'
		});

		$('.searchresults').css('display', 'block');

		var vueHeader = new Vue({
			el: '#header-container',
			data: {
				searchq: '',
				searchres: [],
				searchsuggest: [],
				searchload: 0,
				searchactive: false,
				searchmoveidx: 0,
				searchmovekey: '',
				searchmovearr: []
			},
			watch: {
				searchq: (val, oldVal) => {
					vueHeader.searchmoveidx = 0;
					if(val.length >= 3) {
						vueHeader.searchactive = true;
						vueHeader.searchload++;
						socket.emit('search', { terms: val }, (data) => {
							vueHeader.searchres = data.match;
							vueHeader.searchsuggest = data.suggest;
							vueHeader.searchmovearr = _.concat([], vueHeader.searchres, vueHeader.searchsuggest);
							if(vueHeader.searchload > 0) { vueHeader.searchload--; }
						});
					} else {
						vueHeader.searchactive = false;
						vueHeader.searchres = [];
						vueHeader.searchsuggest = [];
						vueHeader.searchmovearr = [];
						vueHeader.searchload = 0;
					}
				},
				searchmoveidx: (val, oldVal) => {
					if(val > 0) {
						vueHeader.searchmovekey = (vueHeader.searchmovearr[val - 1].document) ?
																				'res.' + vueHeader.searchmovearr[val - 1].document.entryPath :
																				'sug.' + vueHeader.searchmovearr[val - 1];
					} else {
						vueHeader.searchmovekey = '';
					}
				}
			},
			methods: {
				useSuggestion: (sug) => {
					vueHeader.searchq = sug;
				},
				closeSearch: () => {
					vueHeader.searchq = '';
				},
				moveSelectSearch: () => {
					if(vueHeader.searchmoveidx < 1) { return; }
					let i = vueHeader.searchmoveidx - 1;

					if(vueHeader.searchmovearr[i].document) {
						window.location.assign('/' + vueHeader.searchmovearr[i].document.entryPath);
					} else {
						vueHeader.searchq = vueHeader.searchmovearr[i];
					}

				},
				moveDownSearch: () => {
					if(vueHeader.searchmoveidx < vueHeader.searchmovearr.length) {
						vueHeader.searchmoveidx++;
					}
				},
				moveUpSearch: () => {
					if(vueHeader.searchmoveidx > 0) {
						vueHeader.searchmoveidx--;
					}
				}
			}
		});

		$('main').on('click', vueHeader.closeSearch);

	}

});