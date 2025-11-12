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
    // IPs comuns para Roku
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
          brand: 'roku', 
          name: 'TV Roku'
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
  const { userId, tvIp, tvName, tvBrand } = req.body;
  
  console.log(`🔧 Conexão manual: ${tvName} → ${tvIp} (${tvBrand})`);
  
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
          tv_brand: tvBrand || 'roku'
        })
        .eq('user_id', userId);
    } else {
      // Criar nova TV
      result = await supabase
        .from('user_tvs')
        .insert([{
          user_id: userId,
          tv_name: tvName || 'Minha TV',
          tv_brand: tvBrand || 'roku',
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
        brand: tvBrand || 'roku'
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
  const { tvIp, command, tvBrand } = req.body;
  
  console.log(`📡 Tentando comando: ${command} → ${tvIp} (${tvBrand})`);
  
  try {
    let success = false;
    
    // ✅ PROTOCOLO ESPECÍFICO POR MARCA
    if (tvBrand === 'roku') {
      success = await sendRokuCommand(tvIp, command);
    } else if (tvBrand === 'tcl') {
      success = await sendTCLCommand(tvIp, command);
    } else {
      // Tentar todos os protocolos
      success = await sendGenericCommand(tvIp, command);
    }
    
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
    const ports = [8060, 5555, 6466, 8009, 8001];
    
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

// ✅ PROTOCOLO ROKU (8060) - ALTÍSSIMA CHANCE DE FUNCIONAR!
async function sendRokuCommand(ip, command) {
  try {
    console.log(`📺 Tentando protocolo ROKU na porta 8060...`);
    
    // Mapeamento de comandos Roku
    const rokuCommandMap = {
      'POWER': 'Power',
      'VOLUME_UP': 'VolumeUp',
      'VOLUME_DOWN': 'VolumeDown', 
      'MUTE': 'VolumeMute',
      'UP': 'Up',
      'DOWN': 'Down',
      'LEFT': 'Left',
      'RIGHT': 'Right',
      'ENTER': 'Select',
      'HOME': 'Home',
      'BACK': 'Back',
      'MENU': 'Info',
      'SOURCE': 'InputTv'
    };
    
    const rokuCommand = rokuCommandMap[command];
    if (!rokuCommand) {
      console.log(`❌ Comando não mapeado para Roku: ${command}`);
      return false;
    }
    
    // URL do protocolo Roku (documentação oficial)
    const url = `http://${ip}:8060/keypress/${rokuCommand}`;
    
    console.log(`🔗 Enviando para Roku: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000)
    }).catch(() => null);
    
    if (response && response.ok) {
      console.log(`✅ Protocolo ROKU FUNCIONOU! Comando: ${rokuCommand}`);
      return true;
    }
    
    console.log(`❌ Roku não respondeu na porta 8060`);
    return false;
    
  } catch (error) {
    console.log(`❌ Erro Roku: ${error.message}`);
    return false;
  }
}

// ✅ PROTOCOLO TCL
async function sendTCLCommand(ip, command) {
  try {
    console.log(`📱 Tentando protocolo TCL...`);
    
    // Tentar Android TV primeiro
    if (await tryAndroidADBProtocol(ip, command)) return true;
    if (await tryAndroidTVProtocol(ip, command)) return true;
    
    return false;
  } catch (error) {
    return false;
  }
}

// ✅ PROTOCOLO GENÉRICO
async function sendGenericCommand(ip, command) {
  try {
    // Tentar Roku primeiro (muito comum)
    if (await sendRokuCommand(ip, command)) return true;
    
    // Depois tentar Android
    if (await tryAndroidADBProtocol(ip, command)) return true;
    if (await tryAndroidTVProtocol(ip, command)) return true;
    
    // Tentar portas genéricas
    const ports = [8001, 8080, 8009, 8000];
    for (const port of ports) {
      if (await trySendCommand(ip, port, command)) return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

// ✅ PROTOCOLO ANDROID TV ADB (5555)
async function tryAndroidADBProtocol(ip, command) {
  try {
    console.log(`📱 Tentando protocolo Android ADB na porta 5555...`);
    
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
    if (!adbCommand) return false;
    
    const response = await fetch(`http://${ip}:5555/keyevent/${adbCommand}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(2000)
    }).catch(() => null);
    
    if (response && response.ok) {
      console.log(`✅ Protocolo Android ADB FUNCIONOU!`);
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
    if (!androidCommand) return false;
    
    const response = await fetch(`http://${ip}:6466/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: androidCommand }),
      signal: AbortSignal.timeout(2000)
    }).catch(() => null);
    
    if (response && response.ok) {
      console.log(`✅ Protocolo Android TV FUNCIONOU!`);
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
        console.log(`✅ Protocolo porta ${port} FUNCIONOU!`);
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
    protocols: 'Roku(8060), AndroidTV(5555/6466), TCL'
  });
});

// 🚀 INICIAR SERVIDOR
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🎯 Backend rodando: http://localhost:${PORT}`);
  console.log(`📺 Protocolos implementados:`);
  console.log(`   - ROKU (8060) - Alta chance!`);
  console.log(`   - Android TV (5555, 6466)`);
  console.log(`   - Genérico (8001, 8080, 8009)`);
});