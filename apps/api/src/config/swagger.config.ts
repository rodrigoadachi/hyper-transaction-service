import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// ── Dark & Modern Theme (GitHub Dark palette) ─────────────────────────────────
const DARK_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  /* ── Base ── */
  *, *::before, *::after { box-sizing: border-box; }
  html { font-size: 14px; }
  body { background: #0d1117 !important; margin: 0; font-family: 'Inter', system-ui, sans-serif; }
  .swagger-ui { background: #0d1117; font-family: 'Inter', system-ui, sans-serif; color: #e6edf3; }
  .swagger-ui * { font-family: 'Inter', system-ui, sans-serif; }

  /* ── Topbar ── */
  .swagger-ui .topbar {
    background: #161b22;
    border-bottom: 1px solid #30363d;
    padding: 10px 0;
  }
  .swagger-ui .topbar .download-url-wrapper .select-label span { color: #8b949e; }
  .swagger-ui .topbar .topbar-wrapper { align-items: center; gap: 12px; }
  .swagger-ui .topbar .topbar-wrapper img { display: none; }
  .swagger-ui .topbar .topbar-wrapper a span {
    color: #58a6ff;
    font-weight: 700;
    font-size: 1.1rem;
    letter-spacing: -0.02em;
  }
  .swagger-ui .topbar .topbar-wrapper a::before {
    content: '⚡ Hyper Finance';
    color: #58a6ff;
    font-weight: 700;
    font-size: 1.1rem;
  }
  .swagger-ui .topbar .topbar-wrapper a span { display: none; }

  /* ── Info Block ── */
  .swagger-ui .information-container { background: #0d1117; padding: 24px 0; }
  .swagger-ui .info { margin: 8px 0 32px; }
  .swagger-ui .info .title {
    color: #e6edf3;
    font-weight: 700;
    font-size: 2rem;
    letter-spacing: -0.03em;
    line-height: 1.2;
  }
  .swagger-ui .info .title small { color: #8b949e; font-size: 0.55em; font-weight: 400; }
  .swagger-ui .info .title small pre { display: inline; }
  .swagger-ui .info p, .swagger-ui .info li { color: #8b949e; line-height: 1.7; }
  .swagger-ui .info a { color: #58a6ff !important; text-decoration: none; }
  .swagger-ui .info a:hover { text-decoration: underline; }
  .swagger-ui .info pre { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px; }
  .swagger-ui .info .base-url { color: #8b949e; font-size: 0.9rem; }

  /* ── Authorize Button ── */
  .swagger-ui .scheme-container {
    background: #161b22 !important;
    border: none !important;
    border-bottom: 1px solid #30363d !important;
    box-shadow: none !important;
    padding: 12px 0;
  }
  .swagger-ui .btn.authorize {
    background: transparent !important;
    color: #58a6ff !important;
    border: 1px solid #58a6ff !important;
    border-radius: 6px !important;
    font-weight: 600 !important;
    padding: 6px 14px !important;
    transition: background 0.15s;
  }
  .swagger-ui .btn.authorize:hover { background: rgba(88,166,255,0.1) !important; }
  .swagger-ui .btn.authorize svg { fill: #58a6ff !important; }
  .swagger-ui .auth-container { background: #161b22 !important; color: #e6edf3 !important; }

  /* ── Tag Headings ── */
  .swagger-ui .opblock-tag {
    background: #161b22 !important;
    border: 1px solid #30363d !important;
    border-radius: 8px !important;
    color: #e6edf3 !important;
    font-weight: 600 !important;
    font-size: 1.05rem !important;
    margin: 16px 0 8px !important;
    padding: 12px 16px !important;
    transition: background 0.15s;
  }
  .swagger-ui .opblock-tag:hover { background: #1c2128 !important; }
  .swagger-ui .opblock-tag svg { fill: #58a6ff !important; }
  .swagger-ui .opblock-tag small { color: #8b949e !important; font-weight: 400 !important; }

  /* ── Operations ── */
  .swagger-ui .opblock {
    border: 1px solid #30363d !important;
    border-radius: 8px !important;
    background: #161b22 !important;
    margin: 6px 0 !important;
    box-shadow: none !important;
    transition: border-color 0.15s;
  }
  .swagger-ui .opblock:hover { border-color: #444c56 !important; }
  .swagger-ui .opblock-summary {
    border-radius: 7px;
    padding: 10px 16px !important;
    align-items: center !important;
    cursor: pointer;
  }
  .swagger-ui .opblock-summary-method {
    border-radius: 4px !important;
    font-weight: 700 !important;
    font-size: 0.72rem !important;
    letter-spacing: 0.06em !important;
    padding: 4px 10px !important;
    min-width: 64px !important;
    text-align: center !important;
    font-family: 'JetBrains Mono', monospace !important;
  }
  .swagger-ui .opblock-summary-path {
    color: #e6edf3 !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 0.9rem !important;
    font-weight: 500 !important;
  }
  .swagger-ui .opblock-summary-path__deprecated { color: #8b949e !important; }
  .swagger-ui .opblock-summary-description { color: #8b949e !important; font-size: 0.85rem !important; }

  /* POST */
  .swagger-ui .opblock.opblock-post { border-color: #2ea043 !important; }
  .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #238636 !important; }
  .swagger-ui .opblock.opblock-post > .opblock-summary { background: rgba(35,134,54,0.08) !important; border-radius: 7px !important; }
  /* GET */
  .swagger-ui .opblock.opblock-get { border-color: #1f6feb !important; }
  .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #1f6feb !important; }
  .swagger-ui .opblock.opblock-get > .opblock-summary { background: rgba(31,111,235,0.08) !important; border-radius: 7px !important; }
  /* PUT / PATCH */
  .swagger-ui .opblock.opblock-put { border-color: #9e6a03 !important; }
  .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #9e6a03 !important; }
  .swagger-ui .opblock.opblock-put > .opblock-summary { background: rgba(158,106,3,0.08) !important; border-radius: 7px !important; }
  .swagger-ui .opblock.opblock-patch { border-color: #bf8700 !important; }
  .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #bf8700 !important; }
  .swagger-ui .opblock.opblock-patch > .opblock-summary { background: rgba(191,135,0,0.08) !important; border-radius: 7px !important; }
  /* DELETE */
  .swagger-ui .opblock.opblock-delete { border-color: #f85149 !important; }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #b91c1c !important; }
  .swagger-ui .opblock.opblock-delete > .opblock-summary { background: rgba(248,81,73,0.08) !important; border-radius: 7px !important; }

  /* ── Expanded body ── */
  .swagger-ui .opblock-body { background: #0d1117 !important; border-top: 1px solid #30363d !important; border-radius: 0 0 7px 7px; }
  .swagger-ui .opblock .opblock-section-header {
    background: #161b22 !important;
    border-bottom: 1px solid #30363d !important;
    padding: 8px 16px !important;
  }
  .swagger-ui .opblock .opblock-section-header h4 { color: #e6edf3 !important; font-size: 0.85rem !important; font-weight: 600 !important; text-transform: uppercase; letter-spacing: 0.05em; }
  .swagger-ui .opblock .opblock-section-header label { color: #8b949e !important; }
  .swagger-ui .opblock-description-wrapper { padding: 16px !important; }
  .swagger-ui .opblock-description-wrapper p { color: #8b949e !important; }

  /* ── Tabs ── */
  .swagger-ui .tab { border-bottom: 1px solid #30363d !important; margin: 0 !important; padding: 0 16px !important; }
  .swagger-ui .tab li { color: #8b949e !important; padding: 8px 12px !important; border-bottom: 2px solid transparent !important; cursor: pointer; }
  .swagger-ui .tab li:hover { color: #e6edf3 !important; }
  .swagger-ui .tab li.active { color: #58a6ff !important; border-bottom-color: #58a6ff !important; }

  /* ── Parameters Table ── */
  .swagger-ui .parameters-container { background: #0d1117 !important; padding: 0 16px 16px !important; }
  .swagger-ui table { width: 100% !important; border-collapse: collapse !important; }
  .swagger-ui table thead tr th {
    color: #8b949e !important;
    font-size: 0.75rem !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.06em !important;
    padding: 8px 0 !important;
    border-bottom: 1px solid #30363d !important;
  }
  .swagger-ui table tbody tr td { border-bottom: 1px solid #21262d !important; padding: 10px 0 !important; vertical-align: top !important; }
  .swagger-ui .parameter__name { color: #e6edf3 !important; font-weight: 500 !important; font-family: 'JetBrains Mono', monospace !important; }
  .swagger-ui .parameter__name.required::after { color: #f85149 !important; }
  .swagger-ui .parameter__in { color: #8b949e !important; font-size: 0.8rem !important; }
  .swagger-ui .parameter__type { color: #79c0ff !important; font-family: 'JetBrains Mono', monospace !important; font-size: 0.85rem !important; }
  .swagger-ui .parameters-col_description { color: #8b949e !important; }
  .swagger-ui .markdown p { color: #8b949e !important; margin: 4px 0 !important; }

  /* ── Inputs ── */
  .swagger-ui textarea,
  .swagger-ui input[type=text],
  .swagger-ui input[type=email],
  .swagger-ui input[type=password],
  .swagger-ui input[type=search],
  .swagger-ui input[type=number] {
    background: #1c2128 !important;
    color: #e6edf3 !important;
    border: 1px solid #30363d !important;
    border-radius: 6px !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 0.85rem !important;
    padding: 8px 10px !important;
    outline: none !important;
    transition: border-color 0.15s;
  }
  .swagger-ui textarea:focus,
  .swagger-ui input[type=text]:focus,
  .swagger-ui input[type=email]:focus,
  .swagger-ui input[type=password]:focus {
    border-color: #58a6ff !important;
    box-shadow: 0 0 0 3px rgba(88,166,255,0.15) !important;
  }
  .swagger-ui select {
    background: #1c2128 !important;
    color: #e6edf3 !important;
    border: 1px solid #30363d !important;
    border-radius: 6px !important;
    padding: 6px 10px !important;
  }

  /* ── Buttons ── */
  .swagger-ui .btn {
    border-radius: 6px !important;
    font-weight: 600 !important;
    font-size: 0.85rem !important;
    padding: 7px 14px !important;
    transition: all 0.15s !important;
    cursor: pointer !important;
  }
  .swagger-ui .btn.execute {
    background: #238636 !important;
    border: 1px solid #2ea043 !important;
    color: #fff !important;
  }
  .swagger-ui .btn.execute:hover { background: #2ea043 !important; }
  .swagger-ui .btn.btn-clear {
    background: transparent !important;
    color: #f85149 !important;
    border: 1px solid #f85149 !important;
  }
  .swagger-ui .btn.btn-clear:hover { background: rgba(248,81,73,0.1) !important; }
  .swagger-ui .try-out__btn {
    background: transparent !important;
    color: #58a6ff !important;
    border: 1px solid #58a6ff !important;
  }
  .swagger-ui .try-out__btn:hover { background: rgba(88,166,255,0.1) !important; }
  .swagger-ui .btn.cancel {
    background: transparent !important;
    color: #8b949e !important;
    border: 1px solid #30363d !important;
  }

  /* ── Responses ── */
  .swagger-ui .responses-inner { padding: 16px !important; background: #0d1117 !important; }
  .swagger-ui .responses-inner h4,
  .swagger-ui .responses-inner h5 { color: #e6edf3 !important; font-size: 0.85rem !important; text-transform: uppercase; letter-spacing: 0.06em; }
  .swagger-ui .response-col_status { color: #e6edf3 !important; font-family: 'JetBrains Mono', monospace !important; font-weight: 600 !important; }
  .swagger-ui .response-col_links { color: #58a6ff !important; }
  .swagger-ui table.responses-table tbody tr td { color: #8b949e !important; }
  .swagger-ui .response-undocumented .response-col_status { color: #8b949e !important; }

  /* ── Code Blocks / Syntax Highlight ── */
  .swagger-ui .highlight-code {
    background: #0d1117 !important;
    border: 1px solid #30363d !important;
    border-radius: 8px !important;
    padding: 0 !important;
    overflow: hidden !important;
  }
  .swagger-ui .highlight-code > .microlight {
    background: #0d1117 !important;
    color: #e6edf3 !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 0.82rem !important;
    line-height: 1.6 !important;
    padding: 14px 16px !important;
    display: block !important;
    overflow-x: auto !important;
  }
  .swagger-ui .copy-to-clipboard {
    background: #161b22 !important;
    border-left: 1px solid #30363d !important;
    border-bottom: 1px solid #30363d !important;
  }
  .swagger-ui .copy-to-clipboard button { background: transparent !important; cursor: pointer !important; }

  /* ── Models Section ── */
  .swagger-ui section.models {
    background: #161b22 !important;
    border: 1px solid #30363d !important;
    border-radius: 8px !important;
    margin-top: 24px !important;
  }
  .swagger-ui section.models h4 {
    color: #e6edf3 !important;
    font-size: 1rem !important;
    font-weight: 600 !important;
    padding: 12px 16px !important;
    border-bottom: 1px solid #30363d !important;
    margin: 0 !important;
  }
  .swagger-ui section.models h4 svg { fill: #58a6ff !important; }
  .swagger-ui .model-container {
    background: #0d1117 !important;
    border: 1px solid #30363d !important;
    border-radius: 6px !important;
    margin: 12px 16px !important;
  }
  .swagger-ui .model-title { color: #58a6ff !important; font-family: 'JetBrains Mono', monospace !important; }
  .swagger-ui .model { color: #e6edf3 !important; }
  .swagger-ui .model-box { background: #0d1117 !important; padding: 12px !important; }
  .swagger-ui .prop-type { color: #79c0ff !important; font-family: 'JetBrains Mono', monospace !important; }
  .swagger-ui .prop-format { color: #a5d6ff !important; font-family: 'JetBrains Mono', monospace !important; }
  .swagger-ui .model .property { color: #e6edf3 !important; }
  .swagger-ui .model .property.primitive { color: #79c0ff !important; }

  /* ── Loading Spinner ── */
  .swagger-ui .loading-container .loading::after { border-color: #58a6ff #58a6ff transparent !important; }

  /* ── Modal (Auth Dialog) ── */
  .swagger-ui .dialog-ux .backdrop-ux {
    background: rgba(0,0,0,0.85) !important;
    backdrop-filter: blur(4px);
  }
  .swagger-ui .dialog-ux .modal-ux {
    background: #161b22 !important;
    border: 1px solid #30363d !important;
    border-radius: 12px !important;
    box-shadow: 0 16px 32px rgba(0,0,0,0.6) !important;
    max-width: 520px !important;
  }
  .swagger-ui .dialog-ux .modal-ux-header {
    background: #161b22 !important;
    border-bottom: 1px solid #30363d !important;
    border-radius: 12px 12px 0 0;
    padding: 16px 20px !important;
  }
  .swagger-ui .dialog-ux .modal-ux-header h3 { color: #e6edf3 !important; font-weight: 700 !important; }
  .swagger-ui .dialog-ux .modal-ux-header button.close-modal svg { fill: #8b949e !important; }
  .swagger-ui .dialog-ux .modal-ux-content { background: #161b22 !important; padding: 20px !important; }
  .swagger-ui .dialog-ux .modal-ux-content h4 { color: #58a6ff !important; font-size: 0.8rem !important; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px !important; }
  .swagger-ui .dialog-ux .modal-ux-content p { color: #8b949e !important; font-size: 0.9rem !important; }
  .swagger-ui .dialog-ux .modal-ux-content label { color: #8b949e !important; font-size: 0.82rem !important; font-weight: 500 !important; }
  .swagger-ui .modal-btn-wrapper { padding: 16px 20px !important; border-top: 1px solid #30363d !important; gap: 8px !important; display: flex !important; }

  /* ── Misc ── */
  .swagger-ui .wrapper { max-width: 1280px !important; padding: 0 24px !important; }
  .swagger-ui hr { border-color: #30363d !important; }
  .swagger-ui a.nostyle, .swagger-ui a.nostyle:visited { color: #58a6ff !important; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: #0d1117; }
  ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #484f58; }
`;

export function setupSwagger(app: INestApplication, _port: number | string): void {
  if (process.env.NODE_ENV === 'production') return;

  const config = new DocumentBuilder()
    .setTitle('Hyper Finance API')
    .setDescription(
      'Serviço de processamento de transações financeiras multi-tenant (SaaS B2B).\n\n' +
        '## Autenticação\n\n' +
        'Rotas protegidas requerem um **JWT Bearer token** obtido via `POST /auth/login`.\n\n' +
        'O token utiliza algoritmo **ES256** (ECDSA P-256) e expira em **15 minutos** por padrão.\n\n' +
        'Clique em **Authorize 🔒** e informe: `Bearer <seu_token>`',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT obtido via POST /auth/login (algoritmo ES256)',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Hyper Finance — API Docs',
    customCss: DARK_CSS,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      displayRequestDuration: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      syntaxHighlight: { activated: true, theme: 'monokai' },
    },
  });
}
