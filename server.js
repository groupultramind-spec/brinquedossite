const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const UAParser = require('ua-parser-js');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);


const domain = process.env.ALLOWED_DOMAIN || '';
const allowedOrigins = [domain, domain.includes('www.') ? domain.replace('www.', '') : domain.replace('https://', 'https://www.'), 'http://localhost:3000'];
app.use(cors({
  origin: function(origin, callback){
    if(!origin) return callback(null, true);
    if(process.env.ALLOWED_DOMAIN === 'all') return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){
      console.log('Bloqueado por CORS, origem:', origin);
      return callback(new Error('Bloqueado por CORS: ' + origin), false);
    }
    return callback(null, true);
  }
}));

app.use(express.json());

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 2000 }); // Aumentado devido ao heartbeat
app.use('/api/', apiLimiter);

const DATA_FILE = path.join(__dirname, 'data.json');
let botData = { whatsappNumber: '', whatsappText: '', instagramUrl: '', facebookUrl: '', location: '', leadChannelId: '', masterAdminId: '', admins: [], visits: 0, exits: 0 };

if (fs.existsSync(DATA_FILE)) {
    const rawData = fs.readFileSync(DATA_FILE, 'utf8').replace(/^\uFEFF/, '');
    if (rawData) botData = { ...botData, ...JSON.parse(rawData) };
}
if(process.env.MASTER_ADMIN_ID && (!botData.masterAdminId || botData.masterAdminId !== process.env.MASTER_ADMIN_ID)) {
    botData.masterAdminId = process.env.MASTER_ADMIN_ID;
    saveData();
}

function saveData() { fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 2)); }

function isAdmin(ctx) {
    if(!ctx.from) return false;
    const userId = ctx.from.id.toString();
    return userId === botData.masterAdminId || botData.admins.includes(userId);
}

// === RADAR DE VISITANTES ===
const activeSessions = new Map();
const ipLocationCache = new Map();

function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

setInterval(async () => {
    const now = Date.now();
    for (const [sessionId, session] of activeSessions.entries()) {
        const timeElapsed = now - session.startTime;
        const timeSinceLastHeartbeat = now - session.lastHeartbeat;
        const isOffline = timeSinceLastHeartbeat > 15000;
        
        let text = "";
        let shouldUpdateTelegram = false;

        if (isOffline) {
            const reason = session.exitedTo ? `(Foi para o ${session.exitedTo})` : `(Fechou o site)`;
            text = `🔴 *VISITANTE SAIU* ${reason}\n📱 *Aparelho:* ${session.deviceInfo}\n📍 *Local:* ${session.location}\n⏱ *Ficou por:* ${formatTime(session.lastHeartbeat - session.startTime)}`;
            activeSessions.delete(sessionId);
            shouldUpdateTelegram = true;
        } else {
            // Update time every ~10 seconds
            if (Math.abs((timeElapsed % 10000) - 1000) < 500) { 
                text = `🟢 *VISITANTE ONLINE*\n📱 *Aparelho:* ${session.deviceInfo}\n📍 *Local:* ${session.location}\n⏱ *Tempo:* ${formatTime(timeElapsed)}`;
                shouldUpdateTelegram = true;
            }
        }

        if (shouldUpdateTelegram && session.telegramMsgId && botData.leadChannelId) {
            try {
                await bot.telegram.editMessageText(botData.leadChannelId, session.telegramMsgId, null, text, { parse_mode: 'Markdown' });
            } catch(e) {}
        }
    }
}, 1000);

// === EXPRESS API ===
app.get('/api/whatsapp', (req, res) => {
    botData.visits++;
    saveData();
    res.json({
        number: botData.whatsappNumber,
        text: botData.whatsappText,
        instagramUrl: botData.instagramUrl,
        facebookUrl: botData.facebookUrl,
        location: botData.location
    });
});

