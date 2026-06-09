# CRM Mobile

Um sistema de CRM (Customer Relationship Management) completo para web e mobile, construído com React Native + Expo no frontend e Node.js + Express no backend, com banco de dados MariaDB/MySQL.

## Stack Tecnológico

### Frontend
- **React Native** 0.81.5 — Framework multiplataforma
- **Expo** ~54.0.33 — Plataforma de desenvolvimento e build
- **React** 19.1.0 — Biblioteca UI
- **expo-router** ~6.0.23 — Roteamento file-based
- **Zustand** 5.0.12 — Gerenciamento de estado
- **NativeWind** 4.2.3 + **Tailwind CSS** 3.4.19 — Estilização
- **date-fns** 4.1.0 — Manipulação de datas
- **TypeScript** ~5.9.2 — Tipagem estática
- **React DOM** 19.1.0 — Renderização web

### Backend
- **Node.js** — Runtime JavaScript
- **Express** 4.19.2 — Framework web
- **MariaDB/MySQL** (mysql2 3.9.7) — Banco de dados
- **JWT** 9.0.2 — Autenticação
- **bcrypt** 5.1.1 — Hash de senhas
- **UUID** 13.0.0 — Geração de IDs únicos
- **CORS** 2.8.5 — Controle de origem cruzada

## Arquitetura

### Estrutura de Pastas

```
/app                          # Rotas expo-router (file-based)
├── (app)/
│   ├── (tabs)/               # Telas principais com navegação em abas
│   │   ├── dashboard.tsx
│   │   ├── negotiations.tsx
│   │   ├── contacts/
│   │   ├── kanban.tsx
│   │   └── funnel.tsx
│   ├── deal/                 # Detalhes e gerenciamento de deals
│   │   ├── [id].tsx
│   │   └── new.tsx
│   ├── funnels/              # Configuração de funnels
│   ├── admin/                # Painel administrativo
│   ├── market-intelligence.tsx  # Painel Inteligência de Mercado (licitações)
│   └── settings.tsx
└── (auth)/                   # Autenticação (login, registro)

/src
├── stores/                   # Estado Zustand
│   ├── authStore.ts          # Autenticação e usuário
│   ├── dealStore.ts          # Operações e listagem de deals
│   ├── funnelStore.ts        # Gestão de funnels e estágios
│   ├── contactStore.ts       # Contatos
│   ├── activityStore.ts      # Atividades
│   ├── teamStore.ts          # Equipes
│   ├── uiStore.ts            # Estado de UI (toasts, modais)
│   ├── customFieldStore.ts   # Campos personalizados
│   ├── crmUserStore.ts       # Usuários do CRM
│   ├── settingsStore.ts      # Configurações globais
│   └── marketIntelStore.ts   # Inteligência de Mercado (licitações, keywords, portais)
├── services/
│   ├── api.ts                # Client HTTP e armazenamento de tokens
│   ├── apiDataService.ts     # Chamadas à API
│   ├── authService.ts        # Autenticação
│   └── syncEngine.ts         # Motor de sincronização offline
├── db/                       # Repositórios SQLite (mobile)
│   ├── dealRepo.ts
│   ├── contactRepo.ts
│   ├── funnelRepo.ts
│   └── schema.ts             # Schema SQLite
├── components/
│   ├── deal/                 # Componentes de deal
│   │   ├── DealModal.tsx
│   │   ├── NewDealModal.tsx
│   │   └── tabs/             # DealHistoryTab, DealTasksTab, etc.
│   ├── kanban/               # Componentes do quadro Kanban
│   │   ├── KanbanColumn.tsx
│   │   └── KanbanDragContext.tsx
│   ├── contacts/             # Formulários e listagem de contatos
│   ├── settings/             # Modais de Configurações
│   │   ├── ApiExternaModal.tsx     # Config de portais por tenant
│   │   └── PalavrasChaveModal.tsx  # CRUD de palavras-chave por tenant
│   └── layout/               # Layout principal (Sidebar)
├── types/
│   └── models.ts             # TypeScript interfaces (Contact, Deal, Funnel, etc.)
├── constants/
│   ├── theme.ts              # Cores, fontes, espaçamento
│   └── pipeline.ts           # Estágios de pipeline
└── utils/
    ├── currency.ts           # Formatação monetária
    └── date.ts               # Funções de data

/backend
├── src/
│   ├── app.js                # Inicialização Express
│   ├── db.js                 # Conexão MariaDB/MySQL
│   ├── middleware/
│   │   ├── auth.js           # Verificação JWT
│   │   └── acl.js            # Controle de acesso por função/empresa
│   ├── routes/
│   │   ├── activities.js      # GET, POST atividades
│   │   ├── deals.js           # CRUD de deals
│   │   ├── contacts.js        # CRUD de contatos
│   │   ├── funnels.js         # Gestão de funnels e estágios
│   │   ├── auth.js            # Login, registro, verificação de token
│   │   ├── users.js           # Usuários CRM
│   │   ├── teams.js           # Equipes
│   │   ├── marketIntelligence.js # Licitações + keywords + portais (por tenant)
│   │   └── ...                # Outros recursos (produtos, arquivos, etc.)
│   ├── ingest/                # Captação de licitações (Inteligência de Mercado)
│   │   ├── index.js           # Registro dos conectores
│   │   ├── run.js             # Orquestrador multi-tenant
│   │   ├── scheduler.js       # Agendador diário (09h BRT)
│   │   ├── http.js            # Cliente HTTP (UA de navegador, retry)
│   │   ├── normalize.js       # Região/UF, status, datas, dedupeKey
│   │   ├── upsert.js          # Gravação idempotente (dedup por empresa)
│   │   ├── sources.js         # Definições + config de portais por tenant
│   │   ├── relevance.js       # Filtro de contexto (T0–T3)
│   │   ├── embeddings.js      # Provedor de embeddings (Voyage/OpenAI)
│   │   └── connectors/        # pncp, licitaja, bll, effecti, …
│   ├── jobs/
│   │   ├── ingest.js          # CLI da ingestão
│   │   └── README.md          # Doc técnica da captação
│   ├── migrations/            # Migrations SQL (.sql aplicadas em ordem)
│   └── services/
│       └── auditLog.js        # Logging de mudanças
└── database/
    └── schema.sql             # Schema MariaDB/MySQL

```

