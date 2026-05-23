const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const imgMatch = html.match(/<img[^>]+>/g);
if (imgMatch) {
    console.log(imgMatch.slice(0, 5).join('\n'));
}
