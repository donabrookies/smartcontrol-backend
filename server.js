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
    // IPs comuns para teste
    const commonIPs = [
      '192.168.1.128', // SUA TV HQ
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
          brand: 'tcl', 
          name: 'TV TCL'
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

// 🔧 CONECTAR TV MANUALMENTE
app.post('/api/connect-tv', async (req, res) => {
  const { userId, tvIp, tvName } = req.body;
  
  console.log(`🔧 Conexão manual: ${tvName} → ${tvIp}`);
  
  try {
    // Verificar se o IP é acessível
    const isTV = await checkIfIsTV(tvIp);
    
    if (!isTV) {
      return res.json({ 
        success: false, 
        message: `❌ IP ${tvIp} não responde. Verifique se está correto.` 
      });
    }

    // Salvar/atualizar TV no banco
    const { data: existingTV, error: searchError } = await supabase
      .from('user_tvs')
      .select('*')
      .eq('user_id', userId)
      .single();

    let result;
    if (existingTV) {
      // Atualizar TV existente
      result = await supabase
        .from('user_tvs')
        .update({ 
          tv_ip: tvIp,
          tv_name: tvName || 'Minha TV',
          tv_brand: 'tcl'
        })
        .eq('user_id', userId);
    } else {
      // Criar nova TV
      result = await supabase
        .from('user_tvs')
        .insert([{
          user_id: userId,
          tv_name: tvName || 'Minha TV',
          tv_brand: 'tcl',
          tv_ip: tvIp
        }]);
    }

    if (result.error) throw result.error;

    res.json({ 
      success: true, 
      message: `✅ TV conectada manualmente! IP: ${tvIp}`,
      tv: {
        ip: tvIp,
        name: tvName || 'Minha TV',
        brand: 'tcl'
      }
    });
    
  } catch (error) {
    console.error('Erro na conexão manual:', error);
    res.json({ 
      success: false, 
      error: 'Erro ao conectar TV manualmente' 
    });
  }
});

// 📡 ENVIAR COMANDO PARA TV
app.post('/api/send-command', async (req, res) => {
  const { tvIp, command } = req.body;
  
  console.log(`📡 Tentando comando REAL: ${command} → ${tvIp} (TCL Android TV)`);
  
  try {
    // ✅ PROTOCOLOS PRIORIZADOS PARA TCL ANDROID TV
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
    // Testar portas comuns de TVs Android
    const ports = [5555, 6466, 8009, 8001, 8080, 8008];
    
    for (const port of ports) {
      const isReachable = await checkPort(ip, port);
      if (isReachable) {
        console.log(`✅ TV Android detectada na porta ${port}`);
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
  // ✅ PROTOCOLOS PRIORIZADOS PARA TCL ANDROID TV
  try {
    // Protocolo 1: Android TV ADB (5555) - MELHOR CHANCE!
    if (await tryAndroidADBProtocol(ip, command)) {
      return true;
    }
    
    // Protocolo 2: Android TV HTTP (6466)
    if (await tryAndroidTVProtocol(ip, command)) {
      return true;
    }
    
    // Protocolo 3: Google Cast (8009)
    if (await trySendCommand(ip, 8009, command)) {
      return true;
    }
    
    // Protocolo 4: Porta genérica Smart TV (8001)
    if (await trySendCommand(ip, 8001, command)) {
      return true;
    }
    
    // Protocolo 5: Porta 8080
    if (await trySendCommand(ip, 8080, command)) {
      return true;
    }
    
    console.log(`❌ Nenhum protocolo funcionou para TCL Android TV`);
    return false;
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return false;
  }
}

// ✅ PROTOCOLO ANDROID TV ADB (5555) - MELHOR CHANCE!
async function tryAndroidADBProtocol(ip, command) {
  try {
    console.log(`📱 Tentando protocolo Android ADB na porta 5555...`);
    
    // Comandos ADB para Android TV
    const adbCommandMap = {
      'POWER': 'KEYCODE_POWER',
      'VOLUME_UP': 'KEYCODE_VOLUME_UP',
      'VOLUME_DOWN': 'KEYCODE_VOLUME_DOWN', 
      'MUTE': 'KEYCODE_VOLUME_MUTE',
      'UP': 'KEYCODE_DPAD_UP',
      'DOWN': 'KEYCODE_DPAD_DOWN',
      'LEFT': 'KEYCODE_DPAD_LEFT',
      'RIGHT': 'KEYCODE_DPAD_RIGHT',
      'ENTER': 'KEYCODE_DPAD_CENTER',
      'HOME': 'KEYCODE_HOME',
      'BACK': 'KEYCODE_BACK',
      'MENU': 'KEYCODE_MENU',
      'SOURCE': 'KEYCODE_TV_INPUT'
    };
    
    const adbCommand = adbCommandMap[command];
    if (!adbCommand) {
      console.log(`❌ Comando não mapeado para ADB: ${command}`);
      return false;
    }
    
    // Tentar enviar comando ADB via HTTP (algumas TVs Android aceitam)
    const response = await fetch(`http://${ip}:5555/keyevent/${adbCommand}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(2000)
    }).catch(() => null);
    
    if (response && response.ok) {
      console.log(`✅ Protocolo Android ADB FUNCIONOU! Comando: ${adbCommand}`);
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

// ✅ PROTOCOLO ANDROID TV HTTP (6466)
async function tryAndroidTVProtocol(ip, command) {
  try {
    console.log(`📱 Tentando protocolo Android TV na porta 6466...`);
    
    // Mapeamento de comandos Android TV
    const androidCommandMap = {
      'POWER': 'POWER',
      'VOLUME_UP': 'VOLUME_UP',
      'VOLUME_DOWN': 'VOLUME_DOWN', 
      'MUTE': 'MUTE',
      'UP': 'DPAD_UP',
      'DOWN': 'DPAD_DOWN',
      'LEFT': 'DPAD_LEFT',
      'RIGHT': 'DPAD_RIGHT',
      'ENTER': 'DPAD_CENTER',
      'HOME': 'HOME',
      'BACK': 'BACK',
      'MENU': 'MENU',
      'SOURCE': 'INPUT'
    };
    
    const androidCommand = androidCommandMap[command];
    if (!androidCommand) {
      console.log(`❌ Comando não mapeado para Android TV: ${command}`);
      return false;
    }
    
    // Tentar enviar comando Android TV
    const response = await fetch(`http://${ip}:6466/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: androidCommand }),
      signal: AbortSignal.timeout(2000)
    }).catch(() => null);
    
    if (response && response.ok) {
      console.log(`✅ Protocolo Android TV FUNCIONOU! Comando: ${androidCommand}`);
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

// ✅ PROTOCOLO GENÉRICO
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
    
    // Tentar diferentes endpoints
    const endpoints = [
      `/api/command`,
      `/remoteControl`,
      `/keypress/${tvCommand}`,
      `/command`
    ];
    
    for (const endpoint of endpoints) {
      const response = await fetch(`http://${ip}:${port}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: tvCommand, key: tvCommand }),
        signal: AbortSignal.timeout(2000)
      }).catch(() => null);
      
      if (response && response.ok) {
        console.log(`✅ Protocolo porta ${port} FUNCIONOU! Endpoint: ${endpoint}`);
        return true;
      }
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
    protocols: 'TCL Android TV: ADB(5555), AndroidTV(6466), GoogleCast(8009)'
  });
});

// 🚀 INICIAR SERVIDOR
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🎯 Backend rodando: http://localhost:${PORT}`);
  console.log(`🔧 CORS configurado para todas as origens`);
  console.log(`📺 Protocolos TCL Android TV implementados:`);
  console.log(`   - Android ADB (5555) - Melhor chance!`);
  console.log(`   - Android TV (6466)`);
  console.log(`   - Google Cast (8009)`);
  console.log(`   - Smart TV (8001, 8080)`);
});