## Modelos Principais

### Contact
Representação de um contato (lead, prospect, cliente).
```typescript
{
  id: string;
  type: 'lead' | 'prospect' | 'customer' | 'churned';
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  tags: string[];
  notes?: string;
  syncStatus: 'synced' | 'pending_push' | 'conflict';
}
```

### Deal
Oportunidade de venda vinculada a um contato.
```typescript
{
  id: string;
  contactId: string;
  funnelId: string;
  stageId: string;
  stage: 'qualification' | 'discovery' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  title: string;
  value: number;           // em centavos
  currency: string;
  probability: number;     // 0-100
  expectedCloseDate?: string;
  closingReason?: string;
  ownerId?: string;
  stageOrder: number;      // ordenação visual no kanban
}
```

### Funnel
Define estágios de vendas e probabilidades associadas.
```typescript
{
  id: string;
  name: string;
  isDefault: boolean;
  stages: FunnelStage[];
}

// FunnelStage
{
  id: string;
  funnelId: string;
  name: string;
  color: string;
  order: number;
  probability: number;    // 0-100
  type: 'active' | 'won' | 'lost';
  rottenDays?: number;    // dias antes de marcar como "rotten"
}
```

### Activity
Registro de interação com um contato ou deal (call, email, meeting, note).
```typescript
{
  id: string;
  dealId?: string;
  contactId: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'stage_change';
  title: string;
  description?: string;
  occurredAt: string;     // ISO datetime
  metadata?: Record<string, any>;
}
```

## Autenticação e Controle de Acesso

### JWT (JSON Web Tokens)
Tokens auto-contidos armazenados em `SecureStore` (mobile) ou localStorage (web).

```javascript
// Payload do token
{
  id: string;           // user_id
  email: string;
  displayName: string;
  role: 'admin' | 'manager' | 'supervisor' | 'consultant' | 'agent';
  company_id: string;
  team_id?: string;
  iat: number;
  exp: number;
}
```

### ACL (Access Control List)
Controle de acesso baseado em função (RBAC) + empresa + equipe.