app.post('/api/track/ping', async (req, res) => {
    const { sessionId, userAgent } = req.body;
    if(!sessionId) return res.json({success:false});

    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    ip = ip.split(',')[0].trim();
    
    if(!activeSessions.has(sessionId)) {
        let location = "Desconhecido";
        if(ipLocationCache.has(ip)) {
            location = ipLocationCache.get(ip);
        } else if (ip && ip !== '::1' && ip !== '127.0.0.1') {
            try {
                const geoRes = await fetch(`http://ip-api.com/json/${ip}`);
                const geo = await geoRes.json();
                if(geo.status === 'success') {
                    location = `${geo.city}, ${geo.region} (${geo.country})`;
                    ipLocationCache.set(ip, location);
                }
            } catch(e) {}
        } else {
            location = "Localhost (Testes)";
        }
        
        const parser = new UAParser(userAgent);
        const device = parser.getDevice().model || parser.getDevice().vendor || 'PC/Desktop';
        const os = parser.getOS().name || '';
        const browser = parser.getBrowser().name || '';
        const deviceInfo = `${device} ${os} (${browser})`.trim();

        const session = {
            sessionId,
            startTime: Date.now(),
            lastHeartbeat: Date.now(),
            ip,
            location,
            deviceInfo,
            telegramMsgId: null,
            exitedTo: null
        };
        activeSessions.set(sessionId, session);
        
        if(botData.leadChannelId) {
            const text = `🟢 *VISITANTE ONLINE*\n📱 *Aparelho:* ${deviceInfo}\n📍 *Local:* ${location}\n⏱ *Tempo:* 00:00`;
            try {
                const msg = await bot.telegram.sendMessage(botData.leadChannelId, text, { parse_mode: 'Markdown' });
                session.telegramMsgId = msg.message_id;
            } catch(e) {}
        }
    } else {
        activeSessions.get(sessionId).lastHeartbeat = Date.now();
    }
    res.json({ success: true });
});

app.post('/api/track/exit', (req, res) => {
    const { sessionId, target } = req.body || {};
    if(sessionId && activeSessions.has(sessionId)) {
        activeSessions.get(sessionId).exitedTo = target || 'Link Externo';
    }
    botData.exits++;
    saveData();
    res.json({ success: true });
});

app.post('/api/contact', async (req, res) => {
    const { nome, sobrenome, email, telefone, mensagem } = req.body;
    
    // Validações no Backend
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.json({ success: false, error: 'E-mail inválido.' });
    
    const tempDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com', 'mailinator.com', 'temp-mail.org', 'tempmail.net', 'dispostable.com'];
    const domain = email.split('@')[1];
    if (domain && tempDomains.some(td => domain.includes(td))) return res.json({ success: false, error: 'E-mails temporários não são aceitos.' });

    if (!mensagem || mensagem.length < 10 || mensagem.length > 1000) return res.json({ success: false, error: 'A mensagem deve ter entre 10 e 1000 caracteres.' });

    const cleanPhone = telefone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) return res.json({ success: false, error: 'Telefone inválido. Insira o DDD e o número válido.' });

    if(botData.leadChannelId) {
        const textMsg = `🎯 *NOVO LEAD RECEBIDO* 🎯\n\n👤 *Nome:* ${nome} ${sobrenome}\n✉️ *Email:* ${email}\n📱 *Telefone:* ${telefone}\n📝 *Mensagem:* ${mensagem}`;
        const keyboard = Markup.inlineKeyboard([[Markup.button.url('📲 Chamar no WhatsApp', `https://wa.me/55${cleanPhone}`)]]);
        try {
            await bot.telegram.sendMessage(botData.leadChannelId, textMsg, { parse_mode: 'Markdown', ...keyboard });
            return res.json({ success: true });
        } catch (e) {
            console.error('Erro ao enviar pro canal:', e);
            return res.json({ success: false, error: 'Erro no Telegram' });
        }
    }
    res.json({ success: false, error: 'Canal não configurado' });
});

// Cloaker Middleware
app.use((req, res, next) => {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const bots = ['googlebot', 'facebookexternalhit', 'adsbot', 'tiktok', 'twitterbot', 'bingbot'];
    if(bots.some(bot => ua.includes(bot)) && req.url.includes('whatsapp.js')) {
        return res.send('console.log("Protected by Cloaker");');
    }
    next();
});

app.use(express.static(__dirname));

app.get('/combos', (req, res) => res.sendFile(path.join(__dirname, 'combos', 'index.html')));
app.get('/informacao', (req, res) => res.sendFile(path.join(__dirname, 'informacao', 'index.html')));
app.get('/contact-9', (req, res) => res.sendFile(path.join(__dirname, 'contact-9', 'index.html')));


