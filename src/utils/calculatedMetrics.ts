export type MetricValueType = 'number' | 'currency' | 'percentage'

export type DataRow = Record<string, unknown>

export type CalculatedMetric = {
  key: string
  label: string
  type: MetricValueType
  isCalculated: true
  formula: string
}

type Token =
  | { t: 'number'; v: number }
  | { t: 'ident'; v: string }
  | { t: 'func'; v: string } // Função agregada: sum, avg, min, max, count
  | { t: 'op'; v: '+' | '-' | '*' | '/' | 'u-' }
  | { t: 'lparen' }
  | { t: 'rparen' }

function isIdentStart(ch: string) {
  return /[A-Za-z_]/.test(ch)
}
function isIdentPart(ch: string) {
  return /[A-Za-z0-9_]/.test(ch)
}

export function extractFormulaIdentifiers(formula: string): string[] {
  const ids = new Set<string>()
  const funcNames = ['sum', 'avg', 'min', 'max', 'count']
  let i = 0
  while (i < formula.length) {
    const ch = formula[i]
    if (isIdentStart(ch)) {
      let j = i + 1
      while (j < formula.length && isIdentPart(formula[j])) j++
      const ident = formula.slice(i, j)
      // Verificar se é uma chamada de função
      let k = j
      while (k < formula.length && /\s/.test(formula[k])) k++
      if (k < formula.length && formula[k] === '(') {
        // É uma função, não adicionar aos identificadores
        if (!funcNames.includes(ident.toLowerCase())) {
          // Função desconhecida, tratar como identificador
          ids.add(ident)
        }
        // Pular até o parêntese de fechamento correspondente
        let depth = 1
        k++
        while (k < formula.length && depth > 0) {
          if (formula[k] === '(') depth++
          else if (formula[k] === ')') depth--
          k++
        }
        i = k
        continue
      }
      // Não é função, adicionar aos identificadores
      ids.add(ident)
      i = j
      continue
    }
    i++
  }
  return Array.from(ids)
}

function tokenize(formula: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < formula.length) {
    const ch = formula[i]
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (ch === '(') {
      tokens.push({ t: 'lparen' })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ t: 'rparen' })
      i++
      continue
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ t: 'op', v: ch })
      i++
      continue
    }
    if (isIdentStart(ch)) {
      let j = i + 1
      while (j < formula.length && isIdentPart(formula[j])) j++
      const ident = formula.slice(i, j)
      // Verificar se é uma chamada de função (seguido de '(')
      let k = j
      while (k < formula.length && /\s/.test(formula[k])) k++
      if (k < formula.length && formula[k] === '(') {
        // É uma função
        const funcNames = ['sum', 'avg', 'min', 'max', 'count']
        if (funcNames.includes(ident.toLowerCase())) {
          tokens.push({ t: 'func', v: ident.toLowerCase() })
          i = j
          continue
        }
      }
      // Não é função, é identificador normal
      tokens.push({ t: 'ident', v: ident })
      i = j
      continue
    }
    // number (supports decimals)
    if (/[0-9.]/.test(ch)) {
      let j = i
      let dotCount = 0
      while (j < formula.length && /[0-9.]/.test(formula[j])) {
        if (formula[j] === '.') dotCount++
        if (dotCount > 1) break
        j++
      }
      const raw = formula.slice(i, j)
      const num = Number(raw)
      if (!Number.isFinite(num)) throw new Error(`Número inválido: "${raw}"`)
      tokens.push({ t: 'number', v: num })
      i = j
      continue
    }
    throw new Error(`Caractere inválido na fórmula: "${ch}"`)
  }
  return tokens
}

