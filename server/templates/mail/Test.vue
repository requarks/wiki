<template>
  <EHtml lang="en">
    <EHead />
    <EPreview>This is a test email sent from your Wiki.js installation.</EPreview>
    <EBody :style="main">
      <EContainer :style="container">
        <ESection :style="box">
          <img src="https://static.requarks.io/logo/wikijs-full.svg" height="50" alt="Wiki.js" />
          <EHr :style="hr" />
          <EText :style="paragraph"> Hello there! </EText>
          <EText :style="paragraph"> This is a test email sent from your Wiki.js installation. </EText>
          <EHr :style="hr" />
          <EText :style="footer"> Wiki.js, an open source project. </EText>
        </ESection>
      </EContainer>
    </EBody>
  </EHtml>
</template>

<script setup>
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
}

const box = {
  padding: '0 48px',
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
}

const paragraph = {
  color: '#525f7f',

  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left',
}

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
}
</script>
