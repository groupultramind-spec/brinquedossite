const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const matches = html.match(/<script[\s\S]*?<\/script>/gi);
if (matches) {
    matches.forEach(m => {
        const srcMatch = m.match(/src="([^"]+)"/);
        if (srcMatch) console.log('SRC: ' + srcMatch[1]);
        else console.log('INLINE SCRIPT: ' + m.length + ' chars');
    });
} else {
    console.log('No scripts found');
}
