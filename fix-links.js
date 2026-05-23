const fs = require('fs');
const files = ['index.html', 'contact-9/index.html', 'informacao/index.html', 'combos/index.html'];
files.forEach(f => {
    if (!fs.existsSync(f)) return;
    let html = fs.readFileSync(f, 'utf8');
    
    // Replace extensionless links with exact index.html links to prevent KingHost 404s
    html = html.replace(/href="\/contact-9"/g, 'href="/contact-9/index.html"');
    html = html.replace(/href="\/combos"/g, 'href="/combos/index.html"');
    html = html.replace(/href="\/informacao"/g, 'href="/informacao/index.html"');
    
    fs.writeFileSync(f, html);
});
