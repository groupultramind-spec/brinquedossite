const fs = require('fs');
let code = fs.readFileSync('js/whatsapp.js', 'utf8');

// Fix form container logic
code = code.replace(
    /const formContainer = btn\.closest\('form'\) \|\| \(btn\.parentElement \? btn\.parentElement\.parentElement : null\);/,
    "const formContainer = btn.closest('form') || btn.closest('.wixui-form') || document;"
);

// Fix category keyword search logic (Todos os itens)
code = code.replace(
    /textContent\.includes\('todos os produtos'\)/g,
    "textContent.includes('todos os produtos') || textContent.includes('todos os itens')"
);

fs.writeFileSync('js/whatsapp.js', code);
fs.writeFileSync('js/whatsapp_plain.js', code);
console.log('Fixed whatsapp.js logic');