**Hierarquia de funções:**
- **admin** → Todas as empresas, todos os dados
- **manager** → Empresa própria, todos os dados
- **supervisor** → Empresa própria, apenas sua equipe
- **consultant/agent** → Empresa própria, apenas seus registros

**Middleware ACL:**
- `requireAuth` — Valida JWT
- `resolveScope` — Atribui `req.scope` com contexto de acesso
- `buildScopeFilter()` — Gera WHERE clause SQL baseado em permissões
- `canAccess()` — Verifica permissão para um registro específico

## Instalação

### Frontend (React Native + Expo)

```bash
cd /Users/guilhermesampaio/crm-br4
npm install
```

### Backend (Node.js + Express)

```bash
cd /Users/guilhermesampaio/crm-mobile/backend
npm install
```

### Banco de Dados

Crie um banco MariaDB/MySQL e execute o schema:

```bash
mysql -u root -p < /Users/guilhermesampaio/crm-mobile/backend/database/schema.sql
```

## Como Executar

### Desenvolvimento (Frontend + Backend simultaneamente)

```bash
npm run dev
```

Este comando executa em paralelo:
- **API (Backend)**: `cd backend && node src/app.js` na porta 3000
- **Web (Frontend)**: `expo start --web` na porta 19000

### Apenas Frontend

```bash
npm start                # Expo menu interativo
npm run web              # Web no navegador
npm run ios              # Simulador iOS
npm run android          # Emulador Android
```

### Apenas Backend

```bash
cd backend
npm run dev              # Com nodemon (auto-restart)
npm start                # Produção
```

## Variáveis de Ambiente

### Frontend (`.env`)
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_ENV=development
```

### Backend (`.env`)
```
PORT=3000
DATABASE_URL=mysql://user:password@localhost:3306/crm_db
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
```

## Features Principais

### Dashboard
- Métricas de CRM (total de leads, deals, valor do pipeline)
- Filtros por período, funnel e estágio
- Visualização de deals por estágio

### Kanban Board
- Drag-and-drop de deals entre estágios
- Visualização customizável por funnel
- Indicadores de valor e probabilidade

### Gerenciamento de Contatos
- CRUD de contatos
- Classificação (lead, prospect, customer, churned)
- Tags, notas, histórico de atividades

### Deal Management
- Criação e edição de deals
- Movimentação entre estágios
- Histórico de mudanças
- Anexos de arquivos
- Produtos associados

### Funnels & Stages
- Criação de múltiplos funnels
- Customização de estágios (cores, probabilidades)
- Definição de motivos de ganho/perda

### Atividades
- Registro de calls, emails, meetings, notas
- Atrelamento a deals e contatos
- Timeline visual

### Sincronização Offline
- Engine customizado de sync
- Suporte a SQLite em mobile
- Fila de operações pendentes

### Controle de Equipes
- Atribuição de deals a usuários/equipes
- Filtros por proprietário (owner)
- Visibilidade baseada em função e equipe

### Inteligência de Mercado (Captação de Licitações)
- Captação automática de licitações públicas em vários portais (PNCP, Licitaja, BLL e outros)
- Busca dirigida por **palavras-chave por tenant**, com filtro de **contexto** (negativos + IA opcional)
- Painel "Portfólio de Compras Governamentais" com filtros, ranking e gráfico por mês
- **Deduplicação por empresa** e **atualização diária às 09h**
- Veja a seção dedicada **[Inteligência de Mercado](#inteligência-de-mercado-captação-de-licitações-1)** abaixo

## Inteligência de Mercado (Captação de Licitações)

Subsistema que **descobre, normaliza e armazena licitações públicas** a partir de
palavras-chave do cliente, exibindo-as no painel _Portfólio de Compras
Governamentais_ (`/(app)/market-intelligence`). Tudo é **separado por tenant**
(`company_id`): cada empresa tem suas palavras-chave, sua configuração de portais
e suas licitações; o tenant **Default/master** enxerga todas e pode filtrar por
empresa.

### Visão geral do fluxo

```
Palavras-chave (por tenant)
        │
        ▼
