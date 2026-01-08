import express from 'express';
import cors from 'cors';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Middleware de logging
app.use((req, res, next) => {
  console.log('🔍 [VERCEL] Request recebido:', {
    method: req.method,
    path: req.path,
    url: req.url,
    query: req.query
  });
  next();
});

// Inicializar Firebase Admin SDK
let db = null;
let firebaseError = null;
const databaseId = process.env.GCP_DATABASE || 'api-admin';

// Função para inicializar Firebase (chamada de forma lazy)
function initializeFirebase() {
  if (db) {
    return; // Já inicializado
  }
  
  if (firebaseError) {
    throw firebaseError; // Já tentou e falhou
  }

  try {
    const projectId = process.env.GCP_PROJECT_ID;
    
    if (!projectId) {
      throw new Error('GCP_PROJECT_ID não encontrado nas variáveis de ambiente');
    }

    // Criar credenciais do service account
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

    // Inicializar Firebase Admin apenas se ainda não foi inicializado
    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: projectId
      });
    }

    // Obter instância do Firestore
    if (databaseId && databaseId !== '(default)') {
      db = getFirestore(undefined, databaseId);
      console.log('✅ Firestore Admin configurado para database:', databaseId);
    } else {
      db = getFirestore();
      console.log('✅ Firestore Admin configurado para database default');
    }
    console.log('✅ Firebase Admin inicializado com sucesso:', { projectId, databaseId });
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase Admin:', error);
    console.error('Stack:', error.stack);
    firebaseError = error;
    throw error;
  }
}

// Tentar inicializar Firebase (mas não quebrar se falhar)
try {
  initializeFirebase();
} catch (error) {
  // Logar mas não quebrar a função
  console.error('⚠️ Firebase não inicializado no startup, será inicializado sob demanda');
}

const COLLECTION_NAME = 'dashboard_personalizations';
const UNIVERSAL_DOC_ID = '_universal';

