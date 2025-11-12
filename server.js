const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// 🔧 CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://qfslkalwcejdrrqodgad.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmc2xrYWx3Y2VqZHJycW9kZ2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NTI5MDksImV4cCI6MjA3ODUyODkwOX0.G4yXLAe251S9X636qNzXPz2-viOlTEqrNr2AyBNOfbQ';

// ✅ CORS CONFIGURADO PARA TODAS AS ORIGENS
app.use(cors({
  origin: '*', // Permite todas as origens
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

console.log('🚀 Iniciando SmartControl+ Backend...');
console.log('🔧 CORS configurado para todas as origens');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 📡 ROTA DE LOGIN
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  console.log('🔐 Tentando login:', email);
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .limit(1);

    if (error) {
      console.error('Erro Supabase:', error);
      return res.json({ success: false, error: 'Erro no banco de dados' });
    }

    if (users.length === 0) {
      return res.json({ success: false, error: 'Email ou senha inválidos' });
    }

    const user = users[0];
    
    res.json({
      success: true,
      user: { id: user.id, email: user.email },
      message: 'Login realizado!'
    });
    
  } catch (error) {
    console.error('Erro no login:', error);
    res.json({ success: false, error: 'Erro no servidor' });
  }
});

// 📺 BUSCAR TVs DO USUÁRIO
app.get('/api/user-tvs', async (req, res) => {
  const userId = req.query.user_id;
  
  try {
    const { data: tvs, error } = await supabase
      .from('user_tvs')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true, tvs: tvs || [] });
  } catch (error) {
    console.error('Erro ao buscar TVs:', error);
    res.json({ success: false, error: 'Erro ao carregar TVs' });
  }
});

// 🔍 DESCOBRIR TV NA REDE
app.post('/api/discover-tv', async (req, res) => {
  const { userId } = req.body;
  
  console.log('🔍 Procurando TV na rede para usuário:', userId);
  
  try {
   const commonIPs = [
  '192.168.1.100', '192.168.1.101', '192.168.1.102', '192.168.1.103',
  '192.168.0.100', '192.168.0.101', '192.168.0.102', '192.168.0.103',
  '192.168.1.10', '192.168.1.11', '192.168.1.12', '192.168.1.2',
  '192.168.1.3', '192.168.1.4', '192.168.1.5', '192.168.1.6',
  '192.168.1.50', '192.168.1.51', '192.168.1.52', '192.168.1.53'
];
    
    let foundTV = null;
    
    for (const ip of commonIPs) {
      console.log(`Testando IP: ${ip}`);
      const isTV = await checkIfIsTV(ip);
      
      if (isTV) {
        foundTV = { ip: ip, brand: 'samsung', name: 'Minha TV' };
        console.log(`🎉 TV encontrada: ${ip}`);
        break;
      }
    }
    
    if (foundTV) {
      await supabase
        .from('user_tvs')
        .update({ tv_ip: foundTV.ip })
        .eq('user_id', userId);
        
      res.json({ 
        success: true, 
        tv: foundTV,
        message: `🎉 TV encontrada! IP: ${foundTV.ip}`
      });
    } else {
      res.json({ 
        success: false, 
        message: '❌ TV não encontrada na rede.' 
      });
    }
    
  } catch (error) {
    res.json({ success: false, error: 'Erro na busca' });
  }
});

// 📡 ENVIAR COMANDO PARA TV
app.post('/api/send-command', async (req, res) => {
  const { tvIp, command } = req.body;
  
  console.log(`📺 Comando: ${command} → ${tvIp}`);
  
  try {
    const success = await sendCommandToTV(tvIp, command);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `✅ Comando "${command}" enviado!` 
      });
    } else {
      res.json({ 
        success: false, 
        message: '❌ Falha ao enviar comando' 
      });
    }
    
  } catch (error) {
    res.json({ success: false, error: 'Erro no comando' });
  }
});

// 🛠️ FUNÇÕES AUXILIARES
async function checkIfIsTV(ip) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    
    const response = await fetch(`http://${ip}:8001`, { 
      method: 'GET',
      signal: controller.signal
    }).catch(() => null);
    
    clearTimeout(timeoutId);
    return response !== null;
  } catch {
    return false;
  }
}

async function sendCommandToTV(ip, command) {
  console.log(`✅ Comando simulado: ${command} → ${ip}`);
  return true;
}

// 🏥 ROTA DE SAÚDE
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '🚀 SmartControl+ Backend Online!',
    timestamp: new Date().toISOString()
  });
});

// 🚀 INICIAR SERVIDOR
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🎯 Backend rodando: http://localhost:${PORT}`);
  console.log(`🔧 CORS configurado para todas as origens`);
});