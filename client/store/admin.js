import { make } from 'vuex-pathify'
import { gql } from "@apollo/client/core";
import pagesQuery from 'gql/admin/pages/pages-query-list.gql'

const state = {
  info: {
    currentVersion: 'n/a',
    latestVersion: 'n/a',
    groupsTotal: 0,
    pagesTotal: 0,
    usersTotal: 0
  },
  sites: []
}

export default {
  namespaced: true,
  state,
  mutations: {
    ...make.mutations(state),
  SET_SITES(state, sites) {
    state.sites = sites;
  },
},

  actions: {
      async fetchSites({ commit }, { apolloClient }) {
        try {
          const response = await apolloClient.query({
            query: pagesQuery,
            fetchPolicy: 'network-only'
          });
  
          console.log(response.data);
          console.log("Fetched Sites:", response.data.pages.list); 
          const sites = response.data.pages.list;
  
          commit("SET_SITES", sites);
          return response;
        } catch (error) {
          console.error("Error fetching sites:", error);
          throw error;
        }
      },
  },
};
