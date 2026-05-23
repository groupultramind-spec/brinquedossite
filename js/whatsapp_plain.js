document.addEventListener('DOMContentLoaded', () => {
    
    // Gerar ID Único de Sessão
    const generateSessionId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
    const sessionId = localStorage.getItem('site_session_id') || generateSessionId();
    localStorage.setItem('site_session_id', sessionId); // Salva para não perder se atualizar a página
    
    // Heartbeat (Avisar o radar do servidor que o visitante está vivo)
    const sendHeartbeat = () => {
        fetch(window.API_BASE_URL + '/api/track/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, userAgent: navigator.userAgent })
        }).catch(()=>{});
    };
    
    sendHeartbeat(); // Primeiro envio imediato
    setInterval(sendHeartbeat, 5000); // A cada 5 segundos
    
    // Buscar configurações ativas do Bot
    fetch(window.API_BASE_URL + '/api/whatsapp')
        .then(response => response.json())
        .then(data => {
            if(data.number) {
                const formatPhoneNumber = (num) => {
                    const str = num.replace(/\D/g, '');
                    if(str.length >= 10 && str.startsWith('55')) {
                        const ddd = str.substring(2,4);
                        const prefix = str.length === 13 ? str.substring(4,9) : str.substring(4,8);
                        const suffix = str.substring(str.length - 4);
                        return `(${ddd}) ${prefix}-${suffix}`;
                    }
                    return num;
                };
                
                const formattedNum = formatPhoneNumber(data.number);

                // Update visual text nodes that contain the old hardcoded number
                const walkDom = (node) => {
                    if(node.nodeType === 3) {
                        const val = node.nodeValue;
                        if(val.includes('96439')) {
                            node.nodeValue = val
                                .replace('(11) 96439-9707', formattedNum)
                                .replace('(11)964399707', formattedNum)
                                .replace('96439-9707', formattedNum)
                                .replace('964399707', formattedNum);
                        }
                        if (data.location && (val.includes('Silva Lisboa') || val.includes('Nhocuné'))) {
                            node.nodeValue = data.location;
                        }
                    } else if (node.nodeType === 1 && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
                        node.childNodes.forEach(walkDom);
                    }
                };
                walkDom(document.body);
            }

            const links = document.querySelectorAll('a');
            links.forEach(link => {
                const originalHref = link.href.toLowerCase();
                const isWhatsAppLink = originalHref.includes('whatsapp.com') || originalHref.includes('wa.me') || originalHref.includes('wa.link');
                const isTelLink = originalHref.includes('tel:');
                const isInstagramLink = originalHref.includes('instagram.com');
                const isFacebookLink = originalHref.includes('facebook.com') || originalHref.includes('fb.com');
                const isCategoryLink = originalHref.includes('/category/');

                // Reportar Saída Social e Atualizar Links
                if (isInstagramLink) {
                    if(data.instagramUrl) link.href = data.instagramUrl;
                    link.addEventListener('click', () => {
                        fetch(window.API_BASE_URL + '/api/track/exit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, target: 'Instagram' }) }).catch(()=>{});
                    });
                }
                
                if (isFacebookLink) {
                    if(data.facebookUrl) link.href = data.facebookUrl;
                    link.addEventListener('click', () => {
                        fetch(window.API_BASE_URL + '/api/track/exit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, target: 'Facebook' }) }).catch(()=>{});
                    });
                }

                // Lógica original do WhatsApp
                if (data.number && data.text) {
                    let displayPhone = data.number;
                    if(displayPhone.startsWith('55') && displayPhone.length === 13) {
                        displayPhone = `(${displayPhone.substring(2,4)}) ${displayPhone.substring(4,9)}-${displayPhone.substring(9)}`;
                    }

                    if (isTelLink && link.textContent.match(/\d{4}/)) {
                        link.href = `tel:+${data.number}`;
                        
                        function replaceTextInNodes(node, newText) {
                            if (node.nodeType === 3 && node.nodeValue.match(/\d{4}/)) {
                                node.nodeValue = newText;
                                return true;
                            } else if (node.nodeType === 1) {
                                for (let child of node.childNodes) {
                                    if (replaceTextInNodes(child, newText)) return true;
                                }
                            }
                            return false;
                        }
                        replaceTextInNodes(link, displayPhone);
                    }

                    if (isWhatsAppLink || (isTelLink && link.textContent.match(/\d{4}/))) {
                        link.addEventListener('click', (e) => {
                            fetch(window.API_BASE_URL + '/api/track/exit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, target: 'WhatsApp' }) }).catch(()=>{});

                            if (isWhatsAppLink) {
                                e.preventDefault();
                                
                                let contextInfo = document.title;
                                let foundItem = null;
                                
                                let parent = link.parentElement;
                                while(parent && parent !== document.body && !foundItem) {
                                    const img = parent.querySelector('img[alt*="COMBO"], img[alt*="Combo"], img[alt*="Cama"], img[alt*="Piscina"]');
                                    if(img && img.alt) {
                                        foundItem = img.alt.replace('.png', '').replace('.jpg', '');
                                        break;
                                    }
                                    const title = parent.querySelector('h1, h2, h3, h4');
                                    if(title && title.textContent.trim().length > 3) {
                                        foundItem = title.textContent.trim();
                                        break;
                                    }
                                    parent = parent.parentElement;
                                }

                                if(!foundItem) {
                                    const clickY = e.clientY;
                                    const clickX = e.clientX;
                                    const imgs = Array.from(document.querySelectorAll('img[alt]'));
                                    let closestDist = Infinity;
                                    for(const img of imgs) {
                                        if (img.alt.length < 3 || img.alt.includes('bg') || img.alt.includes('logo')) continue;
                                        const rect = img.getBoundingClientRect();
                                        const dist = Math.abs(rect.bottom - clickY) + Math.abs(rect.left - clickX);
                                        if(dist < closestDist && dist < 800) { 
                                            closestDist = dist;
                                            foundItem = img.alt.replace('.png', '').replace('.jpg', '');
                                        }
                                    }
                                }

                                let dynamicText = data.text;
                                if(foundItem) {
                                    dynamicText += `\n\n📌 Tenho interesse no item: ${foundItem}`;
                                } else {
                                    dynamicText += `\n\n📌 Origem: ${contextInfo}`;
                                }

                                const waLink = `https://api.whatsapp.com/send?phone=${data.number}&text=${encodeURIComponent(dynamicText)}`;
                                window.open(waLink, '_blank');
                            }
                        });
                        
                        if(isWhatsAppLink) {
                            link.href = "#";
                        }
                    }

                    // The product link logic has been moved outside to a capturing listener


                    // LÓGICA NOVO: Filtro de Categorias no Frontend
                    if (isCategoryLink) {
                        link.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            let categoryName = link.textContent.trim().toLowerCase();
                            
                            // Define keywords based on category names from the site
                            const keywords = {
                                'camas elásticas': ['cama', 'elástica'],
                                'infláveis': ['tobogã', 'castelinho', 'pula', 'inflável', 'jacaré', 'premium'],
                                'jogos e diversão': ['ping', 'vôlei', 'karaokê', 'disco', 'pebolim', 'basquete', 'fliperama', 'mesa', 'jogo', 'diversão'],
                                'piscina de bolinhas': ['piscina', 'bolinha']
                            };

                            // Normalizar nomes no menu (se estiver escrito diferente)
                            let selectedKeywords = [];
                            if (categoryName.includes('all') || categoryName.includes('todos')) {
                                selectedKeywords = ['ALL'];
                            } else if (categoryName.includes('cama')) {
                                selectedKeywords = keywords['camas elásticas'];
                            } else if (categoryName.includes('infl')) {
                                selectedKeywords = keywords['infláveis'];
                            } else if (categoryName.includes('jogo') || categoryName.includes('divers')) {
                                selectedKeywords = keywords['jogos e diversão'];
                            } else if (categoryName.includes('piscina')) {
                                selectedKeywords = keywords['piscina de bolinhas'];
                            } else {
                                selectedKeywords = ['ALL'];
                            }

                            // Get all products
                            const products = document.querySelectorAll('[data-hook="product-list-grid-item"]');
                            if (products.length > 0) {
                                products.forEach(prod => {
                                    if (selectedKeywords.includes('ALL')) {
                                        prod.style.display = 'block';
                                        return;
                                    }

                                    const productText = prod.textContent.toLowerCase();
                                    const match = selectedKeywords.some(kw => productText.includes(kw));
                                    if (match) {
                                        prod.style.display = 'block';
                                    } else {
                                        prod.style.display = 'none';
                                    }
                                });

                                // Estilizar o menu lateral para mostrar ativo
                                document.querySelectorAll('a[href*="/category/"]').forEach(a => {
                                    a.style.fontWeight = 'normal';
                                    a.style.textDecoration = 'none';
                                });
                                link.style.fontWeight = 'bold';
                                link.style.textDecoration = 'underline';
                            } else {
                                // Se os produtos ainda não carregaram, manda pro index com a categoria salva no hash
                                window.location.href = '/' + link.getAttribute('href');
                            }
                        });
                    }
                }
            });

            // Captura Global para Links de Produtos (Garante que roda antes do Wix)
            document.body.addEventListener('click', (e) => {
                const link = e.target.closest('a');
                if (!link) return;
                
                const originalHref = link.href.toLowerCase();
                const isProductLink = originalHref.includes('product-page');
                
                if (isProductLink && data.number && data.text) {
                    e.preventDefault();
                    e.stopPropagation();

                    let productName = null;
                    const texts = link.querySelectorAll('h1, h2, h3, h4, p, span');
                    for (const t of texts) {
                        const val = t.textContent.trim();
                        if (val.length > 3 && !val.includes('R$') && !val.toLowerCase().includes('produto')) {
                            productName = val;
                            break;
                        }
                    }

                    if (!productName) {
                        const img = link.querySelector('img[alt]');
                        if (img && img.alt.length > 3 && !img.alt.includes('bg')) {
                            productName = img.alt.replace('.png', '').replace('.jpg', '');
                        }
                    }

                    if (!productName) {
                        let parent = link.parentElement;
                        for (let i = 0; i < 4; i++) {
                            if (!parent) break;
                            const siblingTexts = parent.querySelectorAll('h1, h2, h3, h4, p, span');
                            for (const t of siblingTexts) {
                                const val = t.textContent.trim();
                                if (val.length > 3 && !val.includes('R$') && !val.toLowerCase().includes('produto')) {
                                    productName = val;
                                    break;
                                }
                            }
                            if (productName) break;
                            parent = parent.parentElement;
                        }
                    }

                    if (!productName) productName = "um Produto do Catálogo";

                    let dynamicText = data.text + `\n\n📌 Tenho interesse no item: ${productName}`;
                    const waLink = `https://api.whatsapp.com/send?phone=${data.number}&text=${encodeURIComponent(dynamicText)}`;
                    
                    fetch(window.API_BASE_URL + '/api/track/exit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, target: `WhatsApp (${productName})` }) }).catch(()=>{});
                    
                    window.open(waLink, '_blank');
                }
            }, true);

            // Lógica de Captura de Leads (Formulário de Contato)
            const sendButtons = Array.from(document.querySelectorAll('button, a')).filter(el => 
                el.textContent && el.textContent.trim().toLowerCase() === 'enviar'
            );

            sendButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const formContainer = btn.closest('form') || btn.parentElement.parentElement;
                    if (!formContainer) return;

                    const inputs = formContainer.querySelectorAll('input, textarea');
                    let leadData = { nome: '', sobrenome: '', email: '', telefone: '', mensagem: '' };
                    let hasData = false;

                    inputs.forEach(input => {
                        const placeholder = (input.placeholder || '').toLowerCase();
                        const val = input.value.trim();
                        if (!val) return;

                        if (placeholder.includes('nome') && !placeholder.includes('sobrenome')) { leadData.nome = val; hasData = true; }
                        else if (placeholder.includes('sobrenome')) { leadData.sobrenome = val; hasData = true; }
                        else if (placeholder.includes('email')) { leadData.email = val; hasData = true; }
                        else if (placeholder.includes('telefone') || placeholder.includes('celular')) { leadData.telefone = val; hasData = true; }
                        else if (input.tagName.toLowerCase() === 'textarea' || placeholder.includes('mensagem')) { leadData.mensagem = val; hasData = true; }
                    });

                    if (hasData) {
                        e.preventDefault(); 
                        e.stopPropagation();

                        // Validações no Frontend
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(leadData.email)) {
                            alert("Por favor, insira um e-mail válido.");
                            return;
                        }

                        const cleanPhone = leadData.telefone.replace(/\D/g, '');
                        if (cleanPhone.length < 10 || cleanPhone.length > 11) {
                            alert("O telefone deve ter DDD + Número (Ex: 11999999999).");
                            return;
                        }

                        if (!leadData.mensagem || leadData.mensagem.length < 10 || leadData.mensagem.length > 1000) {
                            alert("A mensagem deve ter entre 10 e 1000 caracteres.");
                            return;
                        }

                        btn.textContent = 'Enviando...';
                        btn.style.opacity = '0.7';

                        fetch(window.API_BASE_URL + '/api/contact', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(leadData)
                        })
                        .then(res => res.json())
                        .then(resData => {
                            if (!resData.success) {
                                alert("Erro: " + (resData.error || "Dados inválidos."));
                                btn.textContent = 'Enviar';
                                btn.style.opacity = '1';
                                return;
                            }
                            btn.textContent = 'Enviado com Sucesso!';
                            btn.style.backgroundColor = '#4CAF50';
                            inputs.forEach(i => i.value = ''); 
                            setTimeout(() => {
                                btn.textContent = 'Enviar';
                                btn.style.opacity = '1';
                                btn.style.backgroundColor = '';
                            }, 3000);
                        })
                        .catch(err => {
                            console.error('Erro', err);
                            btn.textContent = 'Erro';
                            setTimeout(() => { btn.textContent = 'Enviar'; btn.style.opacity = '1'; }, 3000);
                        });
                    }
                });
            });

        })
        .catch(err => console.error('Erro:', err));
});
