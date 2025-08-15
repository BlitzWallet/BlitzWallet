import fs from 'fs';
import path from 'path';

function getAllFiles(dirPath, arrayOfFiles = [], ignoreFolders = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      if (!ignoreFolders.includes(file)) {
        getAllFiles(fullPath, arrayOfFiles, ignoreFolders);
      }
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

const folderPath = './db'; // folder to scan
const ignoreFolders = ['assets', 'constants']; // folders to skip
const statusFile = './locales/translation-status.json';

const allFiles = getAllFiles(folderPath, [], ignoreFolders);

// Load existing status if it exists
let status = {};
if (fs.existsSync(statusFile)) {
  status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
}

// Update status for all files
allFiles.forEach(file => {
  status[file] = false;
});

// Save the updated status
fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));

console.log(`✅ Translation status updated in ${statusFile}`);
