import express from 'express';
import cors from 'cors';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Carregar variáveis de ambiente
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Inicializar Firebase Admin SDK
let db = null;
let firebaseError = null;
const databaseId = process.env.GCP_DATABASE || 'api-admin';

function initializeFirebase() {
  if (db) return;
  if (firebaseError) throw firebaseError;

  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) {
    firebaseError = new Error('GCP_PROJECT_ID não encontrado no .env');
    throw firebaseError;
  }

  const serviceAccount = {
    type: 'service_account',
    project_id: projectId,
    private_key_id: process.env.GCP_PRIVATE_KEY_ID,
    private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GCP_CLIENT_EMAIL,
    client_id: process.env.GCP_CLIENT_ID,
    auth_uri: process.env.GCP_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
    token_uri: process.env.GCP_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: process.env.GCP_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.GCP_CLIENT_X509_CERT_URL,
    universe_domain: process.env.GCP_UNIVERSE_DOMAIN || 'googleapis.com'
  };

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId
    });
    console.log('✅ Firebase Admin inicializado');
  }

  if (databaseId && databaseId !== '(default)') {
    db = getFirestore(undefined, databaseId);
    console.log('✅ Firestore Admin configurado para database:', databaseId);
  } else {
    db = getFirestore();
    console.log('✅ Firestore Admin configurado para database default');
  }

  console.log('✅ Firestore Admin inicializado:', { projectId, databaseId });
}

// Não derrubar o servidor se faltar env; deixa os endpoints retornarem erro amigável.
try {
  initializeFirebase();
} catch (error) {
  console.error('⚠️ Firebase Admin não inicializado no startup; será inicializado sob demanda.');
  console.error('Detalhes:', error?.message || error);
}

const COLLECTION_NAME = 'dashboard_personalizations';
const UNIVERSAL_DOC_ID = '_universal'; // Documento especial para abas universais