Conectores de portais ── busca por keyword ──► registros normalizados
   (PNCP, Licitaja, …)                               │
        │                                            ▼
   BLL (collect: lista de processos)        Filtro de relevância (contexto)
                                              T0 negativos → T1 cache exato
                                              → T2 cache semântico → T3 LLM
                                                      │
                                                      ▼
                                   UPSERT em market_intelligence
                                   (dedup por company_id + dedupe_key)
                                                      │
                                                      ▼
                              Painel Inteligência de Mercado (por tenant)
```

### Multi-tenant e isolamento

- `market_intelligence`, `market_intelligence_keywords` e
  `market_intelligence_sources` têm `company_id`.
- A rota `GET /api/market-intelligence` usa `resolveScope` + `buildCompanyFilter`:
  tenant comum vê só o seu `company_id`; **master vê tudo** (sem vazamento).
- A ingestão roda **para cada empresa** que tenha palavras-chave ativas, marcando
  cada linha com o `company_id` da empresa.
- ⚠️ Convenção: colunas `company_id` devem usar `COLLATE utf8mb4_unicode_ci`
  (igual a `companies.id`) para permitir `JOIN` sem "Illegal mix of collations".

### Modelo de dados (migrations)

| Migration | O que faz |
|---|---|
| `018_market_intelligence.sql` | tabela `market_intelligence` (linha = item de um processo) |
| `019_seed_market_intelligence.sql` | seed inicial (base AstraZeneca importada) |
| `020_market_intelligence_ingest.sql` | colunas de origem (`fonte`, `pncp_controle`, `termo_busca`, `external_key`) + tabela `market_intelligence_keywords` |
| `021_market_intelligence_dedupe.sql` | `dedupe_key` (chave canônica) + `fontes` (provenância) + índice único |
| `022_market_intelligence_sources.sql` | tabela `market_intelligence_sources` (config de portais por tenant) |
| `023_market_intelligence_multitenant.sql` | `company_id` em keywords/sources/dados + `contexto`/`negativos` nas keywords + dedup por empresa |
| `024_market_intelligence_relevance_cache.sql` | cache de relevância: exato + **vetorial** (`VECTOR(1024)` nativo do MariaDB) |
| `025_fix_company_id_collation.sql` | alinha collation de `company_id` com `companies.id` |

### Conectores de portais

Cada portal é um módulo em `backend/src/ingest/connectors/` com a mesma interface
(`{ name, key, implemented, search?/collect? }`), registrado em `ingest/index.js`.

| Portal | Modo | Status | Config (UI: API Externa) |
|---|---|---|---|
| **PNCP** | busca por keyword | ✅ ativo | — (API pública) |
| **Licitaja** | busca por keyword | ✅ pronto | `api_key`, `base_url` |
| **BLL** | lista de processos (`collect`) | ✅ pronto | `org_key`, `ws_url`, `processes` |
| Effecti / Conlicitação / Forseti / ComprasBR | busca por keyword | pendente | usuário/senha ou token |

> **PNCP** (Portal Nacional de Contratações Públicas) é a fonte oficial e
> obrigatória; cobre licitações futuras, em andamento e encerradas. **Exige
> `User-Agent` de navegador** (WAF). **BLL** usa SOAP do _órgão promotor_ e **não**
> tem busca por palavra-chave — só puxa processos cujo número você já conhece.

### Pipeline de relevância (filtro de contexto, por custo)

Os achados de cada keyword passam por `filterRelevant()` em lote:

| Camada | O que faz | Custo |
|---|---|---|
| **T0 Negativos** | descarta termos fora do contexto ("pneu de carrinho de obra") | grátis |
| **T1 Cache exato** | reaproveita veredito por (empresa, termo, descrição) | grátis após a 1ª vez |
| **T2 Cache semântico** | item parecido reaproveita veredito — VECTOR no MariaDB (cosine) | 1 embedding |
| **T3 LLM em lote** | Claude Haiku decide o que sobrou (25/chamada + prompt caching) | $ |

- IA liga com `INGEST_AI_RELEVANCE=true` + `ANTHROPIC_API_KEY`.
- Cache semântico liga com `VOYAGE_API_KEY` (ou `OPENAI_API_KEY`).
- Sem chaves, vale só o **filtro de negativos** (rápido e sem custo).

### Agendamento

Agendador **interno** (`ingest/scheduler.js`, iniciado em `app.js`) roda a
ingestão de todos os tenants **todo dia às 09h (horário de Brasília)** enquanto o
servidor estiver no ar. Controle via `.env`: `INGEST_ENABLED`, `INGEST_HOUR_BRT`,
`INGEST_PAGES`, `INGEST_ON_BOOT`.

Execução manual (CLI):
```bash
cd backend
npm run ingest                              # todos os tenants/portais ativos
node src/jobs/ingest.js --portal pncp --pages 10        # só PNCP, 10 páginas
node src/jobs/ingest.js --termo osimertinibe --pages 2  # termo avulso
```

### Endpoints da API

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/market-intelligence` | tenant (master vê tudo) | licitações do tenant (com nome da empresa) |
| GET/POST | `/api/market-intelligence/keywords` | tenant | listar/cadastrar palavras-chave |
| PATCH/DELETE | `/api/market-intelligence/keywords/:id` | tenant | editar/excluir/ativar |
| GET/PATCH | `/api/market-intelligence/sources[/:key]` | manager+ | listar/editar config de portais |

