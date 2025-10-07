# Visualização de Pedidos por Localização

## 📍 Funcionalidade Implementada

Foi adicionada uma nova seção na aba **Visão Geral** que exibe pedidos agrupados por localização geográfica (cidade, região/estado e país).

## 🎯 Componente: OrdersByLocation

### Localização
`src/components/OrdersByLocation.tsx`

### Características

#### 1. **Fonte de Dados**
- Utiliza a API de métricas (`/metrics/basic-data`) ao invés da API de pedidos
- Os dados de localização (`city`, `region`, `country`) vêm junto com as métricas agregadas
- Exemplo de estrutura de dados:
```json
{
  "Data": "2025-10-02",
  "Cluster": "Sem Categoria",
  "Plataforma": "WEB",
  "city": "SAO PAULO",
  "region": "SP",
  "country": "Brasil",
  "Pedidos": 42,
  "Receita": 12524,
  ...
}
```

#### 2. **Agrupamento Flexível**
O componente permite visualizar dados agrupados por:
- **Cidade** (`city`) - mostra também região e país
- **Região/Estado** (`region`) - mostra também país
- **País** (`country`) - apenas o país

#### 3. **Métricas Exibidas**
- **Total de Pedidos**: Soma de todos os pedidos
- **Receita Total**: Soma de toda a receita
- **Localizações Únicas**: Quantidade de localizações diferentes
- **Cobertura de Dados**: Percentual de pedidos com informação de localização

#### 4. **Tabela Interativa**
- Ordenação por número de pedidos ou receita
- Ticket médio calculado automaticamente
- Percentual de pedidos por localização
- Design responsivo para mobile e desktop

#### 5. **Estados Visuais**
- Loading durante carregamento
- Mensagem de erro se houver falha
- Indicação quando não há dados disponíveis

## 🔧 Integração

### No Dashboard
O componente foi integrado na aba "Visão Geral" do Dashboard:

```typescript
<OrdersByLocation
  selectedTable={selectedTable}
  startDate={startDate}
  endDate={endDate}
/>
```

### Atualização de Interfaces
As interfaces `OrderItem` nos componentes relacionados foram atualizadas para incluir:
```typescript
city?: string
region?: string
country?: string
```

Componentes atualizados:
- `OrdersTab.tsx`
- `OrdersExpanded.tsx`

## 📊 Como Funciona

1. O componente faz uma requisição para `/metrics/basic-data` com os parâmetros:
   - `start_date`: data inicial
   - `end_date`: data final
   - `table_name`: tabela selecionada
   - `cluster`: "Todos"

2. Agrupa os dados recebidos pela localização selecionada (cidade, região ou país)

3. Calcula as métricas agregadas:
   - Soma de pedidos por localização
   - Soma de receita por localização
   - Ticket médio (receita / pedidos)

4. Ordena e exibe os resultados em uma tabela interativa

## 🎨 Design

O componente segue o design system existente do dashboard:
- Cores: azul, verde, roxo e laranja para diferentes métricas
- Ícones: MapPin (cidade), Map (região), Globe (país)
- Responsivo com Tailwind CSS
- Compatível com tema claro

## ⚠️ Observações

- Os dados de localização devem estar presentes na resposta da API
- Se os pedidos não tiverem informação de localização, aparecerá como "Não informado"
- A cobertura de dados mostra o percentual de pedidos que possuem informação de localização
- O componente é otimizado para grandes volumes de dados

## 🚀 Próximas Melhorias (Opcional)

- [ ] Adicionar visualização em mapa interativo
- [ ] Exportar dados de localização para CSV
- [ ] Filtro por plataforma (WEB, MOBILE, etc)
- [ ] Gráfico de pizza ou barras para visualização alternativa
- [ ] Comparação entre períodos diferentes