// Helper para obter ID do documento
function getDocId(tableName, userId, email) {
  if (userId) {
    return `${tableName}_${userId}`;
  }
  if (email) {
    return `${tableName}_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
  return tableName;
}

// Helper para salvar abas universais e seus widgets no documento _universal
async function saveUniversalTabs(universalTabs, universalWidgets, timestamp) {
  try {
    const universalDocRef = db.collection(COLLECTION_NAME).doc(UNIVERSAL_DOC_ID);
    const universalDocSnap = await universalDocRef.get();
    
    let existingUniversalTabs = [];
    let existingUniversalWidgets = [];
    if (universalDocSnap.exists) {
      const data = universalDocSnap.data();
      existingUniversalTabs = data.config?.customTabs || [];
      existingUniversalWidgets = data.config?.widgets || [];
    }
    
    // Mesclar abas universais (manter as existentes e adicionar/atualizar as novas)
    const existingTabIds = new Set(existingUniversalTabs.map(t => t.id));
    const tabsToAdd = universalTabs.filter(t => !existingTabIds.has(t.id));
    const tabsToUpdate = universalTabs.filter(t => existingTabIds.has(t.id));
    
    // Atualizar abas existentes
    const updatedTabs = existingUniversalTabs.map(existingTab => {
      const updatedTab = tabsToUpdate.find(t => t.id === existingTab.id);
      return updatedTab || existingTab;
    });
    
    // Adicionar novas abas
    const allUniversalTabs = [...updatedTabs, ...tabsToAdd];
    
    // Mesclar widgets de abas universais
    // Remover widgets antigos das abas que estão sendo atualizadas
    const universalTabIds = new Set(allUniversalTabs.map(t => t.id));
    const widgetsToKeep = existingUniversalWidgets.filter(w => {
      // Manter widgets que não pertencem a abas universais sendo atualizadas
      if (!w.customTabId) return true;
      return !universalTabIds.has(w.customTabId);
    });
    
    // Adicionar novos widgets de abas universais
    const allUniversalWidgets = [...widgetsToKeep, ...universalWidgets];
    
    const universalConfig = {
      widgets: allUniversalWidgets,
      customTabs: allUniversalTabs,
      version: '2.0'
    };
    
    if (universalDocSnap.exists) {
      await universalDocRef.update({
        config: universalConfig,
        updatedAt: timestamp
      });
      console.log('✅ Abas universais e widgets atualizados no documento _universal:', {
        tabs: allUniversalTabs.length,
        widgets: allUniversalWidgets.length
      });
    } else {
      await universalDocRef.set({
        tableName: '_universal',
        userId: null,
        email: null,
        config: universalConfig,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      console.log('✅ Documento _universal criado com abas universais e widgets:', {
        tabs: allUniversalTabs.length,
        widgets: allUniversalWidgets.length
      });
    }
  } catch (error) {
    console.error('❌ Erro ao salvar abas universais:', error);
    // Não falhar o salvamento principal se houver erro ao salvar abas universais
  }
}

// Helper para verificar se usuário tem acesso "all"
function hasAllAccess(accessControl, userTableName) {
  return accessControl === 'all' || userTableName === 'all';
}

// Endpoint para salvar configuração do dashboard
app.post('/api/dashboard/save', async (req, res) => {
  try {
    if (!db) {
      try {
        initializeFirebase();
      } catch (error) {
        console.error('❌ Erro ao inicializar Firestore (save):', error);
        return res.status(500).json({
          error: 'Firestore não inicializado',
          message: error.message,
          hint: 'Verifique as variáveis GCP_* no .env (server/.env ou raiz do projeto)'
        });
      }
    }

    const { tableName, config, userId, email, accessControl, userTableName } = req.body;

    if (!tableName) {
      return res.status(400).json({ error: 'tableName é obrigatório' });
    }

    if (!config) {
      return res.status(400).json({ error: 'config é obrigatório' });
    }

    // Verificar se há abas universais sendo salvas
    const allTabs = config.customTabs || [];
    const universalTabs = allTabs.filter(tab => tab.isUniversal === true);
    
    // Se há abas universais, verificar se o usuário tem acesso "all"
    if (universalTabs.length > 0 && !hasAllAccess(accessControl, userTableName)) {
      console.log('🚫 Tentativa de salvar abas universais sem acesso "all":', {
        accessControl,
        userTableName,
        universalTabsCount: universalTabs.length
      });
      return res.status(403).json({ 
        error: 'Apenas usuários com nível de acesso "all" podem criar ou editar abas universais' 
      });
    }

    console.log('📤 Salvando configuração:', { tableName, userId, email, accessControl, userTableName });

    const docId = getDocId(tableName, userId, email);
    const docRef = db.collection(COLLECTION_NAME).doc(docId);

    // Buscar documento existente
    const docSnap = await docRef.get();
    const now = new Date();

    if (docSnap.exists) {
      // Atualizar documento existente
      const existingData = docSnap.data();
      const existingConfig = existingData.config || { widgets: [], version: '2.0' };
      
      // Remover abas universais que possam estar no documento existente
      const existingClientTabs = (existingConfig.customTabs || []).filter(tab => !tab.isUniversal);

      // Separar abas universais das abas do cliente (do config recebido)
      const allTabs = config.customTabs || [];
      const clientTabs = allTabs.filter(tab => !tab.isUniversal);
      const universalTabs = allTabs.filter(tab => tab.isUniversal === true);
      
      // Separar widgets de abas universais dos widgets do cliente
      const allWidgets = config.widgets !== undefined ? config.widgets : existingConfig.widgets;
      const universalTabIds = new Set(universalTabs.map(t => t.id));
      const universalWidgets = Array.isArray(allWidgets) 
        ? allWidgets.filter(w => w.customTabId && universalTabIds.has(w.customTabId))
        : [];
      const clientWidgets = Array.isArray(allWidgets)
        ? allWidgets.filter(w => !w.customTabId || !universalTabIds.has(w.customTabId))
        : [];
      
      console.log('📋 Separando abas e widgets:', {
        totalTabs: allTabs.length,
        clientTabs: clientTabs.length,
        universalTabs: universalTabs.length,
        totalWidgets: allWidgets.length,
        universalWidgets: universalWidgets.length,
        clientWidgets: clientWidgets.length,
        existingClientTabs: existingClientTabs.length
      });
      
      // Mesclar configurações (sem abas universais e seus widgets no documento do cliente)
      // IMPORTANTE: customTabs deve ser definido DEPOIS do spread para não ser sobrescrito
      const updatedConfig = {
        ...existingConfig,
        ...config,
        widgets: clientWidgets, // Apenas widgets do cliente, sem widgets de abas universais
        version: '2.0',
        customTabs: clientTabs // Apenas abas do cliente, sem universais (definido por último)
      };

      await docRef.update({
        config: updatedConfig,
        updatedAt: now
      });

      // Salvar abas universais e seus widgets no documento _universal (separado)
      if (universalTabs.length > 0 || universalWidgets.length > 0) {
        await saveUniversalTabs(universalTabs, universalWidgets, now);
        console.log('🌍 Abas universais e widgets salvos no documento _universal:', {
          tabs: universalTabs.length,
          widgets: universalWidgets.length
        });
      }

      console.log('✅ Configuração atualizada no Firestore:', { 
        tableName, 
        docId,
        database: databaseId,
        collection: COLLECTION_NAME
      });
      return res.json({ success: true, message: 'Configuração atualizada com sucesso', docId });
    } else {
      // Separar abas universais das abas do cliente
      const allTabs = config.customTabs || [];
      const clientTabs = allTabs.filter(tab => !tab.isUniversal);
      const universalTabs = allTabs.filter(tab => tab.isUniversal === true);
      
      // Separar widgets de abas universais dos widgets do cliente
      const allWidgets = config.widgets || [];
      const universalTabIds = new Set(universalTabs.map(t => t.id));
      const universalWidgets = Array.isArray(allWidgets)
        ? allWidgets.filter(w => w.customTabId && universalTabIds.has(w.customTabId))
        : [];
      const clientWidgets = Array.isArray(allWidgets)
        ? allWidgets.filter(w => !w.customTabId || !universalTabIds.has(w.customTabId))
        : [];
      
      console.log('📋 Criando novo documento:', {
        totalTabs: allTabs.length,
        clientTabs: clientTabs.length,
        universalTabs: universalTabs.length,
        totalWidgets: allWidgets.length,
        universalWidgets: universalWidgets.length,
        clientWidgets: clientWidgets.length
      });
      
      // Criar novo documento (sem abas universais e seus widgets)
      // IMPORTANTE: customTabs deve ser definido DEPOIS do spread para não ser sobrescrito
      const newConfig = {
        ...config,
        widgets: clientWidgets, // Apenas widgets do cliente, sem widgets de abas universais
        version: '2.0',
        customTabs: clientTabs // Apenas abas do cliente, sem universais (definido por último)
      };

      await docRef.set({
        tableName,
        userId: userId || null,
        email: email || null,
        config: newConfig,
        createdAt: now,
        updatedAt: now
      });

      // Salvar abas universais e seus widgets no documento _universal (separado)
      if (universalTabs.length > 0 || universalWidgets.length > 0) {
        await saveUniversalTabs(universalTabs, universalWidgets, now);
        console.log('🌍 Abas universais e widgets salvos no documento _universal:', {
          tabs: universalTabs.length,
          widgets: universalWidgets.length
        });
      }

      console.log('✅ Configuração criada no Firestore:', { 
        tableName, 
        docId,
        database: databaseId,
        collection: COLLECTION_NAME,
        path: docRef.path,
        widgets: newConfig.widgets?.length || 0,
        customTabs: newConfig.customTabs?.length || 0
      });
      return res.json({ success: true, message: 'Configuração criada com sucesso', docId });
    }
  } catch (error) {
    console.error('❌ Erro ao salvar configuração:', error);
    return res.status(500).json({ 
      error: 'Erro ao salvar configuração', 
      message: error.message,
      code: error.code 
    });
  }
});

// Endpoint para carregar configuração do dashboard
app.get('/api/dashboard/load', async (req, res) => {
  try {
    if (!db) {
      try {
        initializeFirebase();
      } catch (error) {
        console.error('❌ Erro ao inicializar Firestore (load):', error);
        return res.status(500).json({
          error: 'Firestore não inicializado',
          message: error.message,
          hint: 'Verifique as variáveis GCP_* no .env (server/.env ou raiz do projeto)'
        });
      }
    }

    const { tableName, userId, email } = req.query;

    if (!tableName) {
      return res.status(400).json({ error: 'tableName é obrigatório' });
    }

    console.log('📥 Carregando configuração:', { tableName, userId, email });

    const docId = getDocId(tableName, userId, email);
    const docRef = db.collection(COLLECTION_NAME).doc(docId);
    const docSnap = await docRef.get();

    let config = null;
    if (docSnap.exists) {
      const data = docSnap.data();
      config = data.config || null;
      console.log('✅ Configuração encontrada:', { 
        tableName, 
        docId,
        hasConfig: !!config,
        widgetsCount: config?.widgets?.length || 0,
        customTabsCount: config?.customTabs?.length || 0,
        widgets: config?.widgets
      });
    } else {
      console.log('⚠️ Configuração não encontrada:', { tableName, docId });
    }

    // Buscar abas universais e seus widgets do documento _universal
    let universalTabs = [];
    let universalWidgets = [];
    try {
      console.log('🌍 Buscando abas universais e widgets do documento _universal...');
      const universalDocRef = db.collection(COLLECTION_NAME).doc(UNIVERSAL_DOC_ID);
      const universalDocSnap = await universalDocRef.get();
      
      if (universalDocSnap.exists) {
        const data = universalDocSnap.data();
        universalTabs = data.config?.customTabs || [];
        universalWidgets = data.config?.widgets || [];
        console.log('🌍 Abas universais e widgets encontrados no documento _universal:', {
          tabsCount: universalTabs.length,
          widgetsCount: universalWidgets.length,
          tabs: universalTabs.map(t => ({ id: t.id, name: t.name, createdBy: t.createdBy }))
        });
      } else {
        console.log('⚠️ Documento _universal não existe ainda');
      }

      // Mesclar abas do cliente com abas universais
      if (config) {
        const clientTabs = config.customTabs || [];
        const clientTabIds = new Set(clientTabs.map(t => t.id));
        const clientWidgets = config.widgets || [];
        
        console.log('📋 Abas e widgets do cliente:', {
          tabs: clientTabs.length,
          widgets: clientWidgets.length,
          tabIds: Array.from(clientTabIds)
        });
        
        // Adicionar apenas abas universais que não estão nas abas do cliente
        const tabsToAdd = universalTabs.filter(tab => !clientTabIds.has(tab.id));
        config.customTabs = [...clientTabs, ...tabsToAdd];
        
        // Mesclar widgets: widgets do cliente + widgets de abas universais
        config.widgets = [...clientWidgets, ...universalWidgets];
        
        console.log('✅ Abas e widgets mesclados:', {
          clientTabs: clientTabs.length,
          universalTabsAdded: tabsToAdd.length,
          totalTabs: config.customTabs.length,
          clientWidgets: clientWidgets.length,
          universalWidgets: universalWidgets.length,
          totalWidgets: config.widgets.length
        });
      } else {
        // Se não há config do cliente, criar uma apenas com abas universais e seus widgets
        config = {
          widgets: universalWidgets,
          customTabs: universalTabs,
          version: '2.0'
        };
        console.log('✅ Config criada apenas com abas universais e widgets:', {
          tabs: universalTabs.length,
          widgets: universalWidgets.length
        });
      }
    } catch (universalError) {
      console.error('⚠️ Erro ao buscar abas universais:', universalError);
      console.error('Stack:', universalError.stack);
      // Continuar mesmo se falhar ao buscar abas universais
    }

    console.log('📤 Retornando configuração:', {
      hasConfig: !!config,
      widgetsCount: config?.widgets?.length || 0,
      customTabsCount: config?.customTabs?.length || 0
    });

    return res.json({ success: true, config });
  } catch (error) {
    console.error('❌ Erro ao carregar configuração:', error);
    return res.status(500).json({ 
      error: 'Erro ao carregar configuração', 
      message: error.message 
    });
  }
});

// Endpoint para deletar uma aba universal do documento _universal
app.post('/api/dashboard/delete-universal-tab', async (req, res) => {
  try {
    if (!db) {
      try {
        initializeFirebase();
      } catch (error) {
        console.error('❌ Erro ao inicializar Firestore (delete-universal-tab):', error);
        return res.status(500).json({
          error: 'Firestore não inicializado',
          message: error.message,
          hint: 'Verifique as variáveis GCP_* no .env (server/.env ou raiz do projeto)'
        });
      }
    }

    const { tabId, accessControl, userTableName } = req.body;

    if (!tabId) {
      return res.status(400).json({ error: 'tabId é obrigatório' });
    }

    // Verificar se o usuário tem acesso "all" antes de permitir deletar abas universais
    if (!hasAllAccess(accessControl, userTableName)) {
      console.log('🚫 Tentativa de deletar aba universal sem acesso "all":', {
        tabId,
        accessControl,
        userTableName
      });
      return res.status(403).json({ 
        error: 'Apenas usuários com nível de acesso "all" podem excluir abas universais' 
      });
    }

    console.log('🗑️ Deletando aba universal:', { tabId, accessControl, userTableName });

    const universalDocRef = db.collection(COLLECTION_NAME).doc(UNIVERSAL_DOC_ID);
    const universalDocSnap = await universalDocRef.get();

    if (!universalDocSnap.exists) {
      console.log('⚠️ Documento _universal não existe');
      return res.json({ success: true, message: 'Documento _universal não existe' });
    }

    const data = universalDocSnap.data();
    const existingTabs = data.config?.customTabs || [];
    const updatedTabs = existingTabs.filter(tab => tab.id !== tabId);

    if (updatedTabs.length === existingTabs.length) {
      console.log('⚠️ Aba universal não encontrada:', tabId);
      return res.json({ success: true, message: 'Aba não encontrada' });
    }

    const universalConfig = {
      widgets: [],
      customTabs: updatedTabs,
      version: '2.0'
    };

    await universalDocRef.update({
      config: universalConfig,
      updatedAt: new Date()
    });

    console.log('✅ Aba universal deletada do documento _universal:', {
      tabId,
      totalAntes: existingTabs.length,
      totalDepois: updatedTabs.length
    });

    return res.json({ success: true, message: 'Aba universal deletada com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar aba universal:', error);
    return res.status(500).json({
      error: 'Erro ao deletar aba universal',
      message: error.message
    });
  }
});

// Endpoint para buscar fontes de dados disponíveis da collection 'tables'
app.get('/api/dashboard/data-sources', async (req, res) => {
  try {
    if (!db) {
      try {
        initializeFirebase();
      } catch (error) {
        console.error('❌ Erro ao inicializar Firestore (data-sources):', error);
        return res.status(500).json({
          error: 'Firestore não inicializado',
          message: error.message,
          hint: 'Verifique as variáveis GCP_* no .env (server/.env ou raiz do projeto)'
        });
      }
    }

    const { tableName } = req.query; // Nome do cliente para filtrar endpoints restritos

    console.log('📥 Buscando fontes de dados:', { tableName });

    // Buscar todos os documentos da collection 'tables'
    const tablesSnapshot = await db.collection('tables').get();
    
    const dataSources = [];
    
    tablesSnapshot.forEach((doc) => {
      // Ignorar documento com ID '_init'
      if (doc.id === '_init') {
        return;
      }
      
      const data = doc.data();
      
      // O endpoint vem do campo 'endpoint' do documento, não do ID
      const endpoint = data.endpoint;
      
      // Se não tem campo endpoint, pular este documento
      if (!endpoint || typeof endpoint !== 'string') {
        console.log('⚠️ Documento sem campo endpoint:', doc.id);
        return;
      }
      
      // Usar o endpoint como label, sem modificações
      const label = endpoint;
      
      // Obter o clientSlug do documento
      const clientSlug = data.clientSlug;
      
      // Verificar se a tabela é restrita a um cliente específico
      // Se clientSlug estiver vazio/null/undefined, a tabela é acessível a todos os clientes
      // Se clientSlug tiver um valor, a tabela é restrita apenas àquele cliente
      const isRestricted = clientSlug && clientSlug.trim() !== '';
      
      // Se tableName não foi fornecido, retornar apenas tabelas não restritas
      if (!tableName || tableName.trim() === '') {
        if (!isRestricted) {
          // Tabela não restrita - incluir para todos os clientes
          dataSources.push({
            endpoint: endpoint,
            label: label,
            restricted: false
          });
          console.log('✅ Tabela não restrita incluída (sem tableName):', { endpoint, clientSlug: clientSlug || '(vazio)' });
        }
        // Ignorar tabelas restritas quando tableName não é fornecido
        return;
      }
      
      // Incluir se:
      // 1. Não é restrito (clientSlug vazio - acessível a todos), OU
      // 2. É restrito mas pertence ao cliente atual (clientSlug === tableName)
      if (!isRestricted) {
        // Tabela não restrita - incluir para todos os clientes
        dataSources.push({
          endpoint: endpoint,
          label: label,
          restricted: false
        });
        console.log('✅ Tabela não restrita incluída:', { endpoint, clientSlug: clientSlug || '(vazio)' });
      } else if (isRestricted && clientSlug === tableName) {
        // Tabela restrita deste cliente específico - incluir
        dataSources.push({
          endpoint: endpoint,
          label: label,
          restricted: true
        });
        console.log('✅ Tabela restrita incluída para cliente:', { endpoint, clientSlug, tableName });
      } else {
        // Se isRestricted é true mas clientSlug !== tableName, não incluir (tabela restrita de outro cliente)
        console.log('⏭️ Tabela restrita de outro cliente ignorada:', { endpoint, clientSlug, tableName });
      }
    });

    // Ordenar: não restritos primeiro, depois restritos
    dataSources.sort((a, b) => {
      if (a.restricted === b.restricted) {
        return a.label.localeCompare(b.label);
      }
      return a.restricted ? 1 : -1;
    });

    console.log('✅ Fontes de dados encontradas:', { 
      total: dataSources.length,
      forClient: tableName || 'all',
      endpoints: dataSources.map(ds => ds.endpoint)
    });

    return res.json({ success: true, dataSources });
  } catch (error) {
    console.error('❌ Erro ao buscar fontes de dados:', error);
    return res.status(500).json({ 
      error: 'Erro ao buscar fontes de dados', 
      message: error.message 
    });
  }
});

// Endpoint de health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'firestore-api',
    firestoreInitialized: !!db,
    envVars: {
      hasProjectId: !!process.env.GCP_PROJECT_ID,
      hasPrivateKey: !!process.env.GCP_PRIVATE_KEY,
      hasClientEmail: !!process.env.GCP_CLIENT_EMAIL,
      databaseId: process.env.GCP_DATABASE || 'api-admin'
    },
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor Firestore API rodando na porta ${PORT}`);
  console.log(`📡 Endpoints disponíveis:`);
  console.log(`   POST /api/dashboard/save - Salvar configuração`);
  console.log(`   GET  /api/dashboard/load - Carregar configuração`);
  console.log(`   POST /api/dashboard/delete-universal-tab - Deletar aba universal`);
  console.log(`   GET  /api/dashboard/data-sources - Buscar fontes de dados disponíveis`);
  console.log(`   GET  /api/health - Health check`);
});

