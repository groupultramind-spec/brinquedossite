const fs = require('fs');
const files = ['index.html', 'contact-9/index.html', 'informacao/index.html', 'combos/index.html'];

files.forEach(f => {
    if (!fs.existsSync(f)) return;
    let html = fs.readFileSync(f, 'utf8');
    
    // Add cache buster to whatsapp.js
    html = html.replace(/src="\/js\/whatsapp\.js(\?v=\d+)?"/g, 'src="/js/whatsapp.js?v=' + Date.now() + '"');

    fs.writeFileSync(f, html);
    console.log('Updated cache buster in: ' + f);
});