function getDocId(tableName, userId, email) {
  if (userId) {
    return `${tableName}_${userId}`;
  }
  if (email) {
    return `${tableName}_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
  return tableName;
}

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
    
    const existingTabIds = new Set(existingUniversalTabs.map(t => t.id));
    const tabsToAdd = universalTabs.filter(t => !existingTabIds.has(t.id));
    const tabsToUpdate = universalTabs.filter(t => existingTabIds.has(t.id));
    
    const updatedTabs = existingUniversalTabs.map(existingTab => {
      const updatedTab = tabsToUpdate.find(t => t.id === existingTab.id);
      return updatedTab || existingTab;
    });
    
    const allUniversalTabs = [...updatedTabs, ...tabsToAdd];
    const universalTabIds = new Set(allUniversalTabs.map(t => t.id));
    const widgetsToKeep = existingUniversalWidgets.filter(w => {
      if (!w.customTabId) return true;
      return !universalTabIds.has(w.customTabId);
    });
    
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
    } else {
      await universalDocRef.set({
        tableName: '_universal',
        userId: null,
        email: null,
        config: universalConfig,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
  } catch (error) {
    console.error('❌ Erro ao salvar abas universais:', error);
  }
}

function hasAllAccess(accessControl, userTableName) {
  return accessControl === 'all' || userTableName === 'all';
}

app.post('/save', async (req, res) => {
  try {
    // Tentar inicializar Firebase se ainda não foi inicializado
    if (!db) {
      try {
        initializeFirebase();
      } catch (error) {
        console.error('❌ Erro ao inicializar Firestore:', error);
        return res.status(500).json({ 
          error: 'Firestore não inicializado', 
          message: error.message,
          hint: 'Verifique as variáveis de ambiente no Vercel'
        });
      }
    }
    
    const { tableName, config, userId, email, accessControl, userTableName } = req.body;

    if (!tableName || !config) {
      return res.status(400).json({ error: 'tableName e config são obrigatórios' });
    }
    
    console.log('📤 [SAVE] Salvando configuração:', { tableName, userId, email });

    const allTabs = config.customTabs || [];
    const universalTabs = allTabs.filter(tab => tab.isUniversal === true);
    
    if (universalTabs.length > 0 && !hasAllAccess(accessControl, userTableName)) {
      return res.status(403).json({ 
        error: 'Apenas usuários com nível de acesso "all" podem criar ou editar abas universais' 
      });
    }

    const docId = getDocId(tableName, userId, email);
    const docRef = db.collection(COLLECTION_NAME).doc(docId);
    const docSnap = await docRef.get();
    const now = new Date();

    if (docSnap.exists) {
      const existingData = docSnap.data();
      const existingConfig = existingData.config || { widgets: [], version: '2.0' };
      const existingClientTabs = (existingConfig.customTabs || []).filter(tab => !tab.isUniversal);

      const clientTabs = allTabs.filter(tab => !tab.isUniversal);
      const allWidgets = config.widgets !== undefined ? config.widgets : existingConfig.widgets;
      const universalTabIds = new Set(universalTabs.map(t => t.id));
      const universalWidgets = Array.isArray(allWidgets) 
        ? allWidgets.filter(w => w.customTabId && universalTabIds.has(w.customTabId))
        : [];
      const clientWidgets = Array.isArray(allWidgets)
        ? allWidgets.filter(w => !w.customTabId || !universalTabIds.has(w.customTabId))
        : [];
      
      const updatedConfig = {
        ...existingConfig,
        ...config,
        widgets: clientWidgets,
        version: '2.0',
        customTabs: clientTabs
      };

      await docRef.update({
        config: updatedConfig,
        updatedAt: now
      });

      if (universalTabs.length > 0 || universalWidgets.length > 0) {
        await saveUniversalTabs(universalTabs, universalWidgets, now);
      }

      return res.json({ success: true, message: 'Configuração atualizada com sucesso', docId });
    } else {
      const clientTabs = allTabs.filter(tab => !tab.isUniversal);
      const allWidgets = config.widgets || [];
      const universalTabIds = new Set(universalTabs.map(t => t.id));
      const universalWidgets = Array.isArray(allWidgets)
        ? allWidgets.filter(w => w.customTabId && universalTabIds.has(w.customTabId))
        : [];
      const clientWidgets = Array.isArray(allWidgets)
        ? allWidgets.filter(w => !w.customTabId || !universalTabIds.has(w.customTabId))
        : [];
      
      const newConfig = {
        ...config,
        widgets: clientWidgets,
        version: '2.0',
        customTabs: clientTabs
      };

      await docRef.set({
        tableName,
        userId: userId || null,
        email: email || null,
        config: newConfig,
        createdAt: now,
        updatedAt: now
      });

      if (universalTabs.length > 0 || universalWidgets.length > 0) {
        await saveUniversalTabs(universalTabs, universalWidgets, now);
      }

      return res.json({ success: true, message: 'Configuração criada com sucesso', docId });
    }
  } catch (error) {
    console.error('❌ Erro ao salvar configuração:', error);
    return res.status(500).json({ 
      error: 'Erro ao salvar configuração', 
      message: error.message
    });
  }
});

app.get('/load', async (req, res) => {
  try {
    // Tentar inicializar Firebase se ainda não foi inicializado
    if (!db) {
      try {
        initializeFirebase();
      } catch (error) {
        console.error('❌ Erro ao inicializar Firestore:', error);
        return res.status(500).json({ 
          error: 'Firestore não inicializado', 
          message: error.message,
          hint: 'Verifique as variáveis de ambiente no Vercel'
        });
      }
    }
    
    const { tableName, userId, email } = req.query;

    if (!tableName) {
      return res.status(400).json({ error: 'tableName é obrigatório' });
    }
    
    console.log('📥 [LOAD] Carregando configuração:', { tableName, userId, email });

    const docId = getDocId(tableName, userId, email);
    const docRef = db.collection(COLLECTION_NAME).doc(docId);
    const docSnap = await docRef.get();

    let config = null;
    if (docSnap.exists) {
      const data = docSnap.data();
      config = data.config || null;
    }

    let universalTabs = [];
    let universalWidgets = [];
    try {
      const universalDocRef = db.collection(COLLECTION_NAME).doc(UNIVERSAL_DOC_ID);
      const universalDocSnap = await universalDocRef.get();
      
      if (universalDocSnap.exists) {
        const data = universalDocSnap.data();
        universalTabs = data.config?.customTabs || [];
        universalWidgets = data.config?.widgets || [];
      }

      if (config) {
        const clientTabs = config.customTabs || [];
        const clientTabIds = new Set(clientTabs.map(t => t.id));
        const clientWidgets = config.widgets || [];
        
        const tabsToAdd = universalTabs.filter(tab => !clientTabIds.has(tab.id));
        config.customTabs = [...clientTabs, ...tabsToAdd];
        config.widgets = [...clientWidgets, ...universalWidgets];
      } else {
        config = {
          widgets: universalWidgets,
          customTabs: universalTabs,
          version: '2.0'
        };
      }
    } catch (universalError) {
      console.error('⚠️ Erro ao buscar abas universais:', universalError);
    }

    return res.json({ success: true, config });
  } catch (error) {
    console.error('❌ Erro ao carregar configuração:', error);
    return res.status(500).json({ 
      error: 'Erro ao carregar configuração', 
      message: error.message 
    });
  }
});

app.post('/delete-universal-tab', async (req, res) => {
  try {
    const { tabId, accessControl, userTableName } = req.body;

    if (!tabId) {
      return res.status(400).json({ error: 'tabId é obrigatório' });
    }

    if (!hasAllAccess(accessControl, userTableName)) {
      return res.status(403).json({ 
        error: 'Apenas usuários com nível de acesso "all" podem excluir abas universais' 
      });
    }

    const universalDocRef = db.collection(COLLECTION_NAME).doc(UNIVERSAL_DOC_ID);
    const universalDocSnap = await universalDocRef.get();

    if (!universalDocSnap.exists) {
      return res.json({ success: true, message: 'Documento _universal não existe' });
    }

    const data = universalDocSnap.data();
    const existingTabs = data.config?.customTabs || [];
    const updatedTabs = existingTabs.filter(tab => tab.id !== tabId);

    if (updatedTabs.length === existingTabs.length) {
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

    return res.json({ success: true, message: 'Aba universal deletada com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar aba universal:', error);
    return res.status(500).json({
      error: 'Erro ao deletar aba universal',
      message: error.message
    });
  }
});

app.get('/data-sources', async (req, res) => {
  try {
    const { tableName } = req.query;

    const tablesSnapshot = await db.collection('tables').get();
    const dataSources = [];
    
    tablesSnapshot.forEach((doc) => {
      if (doc.id === '_init') {
        return;
      }
      
      const data = doc.data();
      const endpoint = data.endpoint;
      
      if (!endpoint || typeof endpoint !== 'string') {
        return;
      }
      
      const label = endpoint;
      const clientSlug = data.clientSlug;
      const isRestricted = clientSlug && clientSlug.trim() !== '';
      
      if (!tableName || tableName.trim() === '') {
        if (!isRestricted) {
          dataSources.push({
            endpoint: endpoint,
            label: label,
            restricted: false
          });
        }
        return;
      }
      
      if (!isRestricted) {
        dataSources.push({
          endpoint: endpoint,
          label: label,
          restricted: false
        });
      } else if (isRestricted && clientSlug === tableName) {
        dataSources.push({
          endpoint: endpoint,
          label: label,
          restricted: true
        });
      }
    });

    dataSources.sort((a, b) => {
      if (a.restricted === b.restricted) {
        return a.label.localeCompare(b.label);
      }
      return a.restricted ? 1 : -1;
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
app.get('/health', (req, res) => {
  try {
    const envVars = {
      hasProjectId: !!process.env.GCP_PROJECT_ID,
      hasPrivateKey: !!process.env.GCP_PRIVATE_KEY,
      hasClientEmail: !!process.env.GCP_CLIENT_EMAIL,
      databaseId: process.env.GCP_DATABASE || 'api-admin'
    };
    
    res.json({ 
      status: 'ok', 
      service: 'firestore-api',
      firestoreInitialized: !!db,
      envVars,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro no health check:', error);
    res.status(500).json({ 
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Middleware de tratamento de erros global
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Handler para Vercel
// O Vercel com [...].js já remove o prefixo /api/dashboard automaticamente
// Então /api/dashboard/health vira /health
export default app;

