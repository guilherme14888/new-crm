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
│   └── settingsStore.ts      # Configurações globais
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
│   │   └── ...                # Outros recursos (produtos, arquivos, etc.)
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
