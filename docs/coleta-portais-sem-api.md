# Coleta dos portais sem API — proposta de arquitetura

> Objetivo do negócio: Inteligência de Mercado **completa** — cada licitação com seu
> histórico (abertura, quem abriu, quem ganhou, quando ganhou, encerramento), de
> **todas** as fontes, sem duplicar e sabendo a origem.

## 0. Antes de scrapear: o que já cobre (de graça e legal)

1. **PNCP (superset legal).** Por Lei 14.133/2021 (Art. 174-175) **toda** contratação
   pública é obrigada a publicar no PNCP. A varredura do PNCP já ingere as licitações
   dos 45 portais — scrapear cada um é, na maioria, **re-coletar o que o PNCP já tem**.
2. **Compras.gov (failover)** — mesmo dado do PNCP em outro host; entra quando o PNCP
   penaliza. Resiliência sem duplicar.
3. **APIs abertas estaduais** (ES via CKAN; CE via TCE) — aditivas onde existem.

➡️ **Regra de ROI:** só scrapear o que **agrega** (dado que o PNCP não tem, ou mais
rico/rápido). Não scrapear o "rabo longo" de portais que só espelham o PNCP.

## 1. Restrições legais/ToS (decisão do dono do negócio)

- **Comerciais** (BLL, Licitanet, Petronect, Portal de Compras Públicas, BBMNet,
  Publinexo): exigem **login/contrato** e o Termo de Uso costuma **proibir scraping**.
  → Só com **credenciais que você contrata**, e idealmente pela API/exportação oficial
  deles. Não se deve burlar login/CAPTCHA de terceiros.
- **Páginas públicas** (sem login) de órgãos públicos: dado público, coleta mais
  defensável — ainda assim respeitar `robots.txt` e ritmo educado.
- ⚖️ A decisão de scrapear cada portal é **sua** (titular do negócio); o sistema dá a
  capacidade, você assume a conformidade por portal.

## 2. Arquitetura proposta

```
                 ┌──────────────────────────────────────────────┐
                 │  Scrape Worker (serviço isolado no Swarm)     │
                 │  Node + Playwright (headless Chromium)        │
                 │                                              │
  scrape_jobs ──▶│  scheduler → fila → [adapter por portal]     │──▶ upsertRecords()
  (tabela/Redis) │     · list(janela)  → lista de processos      │     (mesma dedup +
                 │     · detail(proc)  → abertura/vencedor/datas │      fonte + history)
                 │  throttle por host + circuit breaker (reuso)  │
                 └──────────────────────────────────────────────┘
```

**Decisões-chave:**

- **Playwright, não Selenium.** Mais rápido, auto-wait, headless estável, melhor
  controle de rede/anti-bot, 1 só runtime (Node, igual ao backend). Selenium só se um
  portal exigir um driver específico.
- **Serviço SEPARADO** (novo container `scrape-worker` no stack), não no processo da
  API: browser headless consome CPU/RAM e não pode competir com a web. Escala
  horizontal por **partição de portais** (cada worker pega um subconjunto).
- **Adapter por portal** — uma interface comum (espelha os `connectors/` atuais):
  ```js
  module.exports = {
    key: 'bec_sp', name: 'BEC-SP', kind: 'browser',
    async list(ctx, { janela }) { /* navega a busca, devolve [{processoKey, url, meta}] */ },
    async detail(ctx, ref)       { /* abre a página, extrai abertura/órgão/vencedor/datas/encerramento */ },
  };
  ```
  `ctx` = página Playwright já autenticada (se o portal exigir login com a SUA
  credencial) + helpers de parsing.
- **Fila + agendador** (`scrape_jobs` no MariaDB, ou Redis/BullMQ): cada (portal, janela)
  vira job; workers consomem com lock; retry/observabilidade naturais. Reaproveita o
  **circuit breaker por host** já implementado (anti-penalidade) e o **logCoverage**
  (o painel de monitoria diária passa a ver cada portal).
