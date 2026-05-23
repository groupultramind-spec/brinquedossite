const fs = require('fs');
const files = ['index.html', 'contact-9/index.html', 'informacao/index.html', 'combos/index.html'];

files.forEach(f => {
    if (!fs.existsSync(f)) return;
    let html = fs.readFileSync(f, 'utf8');
    if (!html.includes('mobile-adapt.css')) {
        // Find </head>
        html = html.replace('</head>', '<link rel="stylesheet" href="/css/mobile-adapt.css"></head>');
        fs.writeFileSync(f, html);
        console.log('Injected CSS into ' + f);
    }
});
