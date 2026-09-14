const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function generateImageServiceWorker(directory) {
  const template = fs.readFileSync(
    path.join(__dirname, 'image-service-worker.template.js'),
    'utf8',
  );
  const images = fs
    .readdirSync(directory, { recursive: true })
    .filter(file => /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i.test(file))
    .filter(file => fs.statSync(path.join(directory, file)).isFile())
    .sort();
  if (!images.length) throw new Error('Web export contains no images to cache');

  // Include contents so even public images without hashed filenames update.
  const version = createHash('sha256').update(template);
  const urls = images.map(file => {
    const url = '/' + file.split(path.sep).map(encodeURIComponent).join('/');
    version.update(url).update('\0');
    version.update(fs.readFileSync(path.join(directory, file))).update('\0');
    return url;
  });
  const worker = template
    .replace('__IMAGE_CACHE_VERSION__', version.digest('hex'))
    .replace('/* __IMAGE_URLS__ */', JSON.stringify(urls));
  fs.writeFileSync(path.join(directory, 'image-service-worker.js'), worker);
  return urls.length;
}

if (require.main === module) {
  const count = generateImageServiceWorker(
    path.resolve(process.argv[2] || 'dist'),
  );
  console.log(`Generated service worker to precache ${count} images.`);
}

module.exports = { generateImageServiceWorker };