// === TELEGRAM BOT ===
const bot = new Telegraf(process.env.BOT_TOKEN);
const userStates = new Map();
const pendingLinks = new Map();

async function fetchPageTitle(url) {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const text = await response.text();
        const match = text.match(/<title>(.*?)<\/title>/i);
        if (match && match[1]) return match[1].replace(/&amp;/g, '&').replace(/&#064;/g, '@');
    } catch (e) {}
    return "Página encontrada";
}

function getMenuMarkup(isMaster) {
    const buttons = [
        [Markup.button.callback('📱 WhatsApp', 'edit_whatsapp'), Markup.button.callback('📢 Leads & Radar', 'edit_channel')],
        [Markup.button.callback('📸 Instagram', 'edit_instagram'), Markup.button.callback('📘 Facebook', 'edit_facebook')],
        [Markup.button.callback('📍 Localização', 'edit_location'), Markup.button.callback('📈 Estatísticas', 'view_stats')]
    ];
    if (isMaster) {
        buttons.push([Markup.button.callback('➕ Add Admin', 'add_admin'), Markup.button.callback('➖ Rem Admin', 'remove_admin')]);
    }
    return Markup.inlineKeyboard(buttons);
}

bot.use((ctx, next) => { if (ctx.from && !isAdmin(ctx)) return; return next(); });

const buildStatusMsg = () => `🌟 *PAINEL DE CONTROLE* 🌟\n\n🔹 *Status:* 🟢 Online\n📞 *WhatsApp:* \`${botData.whatsappNumber||'Nenhum'}\`\n📸 *Instagram:* \`${botData.instagramUrl||'Nenhum'}\`\n📘 *Facebook:* \`${botData.facebookUrl||'Nenhum'}\`\n📍 *Localização:* \`${botData.location||'Padrão'}\`\n📢 *Canal Leads:* \`${botData.leadChannelId||'Nenhum'}\`\n\n_Selecione:_`;

bot.command('start', (ctx) => {
    userStates.delete(ctx.from.id);
    ctx.reply(buildStatusMsg(), { parse_mode: 'Markdown', ...getMenuMarkup(ctx.from.id.toString() === botData.masterAdminId) });
});

bot.action('view_config', (ctx) => {
    userStates.delete(ctx.from.id);
    ctx.editMessageText(buildStatusMsg(), { parse_mode: 'Markdown', ...getMenuMarkup(ctx.from.id.toString() === botData.masterAdminId) }).catch(()=>{});
});

bot.action('edit_whatsapp', (ctx) => {
    ctx.editMessageText('⚙️ *Opções do WhatsApp*', { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
        [Markup.button.callback('Mudar Número', 'edit_number'), Markup.button.callback('Mudar Texto Base', 'edit_text')],
        [Markup.button.callback('🔙 Voltar ao Início', 'view_config')]
    ]) }).catch(()=>{});
});

bot.action('view_stats', (ctx) => {
    ctx.editMessageText(`📈 *ESTATÍSTICAS* 📈\n\n👁 *Visitas Totais:* ${botData.visits}\n🚪 *Cliques no WhatsApp:* ${botData.exits}\n👥 *Visitantes Online Agora:* ${activeSessions.size}`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]) }).catch(()=>{});
});

bot.action('edit_location', (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_CEP');
    ctx.editMessageText('📍 *Mudar Localização*\n\nDigite apenas o CEP do seu endereço (ex: 01001-000 ou 01001000):', { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]) });
});

