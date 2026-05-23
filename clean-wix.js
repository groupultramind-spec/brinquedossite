const fs = require('fs');
const files = ['index.html', 'contact-9/index.html', 'informacao/index.html', 'combos/index.html'];

files.forEach(f => {
    if (!fs.existsSync(f)) return;
    let html = fs.readFileSync(f, 'utf8');

    // Fix Safari blank screen issue
    html = html.replace(/body:not\(\[data-js-loaded\]\) \[data-hide-prejs\]\{visibility:hidden\}/g, '');
    html = html.replace(/\[data-hide-prejs\]/g, '');
    html = html.replace(/data-hide-prejs/g, '');

    // Remove Wix Tracking
    html = html.replace(/<script[^>]*src="[^"]*siteTags\.bundle\.min\.js"[^>]*><\/script>/g, '');
    
    // Remove Generator Meta Tag
    html = html.replace(/<meta name="generator" content="Wix\.com Website Builder"\/>/g, '');

    fs.writeFileSync(f, html);
    console.log('Cleaned safely: ' + f);
});
