const fs = require('fs');
const JavaScriptObfuscator = require('javascript-obfuscator');

let code = \
(function() {
    // 1. Anti-Copia e Seguranca
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => { if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault() });
    document.addEventListener('dragstart', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if (e.keyCode === 123) e.preventDefault(); // F12
        if (e.ctrlKey && e.shiftKey && e.keyCode === 73) e.preventDefault(); // Ctrl+Shift+I
        if (e.ctrlKey && e.shiftKey && e.keyCode === 74) e.preventDefault(); // Ctrl+Shift+J
        if (e.ctrlKey && e.keyCode === 85) e.preventDefault(); // Ctrl+U
    });

    const style = document.createElement('style');
    style.innerHTML = \\\
        .custom-toast { position: fixed; bottom: 20px; right: -300px; background-color: #333; color: #fff; padding: 15px 25px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: 'Inter', sans-serif, Arial; font-size: 15px; font-weight: 500; z-index: 999999; transition: right 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55); display: flex; align-items: center; gap: 10px; }
        .custom-toast.show { right: 20px; }
        .custom-toast.success { background-color: #2e7d32; }
        .custom-toast.error { background-color: #d32f2f; }
    \\\;
    document.head.appendChild(style);

    const showToast = (msg, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = 'custom-toast ' + type;
        toast.innerHTML = (type === 'success' ? 'OK: ' : 'ERRO: ') + msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4000);
    };

    const generateSessionId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
    const sessionId = localStorage.getItem('site_session_id') || generateSessionId();
    localStorage.setItem('site_session_id', sessionId);
    
    const sendHeartbeat = () => {
        if (!window.API_BASE_URL) return;
        fetch(window.API_BASE_URL + '/api/track/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, userAgent: navigator.userAgent }) }).catch(()=>{});
    };
    sendHeartbeat(); setInterval(sendHeartbeat, 5000);

    let botData = null;

    const formatPhoneNumber = (num) => {
        let str = num.replace(/\\D/g, '');
        if (str.startsWith('55') && str.length >= 12) str = str.substring(2);
        if(str.length >= 10) return \\\(\\\) \\\-\\\\\\;
        return num;
    };

    const updateStaticText = () => {
        if (!botData) return;
        const formattedNum = formatPhoneNumber(botData.number);
        const walkDom = (node) => {
            if(node.nodeType === 3) {
                const val = node.nodeValue;
                if(val.includes('96439') || val.includes('(11)')) {
                    node.nodeValue = val.replace(/\\(11\\)\\s*96439-?9707/g, formattedNum).replace(/11964399707/g, formattedNum).replace(/96439-?9707/g, formattedNum);
                }
                if (botData.location && (val.includes('Silva Lisboa') || val.includes('Nhocune'))) { node.nodeValue = botData.location; }
            } else if (node.nodeType === 1 && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
                node.childNodes.forEach(walkDom);
                if (node.textContent && botData.location && node.textContent.includes(botData.location) && node.tagName !== 'A' && node.textContent.length < 100) {
                    node.style.cursor = 'pointer'; node.title = 'Abrir no Google Maps';
                }
            }
        };
        walkDom(document.body);
    };

    fetch((window.API_BASE_URL || 'https://brinquedosemcasa.shardweb.app') + '/api/whatsapp').then(res => res.json()).then(data => {
        botData = data; updateStaticText(); setTimeout(updateStaticText, 3000);
    }).catch(e => console.error(e));

    document.body.addEventListener('click', (e) => {
        try {
            if (botData && botData.location) {
                const targetText = (e.target.innerText || e.target.textContent || '').trim();
                if (targetText.includes(botData.location) && targetText.length < 100) {
                    e.preventDefault(); e.stopPropagation();
                    window.open('https://maps.google.com/?q=' + encodeURIComponent(botData.location), '_blank'); return;
                }
            }

            const targetLower = (e.target.innerText || e.target.textContent || '').trim().toLowerCase();
            const isSubmitBtn = targetLower === 'enviar' || e.target.value === 'Enviar' || (e.target.closest && e.target.closest('button') && e.target.closest('button').textContent.trim().toLowerCase() === 'enviar');
            
            if (isSubmitBtn && e.target.closest) {
                const btn = e.target.closest('button') || e.target;
                const formContainer = btn.closest('form') || btn.closest('.wixui-form') || document;
                if (formContainer && formContainer.querySelector('input')) {
                    const inputs = formContainer.querySelectorAll('input, textarea');
                    let leadData = { nome: '', sobrenome: '', email: '', telefone: '', mensagem: '' };
                    let hasData = false;

                    inputs.forEach(input => {
                        const labelText = (input.getAttribute('aria-label') || input.name || input.type || input.placeholder || input.id || '').toLowerCase();
                        const val = input.value.trim();
                        if (!val) return;
                        if (labelText.includes('nome') && !labelText.includes('sobrenome')) { leadData.nome = val; hasData = true; }
                        else if (labelText.includes('sobrenome')) { leadData.sobrenome = val; hasData = true; }
                        else if (labelText.includes('email') || input.type === 'email' || input.name === 'email') { leadData.email = val; hasData = true; }
                        else if (labelText.includes('telefone') || labelText.includes('celular') || input.type === 'tel' || labelText.includes('phone')) { leadData.telefone = val; hasData = true; }
                        else if (input.tagName.toLowerCase() === 'textarea' || labelText.includes('mensagem')) { leadData.mensagem = val; hasData = true; }
                    });

                    if (hasData) {
                        e.preventDefault(); e.stopPropagation();
                        if (!leadData.email) { showToast("Por favor, insira um e-mail valido.", "error"); return; }
                        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
                        if (!emailRegex.test(leadData.email)) { showToast("Por favor, insira um e-mail valido.", "error"); return; }
                        const cleanPhone = leadData.telefone.replace(/\\D/g, '');
                        if (cleanPhone.length < 10 || cleanPhone.length > 11) { showToast("O telefone deve ter DDD + Numero (apenas numeros).", "error"); return; }
                        if (!leadData.mensagem || leadData.mensagem.length < 5) { showToast("A mensagem e muito curta.", "error"); return; }

                        const oldText = btn.textContent;
                        btn.textContent = 'Enviando...'; btn.style.opacity = '0.7';

                        fetch((window.API_BASE_URL || 'https://brinquedosemcasa.shardweb.app') + '/api/contact', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(leadData)
                        }).then(res => res.json()).then(resData => {
                            if (!resData.success) { showToast(resData.error || "Dados invalidos.", "error"); btn.textContent = oldText; btn.style.opacity = '1'; return; }
                            showToast("Mensagem enviada com sucesso!");
                            inputs.forEach(i => i.value = '');
                            setTimeout(() => { btn.textContent = oldText; btn.style.opacity = '1'; }, 3000);
                        }).catch(err => { showToast("Erro ao enviar mensagem.", "error"); btn.textContent = oldText; btn.style.opacity = '1'; });
                        return;
                    }
                }
            }

            if (!e.target.closest) return;
            const link = e.target.closest('a');
            if (!link) return;

            const href = (link.getAttribute('href') || '').toLowerCase();
            const textContent = link.textContent.trim().toLowerCase();

            const isCategoryLink = href.includes('/category/') || textContent.includes('todos os produtos') || textContent.includes('todos os itens');
            if (isCategoryLink) {
                e.preventDefault(); e.stopPropagation();
                const keywords = {
                    'camas elasticas': ['cama', 'elastica'],
                    'inflaveis': ['toboga', 'castelinho', 'pula', 'inflavel', 'jacare', 'premium', 'inflaveis'],
                    'jogos e diversao': ['ping', 'volei', 'karaoke', 'disco', 'pebolim', 'basquete', 'fliperama', 'mesa', 'jogo', 'diversao', 'games'],
                    'piscina de bolinhas': ['piscina', 'bolinha']
                };
                let selectedKeywords = ['ALL'];
                if (textContent.includes('cama')) selectedKeywords = keywords['camas elasticas'];
                else if (textContent.includes('infl')) selectedKeywords = keywords['inflaveis'];
                else if (textContent.includes('jogo') || textContent.includes('divers')) selectedKeywords = keywords['jogos e diversao'];
                else if (textContent.includes('piscina')) selectedKeywords = keywords['piscina de bolinhas'];

                const products = document.querySelectorAll('[data-hook="product-list-grid-item"]');
                if (products.length > 0) {
                    products.forEach(prod => {
                        if (selectedKeywords[0] === 'ALL') { prod.style.display = 'block'; return; }
                        const pText = prod.textContent.toLowerCase();
                        const match = selectedKeywords.some(kw => pText.includes(kw));
                        prod.style.display = match ? 'block' : 'none';
                    });
                    document.querySelectorAll('a').forEach(a => {
                        if((a.getAttribute('href')||'').includes('/category/') || a.textContent.toLowerCase().includes('todos os produtos') || a.textContent.toLowerCase().includes('todos os itens')) {
                            a.style.fontWeight = 'normal'; a.style.textDecoration = 'none';
                        }
                    });
                    link.style.fontWeight = 'bold'; link.style.textDecoration = 'underline';
                } else if (window.location.pathname.length > 2 && window.location.pathname !== '/catalogo') {
                    window.location.href = '/' + (href.startsWith('/') ? href.substring(1) : href);
                }
                return;
            }

            const isProductLink = href.includes('product-page') || href.includes('#product-page') || textContent.includes('reservar agora');
            const isWhatsAppDirect = href.includes('whatsapp.com') || href.includes('wa.me') || href.includes('wa.link');
            const isTelLink = href.includes('tel:');
            
            if ((isProductLink || isWhatsAppDirect || isTelLink) && botData && botData.number && botData.text) {
                e.preventDefault(); e.stopPropagation();

                let foundItem = null;
                let parent = e.target;
                while (parent && parent !== document.body && !foundItem) {
                    const texts = parent.querySelectorAll('h1, h2, h3, h4, span, p');
                    for (const t of texts) {
                        const val = t.textContent.trim();
                        if (val.toUpperCase().includes('COMBO') && val.length < 15) { foundItem = val.toUpperCase(); break; }
                        if (isProductLink && val.length > 3 && !val.includes('R$') && !val.toLowerCase().includes('produto') && !val.toLowerCase().includes('reservar')) { foundItem = val; break; }
                    }
                    if (!foundItem) {
                        const img = parent.querySelector('img[alt]');
                        if (img && img.alt && img.alt.length > 3 && !img.alt.includes('bg') && !img.alt.includes('logo')) { foundItem = img.alt.replace('.png', '').replace('.jpg', ''); }
                    }
                    parent = parent.parentElement;
                }

                if (!foundItem) foundItem = document.title || "Catalogo";

                let dynamicText = botData.text;
                if(isProductLink || textContent.includes('reservar')) { dynamicText += \\\\\n\\n?? Tenho interesse no item: \\\\\\; } 
                else if (!isTelLink) { dynamicText += \\\\\n\\n?? Origem: \\\\\\; }

                const cleanPhone = botData.number.replace(/\\D/g, '');
                const phoneNum = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
                
                fetch((window.API_BASE_URL || 'https://brinquedosemcasa.shardweb.app') + '/api/track/exit', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sessionId, target: \\\WhatsApp (\\\)\\\ }) }).catch(()=>{});
                
                if (isTelLink && !isWhatsAppDirect && !isProductLink) { window.location.href = \\\	el:+\\\\\\; } 
                else { window.open(\\\https://api.whatsapp.com/send?phone=\\\&text=\\\\\\, '_blank'); }
            }

        } catch(err) { console.error('Global Click Error:', err); }
    }, true);
})();
\;

fs.writeFileSync('js/whatsapp_plain.js', code);

const obfuscated = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: true,
    debugProtectionInterval: 2000,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.5,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 2,
    stringArrayWrappersType: 'variable',
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false
});

fs.writeFileSync('js/whatsapp.js', obfuscated.getObfuscatedCode());
console.log('Obfuscated and secured successfully!');
