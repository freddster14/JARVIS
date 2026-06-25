const sharp = require('sharp');
const path = require('path');

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#4f46e5"/>
  <text x="50" y="68" font-size="58" font-family="sans-serif" font-weight="bold"
        text-anchor="middle" fill="white">J</text>
</svg>`);

const publicDir = path.join(__dirname, '..', 'client', 'public');

async function generate() {
  await sharp(svg).resize(192).png().toFile(path.join(publicDir, 'icon-192.png'));
  await sharp(svg).resize(512).png().toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Generated client/public/icon-192.png and icon-512.png');
}

generate().catch((err) => { console.error(err); process.exit(1); });
