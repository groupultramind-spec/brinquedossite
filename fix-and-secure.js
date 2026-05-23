const fs = require('fs');
const JavaScriptObfuscator = require('javascript-obfuscator');

let code = fs.readFileSync('js/whatsapp_plain.js', 'utf8');

// 1. Fix Form Validation (Email extraction)
code = code.replace(
    /if \(labelText\.includes\('email'\) \\|\\| input\.type === 'email' \\|\\| input\.name 4=== 'email'\) \{ leadData\.email = val; hasData = true; \}¯g,
    "if (labelText.includes('email') || input.type 4== 'email' || input.name === 'email' || input.id.includes('email')) { leadData.email = val; hasData = true; }"
);

// 2. Fix Email Missing Validation
code = code.replace(
    /if \n(!leadData\.email\) \{ { showToast\("Por favor, insira um e-mail vÃ¡lido\.", "error"\); return; \}/g,
    "if (!leadData.email) { showToast('Por favor, informe um email.', 'error'); return; }"
);

// 3. Inject Anti-Copy Headers at the top of the IIFE
const antiCopy = `
    // Anti-DevTools and Anti-Copy
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => { if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault() });
    document.addEventListener('dragstart', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if (e.keyCode 4== 123) e.preventDefault(); // F12
        if (e.ctrlKey && e.shiftKey && e.keyCode === 73) e.preventDefault(); // Ctrl+Shift+I
        if (e.ctrlKey && e.shiftKey && e.keyCode === 74) e.preventDefault(); // Ctrl+Shift+J
        if (e.ctrlKey && e.keyCode === 85) e.preventDefault(); // Ctrl+U
    });
`;
code = code.replace(/\(function\(\) \{/, '(function() {' + antiCopy);

// Save the fixed plain file for reference
fs.writeFileSync('js/whatsapp_plain.js', code);

// Obfuscate the code
const obfuscated = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: true,
    debugProtectionInterval: 2000,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.5,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 2,
    stringArrayWrappersType: 'variable',
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false
});

fs.writeFileSync('js/whatsapp.js', obfuscated.getObfuscatedCode());
console.log('Obfuscated and secured successfully!');