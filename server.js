const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// 🔧 CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://qfslkalwcejdrrqodgad.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmc2xrYWx3Y2VqZHJycW9kZ2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NTI5MDksImV4cCI6MjA3ODUyODkwOX0.G4yXLAe251S9X636qNzXPz2-viOlTEqrNr2AyBNOfbQ';

// ✅ CORS CONFIGURADO PARA TODAS AS ORIGENS
app.use(cors({
  origin: '*',
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
    // ✅ IP DA SUA TV HQ PRIMEIRO!
    const commonIPs = [
      '192.168.1.128', // ✅ SEU IP DA TV HQ
      '192.168.1.100', '192.168.1.101', '192.168.1.102', 
      '192.168.1.103', '192.168.1.104', '192.168.1.105',
      '192.168.0.100', '192.168.0.101', '192.168.0.102',
      '192.168.0.103', '192.168.0.104', '192.168.0.105'
    ];
    
    let foundTV = null;
    
    for (const ip of commonIPs) {
      console.log(`🔎 Testando IP: ${ip}`);
      const isTV = await checkIfIsTV(ip);
      
      if (isTV) {
        foundTV = { 
          ip: ip, 
          brand: ip === '192.168.1.128' ? 'hq' : 'samsung', 
          name: ip === '192.168.1.128' ? 'Minha TV HQ' : 'TV Descoberta'
        };
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
  
  console.log(`📡 Tentando comando REAL: ${command} → ${tvIp}`);
  
  try {
    // ✅ AGORA TENTA PROTOCOLOS REAIS!
    const success = await sendCommandToTV(tvIp, command);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `✅ Comando "${command}" enviado para TV!` 
      });
    } else {
      res.json({ 
        success: false, 
        message: '❌ TV não respondeu aos comandos' 
      });
    }
    
  } catch (error) {
    console.error('Erro no comando:', error);
    res.json({ success: false, error: 'Erro no comando' });
  }
});

// 🛠️ FUNÇÕES AUXILIARES
async function checkIfIsTV(ip) {
  try {
    // Testar portas comuns de TVs
    const ports = [8001, 8080, 8008, 8000, 8002, 8081];
    
    for (const port of ports) {
      const isReachable = await checkPort(ip, port);
      if (isReachable) {
        console.log(`✅ TV detectada na porta ${port}`);
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

async function checkPort(ip, port) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    
    const response = await fetch(`http://${ip}:${port}`, { 
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
  console.log(`📡 Tentando comando REAL: ${command} → ${ip}`);
  
  // ✅ TENTAR DIFERENTES PROTOCOLOS PARA TV HQ
  try {
    // Protocolo 1: Tentar porta comum de Smart TVs (8001)
    if (await trySendCommand(ip, 8001, command)) {
      return true;
    }
    
    // Protocolo 2: Tentar porta 8080
    if (await trySendCommand(ip, 8080, command)) {
      return true;
    }
    
    // Protocolo 3: Tentar porta 8008
    if (await trySendCommand(ip, 8008, command)) {
      return true;
    }
    
    // Protocolo 4: Tentar porta 8000
    if (await trySendCommand(ip, 8000, command)) {
      return true;
    }
    
    // Protocolo 5: Tentar porta 8002
    if (await trySendCommand(ip, 8002, command)) {
      return true;
    }
    
    // Protocolo 6: Tentar porta 8081
    if (await trySendCommand(ip, 8081, command)) {
      return true;
    }
    
    console.log(`❌ Nenhum protocolo funcionou para TV HQ`);
    return false;
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return false;
  }
}

// ✅ NOVA FUNÇÃO PARA TESTAR DIFERENTES PROTOCOLOS
async function trySendCommand(ip, port, command) {
  try {
    console.log(`🔧 Testando protocolo porta ${port}...`);
    
    // Mapeamento de comandos genéricos
    const commandMap = {
      'POWER': 'KEY_POWER',
      'VOLUME_UP': 'KEY_VOLUP', 
      'VOLUME_DOWN': 'KEY_VOLDOWN',
      'MUTE': 'KEY_MUTE',
      'UP': 'KEY_UP',
      'DOWN': 'KEY_DOWN',
      'LEFT': 'KEY_LEFT',
      'RIGHT': 'KEY_RIGHT',
      'ENTER': 'KEY_ENTER',
      'HOME': 'KEY_HOME',
      'BACK': 'KEY_BACK',
      'MENU': 'KEY_MENU',
      'SOURCE': 'KEY_SOURCE'
    };
    
    const tvCommand = commandMap[command] || command;
    
    // Tentar enviar comando HTTP (protocolo comum)
    const response = await fetch(`http://${ip}:${port}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: tvCommand }),
      signal: AbortSignal.timeout(2000)
    }).catch(() => null);
    
    if (response && response.ok) {
      console.log(`✅ Protocolo porta ${port} FUNCIONOU!`);
      return true;
    }
    
    // Tentar método alternativo (para algumas TVs)
    const response2 = await fetch(`http://${ip}:${port}/remoteControl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: tvCommand }),
      signal: AbortSignal.timeout(2000)
    }).catch(() => null);
    
    if (response2 && response2.ok) {
      console.log(`✅ Protocolo alternativo porta ${port} FUNCIONOU!`);
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

// 🏥 ROTA DE SAÚDE
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: '🚀 SmartControl+ Backend Online!',
    timestamp: new Date().toISOString(),
    tvHqIp: '192.168.1.128'
  });
});

// 🚀 INICIAR SERVIDOR
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🎯 Backend rodando: http://localhost:${PORT}`);
  console.log(`🔧 CORS configurado para todas as origens`);
  console.log(`📺 IP da TV HQ: 192.168.1.128`);
  console.log(`🔍 Testando protocolos: 8001, 8080, 8008, 8000, 8002, 8081`);
});