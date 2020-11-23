/// <reference types="Cypress" />

describe('Setup', () => {
  it('Load the setup page', () => {
    cy.visit('/')
    cy.contains('You are about to install Wiki.js').should('exist')
  })
  it('Enter administrator email address', () => {
    cy.get('.v-input').contains('Administrator Email').next('input').click().type('test@example.com')
  })
  it('Enter a password', () => {
    cy.get('.v-input').contains('Password').next('input').click().type('12345678')
    cy.get('.v-input').contains('Confirm Password').next('input').click().type('12345678')
  })
  it('Enter a Site URL', () => {
    cy.get('.v-input').contains('Site URL').next('input').click().clear().type('http://localhost:3000')
  })
  it('Disable Telemetry', () => {
    cy.contains('Telemetry').next('.v-input').click()
  })
  it('Press Install', () => {
    cy.get('.v-card__actions').find('button').click()
  })
  it('Wait for install success', () => {
    cy.contains('Installation complete!', {timeout: 30000}).should('exist')
  })
  // -> Disabled because of origin change errors during CI tests
  //
  // it('Redirect to login page', () => {
  //   cy.location('pathname', {timeout: 10000}).should('include', '/login')
  // })
})
