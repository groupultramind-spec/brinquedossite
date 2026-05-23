const fs = require('fs');
const files = ['index.html', 'contatos/index.html', 'informacao/index.html', 'combos/index.html'];
files.forEach(f => {
    let html = fs.readFileSync(f, 'utf8');
    html = html.replace(/window\.API_BASE_URL = ''; \/\/ Exemplo: 'https:\/\/meubot\.shardcloud\.com'/g, "window.API_BASE_URL = 'https://brinquedosemcasa.shardweb.app';");
    fs.writeFileSync(f, html);
});
