const fs = require('fs');
const files = ['index.html', 'contact-9/index.html', 'informacao/index.html', 'combos/index.html'];

files.forEach(f => {
    if (!fs.existsSync(f)) return;
    let html = fs.readFileSync(f, 'utf8');
    
    // Remove the updateDOM inline script
    html = html.replace(/<script[^>]*>(?:(?!<\/script>)[\s\S])*?updateDOM(?:(?!<\/script>)[\s\S])*?<\/script>/g, '');
    
    // Check if there are any other <script> tags before API_BASE_URL that shouldn't be there
    // We already removed fetch('/api/...') and removeNumbers
    
    fs.writeFileSync(f, html);
    console.log("Cleaned updateDOM:", f);
});
