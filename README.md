# MyMetricHUB

Uma tela de login elegante e responsiva para o MyMetricHUB, construída com tecnologias front-end modernas.

## 🚀 Tecnologias Utilizadas

- **React 18** - Biblioteca JavaScript para interfaces de usuário
- **TypeScript** - Superset do JavaScript com tipagem estática
- **Vite** - Build tool rápida e moderna
- **Tailwind CSS** - Framework CSS utilitário
- **React Hook Form** - Biblioteca para gerenciamento de formulários
- **Lucide React** - Ícones modernos e leves

## ✨ Características

- 🎨 Design moderno com glassmorphism e gradientes
- 📱 Totalmente responsivo
- ⚡ Animações suaves e feedback visual
- 🔒 Validação de formulários em tempo real
- 👁️ Toggle para mostrar/ocultar senha
- 🎯 Estados de loading e feedback de erro/sucesso
- ♿ Acessível com labels e navegação por teclado
- 📊 Dashboard completo com métricas e atividades
- 🔄 Navegação fluida entre login e dashboard
- 🔔 Sistema de notificações
- 🔍 Barra de pesquisa funcional
- 💾 Persistência de sessão com localStorage
- 👤 Informações do usuário logado
- ⏱️ Tela de loading durante verificação de autenticação
- 🎨 Logo personalizado com design moderno
- 🎯 Nome atualizado para MyMetricHUB
- 🔐 Autenticação via API REST
- 🎫 Sistema de tokens JWT
- 👤 Login com usuário ou email
- 🏢 Seletor de cliente para tablename "all"
- 📊 Métricas dinâmicas com seletor de datas

## 🛠️ Instalação

1. Clone o repositório ou navegue até a pasta do projeto
2. Instale as dependências:
```bash
npm install
```

3. Execute o servidor de desenvolvimento:
```bash
npm run dev
```

4. Abra [http://localhost:5173](http://localhost:5173) no seu navegador

## 🔑 Credenciais de Demonstração

- **Usuário/Email:** `accounts@mymetric.com.br`
- **Senha:** `Z5RDqlkDOk0SP65`
- **Tabela de Dados:** `all` (permite seleção de cliente)

> **Nota:** Certifique-se de que a API backend está rodando em `http://localhost:8000`

## 🔒 Segurança

- **Senha:** Enviada em texto plano (como no exemplo curl)
- **Token:** JWT com expiração de 24 horas
- **Validação:** Tokens são validados automaticamente

## 📡 Formato da API

### Login (POST /login)
```json
// Request
{
  "email": "accounts@mymetric.com.br",
  "password": "Z5RDqlkDOk0SP65"
}

// Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### Profile (GET /profile)
```bash
curl --request GET \
  --url http://localhost:8000/profile \
  --header 'Authorization: Bearer YOUR_TOKEN' \
  --header 'Content-Type: application/json'
```

```json
// Response
{
  "email": "accounts@mymetric.com.br",
  "admin": false,
  "access_control": "all",
  "tablename": "all"
}
```

### Metrics (POST /metrics/basic-data)
```bash
curl --request POST \
  --url http://localhost:8000/metrics/basic-data \
  --header 'Authorization: Bearer YOUR_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "start_date": "2025-07-27",
    "end_date": "2025-08-03",
    "table_name": "coffeemais"
  }'
```

```json
// Response
{
  "total_sales": 125000,
  "total_orders": 1250,
  "average_order_value": 100.0,
  "customer_count": 450,
  "growth_rate": 12.5,
  "period": "2025-07-27 a 2025-08-03",
  "table_name": "coffeemais"
}
```

## 🎯 Sobre o MyMetricHUB

O MyMetricHUB é uma plataforma moderna de análise de métricas e dados, oferecendo uma interface intuitiva e responsiva para visualização de indicadores de negócio.

## 📦 Scripts Disponíveis

- `npm run dev` - Inicia o servidor de desenvolvimento
- `npm run build` - Cria a build de produção
- `npm run preview` - Visualiza a build de produção
- `npm run lint` - Executa o linter

## 🎨 Personalização

O projeto usa Tailwind CSS com configurações customizadas. Você pode personalizar:

- Cores no arquivo `tailwind.config.js`
- Animações no arquivo `src/index.css`
- Componentes no arquivo `src/components/LoginScreen.tsx`

## 📱 Responsividade

A tela de login é totalmente responsiva e funciona perfeitamente em:
- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## 🔧 Estrutura do Projeto

```
src/
├── components/
│   ├── LoginScreen.tsx    # Componente da tela de login
│   ├── Dashboard.tsx      # Componente da dashboard principal
│   ├── LoadingScreen.tsx  # Tela de loading
│   └── Logo.tsx          # Componente de logo personalizado
├── hooks/
│   └── useAuth.ts        # Hook para gerenciamento de autenticação
├── types/
│   └── index.ts          # Definições de tipos TypeScript
├── App.tsx                # Componente raiz da aplicação
├── main.tsx              # Ponto de entrada da aplicação
└── index.css             # Estilos globais e configurações do Tailwind
```

## 🚀 Deploy

Para fazer o deploy da aplicação:

1. Execute `npm run build`
2. Os arquivos de produção estarão na pasta `dist/`
3. Faça upload dos arquivos para seu servidor web

## 📄 Licença

Este projeto está sob a licença MIT. 