- **Normalização única:** todo adapter devolve o registro no shape padrão e chama
  `upsertRecords()` → **dedup por `dedupe_key` + `fonte`/`fontes`** (PNCP primeiro,
  nunca duplica) e o **histórico** já existente (`market_intelligence_history` grava
  cada transição: situação → vencedor → encerramento).

**Anti-bloqueio (mesma filosofia do PNCP):**
- rate limit por domínio + jitter aleatório; respeitar `Retry-After`/erros.
- UA realista; sessão/cookies por portal; **proxies residenciais rotativos** se um
  portal bloquear datacenter IPs.
- **CAPTCHA:** evitar (preferir portais sem). Onde for inevitável e legítimo (sua
  conta), serviço de resolução (ex.: 2Captcha) — tem **custo por captcha**, sinalizar.

## 3. O histórico que você quer (já existe a base)

`market_intelligence_history` já registra, por snapshot, as transições de
**situação / etapa / posição / concorrente (vencedor) / preço**. Re-coletar o mesmo
processo ao longo do tempo (re-scrape periódico) **constrói a linha do tempo**:
abertura → andamento → resultado (quem ganhou, quando, valor) → encerramento. Cada
adapter só precisa preencher esses campos; a timeline monta sozinha.

## 4. Faseamento (ROI-first) — recomendação

| Fase | Escopo | Esforço | Valor |
|------|--------|---------|-------|
| **0 (feito)** | PNCP + sweep + Compras.gov failover + ES (CKAN) | — | Cobre ~tudo que é legalmente obrigatório |
| **1** | Esqueleto do `scrape-worker` (Playwright) + 1 adapter de referência num portal **público e de alto valor** (ex.: BEC-SP) | médio | Prova a arquitetura, 1 fonte nova real |
| **2** | + 3-5 portais priorizados por VOCÊ (onde seus clientes sentem falta) | alto | Cobertura incremental dirigida por ROI |
| **3** | Portais comerciais **com sua credencial** (API/exportação oficial deles) | médio | Dados premium que você já paga |

**Não recomendado:** construir/manter os 45 de uma vez — a maioria só espelha o PNCP,
e cada scraper quebra sozinho a cada mudança de layout (manutenção perpétua).

## 5. Custo honesto

- Cada adapter robusto = **dias** de desenvolvimento + **manutenção contínua** (layouts mudam).
- Infra: container browser (CPU/RAM), possíveis **proxies** e **CAPTCHA** (custo recorrente).
- Por isso a régua de ROI: scrapear só onde o ganho > custo de manter.

## Validação ao vivo — achados (2026-06-20)

Sondei os portais públicos como piloto. Realidade encontrada:

| Portal | Achado |
|--------|--------|
| **BEC-SP** | Consulta pública protegida por **reCAPTCHA** (`hdnRecaptchaToken`/`noRobot`) → precisa de **serviço de solver** (custo/ToS). |
| **ComprasNet-BA** | Tem CAPTCHA. |
| **Portal de Compras Públicas** | Comercial (ToS) + app JS; sem listagem HTTP limpa. |
| **ComprasNet-GO / Banrisul** | Sem CAPTCHA, mas sem listagem estruturada via HTTP simples (precisa browser + parsing). |

**Conclusão:** os portais públicos grandes são, em geral, **CAPTCHA-protegidos,
comerciais (ToS) ou apps JS**. Scrapear cada um custa **solver de CAPTCHA + manutenção**.
Como o **PNCP é o superset legal** e já temos failover + APIs abertas (ES, CE), o
caminho **completo e rentável** é a frota de APIs; o scraping só compensa para um
portal específico onde você **aceite o custo do CAPTCHA** ou **tenha credencial
contratada**. O `scrape-worker` fica pronto para esse caso pontual.

## Próximo passo sugerido

Montar o **esqueleto do `scrape-worker`** (Playwright + fila + 1 adapter de referência
num portal público) como Fase 1 — e a partir dele você escolhe os próximos portais por
ROI. Pronto para iniciar quando você confirmar o portal-alvo da Fase 1.
