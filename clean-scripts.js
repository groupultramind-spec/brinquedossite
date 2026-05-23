const fs = require('fs');

const files = ['index.html', 'contact-9/index.html', 'informacao/index.html', 'combos/index.html'];

files.forEach(f => {
    if (!fs.existsSync(f)) return;
    let html = fs.readFileSync(f, 'utf8');
    
    // Remove inline scripts containing specific logic
    html = html.replace(/<script>[\s\S]*?removeNumbers[\s\S]*?<\/script>/g, '');
    html = html.replace(/<script>[\s\S]*?fetch\('(?:\/api\/contact|https:\/\/brinquedosemcasa\.shardweb\.app\/api\/contact)'\)[\s\S]*?<\/script>/g, '');
    html = html.replace(/<script>[\s\S]*?fetch\('(?:\/api\/whatsapp|https:\/\/brinquedosemcasa\.shardweb\.app\/api\/whatsapp)'\)[\s\S]*?<\/script>/g, '');
    html = html.replace(/<script>[\s\S]*?fetch\('(?:\/api\/track\/ping|https:\/\/brinquedosemcasa\.shardweb\.app\/api\/track\/ping)'\)[\s\S]*?<\/script>/g, '');
    
    // Remove any malformed whatsapp.js script tags
    html = html.replace(/<script src=" \/js\/whatsapp\.js\\><\/script>/g, '');
    html = html.replace(/<script src="\/js\/whatsapp\.js"><\/script>/g, '');
    html = html.replace(/<script src=" \/js\/whatsapp\.js"><\/script>/g, '');
    
    // Clean up old window.API_BASE_URL definitions if they are alone
    html = html.replace(/<script>\s*window\.API_BASE_URL = '[^']+';\s*<\/script>/g, '');

    // Now inject the clean ones right before </body>
    const injection = `
<script>window.API_BASE_URL = 'https://brinquedosemcasa.shardweb.app';</script>
<script src="/js/whatsapp.js"></script>
</body>`;
    
    html = html.replace(/<\/body>/, injection);
    
    fs.writeFileSync(f, html);
    console.log("Cleaned:", f);
});