function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = []
  const stack: Token[] = []

  const prec = (op: Token & { t: 'op' }) => {
    switch (op.v) {
      case 'u-':
        return 3
      case '*':
      case '/':
        return 2
      case '+':
      case '-':
        return 1
      default:
        return 0
    }
  }

  const isRightAssoc = (op: Token & { t: 'op' }) => op.v === 'u-'

  let prev: Token | null = null
  for (const tok of tokens) {
    if (tok.t === 'number' || tok.t === 'ident') {
      output.push(tok)
      prev = tok
      continue
    }
    if (tok.t === 'func') {
      stack.push(tok)
      prev = tok
      continue
    }
    if (tok.t === 'op') {
      // unary minus
      let opTok: Token & { t: 'op' } = tok
      if (tok.v === '-') {
        const unary =
          prev === null || prev.t === 'op' || prev.t === 'lparen'
        if (unary) opTok = { t: 'op', v: 'u-' }
      }
      while (stack.length > 0) {
        const top = stack[stack.length - 1]
        if (top.t !== 'op') break
        const p1 = prec(opTok)
        const p2 = prec(top as any)
        if ((isRightAssoc(opTok) && p1 < p2) || (!isRightAssoc(opTok) && p1 <= p2)) {
          output.push(stack.pop()!)
        } else {
          break
        }
      }
      stack.push(opTok)
      prev = opTok
      continue
    }
    if (tok.t === 'lparen') {
      stack.push(tok)
      prev = tok
      continue
    }
    if (tok.t === 'rparen') {
      // Processar operadores até encontrar o parêntese de abertura
      while (stack.length > 0 && stack[stack.length - 1].t !== 'lparen' && stack[stack.length - 1].t !== 'func') {
        output.push(stack.pop()!)
      }
      // Se há uma função no topo, movê-la para a saída
      if (stack.length > 0 && stack[stack.length - 1].t === 'func') {
        output.push(stack.pop()!)
      }
      // Remover o parêntese de abertura
      const top = stack.pop()
      if (!top || top.t !== 'lparen') throw new Error('Parênteses desbalanceados')
      prev = tok
      continue
    }
  }

  while (stack.length > 0) {
    const top = stack.pop()!
    if (top.t === 'lparen' || top.t === 'rparen') throw new Error('Parênteses desbalanceados')
    output.push(top)
  }
  return output
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    // Tentar conversão direta primeiro
    let n = Number(value)
    if (Number.isFinite(n)) return n
    
    // Se falhou, pode ser formato brasileiro (1.234,56)
    // Remover pontos (separadores de milhar) e substituir vírgula por ponto
    const normalized = value.trim()
      .replace(/\./g, '') // Remove pontos
      .replace(',', '.') // Substitui vírgula por ponto
    n = Number(normalized)
    if (Number.isFinite(n)) return n
  }
  return 0
}

// Verifica se uma fórmula contém funções agregadas
export function hasAggregateFunctions(formula: string): boolean {
  const funcNames = ['sum', 'avg', 'min', 'max', 'count']
  const lowerFormula = formula.toLowerCase()
  return funcNames.some(func => {
    const regex = new RegExp(`\\b${func}\\s*\\(`, 'i')
    return regex.test(lowerFormula)
  })
}

// Extrai o argumento de uma função agregada (o campo dentro dos parênteses)
function extractFunctionArgument(formula: string, funcName: string): string | null {
  const regex = new RegExp(`\\b${funcName}\\s*\\(\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\)`, 'i')
  const match = formula.match(regex)
  return match ? match[1] : null
}

// Avalia uma função agregada sobre múltiplas linhas
function evaluateAggregateFunction(
  funcName: string,
  fieldName: string,
  rows: DataRow[]
): number {
  // Mapear valores com logs detalhados
  const rawValues = rows.map(row => row[fieldName])
  const convertedValues = rawValues.map(raw => {
    const converted = asNumber(raw)
    return { raw, converted, type: typeof raw }
  })
  
  const values = convertedValues
    .map(v => v.converted)
    .filter(v => Number.isFinite(v))

  if (values.length === 0) {
    console.warn(`⚠️ Nenhum valor válido encontrado para ${funcName}(${fieldName})`)
    console.warn(`   Valores brutos:`, rawValues.slice(0, 5))
    return 0
  }

  // Log detalhado dos primeiros valores para debug
  if (funcName.toLowerCase() === 'sum') {
    console.log(`🔍 Debug ${funcName}(${fieldName}):`)
    console.log(`   Total de linhas: ${rows.length}`)
    console.log(`   Valores válidos: ${values.length}`)
    console.log(`   Primeiros 5 valores convertidos:`, convertedValues.slice(0, 5))
    console.log(`   Primeiros 10 valores numéricos:`, values.slice(0, 10))
  }

  let result: number
  switch (funcName.toLowerCase()) {
    case 'sum':
      result = values.reduce((a, b) => a + b, 0)
      break
    case 'avg':
      result = values.reduce((a, b) => a + b, 0) / values.length
      break
    case 'min':
      result = Math.min(...values)
      break
    case 'max':
      result = Math.max(...values)
      break
    case 'count':
      result = values.length
      break
    default:
      throw new Error(`Função agregada desconhecida: ${funcName}`)
  }

  console.log(`📊 ${funcName}(${fieldName}): ${values.length} valores, resultado = ${result}`)
  return result
}