bot.action('edit_number', (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_NUMBER');
    ctx.editMessageText('Digite o novo número do WhatsApp (ex: 5511999999999):', Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
});

bot.action('edit_text', (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_TEXT');
    ctx.editMessageText('Digite o novo texto de saudação:', Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
});

bot.action('edit_instagram', (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_INSTAGRAM');
    ctx.editMessageText('📸 Digite o @ da página do Instagram (ex: @loja) ou cole o link:', Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
});

bot.action('edit_facebook', (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_FACEBOOK');
    ctx.editMessageText('📘 Digite o @ da página do Facebook (ex: @loja) ou cole o link:', Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
});

bot.action('edit_channel', (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_CHANNEL');
    ctx.editMessageText('📢 *Configuração de Canal*\n\nPara receber os leads e o Radar em Tempo Real, adicione o bot como Administrador do seu Canal.\n\nDepois, *encaminhe qualquer mensagem* do canal para mim, ou escolha enviar manualmente:', { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
        [Markup.button.callback('✍️ Enviar ID Manualmente', 'manual_channel_id')],
        [Markup.button.callback('🔙 Voltar ao Início', 'view_config')]
    ]) }).catch(()=>{});
});

bot.action('manual_channel_id', (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_MANUAL_CHANNEL');
    ctx.editMessageText('✍️ Digite ou cole o ID numérico do canal (ex: -100123...):', Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
});

bot.action(/^set_channel_(.+)$/, async (ctx) => {
    const channelId = ctx.match[1];
    
    // Testa se o bot realmente tem acesso
    try {
        await ctx.telegram.getChat(channelId); // Verifica se existe e tem acesso
        botData.leadChannelId = channelId;
        saveData();
        ctx.editMessageText(`✅ Canal configurado e testado com sucesso!\n\nOs leads e alertas cairão no ID: \`${channelId}\``, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]) });
    } catch(e) {
        ctx.editMessageText(`❌ Ocorreu um erro ao verificar o canal.\n\nTem certeza de que adicionou o Bot como Administrador dele?\nErro: ${e.message}`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
    }
});

bot.action('add_admin', (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_ADD_ADMIN');
    ctx.editMessageText('Digite o ID do Telegram do novo admin:', Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
});

bot.action('remove_admin', (ctx) => {
    userStates.set(ctx.from.id, 'WAITING_REMOVE_ADMIN');
    ctx.editMessageText(`Admins atuais: ${botData.admins.join(', ')}\n\nDigite o ID que deseja remover:`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
});

bot.action(/^confirm_(instagram|facebook)$/, (ctx) => {
    const network = ctx.match[1];
    const url = pendingLinks.get(ctx.from.id);
    if(url) {
        if(network === 'instagram') botData.instagramUrl = url;
        else botData.facebookUrl = url;
        saveData();
        ctx.editMessageText(`✅ O link oficial foi salvo!\n${url}\n\nJá está atualizado no site inteiro.`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
    }
});

bot.action('cancel_link', (ctx) => {
    pendingLinks.delete(ctx.from.id);
    ctx.editMessageText('❌ Ação cancelada.', Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
});

bot.on('message', async (ctx) => {
    const state = userStates.get(ctx.from.id);
    if (!state) return;

    if (state === 'WAITING_CHANNEL' && ctx.message.forward_from_chat) {
        const chat = ctx.message.forward_from_chat;
        const channelId = chat.id.toString();
        const channelName = chat.title || 'Desconhecido';
        
        ctx.reply(`🔎 *Canal Identificado*\n\n`+
                  `📌 *Nome:* ${channelName}\n`+
                  `🆔 *ID:* \`${channelId}\`\n`+
                  `📅 *Data de Criação:* (Oculta por privacidade do Telegram)\n\n`+
                  `O que deseja fazer?`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ Definir Automaticamente', `set_channel_${channelId}`)],
                [Markup.button.callback('✍️ Enviar ID Manualmente', 'manual_channel_id')],
                [Markup.button.callback('🔙 Voltar ao Início', 'view_config')]
            ])
        }).catch(e => console.log(e));
        userStates.delete(ctx.from.id);
    } else if ((state === 'WAITING_MANUAL_CHANNEL' || state === 'WAITING_CHANNEL') && ctx.message.text) {
        const channelId = ctx.message.text.trim();
        ctx.reply(`Processando...`).then(msg => {
            ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, 'Verificando acesso...', Markup.inlineKeyboard([[Markup.button.callback('✅ Confirmar ID', `set_channel_${channelId}`)], [Markup.button.callback('🔙 Cancelar', 'view_config')]]));
        });
        userStates.delete(ctx.from.id);
    } else if(ctx.message.text) {
        const text = ctx.message.text.trim();
        if (state === 'WAITING_NUMBER') {
            botData.whatsappNumber = text.replace(/\D/g, ''); saveData();
            ctx.reply(`✅ Número atualizado com sucesso no site!\n🔗 https://brinquedosemcasa.com.br`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
        } else if (state === 'WAITING_TEXT') {
            botData.whatsappText = text; saveData();
            ctx.reply(`✅ Texto atualizado!`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
        } else if (state === 'WAITING_INSTAGRAM' || state === 'WAITING_FACEBOOK') {
            const network = state === 'WAITING_INSTAGRAM' ? 'instagram' : 'facebook';
            let url = text.startsWith('@') ? `https://${network}.com/${text.substring(1)}` : (text.startsWith('http') ? text : `https://${network}.com/${text}`);
            const loadingMsg = await ctx.reply('🔎 Escaneando a página, aguarde...');
            const title = await fetchPageTitle(url);
            pendingLinks.set(ctx.from.id, url);
            ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null, `❓ *Verificação*\nNome: *${title}*\nLink: \`${url}\`\n\nConfirmar?`, {
                parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('✅ Confirmar', `confirm_${network}`)], [Markup.button.callback('❌ Cancelar', 'cancel_link')]])
            });
        } else if (state === 'WAITING_CEP') {
            const cep = text.replace(/\D/g, '');
            if (cep.length !== 8) return ctx.reply('⚠️ CEP inválido. Digite 8 números (ex: 01001000):');
            try {
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await response.json();
                if (data.erro) throw new Error("CEP não encontrado");
                
                const partialAddressObj = {
                    logradouro: data.logradouro || '',
                    bairro: data.bairro || '',
                    localidade: data.localidade || '',
                    uf: data.uf || ''
                };
                pendingLinks.set(ctx.from.id, JSON.stringify(partialAddressObj));
                
                let locationString = `${data.logradouro ? data.logradouro + ', ' : ''}${data.bairro ? '(' + data.bairro + '), ' : ''}${data.localidade}, ${data.uf}`;
                
                userStates.set(ctx.from.id, 'WAITING_ADDRESS_NUMBER');
                if (data.logradouro) {
                    ctx.reply(`📍 Endereço encontrado:\n*${locationString}*\n\nDigite agora apenas o **número** do local (e complemento se houver):`, { parse_mode: 'Markdown' });
                } else {
                    ctx.reply(`📍 CEP geral da cidade:\n*${locationString}*\n\nDigite agora o **nome da rua e o número**:`, { parse_mode: 'Markdown' });
                }
            } catch (err) {
                userStates.set(ctx.from.id, 'WAITING_FULL_ADDRESS');
                ctx.reply('⚠️ CEP não encontrado de forma automática.\n\nDigite o endereço completo manualmente (ex: Rua X, 123 - Bairro Y, Cidade, SP):');
            }
            return; // Don't delete state yet
        } else if (state === 'WAITING_ADDRESS_NUMBER') {
            const objStr = pendingLinks.get(ctx.from.id);
            let finalAddress = text;
            if (objStr && objStr.startsWith('{')) {
                const obj = JSON.parse(objStr);
                if (obj.logradouro) {
                    finalAddress = `${obj.logradouro} ${text}${obj.bairro ? ' (' + obj.bairro + ')' : ''}, ${obj.localidade}, ${obj.uf}`;
                } else {
                    finalAddress = `${text}${obj.bairro ? ' (' + obj.bairro + ')' : ''}, ${obj.localidade}, ${obj.uf}`;
                }
            }
            botData.location = finalAddress;
            saveData();
            ctx.reply(`✅ Endereço atualizado no site para:\n${finalAddress}`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
        } else if (state === 'WAITING_FULL_ADDRESS') {
            botData.location = text;
            saveData();
            ctx.reply(`✅ Endereço atualizado no site para:\n${text}`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Voltar ao Início', 'view_config')]]));
        }
    }
    userStates.delete(ctx.from.id);
});

bot.launch().then(() => console.log('Telegram Bot rodando!')).catch(err => console.error('Erro ao iniciar bot:', err));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    
    // Notificar startup
    const msg = "✅ *Sistema Iniciado com Sucesso na Hospedagem (ShardCloud)*\nSeu servidor e bot estão online e prontos para receber leads!";
    if (botData.masterAdminId) {
        bot.telegram.sendMessage(botData.masterAdminId, msg, { parse_mode: 'Markdown' }).catch(()=>{});
    }
    if (botData.logsChannel) {
        bot.telegram.sendMessage(botData.logsChannel, msg, { parse_mode: 'Markdown' }).catch(()=>{});
    }
});