### Configuração pela interface (Configurações)

- **Palavras-Chave** — CRUD por tenant: `termo`, rótulo (`produto_candidato`),
  `contexto` (negócio), `negativos` (exclusões) e `ativo`.
- **API Externa** — ativar/desativar portais e preencher credenciais (por tenant).

### Variáveis de ambiente (backend `.env`)

```
# Agendamento da ingestão
INGEST_ENABLED=true
INGEST_HOUR_BRT=9
INGEST_PAGES=10
INGEST_ON_BOOT=false

# Filtro de relevância por IA (opcional)
INGEST_AI_RELEVANCE=false
INGEST_AI_MODEL=claude-haiku-4-5-20251001
INGEST_AI_BATCH=25
ANTHROPIC_API_KEY=

# Cache semântico / embeddings (opcional)
EMBEDDINGS_PROVIDER=              # voyage | openai
VOYAGE_API_KEY=
OPENAI_API_KEY=
INGEST_SEM_THRESHOLD=0.12

# Credenciais de portais (fallback; o normal é configurar pela UI por tenant)
LICITAJA_API_KEY=  BLL_ORG_KEY=  EFFECTI_USER=  CONLICITACAO_TOKEN=  ...
```

> Documentação técnica detalhada do subsistema: **`backend/src/jobs/README.md`**.

## Padrões de Código

### Zustand Stores
Gerenciamento reativo de estado com persistência automática.

```typescript
export const useDealStore = create<DealState>((set, get) => ({
  deals: [],
  isLoading: false,
  
  loadDeals: async () => {
    set({ isLoading: true });
    try {
      const deals = await apiGetDeals();
      set({ deals });
    } finally {
      set({ isLoading: false });
    }
  },
}));
```

### API Service Layer
Abstração de chamadas HTTP com manejo de erros e tokens.

```typescript
import { tokenStorage } from './api';

export async function apiGetDeals() {
  const response = await fetch('/api/deals', {
    headers: {
      Authorization: `Bearer ${tokenStorage.get()}`
    }
  });
  return response.json();
}
```

### Componentes React Native
Uso de `StyleSheet` nativo e classe `className` via NativeWind.

```typescript
import { View, Text, StyleSheet } from 'react-native';

export function DealCard({ deal }) {
  return (
    <View style={styles.card}>
      <Text className="text-lg font-bold">{deal.title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 8 }
});
```

## Build & Deployment

### Web
```bash
npm run web -- --release
```

### iOS (APK/IPA)
```bash
eas build --platform ios
```

### Android
```bash
eas build --platform android
```

## Troubleshooting

### Erro de conexão API
- Verificar se o backend está rodando em `PORT` correto
- Confirmar `EXPO_PUBLIC_API_URL` no `.env`
- Inspecionar Network tab do DevTools

### Erro de JWT expirado
- Token expirado será removido de `SecureStore`
- Usuário será redirecionado para login automaticamente

### SQLite locked (mobile)
- Fechar outras abas da aplicação
- Limpar cache: `expo start -c`

## Contribuição

1. Crie uma branch: `git checkout -b feature/sua-feature`
2. Commit com mensagens descritivas em PT-BR
3. Push: `git push origin feature/sua-feature`
4. Abra um Pull Request

## Licença

Propriedade privada — CRM Mobile 2026
