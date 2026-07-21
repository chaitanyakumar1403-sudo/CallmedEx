const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walkDir('frontend/src');
let changedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace exact string matches: "http://localhost:8000/..."
    content = content.replace(/"http:\/\/localhost:8000(\/[^"]*)"/g, '`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}$1`');
    
    // Replace exact string matches: 'http://localhost:8000/...'
    content = content.replace(/'http:\/\/localhost:8000(\/[^']*)'/g, '`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}$1`');
    
    // Replace template literal matches: `http://localhost:8000/...`
    content = content.replace(/`http:\/\/localhost:8000(\/[^`]*)`/g, '`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}$1`');
    
    // Replace standalone assignments like apiBase = 'http://localhost:8000'
    content = content.replace(/= ['"]http:\/\/localhost:8000['"]/g, '= process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"');

    if (content !== original) {
        fs.writeFileSync(file, content);
        changedFiles++;
        console.log('Updated', file);
    }
});

console.log('Total files updated:', changedFiles);
