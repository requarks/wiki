<template>
<div><div id="insertHere"><slot></slot></div></div>
</template>

<!--
  Purpose: Define a Vue component in a wiki page (Using conventions set below). 
      Tag one or more such component page(s). And then use these new 
      components (in /Components/StudentsTable, /Components/ParentsList) in 
      any new wiki page like this: 

       <page-component tag="tagname">
           <StudentsList />
           <ParentsList />
        </page-component> 
  
  For example, you can define a component to fetch data from remote server 
  using axios and display it as table using bootstrap-vue. 
  And this table can then be displayed in any other wiki page.

  To define a component, create a component in a page, say, 
  "/Components/StudentsList". Use HTML as page content type. 
  (Only source content is used, and not rendered HTML.)

     <!-- COMPONENT 
     <template>
       ...
     </template>
     <script>
       ... 
     </script>
     <style>
     </style>
      ...  ENDCOMPONENT -->

  Here, the lines between COMPONENT and ENDCOMPONENT are taken as Vue file. 
  Which tags (html comments above for e.g.) you use doesn't matter, since 
  we only search for two lines using regular expression matching these two 
  words. 

  Name of the page will be component name (don't use .vue). It should ideally
  be camelcase, such as 'SomePageComponent1'. To use it in another wiki page, 
  use kebab-case names such as some-page-component (as per component name 
  conventions of Vue). 
   
  NOTE: For Security considerations /Components path is hardcoded, and it can
  be athorized appropriately.

-->


<script>
 import Vue from 'vue'
 import BootstrapVue from 'bootstrap-vue'
 import httpVueLoader from 'http-vue-loader'
 import axios from 'axios'
 import gql from 'graphql-tag'

 let page_component_mixin = {
  data: function () {
    return {
      axios: axios
    }
  }
 }
 Vue.mixin(page_component_mixin)
 Vue.use(BootstrapVue)

 async function preparePageComponents(vm, tagname) 
 {
     // Get pages tagged with specified component. 
     const response = await vm.$apollo.query({
     query: gql`query ($tags: [String!]) {
             pages {
               list(tags: $tags) {
                  id
                  path
               }
             }
         }`,
         variables: {
            tags: [ tagname ]
         }
    });
    // Our tagged page list is in: response.data.pages.list
    let page_arr = response.data.pages.list
    let page_components_info = {}
    page_arr.map((pageinfo) => {
         let m=pageinfo.path.match(/^Components\/([a-zA-Z0-9]+\/)*([a-zA-Z0-9]+)$/)
         if (m) {
            let name = m && m[2] 
            let url = '/' + name + '.vue'
            page_components_info[url] = {
              id: pageinfo.id,
              path: pageinfo.path,
              name: name,
              url: url
            }
         }
    })
    return page_components_info;
  }

 function wrapHttpRequest(vm, page_components_info) {

      async function fetchPageVueComponent(vm, page_id) {
         const response = await vm.$apollo.query({
           query: gql`query($id: Int!) {
                   pages {
                      single(id: $id) {
                         id
                         path
                         content
                      }
                   }
           }`,
           variables: {
                   id: page_id 
           }
         });
         const regexp = /COMPONENT([^\n]+)([^]*\n)[^\n]*ENDCOMPONENT/
         let m=response.data.pages.single.content.match(regexp)
         let content = m ? m[2] : ""

         return content
     }
     return function(url) {
         return new Promise(function(resolve, reject) {
              let info = page_components_info[url]
              fetchPageVueComponent(vm, info.id).then((content)=>resolve(content));
         })
     }   
 }


 export default {
   props: {
    tagname: {
      type: String, default: "component"
    }
   },
   data: function() {
       return {
         page_components_info: {}
       }
   },
   async mounted() {
       let self = this
       this.page_components_info = await preparePageComponents(this, this.tagname); 

       httpVueLoader.httpRequest = wrapHttpRequest(this, this.page_components_info);

       let newComponent = { 
                 el: "#insertHere", 
                 components: {},
                 data: function() { 
                     return {
                     }
                 },
                 template: self.$slots.default.innerHTML, 
                 no_template: '<div>{{hello}} Am I visible?<ListHospitalsStrapi/></div>',
                 no_render: (createElement) => {
                   const template = `<div>{{hello}} FINALLy! <list-hospitals-strapi/></div>`;
                   const compiledTemplate = Vue.compile(template);
                   // return createElement('TestMe', 'From Render Function');
                   return compiledTemplate.render.call(this, createElement);
                 }
       };
       Object.keys(this.page_components_info).map((key) => {
                let c = this.page_components_info[key]

                let component = Vue.component(c.name, httpVueLoader(c.url))
                newComponent.components[c.name] = component })
       new Vue(newComponent);
   }
  }
</script>
