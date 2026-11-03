/**
 * Servidor Mock do Service Desk Detran-MG
 * Porta 3001
 * 
 * Simula o comportamento da aplicação satélite recebendo o fluxo de Single Sign-On (SSO)
 * a partir da Intranet via Microsoft Entra ID.
 */

const http = require('http')
const url = require('url')

const PORT = process.env.PORT || 3001
const INTRANET_URL = process.env.INTRANET_URL || 'http://localhost:3000'
const TENANT_ID = 'e5d3ae7c-9b38-48de-a087-f6734a287574'

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true)

  // 1. Endpoint receptor de SSO da Intranet (?login_hint=...)
  if (parsed.pathname === '/api/auth/sso/start') {
    const loginHint = parsed.query.login_hint || 'Nenhum login_hint fornecido'
    const timestamp = new Date().toLocaleString('pt-BR')

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Service Desk Detran-MG - Mock SSO</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@mdi/font@6.9.96/css/materialdesignicons.min.css" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Montserrat', sans-serif;
      background: #f0f4f8;
      color: #1e293b;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    header {
      background: #003366;
      color: #fff;
      padding: 16px 32px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    main {
      flex: 1;
      max-width: 720px;
      margin: 40px auto;
      padding: 32px;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      border-top: 5px solid #00a86b;
    }
    .badge-success {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #e6f9f0;
      color: #00875a;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      font-size: 15px;
      line-height: 1.8;
    }
    .info-card code {
      background: #e2e8f0;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 14px;
      color: #0f172a;
      font-weight: 600;
    }
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #003366;
      color: #fff;
    }
    .btn-primary:hover {
      background: #002244;
    }
    .btn-secondary {
      background: #e2e8f0;
      color: #334155;
    }
    .btn-secondary:hover {
      background: #cbd5e1;
    }
  </style>
</head>
<body>
  <header>
    <i class="mdi mdi-headset" style="font-size: 28px;"></i>
    <h1>Service Desk Detran-MG <span style="font-weight: 400; font-size: 14px; opacity: 0.85;">(Mock Local de Testes)</span></h1>
  </header>

  <main>
    <div class="badge-success">
      <i class="mdi mdi-check-circle"></i> Handshake SSO Concluído com Sucesso!
    </div>

    <h2 style="margin: 0 0 10px 0; color: #003366;">Autenticação Satélite Recebida</h2>
    <p style="color: #64748b; margin-top: 0;">
      A Intranet redirecionou o utilizador autenticado via Microsoft Entra ID com os seguintes parâmetros:
    </p>

    <div class="info-card">
      <div><strong>Dica de Login (<code>login_hint</code>):</strong> <code>${loginHint}</code></div>
      <div><strong>Tenant Microsoft Entra ID:</strong> <code>${TENANT_ID}</code></div>
      <div><strong>Horário do Redirecionamento:</strong> ${timestamp}</div>
      <div><strong>Origem Autorizada:</strong> <code>${INTRANET_URL}</code></div>
    </div>

    <p style="font-size: 14px; color: #475569;">
      No Service Desk real, o backend utilizaria este <code>login_hint</code> para abrir o handshake OIDC silencioso (Single Sign-On) contra o Microsoft Entra ID sem solicitar a senha novamente ao servidor.
    </p>

    <div class="actions">
      <a href="${INTRANET_URL}/apps" class="btn btn-primary">
        <i class="mdi mdi-apps"></i> Voltar ao Painel da Intranet
      </a>
      <a href="/chamados" class="btn btn-secondary">
        <i class="mdi mdi-refresh"></i> Testar Fluxo de Sessão Expirada (?returnApp=)
      </a>
    </div>
  </main>
</body>
</html>
    `)
  }

  // 2. Rota protegida do Service Desk simulando sessão não autenticada
  // Quando o utilizador tenta acessar sem estar logado no Service Desk, é enviado para a Intranet
  if (parsed.pathname === '/chamados' || parsed.pathname === '/') {
    const returnUrl = `${INTRANET_URL}/login?returnApp=servicedesk`
    res.writeHead(302, { Location: returnUrl })
    return res.end(`Redirecionando para a Intranet: ${returnUrl}`)
  }

  // 3. Status
  if (parsed.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ status: 'ok', service: 'servicedesk-mock', port: PORT }))
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('Página não encontrada no mock')
})

server.listen(PORT, () => {
  console.log(`[Service Desk Mock] Rodando em http://localhost:${PORT}`)
  console.log(`[Service Desk Mock] SSO Start URL: http://localhost:${PORT}/api/auth/sso/start`)
  console.log(`[Service Desk Mock] Intranet Alvo: ${INTRANET_URL}`)
})
