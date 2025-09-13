import { useState, useEffect } from 'react'
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  Search, 
  Shield,
  XCircle,
  AlertCircle,
  Target,
  Network,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react'
import { api } from '../services/api'

interface User {
  id?: string
  email: string
  username: string
  admin: boolean
  access_control: string
  tablename: string
  lastLogin?: string
  created_at?: string
  status?: 'active' | 'inactive'
}

interface ConfiguracaoProps {
  selectedTable: string
}

const Configuracao = ({ selectedTable }: ConfiguracaoProps) => {
  const [activeSubTab, setActiveSubTab] = useState<'usuarios' | 'metas' | 'clusters'>('usuarios')
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

  // Estados para metas
  const [goals, setGoals] = useState<any>(null)
  const [isLoadingGoals, setIsLoadingGoals] = useState(false)
  const [goalsError, setGoalsError] = useState<string | null>(null)

  // Estados para categorias de tráfego
  const [trafficCategories, setTrafficCategories] = useState<any>(null)
  const [isLoadingTraffic, setIsLoadingTraffic] = useState(false)
  const [trafficError, setTrafficError] = useState<string | null>(null)

  
  // Estados para modal de usuário
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showGeneratedPassword, setShowGeneratedPassword] = useState(false)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<string | null>(null)
  const [goalFormData, setGoalFormData] = useState({
    month: '',
    goal_value: ''
  })
  const [showClusterModal, setShowClusterModal] = useState(false)
  const [editingCluster, setEditingCluster] = useState<string | null>(null)
  const [clusterFormData, setClusterFormData] = useState({
    category_name: '',
    description: '',
    rules: {
      origem: '',
      midia: '',
      campaign: '',
      page_location: '',
      parametros_url: '',
      cupom: ''
    }
  })
  const [successData, setSuccessData] = useState<{
    message: string
    generated_password?: string
    note?: string
  } | null>(null)
  
  // Estados para formulário
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    admin: false,
    access_control: 'read',
    tablename: selectedTable
  })
  

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<string | null>(null)

  // Buscar usuários
  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      setApiError(null)
      const token = localStorage.getItem('auth-token')
      if (!token) return

      const data = await api.getUsers(token, selectedTable)
      setUsers(data.users || [])
      setFilteredUsers(data.users || [])
    } catch (error: any) {
      console.error('Erro ao buscar usuários:', error)
      setUsers([])
      setFilteredUsers([])
      setApiError(error.message || 'Erro ao conectar com a API')
    } finally {
      setIsLoading(false)
    }
  }

  // Buscar metas
  const fetchGoals = async () => {
    try {
      setIsLoadingGoals(true)
      setGoalsError(null)
      const token = localStorage.getItem('auth-token')
      if (!token) return

      const data = await api.getGoals(token, { table_name: selectedTable })
      setGoals(data)
    } catch (error: any) {
      console.error('Erro ao buscar metas:', error)
      setGoals(null)
      setGoalsError(error.message || 'Erro ao conectar com a API')
    } finally {
      setIsLoadingGoals(false)
    }
  }

  // Buscar categorias de tráfego
  const fetchTrafficCategories = async () => {
    try {
      setIsLoadingTraffic(true)
      setTrafficError(null)
      const token = localStorage.getItem('auth-token')
      if (!token) return

      const data = await api.getTrafficCategories(token, { table_name: selectedTable })
      setTrafficCategories(data)
    } catch (error: any) {
      console.error('Erro ao buscar categorias de tráfego:', error)
      setTrafficCategories(null)
      setTrafficError(error.message || 'Erro ao conectar com a API')
    } finally {
      setIsLoadingTraffic(false)
    }
  }

  // Deletar meta
  const deleteGoal = async (month: string) => {
    if (!confirm(`Tem certeza que deseja deletar a meta de ${month}?`)) return

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) return

      await api.deleteGoal(token, {
        table_name: selectedTable,
        month: month,
        goal_type: 'revenue_goal'
      })
      
      // Recarregar as metas após deletar
      fetchGoals()
    } catch (error: any) {
      console.error('Erro ao deletar meta:', error)
      alert('Erro ao deletar meta. Tente novamente.')
    }
  }

  // Deletar categoria de tráfego
  const deleteTrafficCategory = async (categoryName: string) => {
    if (!confirm(`Tem certeza que deseja deletar a categoria "${categoryName}"?`)) return

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) return

      await api.deleteTrafficCategory(token, {
        table_name: selectedTable,
        category_name: categoryName
      })
      
      // Recarregar as categorias após deletar
      fetchTrafficCategories()
    } catch (error: any) {
      console.error('Erro ao deletar categoria:', error)
      alert('Erro ao deletar categoria. Tente novamente.')
    }
  }

  // Salvar meta
  const saveGoal = async () => {
    if (!goalFormData.month || !goalFormData.goal_value) {
      alert('Por favor, preencha todos os campos.')
      return
    }

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) return

      await api.saveMonthlyGoal(token, {
        table_name: selectedTable,
        month: goalFormData.month,
        goal_value: parseFloat(goalFormData.goal_value),
        goal_type: 'revenue_goal'
      })
      
      // Fechar modal e recarregar metas
      setShowGoalModal(false)
      setGoalFormData({ month: '', goal_value: '' })
      setEditingGoal(null)
      fetchGoals()
      
      // Mostrar sucesso
      setSuccessData({
        message: editingGoal ? 'Meta atualizada com sucesso!' : 'Meta cadastrada com sucesso!',
        note: `Meta de R$ ${parseFloat(goalFormData.goal_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para ${goalFormData.month} foi ${editingGoal ? 'atualizada' : 'salva'}.`
      })
      setShowSuccessModal(true)
    } catch (error: any) {
      console.error('Erro ao salvar meta:', error)
      alert('Erro ao salvar meta. Tente novamente.')
    }
  }

  // Abrir modal de nova meta
  const openNewGoalModal = () => {
    setGoalFormData({ month: '', goal_value: '' })
    setEditingGoal(null)
    setShowGoalModal(true)
  }

  // Abrir modal de editar meta
  const openEditGoalModal = (month: string, currentValue: number) => {
    setGoalFormData({ 
      month: month, 
      goal_value: currentValue.toString() 
    })
    setEditingGoal(month)
    setShowGoalModal(true)
  }

  // Salvar cluster
  const saveCluster = async () => {
    if (!clusterFormData.category_name || !clusterFormData.description) {
      alert('Por favor, preencha nome e descrição da categoria.')
      return
    }

    // Filtrar apenas as regras que foram preenchidas
    const filledRules = Object.entries(clusterFormData.rules)
      .filter(([key, value]) => value.trim() !== '')
      .reduce((acc, [key, value]) => {
        acc[key] = value
        return acc
      }, {} as Record<string, string>)

    if (Object.keys(filledRules).length === 0) {
      alert('Por favor, preencha pelo menos uma regra.')
      return
    }

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) return

      await api.saveTrafficCategory(token, {
        table_name: selectedTable,
        category_name: clusterFormData.category_name,
        description: clusterFormData.description,
        rules: {
          type: 'regex',
          rules: filledRules
        }
      })
      
      // Fechar modal e recarregar categorias
      setShowClusterModal(false)
      setClusterFormData({ 
        category_name: '', 
        description: '', 
        rules: {
          origem: '',
          midia: '',
          campaign: '',
          page_location: '',
          parametros_url: '',
          cupom: ''
        }
      })
      setEditingCluster(null)
      fetchTrafficCategories()
      
      // Mostrar sucesso
      setSuccessData({
        message: editingCluster ? 'Cluster atualizado com sucesso!' : 'Cluster cadastrado com sucesso!',
        note: `Categoria "${clusterFormData.category_name}" foi ${editingCluster ? 'atualizada' : 'salva'} com ${Object.keys(filledRules).length} regras.`
      })
      setShowSuccessModal(true)
    } catch (error: any) {
      console.error('Erro ao salvar cluster:', error)
      alert('Erro ao salvar cluster. Tente novamente.')
    }
  }

  // Abrir modal de novo cluster
  const openNewClusterModal = () => {
    setClusterFormData({ 
      category_name: '', 
      description: '', 
      rules: {
        origem: '',
        midia: '',
        campaign: '',
        page_location: '',
        parametros_url: '',
        cupom: ''
      }
    })
    setEditingCluster(null)
    setShowClusterModal(true)
  }

  // Abrir modal de editar cluster
  const openEditClusterModal = (category: any) => {
    setClusterFormData({ 
      category_name: category.nome, 
      description: category.descricao || '', 
      rules: {
        origem: category.regras?.rules?.origem || '',
        midia: category.regras?.rules?.midia || '',
        campaign: category.regras?.rules?.campaign || '',
        page_location: category.regras?.rules?.page_location || '',
        parametros_url: category.regras?.rules?.parametros_url || '',
        cupom: category.regras?.rules?.cupom || ''
      }
    })
    setEditingCluster(category.nome)
    setShowClusterModal(true)
  }

  // Filtrar usuários
  useEffect(() => {
    let filtered = users

    // Filtro por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro por tipo
    if (filterType !== 'all') {
      if (filterType === 'admin') {
        filtered = filtered.filter(user => user.admin === true)
      } else if (filterType === 'user') {
        filtered = filtered.filter(user => user.admin === false)
      }
    }

    // Filtro por status


    setFilteredUsers(filtered)
  }, [users, searchTerm, filterType])

  // Carregar usuários quando a tabela mudar
  useEffect(() => {
    if (selectedTable) {
      fetchUsers()
      setFormData(prev => ({ ...prev, tablename: selectedTable }))
    }
  }, [selectedTable])

  // Carregar metas quando a aba metas for ativada
  useEffect(() => {
    if (activeSubTab === 'metas' && selectedTable && !goals) {
      fetchGoals()
    }
  }, [activeSubTab, selectedTable])

  // Carregar categorias de tráfego quando a aba clusters for ativada
  useEffect(() => {
    if (activeSubTab === 'clusters' && selectedTable && !trafficCategories) {
      fetchTrafficCategories()
    }
  }, [activeSubTab, selectedTable])

  // Abrir modal para novo usuário
  const openNewUserModal = () => {
    setEditingUser(null)
    setFormData({
      email: '',
      username: '',
      admin: false,
      access_control: 'read',
      tablename: selectedTable
    })
    setErrors({})
    setShowUserModal(true)
  }

  // Abrir modal para editar usuário
  const openEditUserModal = (user: User) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      username: user.username || user.email.split('@')[0],
      admin: user.admin,
      access_control: user.access_control === '[]' || user.access_control === '' ? 'read' : user.access_control,
      tablename: selectedTable
    })
    setErrors({})
    setShowUserModal(true)
  }

  // Validar formulário
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = 'Email é obrigatório'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido'
    }

    // Validar se temos uma tabela válida
    if (!selectedTable || selectedTable.trim() === '') {
      newErrors.general = 'Nenhuma tabela selecionada. Selecione uma tabela antes de criar/editar usuários.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Salvar usuário
  const saveUser = async () => {
    if (!validateForm()) return

    try {
      setIsSubmitting(true)
      const token = localStorage.getItem('auth-token')
      if (!token) return

      // Garantir que teremos uma tabela válida (priorizar selectedTable)
      const effectiveTable = selectedTable && selectedTable.trim() 
        ? selectedTable 
        : (formData.tablename && formData.tablename.trim())
          ? formData.tablename
          : (editingUser && editingUser.tablename)
            ? editingUser.tablename
            : ''
      
      if (!effectiveTable) {
        setErrors({ general: 'Tabela não definida. Selecione uma tabela e tente novamente.' })
        return
      }

      console.log('🔍 Determinação da tabela efetiva:', {
        selectedTable,
        formDataTablename: formData.tablename,
        editingUserTablename: editingUser?.tablename,
        effectiveTable
      })


      // Usar o mesmo endpoint para criação e edição
      const userDataToSend: any = {
        email: formData.email,
        table_name: effectiveTable,
        admin: formData.admin
      }
      // redundância opcional para compat
      userDataToSend.tablename = effectiveTable

      console.log('👤 Enviando usuário (criar/editar):', userDataToSend, { selectedTable, formTable: formData.tablename, editingUserTable: editingUser?.tablename })
      
      const response = await api.createUser(token, userDataToSend)

      // Se a API retornar uma nova senha (tanto na criação quanto na edição), exibir modal de sucesso
      if (response && response.generated_password) {
        setSuccessData({
          message: response.message,
          generated_password: response.generated_password,
          note: response.note
        })
        setShowSuccessModal(true)
        setShowUserModal(false)
      } else if (!editingUser) {
        // Criação sem senha (fallback)
        setSuccessData({
          message: response?.message || 'Usuário criado com sucesso',
          generated_password: undefined,
          note: response?.note
        })
        setShowSuccessModal(true)
        setShowUserModal(false)
      } else {
        // Edição sem senha gerada: apenas fechar modal
        setShowUserModal(false)
      }

      fetchUsers() // Recarregar lista
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error)
      setErrors({ general: error.message || 'Erro ao salvar usuário. Tente novamente.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Remover usuário
  const deleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja remover este usuário?')) return

    try {
      const token = localStorage.getItem('auth-token')
      if (!token) return

      await api.deleteUser(token, userId)
      fetchUsers() // Recarregar lista
    } catch (error) {
      console.error('Erro ao remover usuário:', error)
      alert('Erro ao remover usuário. Tente novamente.')
    }
  }

  



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configurações</h2>
          <p className="text-gray-600">Gerencie configurações do sistema para {selectedTable}</p>
        </div>
      </div>

      {/* Sub-abas de Navegação */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <nav className="flex">
          <button
            onClick={() => setActiveSubTab('usuarios')}
            className={`flex-1 py-2.5 px-4 font-medium text-sm transition-all duration-200 ${
              activeSubTab === 'usuarios'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <div className={`p-1.5 rounded-md transition-colors ${
                activeSubTab === 'usuarios' ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                <Users className={`w-4 h-4 ${
                  activeSubTab === 'usuarios' ? 'text-blue-600' : 'text-gray-500'
                }`} />
              </div>
              <span>Usuários</span>
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab('metas')}
            className={`flex-1 py-2.5 px-4 font-medium text-sm transition-all duration-200 ${
              activeSubTab === 'metas'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <div className={`p-1.5 rounded-md transition-colors ${
                activeSubTab === 'metas' ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                <Target className={`w-4 h-4 ${
                  activeSubTab === 'metas' ? 'text-blue-600' : 'text-gray-500'
                }`} />
              </div>
              <span>Metas</span>
            </div>
          </button>
          <button
            onClick={() => setActiveSubTab('clusters')}
            className={`flex-1 py-2.5 px-4 font-medium text-sm transition-all duration-200 ${
              activeSubTab === 'clusters'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <div className={`p-1.5 rounded-md transition-colors ${
                activeSubTab === 'clusters' ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                <Network className={`w-4 h-4 ${
                  activeSubTab === 'clusters' ? 'text-blue-600' : 'text-gray-500'
                }`} />
              </div>
              <span>Clusters de Tráfego</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Conteúdo das Sub-abas */}
      {activeSubTab === 'usuarios' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header da sub-aba Usuários */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Configuração de Usuários</h3>
              <p className="text-gray-600">Gerencie usuários e permissões para {selectedTable}</p>
            </div>
            <button
              onClick={openNewUserModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Novo Usuário
            </button>
          </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
            />
          </div>

          {/* Filtro de Tipo */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
          >
            <option value="all">Todos os tipos</option>
            <option value="admin">Administradores</option>
            <option value="user">Usuários</option>
          </select>
        </div>
      </div>

      {/* Lista de Usuários */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Carregando usuários...</p>
          </div>
        ) : apiError ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-600 font-medium mb-2">Erro ao carregar usuários</p>
            <p className="text-gray-600 mb-4">{apiError}</p>
            <button
              onClick={fetchUsers}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
            >
              Tentar Novamente
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchTerm || filterType !== 'all'
                ? 'Nenhum usuário encontrado com os filtros aplicados'
                : users.length === 0 
                  ? 'Nenhum usuário encontrado para esta tabela'
                  : 'Nenhum usuário encontrado'
              }
            </p>
            {users.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Clique em "Novo Usuário" para adicionar o primeiro usuário
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>


                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-px whitespace-nowrap">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id || user.email} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center shadow-sm">
                            <span className="text-lg font-semibold text-blue-700">
                              {(user.username || user.email.split('@')[0]).charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-gray-900">
                            {user.username || user.email.split('@')[0]}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {user.admin ? (
                          <div className="flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded-full">
                            <Shield className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-medium text-red-700">Administrador</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-200 rounded-full">
                            <Users className="w-4 h-4 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700">Usuário</span>
                          </div>
                        )}
                      </div>
                    </td>
                    
                    

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium w-px">
                      <div className="flex items-center justify-end gap-2 ml-auto">
                        <button
                          onClick={() => openEditUserModal(user)}
                          className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200 transform hover:scale-110"
                          title="Editar usuário"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id || user.email)}
                          className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-all duration-200 transform hover:scale-110"
                          title="Remover usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </div>
      )}

      {/* Sub-aba Metas */}
      {activeSubTab === 'metas' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Configuração de Metas</h3>
              <p className="text-gray-600">Visualize e gerencie metas para {selectedTable}</p>
            </div>
            <button
              onClick={openNewGoalModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <Target className="w-4 h-4" />
              Nova Meta
            </button>
          </div>
          
          {isLoadingGoals ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando metas...</p>
            </div>
          ) : goalsError ? (
            <div className="bg-white rounded-xl border border-red-200 p-8 text-center shadow-sm">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-red-600 mb-2">Erro ao carregar metas</h4>
              <p className="text-gray-600 mb-4">{goalsError}</p>
              <button
                onClick={fetchGoals}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
              >
                Tentar Novamente
              </button>
            </div>
          ) : goals ? (
            <div className="space-y-6">
              {/* Tabela detalhada das metas */}
              {goals.goals?.metas_mensais && Object.keys(goals.goals.metas_mensais).length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900">Detalhamento das Metas Mensais</h4>
                    <p className="text-sm text-gray-600 mt-1">Metas de receita paga por mês</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Mês
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Meta de Receita Paga
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(goals.goals.metas_mensais)
                          .sort(([a], [b]) => {
                            // Ordenar por mês em ordem decrescente (mais recente primeiro)
                            return b.localeCompare(a)
                          })
                          .map(([mes, meta]: [string, any]) => (
                          <tr key={mes} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                  <span className="text-xs font-semibold text-blue-600">
                                    {new Date(mes.split('-')[0], parseInt(mes.split('-')[1]) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {new Date(mes.split('-')[0], parseInt(mes.split('-')[1]) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                  </div>
                                  <div className="text-xs text-gray-500">{mes}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-sm font-semibold text-green-600">
                                  R$ {meta.meta_receita_paga?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openEditGoalModal(mes, meta.meta_receita_paga || 0)}
                                  className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200 transform hover:scale-110"
                                  title="Editar meta"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteGoal(mes)}
                                  className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-all duration-200 transform hover:scale-110"
                                  title="Deletar meta"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Nenhuma meta encontrada</h4>
                  <p className="text-gray-600">
                    Não há metas configuradas para esta tabela no momento.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
              <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">Nenhuma meta carregada</h4>
              <p className="text-gray-600 mb-4">
                Clique em "Atualizar" para carregar as metas da API.
              </p>
              <button
                onClick={fetchGoals}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
              >
                Carregar Metas
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sub-aba Clusters de Tráfego */}
      {activeSubTab === 'clusters' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Clusters de Tráfego</h3>
              <p className="text-gray-600">Visualize e gerencie categorias de tráfego para {selectedTable}</p>
            </div>
            <button
              onClick={openNewClusterModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <Network className="w-4 h-4" />
              Novo Cluster
            </button>
          </div>
          
          {isLoadingTraffic ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando categorias de tráfego...</p>
            </div>
          ) : trafficError ? (
            <div className="bg-white rounded-xl border border-red-200 p-8 text-center shadow-sm">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-red-600 mb-2">Erro ao carregar categorias</h4>
              <p className="text-gray-600 mb-4">{trafficError}</p>
              <button
                onClick={fetchTrafficCategories}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          ) : trafficCategories ? (
            <div className="space-y-4">
              {/* Lista de categorias */}
              {trafficCategories.data && trafficCategories.data.length > 0 ? (
                <div className="space-y-4">
                  {trafficCategories.data.map((category, index) => (
                    <div key={index} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                        <h5 className="text-lg font-semibold text-gray-900">{category.nome}</h5>
                        {category.descricao && (
                          <p className="text-sm text-gray-600 mt-1">{category.descricao}</p>
                        )}
                      </div>
                      {category.regras && category.regras.rules && Object.keys(category.regras.rules).length > 0 && (
                        <div className="px-6 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <h6 className="text-sm font-medium text-gray-700">
                              Regras de Classificação ({category.regras.type}):
                            </h6>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditClusterModal(category)}
                                className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200 transform hover:scale-110"
                                title="Editar categoria"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteTrafficCategory(category.nome)}
                                className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-all duration-200 transform hover:scale-110"
                                title="Deletar categoria"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {Object.entries(category.regras.rules).map(([key, value], ruleIndex) => (
                              <div key={ruleIndex} className="flex items-start gap-3">
                                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                                <div className="flex-1">
                                  <span className="text-sm font-medium text-gray-700">{key}:</span>
                                  <span className="text-sm text-gray-600 ml-2 font-mono bg-gray-100 px-2 py-1 rounded">
                                    {value}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
                  <Network className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Nenhuma categoria encontrada</h4>
                  <p className="text-gray-600">
                    Não há categorias de tráfego configuradas para esta tabela no momento.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
              <Network className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">Nenhuma categoria carregada</h4>
              <p className="text-gray-600 mb-4">
                Clique em "Atualizar" para carregar as categorias de tráfego da API.
              </p>
              <button
                onClick={fetchTrafficCategories}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Carregar Categorias
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Usuário */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingUser ? 'Editar Usuário' : 'Criar Novo Usuário'}
                </h3>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {errors.general && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{errors.general}</span>
                  </div>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); saveUser(); }} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="usuario@exemplo.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>




                {/* Admin */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="admin"
                      checked={formData.admin}
                      onChange={(e) => setFormData({ ...formData, admin: e.target.checked })}
                      className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="admin" className="ml-3 block text-sm font-medium text-gray-900">
                      Usuário administrador
                    </label>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    Administradores têm acesso total ao sistema e podem gerenciar outros usuários
                  </p>
                </div>



                {/* Botões */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowUserModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? 'Salvando...' : (editingUser ? 'Atualizar' : 'Criar')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sucesso */}
      {showSuccessModal && successData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  ✅ Usuário Criado com Sucesso!
                </h3>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-gray-600">{successData.message}</p>
                
                {successData.generated_password && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 mb-2">🔑 Senha Gerada Automaticamente</h4>
                    <div className="bg-white border border-yellow-300 rounded p-3 font-mono text-lg text-center relative">
                      <div className="flex items-center justify-center gap-2">
                        <span className="flex-1">
                          {showGeneratedPassword ? successData.generated_password : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowGeneratedPassword(!showGeneratedPassword)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                        >
                          {showGeneratedPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-yellow-700 mt-2">
                      {successData.note}
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-2">📧 Próximos Passos</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• A senha será enviada por email para o usuário</li>
                    <li>• O usuário poderá fazer login com o email e senha</li>
                    <li>• Compartilhe a senha com o usuário de forma segura se necessário</li>
                  </ul>
                </div>

                <button
                  onClick={() => {
                    setShowSuccessModal(false)
                    setShowGeneratedPassword(false)
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Meta */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingGoal ? 'Editar Meta' : 'Nova Meta'}</h3>
              <p className="text-sm text-gray-600 mt-1">{editingGoal ? 'Edite a meta de receita' : 'Cadastre uma nova meta de receita'}</p>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mês/Ano
                </label>
                <input
                  type="month"
                  value={goalFormData.month}
                  onChange={(e) => setGoalFormData({ ...goalFormData, month: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="2025-10"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meta de Receita (R$)
                </label>
                <input
                  type="number"
                  value={goalFormData.goal_value}
                  onChange={(e) => setGoalFormData({ ...goalFormData, goal_value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="10000000"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowGoalModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={saveGoal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <Target className="w-4 h-4" />
                {editingGoal ? 'Atualizar Meta' : 'Salvar Meta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Novo Cluster */}
      {showClusterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingCluster ? 'Editar Cluster de Tráfego' : 'Novo Cluster de Tráfego'}</h3>
              <p className="text-sm text-gray-600 mt-1">{editingCluster ? 'Edite a categoria de tráfego' : 'Cadastre uma nova categoria de tráfego'}</p>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Categoria
                </label>
                <input
                  type="text"
                  value={clusterFormData.category_name}
                  onChange={(e) => setClusterFormData({ ...clusterFormData, category_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  placeholder="SDR Completo"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  value={clusterFormData.description}
                  onChange={(e) => setClusterFormData({ ...clusterFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                  rows={3}
                  placeholder="Categoria para tráfego SDR com campanhas, páginas, cupons e parâmetros múltiplos"
                />
              </div>
              
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Regras de Classificação
                </label>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Origem
                    </label>
                    <input
                      type="text"
                      value={clusterFormData.rules.origem}
                      onChange={(e) => setClusterFormData({
                        ...clusterFormData,
                        rules: { ...clusterFormData.rules, origem: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                      placeholder="direct|referral|organic"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mídia
                    </label>
                    <input
                      type="text"
                      value={clusterFormData.rules.midia}
                      onChange={(e) => setClusterFormData({
                        ...clusterFormData,
                        rules: { ...clusterFormData.rules, midia: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                      placeholder="referral|social|cpc|email"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Campanha
                    </label>
                    <input
                      type="text"
                      value={clusterFormData.rules.campaign}
                      onChange={(e) => setClusterFormData({
                        ...clusterFormData,
                        rules: { ...clusterFormData.rules, campaign: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                      placeholder="sdr_campaign|lead_generation|outbound_2024"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Localização da Página
                    </label>
                    <input
                      type="text"
                      value={clusterFormData.rules.page_location}
                      onChange={(e) => setClusterFormData({
                        ...clusterFormData,
                        rules: { ...clusterFormData.rules, page_location: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                      placeholder="https://exemplo.com.br/sdr|https://exemplo.com.br/leads"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parâmetros URL
                    </label>
                    <input
                      type="text"
                      value={clusterFormData.rules.parametros_url}
                      onChange={(e) => setClusterFormData({
                        ...clusterFormData,
                        rules: { ...clusterFormData.rules, parametros_url: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                      placeholder="(8023|8001|8017)"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cupom
                    </label>
                    <input
                      type="text"
                      value={clusterFormData.rules.cupom}
                      onChange={(e) => setClusterFormData({
                        ...clusterFormData,
                        rules: { ...clusterFormData.rules, cupom: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                      placeholder="JF|Jf|jf|JC|Jc|jc|ES|Es|es"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowClusterModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={saveCluster}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
              >
                <Network className="w-4 h-4" />
                {editingCluster ? 'Atualizar Cluster' : 'Salvar Cluster'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Configuracao
