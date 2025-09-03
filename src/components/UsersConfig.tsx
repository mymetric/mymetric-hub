import { useState, useEffect } from 'react'
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  Search, 
  Shield,
  XCircle,
  AlertCircle
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

interface UsersConfigProps {
  selectedTable: string
}

const UsersConfig = ({ selectedTable }: UsersConfigProps) => {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')

  
  // Estados para modal de usuário
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
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
    tablename: selectedTable,
    password: '',
    confirmPassword: ''
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

  // Abrir modal para novo usuário
  const openNewUserModal = () => {
    setEditingUser(null)
    setFormData({
      email: '',
      username: '',
      admin: false,
      access_control: 'read',
      tablename: selectedTable,
      password: '',
      confirmPassword: ''
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
      tablename: selectedTable,
      password: '',
      confirmPassword: ''
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
          <h2 className="text-2xl font-bold text-gray-900">Configuração de Usuários</h2>
          <p className="text-gray-600">Gerencie usuários e permissões para {selectedTable}</p>
        </div>
        <button
          onClick={openNewUserModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtro de Tipo */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos os tipos</option>
            <option value="admin">Administradores</option>
            <option value="user">Usuários</option>
          </select>


        </div>
      </div>

      {/* Lista de Usuários */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {(user.username || user.email.split('@')[0]).charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
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
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-red-500" />
                            <span className="text-sm font-medium text-red-700">Administrador</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-700">Usuário</span>
                          </div>
                        )}
                      </div>
                    </td>
                    
                    

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium w-px">
                      <div className="flex items-center justify-end gap-2 ml-auto">
                        <button
                          onClick={() => openEditUserModal(user)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                          title="Editar usuário"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id || user.email)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
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
                    <div className="bg-white border border-yellow-300 rounded p-3 font-mono text-lg text-center">
                      {successData.generated_password}
                    </div>
                    <p className="text-sm text-yellow-700 mt-2">
                      {successData.note}
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-2">📧 Próximos Passos</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Compartilhe a senha com o usuário de forma segura</li>
                    <li>• O usuário poderá fazer login com o email e senha</li>
                  </ul>
                </div>

                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UsersConfig
