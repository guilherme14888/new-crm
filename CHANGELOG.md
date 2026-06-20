# [1.33.0](https://github.com/guilherme14888/crm-br4/compare/v1.32.0...v1.33.0) (2026-06-20)


### Features

* **ingest:** conector Compras-CE (TCE-CE) dirigido por configuracao ([d540979](https://github.com/guilherme14888/crm-br4/commit/d5409793a7200439b3c3d8403f89a9d78f689d6e))

# [1.32.0](https://github.com/guilherme14888/crm-br4/compare/v1.31.0...v1.32.0) (2026-06-20)


### Features

* **ingest:** Compras.gov como failover do PNCP + cooldown ciente de host ([2a41f26](https://github.com/guilherme14888/crm-br4/commit/2a41f26769b33b328351eeb09122a8daab9b6bc0))

# [1.31.0](https://github.com/guilherme14888/crm-br4/compare/v1.30.0...v1.31.0) (2026-06-20)


### Features

* **ingest:** conector Compras-ES (SIGA) — primeiro do subconjunto de dados abertos ([39cd3bb](https://github.com/guilherme14888/crm-br4/commit/39cd3bb726d4e2f449d7844efde99cc7582f6ce0))

# [1.30.0](https://github.com/guilherme14888/crm-br4/compare/v1.29.0...v1.30.0) (2026-06-20)


### Features

* **market-intel:** expoe a origem (fonte) de cada licitacao na Listagem ([0b25687](https://github.com/guilherme14888/crm-br4/commit/0b2568737e885bb8555570d0aa8a39885dbc38e2))

# [1.29.0](https://github.com/guilherme14888/crm-br4/compare/v1.28.0...v1.29.0) (2026-06-20)


### Features

* **ingest:** circuit breaker + cooldown persistido para nunca penalizar no PNCP ([285b154](https://github.com/guilherme14888/crm-br4/commit/285b154ca3c37f81722fda009a6e9f7fcca16426))

# [1.28.0](https://github.com/guilherme14888/crm-br4/compare/v1.27.4...v1.28.0) (2026-06-20)


### Features

* **market-intel:** monitoria diaria no Historico de Mineracao ([e598350](https://github.com/guilherme14888/crm-br4/commit/e598350d6cb5ab9c3172c75e9e0f0feca051b8d6))

## [1.27.4](https://github.com/guilherme14888/crm-br4/compare/v1.27.3...v1.27.4) (2026-06-20)


### Bug Fixes

* **ingest:** evita compounding de retry de 429 na enumeracao do sweep ([f14514f](https://github.com/guilherme14888/crm-br4/commit/f14514f16312dafc9ad67c2c8a619e9ef14cf1c3))

## [1.27.3](https://github.com/guilherme14888/crm-br4/compare/v1.27.2...v1.27.3) (2026-06-20)


### Performance Improvements

* **front:** debounce na busca + blob pre-computado + cap no MultiSelect ([50af3b1](https://github.com/guilherme14888/crm-br4/commit/50af3b10e3f38a87fa67e2a1a8161ed11ca2335c))
* **ingest:** throttle global+429, bulk upsert e enumeracao 1x do PNCP ([ca952bf](https://github.com/guilherme14888/crm-br4/commit/ca952bfd1ad5f366cfd11160f3e1985da16f9479))

## [1.27.2](https://github.com/guilherme14888/crm-br4/compare/v1.27.1...v1.27.2) (2026-06-20)


### Performance Improvements

* **db:** indices compostos por tenant (migration 034) + pool dimensionado ([7ed9d8b](https://github.com/guilherme14888/crm-br4/commit/7ed9d8bce17ec4e7ec5e4b5a713564c8d98d9820))

## [1.27.1](https://github.com/guilherme14888/crm-br4/compare/v1.27.0...v1.27.1) (2026-06-20)


### Bug Fixes

* **security:** corrige cross-tenant em deals e bug 500 em users; hardening ([323fcc7](https://github.com/guilherme14888/crm-br4/commit/323fcc723665d2a8467a5f7b3610fe919e142850))

# [1.27.0](https://github.com/guilherme14888/crm-br4/compare/v1.26.0...v1.27.0) (2026-06-19)


### Features

* **market-intel:** Historico de Mineracao (dias x palavras-chave) com ACL ([f22cbf1](https://github.com/guilherme14888/crm-br4/commit/f22cbf1f1af6cab06075777f1276f099b187c5eb))

# [1.26.0](https://github.com/guilherme14888/crm-br4/compare/v1.25.0...v1.26.0) (2026-06-18)


### Features

* **market-intel:** grafico 12m por padrao, Orgao multi, Empresa Concorrente, toggle todos/nenhum ([3611110](https://github.com/guilherme14888/crm-br4/commit/3611110c49f4a1447101e70a98c0dde49c88d841))

# [1.25.0](https://github.com/guilherme14888/crm-br4/compare/v1.24.1...v1.25.0) (2026-06-18)


### Features

* **market-intel:** filtros unificados num drawer (Visao Executiva) ([8bef8f1](https://github.com/guilherme14888/crm-br4/commit/8bef8f1c29cc988689154dcc9f3f2e9986b301cd))

## [1.24.1](https://github.com/guilherme14888/crm-br4/compare/v1.24.0...v1.24.1) (2026-06-18)


### Bug Fixes

* **ai-config:** chave cifrada no banco (AES-GCM) + corrige mismatch de provedor ([bdd6416](https://github.com/guilherme14888/crm-br4/commit/bdd6416a3eef0573cb23a8c9e6cf0b27c8e7a04f))

# [1.24.0](https://github.com/guilherme14888/crm-br4/compare/v1.23.1...v1.24.0) (2026-06-18)


### Features

* **deal-files:** edital/ata do PNCP na aba Arquivos + categoria, nome e link no anexar ([2893e45](https://github.com/guilherme14888/crm-br4/commit/2893e4529736ed3a8544939d17138f8b12ba25cc))

## [1.23.1](https://github.com/guilherme14888/crm-br4/compare/v1.23.0...v1.23.1) (2026-06-18)


### Bug Fixes

* **kanban:** lazy-load 10-em-10 deterministico (corta os DADOS, nao so a renderizacao) ([b73210f](https://github.com/guilherme14888/crm-br4/commit/b73210f97cb500edc442ef90f7a59e74732d6058))

# [1.23.0](https://github.com/guilherme14888/crm-br4/compare/v1.22.0...v1.23.0) (2026-06-18)


### Features

* **kanban:** produto no card de Oportunidade + lazy-load (10 em 10) nos kanbans ([75231ef](https://github.com/guilherme14888/crm-br4/commit/75231ef4a0f9050d166d004d5b26ae841d26fd16))

# [1.22.0](https://github.com/guilherme14888/crm-br4/compare/v1.21.0...v1.22.0) (2026-06-18)


### Features

* **acl:** enforcement fase 2 — companies/billing/trial e leads_* ([aeb167d](https://github.com/guilherme14888/crm-br4/commit/aeb167dfa696b8136fdf2bb81a297d03a9f18913))

# [1.21.0](https://github.com/guilherme14888/crm-br4/compare/v1.20.0...v1.21.0) (2026-06-18)


### Features

* **acl:** liga o enforcement das permissoes (requirePermission, fail-safe) ([073b7e8](https://github.com/guilherme14888/crm-br4/commit/073b7e8f860d1fcee533d4a462058d732c07ebff))

# [1.20.0](https://github.com/guilherme14888/crm-br4/compare/v1.19.0...v1.20.0) (2026-06-18)


### Features

* Financeiro dividido (Default x tenant) + visibilidade de menus por perfil ([bd3f0b1](https://github.com/guilherme14888/crm-br4/commit/bd3f0b11c3f080ccf892140d2a48ce6705c9d822))

# [1.19.0](https://github.com/guilherme14888/crm-br4/compare/v1.18.1...v1.19.0) (2026-06-18)


### Features

* IA global (Default-only), expansao do ACL e periodo de teste por tenant ([40d9841](https://github.com/guilherme14888/crm-br4/commit/40d98410fa85e5a58b77a440d4b20b5d5f5f35f4))

## [1.18.1](https://github.com/guilherme14888/crm-br4/compare/v1.18.0...v1.18.1) (2026-06-18)


### Bug Fixes

* **ingest:** corrige relevancia com provedor configuravel (MODEL removido) ([6342b21](https://github.com/guilherme14888/crm-br4/commit/6342b21d16c9ea0d26068fc27bbafc39870a4e06))

# [1.18.0](https://github.com/guilherme14888/crm-br4/compare/v1.17.0...v1.18.0) (2026-06-18)


### Features

* **market-intel:** IA com dropdowns + busca de modelos por chave + provedor Groq ([7fafaa2](https://github.com/guilherme14888/crm-br4/commit/7fafaa2109f68fce0c7f3d8694b7c5d884433f27))

# [1.17.0](https://github.com/guilherme14888/crm-br4/compare/v1.16.0...v1.17.0) (2026-06-18)


### Features

* **market-intel:** provedor de IA configuravel na UI (Anthropic/OpenAI/Gemini/Grok/DeepSeek) ([067fead](https://github.com/guilherme14888/crm-br4/commit/067fead9f036336a9361dd60c9941a866274a8bb))

# [1.16.0](https://github.com/guilherme14888/crm-br4/compare/v1.15.1...v1.16.0) (2026-06-18)


### Features

* **market-intel:** governanca de contexto das palavras-chave + assistente de IA ([bf96a83](https://github.com/guilherme14888/crm-br4/commit/bf96a83ed70d630fde0cd901ab46129e38278dd6))

## [1.15.1](https://github.com/guilherme14888/crm-br4/compare/v1.15.0...v1.15.1) (2026-06-18)


### Bug Fixes

* **ingest:** varredura PNCP resiliente a 429 (sem truncamento silencioso) ([7e0c5d6](https://github.com/guilherme14888/crm-br4/commit/7e0c5d6f89a4e865e4be3343c84b617b729f9053))

# [1.15.0](https://github.com/guilherme14888/crm-br4/compare/v1.14.0...v1.15.0) (2026-06-17)


### Features

* **market-intel:** painel de Cobertura / Saude da Coleta (monitoramento da varredura) ([64fd1ca](https://github.com/guilherme14888/crm-br4/commit/64fd1ca041ef7009e5c038619467e791a92e1969))

# [1.14.0](https://github.com/guilherme14888/crm-br4/compare/v1.13.0...v1.14.0) (2026-06-17)


### Features

* **ingest:** varredura completa do PNCP (cobertura garantida) + auditoria ([d5ea522](https://github.com/guilherme14888/crm-br4/commit/d5ea522b265fee8e2457364a488c83e89b3e710a))

# [1.13.0](https://github.com/guilherme14888/crm-br4/compare/v1.12.0...v1.13.0) (2026-06-17)


### Features

* legenda clicavel filtra produtos no grafico mensal (visao executiva) ([16cf673](https://github.com/guilherme14888/crm-br4/commit/16cf6739a08d7bce4abbbcfb3511ef56cd124013))

# [1.12.0](https://github.com/guilherme14888/crm-br4/compare/v1.11.1...v1.12.0) (2026-06-16)


### Features

* clique no legend isola o produto no grafico mensal (solo/reverter) ([d48291e](https://github.com/guilherme14888/crm-br4/commit/d48291e82e96c2423be14f4ae2aa1c269cf70a52))

## [1.11.1](https://github.com/guilherme14888/crm-br4/compare/v1.11.0...v1.11.1) (2026-06-16)


### Bug Fixes

* setas de ordenacao visiveis em todas as colunas da Listagem ([57098a2](https://github.com/guilherme14888/crm-br4/commit/57098a26cb2b8b233dbfa13ce129b00591acf1de))

# [1.11.0](https://github.com/guilherme14888/crm-br4/compare/v1.10.2...v1.11.0) (2026-06-16)


### Features

* ordenacao por coluna na Listagem (clique no cabecalho alterna asc/desc) ([6643c2b](https://github.com/guilherme14888/crm-br4/commit/6643c2b46d9fe245baf6c8088a1d9cde9e79c599))

## [1.10.2](https://github.com/guilherme14888/crm-br4/compare/v1.10.1...v1.10.2) (2026-06-16)


### Bug Fixes

* worker de ingestao responde /health (Swarm matava o worker em loop) ([9523405](https://github.com/guilherme14888/crm-br4/commit/95234059bf615c1408f75f264a0150e44284f69f))

## [1.10.1](https://github.com/guilherme14888/crm-br4/compare/v1.10.0...v1.10.1) (2026-06-16)


### Bug Fixes

* agendador de ingestao auto-recuperavel (rede de seguranca a cada 30min) ([843089c](https://github.com/guilherme14888/crm-br4/commit/843089c704e0365347e0194cd4614da0b63c44fd))

# [1.10.0](https://github.com/guilherme14888/crm-br4/compare/v1.9.0...v1.10.0) (2026-06-15)


### Features

* mapa de IM com drill-down por estado + bolinhas na coordenada da cidade ([dfbfda8](https://github.com/guilherme14888/crm-br4/commit/dfbfda81c7fab96ebed091e9ee3d6b4cdcf4c845))

# [1.9.0](https://github.com/guilherme14888/crm-br4/compare/v1.8.0...v1.9.0) (2026-06-13)


### Features

* oportunidades como cards bloqueados na etapa Oportunidade + botao Participar ([5741066](https://github.com/guilherme14888/crm-br4/commit/57410669af2b824bd419f9f42f5e6b88814c41f9))

# [1.8.0](https://github.com/guilherme14888/crm-br4/compare/v1.7.3...v1.8.0) (2026-06-13)


### Features

* oportunidades abertas -> Licitacoes com confirmacao de participacao + docs no deal ([0327c0c](https://github.com/guilherme14888/crm-br4/commit/0327c0c96c6dd3099617aae774208337a02fcc55))

## [1.7.3](https://github.com/guilherme14888/crm-br4/compare/v1.7.2...v1.7.3) (2026-06-13)


### Bug Fixes

* rotulos das UFs no centro real do estado (centroide de area) ([6666b3c](https://github.com/guilherme14888/crm-br4/commit/6666b3c5480530620fe7ba613ac1271995b9b2c6))

## [1.7.2](https://github.com/guilherme14888/crm-br4/compare/v1.7.1...v1.7.2) (2026-06-13)


### Bug Fixes

* rotulos do NE com linha-guia no mapa + calendario abre ao clicar nos filtros de data ([91edc91](https://github.com/guilherme14888/crm-br4/commit/91edc91333d3fa645e199f3a54beced3dff261ab))

## [1.7.1](https://github.com/guilherme14888/crm-br4/compare/v1.7.0...v1.7.1) (2026-06-12)


### Bug Fixes

* mapa do Brasil com geometria real por UF (sem cor) + KPIs com valor inteiro ([7078306](https://github.com/guilherme14888/crm-br4/commit/70783069b3768ecc2e36ebb0850e853e6bf4f9f7))

# [1.7.0](https://github.com/guilherme14888/crm-br4/compare/v1.6.1...v1.7.0) (2026-06-12)


### Features

* visao executiva no dashboard (KPIs, valor por licitador) + mapa do Brasil ([62b1f2c](https://github.com/guilherme14888/crm-br4/commit/62b1f2ce2f1da8568507ea78efccc587faaca951))

## [1.6.1](https://github.com/guilherme14888/crm-br4/compare/v1.6.0...v1.6.1) (2026-06-12)


### Bug Fixes

* decodifica nome dos PDFs do zip em CP850 (acentos corretos) ([a5534c8](https://github.com/guilherme14888/crm-br4/commit/a5534c85fa3ab0b32cd80f349a058a81876b2294))

# [1.6.0](https://github.com/guilherme14888/crm-br4/compare/v1.5.0...v1.6.0) (2026-06-12)


### Features

* leitor de documentos extrai todos os PDFs (zips aninhados) e lista por arquivo ([f8b904f](https://github.com/guilherme14888/crm-br4/commit/f8b904fdbb50381754ff4a4ff8fc2f102cfe6c01))

# [1.5.0](https://github.com/guilherme14888/crm-br4/compare/v1.4.2...v1.5.0) (2026-06-12)


### Features

* leitor de edital/ata (PDF) embutido na Listagem ([1e5d5fa](https://github.com/guilherme14888/crm-br4/commit/1e5d5fac96991b2b1bdfc87e0fea51433ea0fe3a))

## [1.4.2](https://github.com/guilherme14888/crm-br4/compare/v1.4.1...v1.4.2) (2026-06-12)


### Bug Fixes

* matchesTerm mais preciso em keywords multi-palavra ([1cccd05](https://github.com/guilherme14888/crm-br4/commit/1cccd0562b190c6a74b6bdb6f7639072e1a40af1))

## [1.4.1](https://github.com/guilherme14888/crm-br4/compare/v1.4.0...v1.4.1) (2026-06-12)


### Bug Fixes

* editar palavra-chave re-sincroniza o rotulo (produto_candidato) das licitacoes ja capturadas ([e35d1c7](https://github.com/guilherme14888/crm-br4/commit/e35d1c788d4624e4fdbae4675cf0224591ceff4d))

# [1.4.0](https://github.com/guilherme14888/crm-br4/compare/v1.3.0...v1.4.0) (2026-06-12)


### Features

* worker isolado de ingestao (servico separado no swarm) ([12c1645](https://github.com/guilherme14888/crm-br4/commit/12c16454a93261220067af77b056ac7fe088ae7b))

# [1.3.0](https://github.com/guilherme14888/crm-br4/compare/v1.2.1...v1.3.0) (2026-06-12)


### Features

* scraping objetivo (so itens da keyword) + historico da licitacao ([a83adc9](https://github.com/guilherme14888/crm-br4/commit/a83adc933940ff333d42550c2c3a175fb095d31e))

## [1.2.1](https://github.com/guilherme14888/crm-br4/compare/v1.2.0...v1.2.1) (2026-06-12)


### Bug Fixes

* filtros da Listagem como dropdown accordion (sem sobreposicao) e Dashboard mais rapido ([af3f0fc](https://github.com/guilherme14888/crm-br4/commit/af3f0fcc200cf0cafa00c78eabdc0007a0a64e9a))

# [1.2.0](https://github.com/guilherme14888/crm-br4/compare/v1.1.1...v1.2.0) (2026-06-10)


### Features

* paginacao (20/pagina) na Listagem e dashboard de IA mais leve ([1bbaded](https://github.com/guilherme14888/crm-br4/commit/1bbaded28211c7be45f26ee15f0ad3122207b855))

## [1.1.1](https://github.com/guilherme14888/crm-br4/compare/v1.1.0...v1.1.1) (2026-06-10)


### Bug Fixes

* sincroniza enum role ao escolher perfil ACL na edicao de usuario ([5781ce2](https://github.com/guilherme14888/crm-br4/commit/5781ce222313b43e1c9c1ff2a1a723113f353944))

# [1.1.0](https://github.com/guilherme14888/crm-br4/compare/v1.0.0...v1.1.0) (2026-06-10)


### Features

* papel (ACL) como lista suspensa e redefinicao de senha na edicao de usuario ([6cdf208](https://github.com/guilherme14888/crm-br4/commit/6cdf2083a67fb3b5312aceb8eee777bd12e865e2))

# 1.0.0 (2026-06-10)


### Features

* dockerização, CI de release e listagem de inteligência de mercado ([c5a04b5](https://github.com/guilherme14888/crm-br4/commit/c5a04b51745cbde5726bb07293a8b4f9878f858b))

# 1.0.0 (2026-06-09)


### Features

* dockerização, CI de release e listagem de inteligência de mercado ([c5a04b5](https://github.com/guilherme14888/crm-br4/commit/c5a04b51745cbde5726bb07293a8b4f9878f858b))
