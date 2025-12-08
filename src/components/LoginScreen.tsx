import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, User, Lock, CheckCircle, AlertCircle, ArrowLeft, Mail } from 'lucide-react'
import Logo from './Logo'
import { api } from '../services/api'

interface LoginForm {
  username: string
  password: string
  rememberMe: boolean
}

interface ForgotPasswordForm {
  email: string
}

const LoginScreen = ({ onLogin }: { onLogin: (username: string, rememberMe: boolean) => void }) => {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loginStatus, setLoginStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [showTransition, setShowTransition] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordStatus, setForgotPasswordStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('')
  const [isForgotPasswordLoading, setIsForgotPasswordLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<LoginForm>()

  const {
    register: registerForgotPassword,
    handleSubmit: handleForgotPasswordSubmit,
    formState: { errors: forgotPasswordErrors },
    reset: resetForgotPassword
  } = useForm<ForgotPasswordForm>()

  const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRememberMe(e.target.checked)
  }

  const handleForgotPassword = () => {
    setShowForgotPassword(true)
    setForgotPasswordStatus('idle')
    setForgotPasswordMessage('')
    resetForgotPassword()
  }

  const handleBackToLogin = () => {
    setShowForgotPassword(false)
    setForgotPasswordStatus('idle')
    setForgotPasswordMessage('')
    resetForgotPassword()
  }

  const onForgotPasswordSubmit = async (data: ForgotPasswordForm) => {
    setIsForgotPasswordLoading(true)
    setForgotPasswordStatus('idle')
    setForgotPasswordMessage('')

    try {
      const response = await api.forgotPassword({
        email: data.email
      })

      setForgotPasswordStatus('success')
      setForgotPasswordMessage('Nova senha foi criada e enviada para seu email.')
      resetForgotPassword()
    } catch (error) {
      setForgotPasswordStatus('error')
      setForgotPasswordMessage(error instanceof Error ? error.message : 'Erro ao solicitar recuperação de senha.')
    }

    setIsForgotPasswordLoading(false)
  }

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setLoginStatus('idle')
    setErrorMessage('')

    try {
      // Fazer requisição para a API
      const response = await api.login({
        email: data.username, // Envia username como email para a API
        password: data.password
      })

      // Chamar API 2.0 em paralelo (não bloqueia o fluxo)
      api.loginV2({
        email: data.username,
        password: data.password
      }).catch(error => {
        console.error('⚠️ API 2.0 login error (não bloqueia o fluxo):', error)
      })

      if (response.access_token && response.refresh_token) {
        setLoginStatus('success')
        
        console.log('🔐 Login response received:', response)
        
        // Salvar tokens e dados completos da resposta da API
        localStorage.setItem('auth-token', response.access_token)
        localStorage.setItem('login-response', JSON.stringify(response))
        
        console.log('💾 Data saved to localStorage:', {
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          loginResponse: response
        })
        
        // Efeito visual mais elaborado antes de redirecionar
        setTimeout(() => {
          setShowTransition(true)
          
          // Adicionar classe para animação de saída
          const loginContainer = document.querySelector('.login-container')
          if (loginContainer) {
            loginContainer.classList.add('animate-login-success')
          }
          
          // Redirecionar após a animação
          setTimeout(() => {
            onLogin(data.username, rememberMe) // Usa o estado local rememberMe
            reset()
            setRememberMe(false) // Reset do estado rememberMe
            setLoginStatus('idle')
            setShowTransition(false)
          }, 800)
        }, 1200)
      } else {
        setLoginStatus('error')
        setErrorMessage('Credenciais inválidas. Tente novamente.')
      }
    } catch (error) {
      setLoginStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao fazer login. Tente novamente.')
    }

    setIsLoading(false)
  }

  return (
    <div className="w-full max-w-lg relative">
      {/* Overlay de transição */}
      {showTransition && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm rounded-2xl z-10 animate-fade-in"></div>
      )}
      
      <div className="login-container bg-white/90 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20 transition-all duration-800 ease-in-out relative z-20">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Logo size="xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {showForgotPassword ? 'Recuperar Senha' : 'Bem-vindo'}
          </h1>
          <p className="text-gray-600">
            {showForgotPassword 
              ? 'Digite seu email para criar uma nova senha' 
              : 'Faça login para acessar sua conta'
            }
          </p>
        </div>

        {/* Status Messages */}
        {!showForgotPassword && loginStatus === 'success' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 animate-slide-up">
            <CheckCircle className="w-5 h-5 text-green-600 animate-bounce" />
            <span className="text-green-800 font-medium">Login realizado com sucesso!</span>
            <div className="success-particles"></div>
          </div>
        )}

        {!showForgotPassword && loginStatus === 'error' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 animate-slide-up">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800 font-medium">{errorMessage}</span>
          </div>
        )}

        {showForgotPassword && forgotPasswordStatus === 'success' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 animate-slide-up">
            <CheckCircle className="w-5 h-5 text-green-600 animate-bounce" />
            <span className="text-green-800 font-medium">{forgotPasswordMessage}</span>
          </div>
        )}

        {showForgotPassword && forgotPasswordStatus === 'error' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 animate-slide-up">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800 font-medium">{forgotPasswordMessage}</span>
          </div>
        )}

        {/* Forms */}
        {!showForgotPassword ? (
          /* Login Form */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Username Field */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Usuário ou Email
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                {...register('username', { 
                  required: 'Usuário ou email é obrigatório',
                  minLength: { value: 3, message: 'Deve ter pelo menos 3 caracteres' }
                })}
                type="text"
                id="username"
                placeholder="Digite seu usuário ou email"
                className="input-field pl-10"
                disabled={isLoading}
              />
            </div>
            {errors.username && (
              <p className="mt-1 text-sm text-red-600 animate-slide-up">
                {errors.username.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                {...register('password', { 
                  required: 'Senha é obrigatória',
                  minLength: { value: 4, message: 'Senha deve ter pelo menos 4 caracteres' }
                })}
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="Digite sua senha"
                className="input-field pl-10 pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600 animate-slide-up">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                {...register('rememberMe')}
                type="checkbox"
                id="rememberMe"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={rememberMe}
                onChange={handleRememberMeChange}
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                Lembrar de mim
              </label>
            </div>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              disabled={isLoading}
            >
              Esqueci minha senha
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
              loginStatus === 'success' ? 'animate-pulse' : ''
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Entrando...
              </div>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
        ) : (
          /* Forgot Password Form */
          <form onSubmit={handleForgotPasswordSubmit(onForgotPasswordSubmit)} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="forgotEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...registerForgotPassword('email', { 
                    required: 'Email é obrigatório',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Email inválido'
                    }
                  })}
                  type="email"
                  id="forgotEmail"
                  placeholder="Digite seu email"
                  className="input-field pl-10"
                  disabled={isForgotPasswordLoading}
                />
              </div>
              {forgotPasswordErrors.email && (
                <p className="mt-1 text-sm text-red-600 animate-slide-up">
                  {forgotPasswordErrors.email.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isForgotPasswordLoading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isForgotPasswordLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Criando...
                </div>
              ) : (
                'Criar Nova Senha'
              )}
            </button>

            {/* Back to Login Button */}
            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors py-2"
              disabled={isForgotPasswordLoading}
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao login
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            © 2025 MyMetricHUB. Todos os direitos reservados.
          </p>
        </div>
      </div>
      
      {/* Estilos para animações */}
      <style>{`
        .login-container {
          transform: scale(1);
          opacity: 1;
        }
        
        .animate-login-success {
          animation: loginSuccess 0.8s ease-in-out forwards;
        }
        
        @keyframes loginSuccess {
          0% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
          50% {
            transform: scale(1.05) translateY(-10px);
            opacity: 0.8;
          }
          100% {
            transform: scale(0.8) translateY(-50px);
            opacity: 0;
          }
        }
        
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
          }
          
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .success-particles {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: hidden;
          }
          
          .success-particles::before,
          .success-particles::after {
            content: '';
            position: absolute;
            width: 4px;
            height: 4px;
            background: #10b981;
            border-radius: 50%;
            animation: particle 1s ease-out infinite;
          }
          
          .success-particles::before {
            top: 20%;
            left: 20%;
            animation-delay: 0s;
          }
          
          .success-particles::after {
            top: 30%;
            right: 20%;
            animation-delay: 0.3s;
          }
          
          @keyframes particle {
            0% {
              transform: translateY(0) scale(1);
              opacity: 1;
            }
            100% {
              transform: translateY(-20px) scale(0);
              opacity: 0;
            }
          }
          
          .animate-fade-in {
            animation: fadeIn 0.5s ease-out;
          }
          
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}</style>
    </div>
  )
}

export default LoginScreen 