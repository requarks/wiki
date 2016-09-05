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
					searchmoveidx: 0;
					if(val.length >= 3) {
						vueHeader.searchactive = true;
						vueHeader.searchload++;
						socket.emit('search', { terms: val }, (data) => {
							vueHeader.searchres = data.match;
							vueHeader.searchsuggest = data.suggest;
							if(vueHeader.searchload > 0) { vueHeader.searchload--; }
						});
					} else {
						vueHeader.searchactive = false;
						vueHeader.searchres = [];
						vueHeader.searchsuggest = [];
						vueHeader.searchload = 0;
					}
				},
				searchmoveidx: (val, oldVal) => {

				}
			},
			methods: {
				useSuggestion: (sug) => {
					vueHeader.searchq = sug;
				},
				closeSearch: () => {
					vueHeader.searchq = '';
					vueHeader.searchactive = false;
				},
				moveSelectSearch: () => {

				},
				moveDownSearch: () => {
					if(vueHeader.searchmoveidx < vueHeader.searchmovearr) {
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