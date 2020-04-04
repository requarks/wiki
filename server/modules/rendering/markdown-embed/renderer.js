const embed = require('markdown-it-block-embed')

class PageService {
  constructor (name, opts, env) {
    this.name = name
    this.opts = Object.assign(opts || {}, env.options)
  }

  extractVideoID (token) {
    return token
  }

  getEmbedCode (token) {
    console.log('Rendering PageService: '+ token)
    return `<div class="embed-page" _style="border-width:0.5;border-style:dotted;width:1000px">${token}</div>`
  }
}

class SheetService extends PageService {

  getEmbedCode (token) { 
    const path = (token.length > 45) ? `e/${token}/pubhtml?gid=0&amp;single=false&amp;widget=true` : `${token}/edit?usp=sharing&headers=off` 
    return `
      <div class="block-embed"><iframe 
        src="https://docs.google.com/spreadsheets/d/${path}" frameborder=0 width=1000 height=592 allowfullscreen=true
        mozallowfullscreen=true webkitallowfullscreen=true></iframe>
      </div>`
  }
}

class GdocService extends PageService {

  getEmbedCode (token) {
    const path = (token.length > 45) ? `e/${token}/pub?embedded=true` : `${token}/edit?usp=sharing&rm=minimal` 
    return `
      <div class="block-embed" _style="border-width:1;border-style:solid"><iframe 
        src="https://docs.google.com/document/d/${path}"
        frameborder=0 width=1000 height=592 allowfullscreen=true
        mozallowfullscreen=true webkitallowfullscreen=true></iframe>
      </div>`
  }
}

class DeckService extends PageService {

  getEmbedCode (token) {
    return `
      <div class="block-embed" _style="border-width:1;border-style:solid"><iframe 
        src="https://docs.google.com/presentation/d/e/${token}/embed"
        frameborder=0 width=1000 height=592 allowfullscreen=true
        mozallowfullscreen=true webkitallowfullscreen=true></iframe>
      </div>`
  }
}

class JiraService extends PageService {

  getEmbedCode (token) {
    return `
      <base target="_top" />
      <div class="jira-embed" style="position:relative;overflow:hidden;width:1000px;height:105px"><iframe 
      style="position:absolute;top:-150px;height:300px;width:1000px"
        src="${this.opts.jiraURL}/sr/jira.issueviews:searchrequest-printable/temp/SearchRequest.html?jqlQuery=key%3D${token}"></iframe>
      </div>`
  }
}

class JQLService extends PageService {

  getEmbedCode (token) {
    return `
      <base target="_top" />
      <div class="jira-embed" style="position:relative;overflow:scroll;width:1000px;height:600px"><iframe 
        style="position:absolute;top:-150px;height:600px;width:1000px"
        src="${this.opts.jiraURL}/sr/jira.issueviews:searchrequest-printable/temp/SearchRequest.html?jqlQuery=${token}"></iframe>
      </div>`
  }
}



module.exports = {
  init (md, conf) {
    md.use(embed, {
      jiraURL: conf.jiraURL,
      services: {
        page: PageService,
        gdoc: GdocService,
        jql: JQLService,
        jira: JiraService,
        sheet: SheetService,
        deck: DeckService
      }
    })
  }
}