export function evaluateFormula(formula: string, variables: DataRow): number {
  const tokens = tokenize(formula)
  const rpn = toRpn(tokens)
  const stack: number[] = []

  console.log(`🧮 Avaliando fórmula: "${formula}"`)
  console.log(`   Tokens:`, tokens.map(t => t.t === 'number' ? t.v : t.t === 'ident' ? t.v : t.t === 'op' ? t.v : t.t))
  console.log(`   RPN:`, rpn.map(t => t.t === 'number' ? t.v : t.t === 'ident' ? t.v : t.t === 'op' ? t.v : t.t))

  for (const tok of rpn) {
    if (tok.t === 'number') {
      stack.push(tok.v)
      continue
    }
    if (tok.t === 'ident') {
      stack.push(asNumber(variables[tok.v]))
      continue
    }
    if (tok.t === 'func') {
      // Funções agregadas não devem aparecer aqui na avaliação linha por linha
      // Se aparecer, é um erro (deveria ter sido processada antes)
      throw new Error(`Função agregada ${tok.v} não pode ser avaliada linha por linha`)
    }
    if (tok.t === 'op') {
      if (tok.v === 'u-') {
        if (stack.length < 1) throw new Error('Expressão inválida (unário)')
        const a = stack.pop()!
        stack.push(-a)
        continue
      }
      if (stack.length < 2) throw new Error('Expressão inválida')
      const b = stack.pop()!
      const a = stack.pop()!
      let result: number
      switch (tok.v) {
        case '+':
          result = a + b
          break
        case '-':
          result = a - b
          break
        case '*':
          result = a * b
          break
        case '/':
          result = b === 0 ? 0 : a / b
          console.log(`🔢 Divisão: ${a} / ${b} = ${result}`)
          break
        default:
          throw new Error(`Operador desconhecido: ${tok.v}`)
      }
      stack.push(result)
      continue
    }
  }

  if (stack.length !== 1) throw new Error('Expressão inválida (pilha)')
  const out = stack[0]
  return Number.isFinite(out) ? out : 0
}

