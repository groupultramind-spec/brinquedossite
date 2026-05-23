const fs = require('fs');
let code = fs.readFileSync('js/whatsapp.js', 'utf8');

// Remove DOMContentLoaded wrapper to execute immediately
code = code.replace(/document\.addEventListener\('DOMContentLoaded', \(\) => \{/, '(function() {');
code = code.replace(/\}\);\s*$/, '})();');

// Add try-catch around the click handler to prevent one bad click from breaking the whole listener
code = code.replace(/document\.body\.addEventListener\('click', \(e\) => \{/g, "document.body.addEventListener('click', (e) => { try {");
code = code.replace(/\}, true\);/g, "} catch(err) { console.error('Global Click Error:', err); } }, true);");

fs.writeFileSync('js/whatsapp.js', code);
fs.writeFileSync('js/whatsapp_plain.js', code);
