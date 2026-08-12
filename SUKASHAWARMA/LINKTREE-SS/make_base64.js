const fs = require('fs');

async function processImage() {
  const Jimp = require('jimp');
  try {
    const image = await Jimp.read('logo.png');
    image.resize(144, 144); // Resize to twice the display size (72px) for retina
    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
    const base64 = buffer.toString('base64');
    const dataUri = `data:image/png;base64,${base64}`;
    fs.writeFileSync('logo_base64.txt', dataUri);
    console.log('Successfully saved to logo_base64.txt');
  } catch (err) {
    console.error('Error processing image with Jimp:', err);
    // Fallback: just read as is if Jimp isn't installed
    const buffer = fs.readFileSync('logo.png');
    const base64 = buffer.toString('base64');
    const dataUri = `data:image/png;base64,${base64}`;
    fs.writeFileSync('logo_base64.txt', dataUri);
    console.log('Saved raw base64 (Jimp failed)');
  }
}

processImage();
