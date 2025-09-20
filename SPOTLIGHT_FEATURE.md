# Spotlight Unified - Clientes e Abas

## 🎯 Funcionalidades

O novo **SpotlightUnified** foi criado para replicar a experiência do Spotlight do macOS, permitindo alternar entre clientes e abas do dashboard em uma única interface.

### ✨ Características Principais

- **Design Elegante**: Interface moderna com backdrop blur e animações suaves
- **Busca Global**: Filtragem em tempo real em TODAS as categorias simultaneamente
- **Categorias Inteligentes**: Alternância entre "Clientes" e "Abas" com `Tab` (quando não há busca)
- **Navegação por Teclado**: 
  - `⌘K` (Mac) ou `Ctrl+K` (Windows/Linux) para abrir
  - `↑↓` para navegar entre opções
  - `Tab` para alternar entre categorias (Clientes/Abas)
  - `Enter` para selecionar
  - `Escape` para fechar
- **Visualização Rica**: 
  - Clientes: Avatares coloridos com primeira letra
  - Abas: Ícones específicos para cada seção
- **Responsivo**: Funciona perfeitamente em desktop e mobile

### 🎨 Design

- **Modal Centralizado**: Aparece no centro da tela com overlay blur
- **Gradientes**: Avatares com gradientes coloridos para cada cliente
- **Animações**: Transições suaves de entrada e saída
- **Estados Visuais**: Destaque do item selecionado com bordas coloridas

### 🔧 Integração

O componente foi integrado no Dashboard substituindo o TableSelector anterior, mantendo toda a funcionalidade existente:

- Suporte a CSV de clientes
- Controle de permissões de usuário
- Opção de ocultar nome do cliente
- Fallback para tabelas disponíveis

### 🚀 Como Usar

1. **Abrir Spotlight**: Pressione `⌘K` ou clique no botão do seletor
2. **Busca Global**: Digite para buscar em TODOS os clientes e abas simultaneamente
3. **Alternar Categorias**: Use `Tab` para alternar entre "Clientes" e "Abas" (quando não há busca)
4. **Navegar**: Use as setas do teclado para navegar
5. **Selecionar**: Pressione `Enter` ou clique no item
6. **Fechar**: Pressione `Escape` ou clique fora do modal

### 📋 Abas Disponíveis

- **Visão Geral**: Métricas gerais e KPIs
- **Mídia Paga**: Análise de campanhas pagas  
- **Funil de Conversão**: Jornada do cliente
- **Dados Detalhados**: Dados brutos e análises
- **Frete**: Análise de frete e logística
- **Produtos**: Performance de produtos
- **Tempo Real**: Dados em tempo real
- **Product Scoring**: Scoring de produtos (Havaianas)
- **Testes A/B**: Experimentos e testes
- **Configuração**: Configurações do sistema (apenas admins)

### 🎯 Melhorias Implementadas

- **Interface Unificada**: Uma única interface para clientes e abas
- **Sempre Disponível**: Spotlight aparece para TODOS os usuários (com ou sem acesso total)
- **Busca Global Inteligente**: Filtragem simultânea em TODAS as categorias
- **Navegação Intuitiva**: Alternância fácil entre categorias com `Tab` (sem busca)
- **Adaptação Inteligente**: Mostra apenas categorias disponíveis para cada usuário
- **Indicadores Visuais**: Tags coloridas mostram a categoria de cada resultado
- **Navegação por Teclado Completa**: Controle total via teclado
- **Visual Diferenciado**: Cores e ícones distintos para cada categoria
- **Performance Otimizada**: Limitação inteligente de resultados
- **Compatibilidade Total**: Mantém toda funcionalidade existente

### 🔄 Fluxo de Trabalho

1. **Acesso Rápido**: `⌘K` para abrir o spotlight (disponível para TODOS)
2. **Busca Global**: Digite para buscar em TODOS os clientes e abas
3. **Seleção de Contexto**: `Tab` para escolher entre clientes ou abas (sem busca)
4. **Navegação Fluida**: Setas para navegar, `Enter` para confirmar
5. **Mudança Instantânea**: Cliente e aba mudam imediatamente
6. **Indicadores Visuais**: Tags mostram se é "Cliente" ou "Aba"

### 👥 Diferentes Níveis de Acesso

- **Usuários com Acesso Total**: Veem clientes e abas, podem alternar entre ambos
- **Usuários com Acesso Limitado**: Veem apenas abas (não podem trocar de cliente)
- **Busca Global**: Funciona para todos, mas filtra apenas o que o usuário tem acesso

O componente oferece uma experiência muito mais rica e similar ao Spotlight do macOS, permitindo navegação rápida e eficiente entre diferentes contextos da aplicação, independentemente do nível de acesso do usuário.