// Avalia uma fórmula com agregações sobre múltiplas linhas
export function evaluateAggregateFormula(
  formula: string,
  rows: DataRow[]
): number {
  console.log(`═══════════════════════════════════════════════════════════`)
  console.log(`🚀 EVALUATE AGGREGATE FORMULA CHAMADA`)
  console.log(`   Fórmula: "${formula}"`)
  console.log(`   Número de linhas: ${rows.length}`)
  console.log(`═══════════════════════════════════════════════════════════`)
  
  if (!rows.length) {
    console.warn(`⚠️ Nenhuma linha fornecida para avaliação`)
    return 0
  }

  // Substituir funções agregadas pelos seus valores calculados
  let processedFormula = formula.trim()
  const funcNames = ['sum', 'avg', 'min', 'max', 'count']
  
  // Armazenar substituições para evitar substituições múltiplas
  const replacements = new Map<string, number>()
  
  // Primeiro, encontrar todas as funções agregadas e calcular seus valores
  for (const funcName of funcNames) {
    const regex = new RegExp(`\\b${funcName}\\s*\\(\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\)`, 'gi')
    let match
    while ((match = regex.exec(formula)) !== null) {
      const fullMatch = match[0]
      const fieldName = match[1]
      const key = `${funcName}(${fieldName})`
      
      if (!replacements.has(key)) {
        const value = evaluateAggregateFunction(funcName, fieldName, rows)
        replacements.set(key, value)
        console.log(`🔢 Função agregada ${key} = ${value}`)
      }
    }
  }

  // Agora substituir todas as ocorrências - substituir da mais longa para a mais curta para evitar conflitos
  // Mas garantir que substituímos todas as ocorrências de cada função
  const sortedReplacements = Array.from(replacements.entries()).sort((a, b) => b[0].length - a[0].length)
  
  for (const [key, value] of sortedReplacements) {
    // Criar regex específica para esta função para evitar substituições parciais
    const [funcName, fieldName] = key.replace(')', '').split('(')
    // Escapar caracteres especiais do nome do campo para regex
    const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${funcName}\\s*\\(\\s*${escapedFieldName}\\s*\\)`, 'g')
    // Garantir que o valor é um número válido e formatá-lo corretamente
    const numValue = Number(value)
    if (!Number.isFinite(numValue)) {
      console.error(`❌ Valor não é um número finito para ${key}: ${value}`)
      continue
    }
    const valueStr = String(numValue) // Usar String() para garantir formato correto
    const beforeReplace = processedFormula
    
    // Substituição global - substituir todas as ocorrências
    processedFormula = processedFormula.replace(regex, valueStr)
    
    if (beforeReplace !== processedFormula) {
      console.log(`🔄 Substituído "${key}" por "${valueStr}" na fórmula`)
      console.log(`   Antes: "${beforeReplace}"`)
      console.log(`   Depois: "${processedFormula}"`)
    } else {
      console.warn(`⚠️ Não encontrou "${key}" para substituir na fórmula: "${processedFormula}"`)
      // Tentar sem word boundary
      const regexNoBoundary = new RegExp(`${funcName}\\s*\\(\\s*${escapedFieldName}\\s*\\)`, 'g')
      const testReplace = processedFormula.replace(regexNoBoundary, valueStr)
      if (testReplace !== processedFormula) {
        processedFormula = testReplace
        console.log(`   Tentativa sem word boundary funcionou: "${processedFormula}"`)
      }
    }
  }

  console.log(`📝 Fórmula original: "${formula}"`)
  console.log(`📝 Fórmula processada: "${processedFormula}"`)
  
  // Verificar se ainda há funções agregadas não substituídas
  const remainingFunctions = funcNames.some(func => 
    new RegExp(`\\b${func}\\s*\\(`, 'i').test(processedFormula)
  )
  if (remainingFunctions) {
    console.warn(`⚠️ Ainda há funções agregadas na fórmula processada!`)
    // Tentar substituir novamente
    for (const [key, value] of replacements.entries()) {
      const [funcName, fieldName] = key.replace(')', '').split('(')
      const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`${funcName}\\s*\\(\\s*${escapedFieldName}\\s*\\)`, 'gi')
      processedFormula = processedFormula.replace(regex, String(value))
    }
    console.log(`📝 Fórmula após segunda tentativa: "${processedFormula}"`)
  }
  
  // Validar que a fórmula processada contém apenas números, operadores e parênteses
  const validPattern = /^[\d\s+\-*/().]+$/
  if (!validPattern.test(processedFormula)) {
    console.warn(`⚠️ Fórmula processada contém caracteres inválidos: "${processedFormula}"`)
  }

  // Avaliar a fórmula resultante (agora sem funções agregadas)
  // Como todos os identificadores foram substituídos por números, podemos passar um objeto vazio
  try {
    console.log(`🧮 Avaliando fórmula processada: "${processedFormula}"`)
    const result = evaluateFormula(processedFormula, {})
    console.log(`✅ Resultado da fórmula agregada: ${result}`)
    
    // Log de debug: mostrar todos os valores calculados
    if (replacements.size > 0) {
      console.log(`📋 Valores calculados:`, Object.fromEntries(replacements))
      
      // Validação manual para divisão
      if (formula.includes('/') && replacements.size >= 2) {
        const replacementsArray = Array.from(replacements.entries())
        console.log(`🔍 Validação manual de divisão:`)
        replacementsArray.forEach(([key, value]) => {
          console.log(`   ${key} = ${value}`)
        })
      }
    }
    
    // Verificar se resultado é 0 quando não deveria ser
    if (result === 0 && replacements.size > 0) {
      const replacementsArray = Array.from(replacements.entries())
      const allNonZero = replacementsArray.every(([_, value]) => value !== 0)
      if (allNonZero && formula.includes('/')) {
        console.warn(`⚠️ Resultado é 0, mas todos os valores são não-zero. Verificando divisão...`)
        // Tentar calcular manualmente
        if (processedFormula.includes('/')) {
          const parts = processedFormula.split('/').map(p => p.trim())
          if (parts.length === 2) {
            const num = Number(parts[0])
            const den = Number(parts[1])
            if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
              const manualResult = num / den
              console.warn(`   Divisão manual: ${num} / ${den} = ${manualResult}`)
            }
          }
        }
      }
    }
    
    return result
  } catch (error) {
    console.error(`❌ Erro ao avaliar fórmula processada:`, error)
    console.error(`   Fórmula original: ${formula}`)
    console.error(`   Fórmula processada: ${processedFormula}`)
    throw error
  }
}

export function topologicallySortCalculatedMetrics(metrics: CalculatedMetric[]): CalculatedMetric[] {
  const byKey = new Map(metrics.map(m => [m.key, m] as const))
  const deps = new Map<string, Set<string>>()
  const inDegree = new Map<string, number>()

  for (const m of metrics) {
    const used = extractFormulaIdentifiers(m.formula)
    const d = new Set<string>()
    for (const id of used) {
      if (byKey.has(id) && id !== m.key) d.add(id)
    }
    deps.set(m.key, d)
    inDegree.set(m.key, d.size)
  }

  const queue: string[] = []
  for (const [k, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(k)
  }

  const ordered: CalculatedMetric[] = []
  while (queue.length > 0) {
    const k = queue.shift()!
    ordered.push(byKey.get(k)!)
    for (const [other, d] of deps.entries()) {
      if (d.has(k)) {
        d.delete(k)
        inDegree.set(other, (inDegree.get(other) || 0) - 1)
        if ((inDegree.get(other) || 0) === 0) queue.push(other)
      }
    }
  }

  if (ordered.length !== metrics.length) {
    const remaining = metrics.map(m => m.key).filter(k => !ordered.find(o => o.key === k))
    throw new Error(`Ciclo detectado entre métricas calculadas: ${remaining.join(', ')}`)
  }

  return ordered
}

export function applyCalculatedMetricsToRows<T extends DataRow>(
  rows: T[],
  metrics: CalculatedMetric[]
): T[] {
  if (!rows.length || !metrics.length) return rows
  const ordered = topologicallySortCalculatedMetrics(metrics)

  // Separar métricas agregadas das não-agregadas
  const aggregateMetrics: CalculatedMetric[] = []
  const regularMetrics: CalculatedMetric[] = []

  for (const m of ordered) {
    if (hasAggregateFunctions(m.formula)) {
      aggregateMetrics.push(m)
    } else {
      regularMetrics.push(m)
    }
  }

  // Primeiro, aplicar métricas regulares (linha por linha)
  let processedRows = rows.map((row) => {
    const next: any = { ...row }
    for (const m of regularMetrics) {
      try {
        const rawValue = evaluateFormula(m.formula, next)
        // Para métricas do tipo percentage, o padrão esperado no dashboard é 0–100 (e não 0–1)
        next[m.key] = m.type === 'percentage' ? rawValue * 100 : rawValue
      } catch {
        next[m.key] = 0
      }
    }
    return next as T
  })

  // Depois, aplicar métricas agregadas (uma vez sobre todas as linhas)
  if (aggregateMetrics.length > 0) {
    // Calcular valores agregados uma vez
    const aggregateValues = new Map<string, number>()
    for (const m of aggregateMetrics) {
      try {
        const rawValue = evaluateAggregateFormula(m.formula, processedRows as unknown as DataRow[])
        // Para métricas do tipo percentage, o padrão esperado no dashboard é 0–100 (e não 0–1)
        aggregateValues.set(m.key, m.type === 'percentage' ? rawValue * 100 : rawValue)
      } catch (e) {
        console.warn(`Erro ao calcular métrica agregada ${m.key}:`, e)
        aggregateValues.set(m.key, 0)
      }
    }

    // Aplicar os valores agregados a todas as linhas
    processedRows = processedRows.map((row) => {
      const next: any = { ...row }
      for (const m of aggregateMetrics) {
        next[m.key] = aggregateValues.get(m.key) || 0
      }
      return next as T
    })
  }

  return processedRows
}



