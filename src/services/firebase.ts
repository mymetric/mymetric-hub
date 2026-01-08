import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getFirestore, Firestore } from 'firebase/firestore'

// Configuração do Firestore usando o Project ID do GCP
// Usa o projectId do GCP que está configurado no .env
// Como o Vite só expõe variáveis com prefixo VITE_, vamos usar o valor diretamente
// ou ler de uma variável de ambiente do sistema se disponível
const projectId = 'mymetric-hub-shopify' // Mesmo valor do GCP_PROJECT_ID no .env

// Obter API key do ambiente (deve ser configurada no .env como VITE_FIREBASE_API_KEY)
// Se não estiver configurada, tentar usar um valor padrão (pode não funcionar)
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || 'firestore-only'

const firebaseConfig = {
  projectId: projectId,
  apiKey: apiKey,
}

// Inicializar Firebase apenas se ainda não foi inicializado
let app: FirebaseApp
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig)
} else {
  app = getApps()[0]
}

// Obter instância do Firestore com o database api-admin
const databaseId = 'api-admin' // Mesmo valor do GCP_DATABASE no .env
export const db: Firestore = getFirestore(app, databaseId)

console.log('🔥 Firestore inicializado:', { projectId, databaseId, app: app.name })

export default app

