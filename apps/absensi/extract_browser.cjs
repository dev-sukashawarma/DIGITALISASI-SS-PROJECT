const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const imgBuffer = fs.readFileSync('C:/Users/Creator MPB/.gemini/antigravity/brain/d5714403-fa62-4e45-85fe-fa36bc4e286d/.user_uploaded/media__1785397559232.png');
  const base64Img = imgBuffer.toString('base64');
  
  // Create an HTML file locally
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
      <script src="https://cdn.jsdelivr.net/npm/@vladmandic/human/dist/human.js"></script>
  </head>
  <body>
      <img id="img" src="data:image/png;base64,${base64Img}">
      <script>
          async function process() {
              const human = new Human({
                  modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models',
                  backend: 'wasm',
                  face: {
                    enabled: true,
                    detector: { return: true, rotation: true },
                    mesh: { enabled: true },
                    iris: { enabled: true },
                    description: { enabled: true },
                    emotion: { enabled: false }
                  },
                  body: { enabled: false },
                  hand: { enabled: false },
                  object: { enabled: false }
              });
              await human.load();
              const img = document.getElementById('img');
              if(img.complete) {
                  await detect(img, human);
              } else {
                  img.onload = async () => await detect(img, human);
              }
          }
          
          async function detect(img, human) {
              const result = await human.detect(img);
              if (result.face && result.face.length > 0) {
                  window.resultDescriptor = result.face[0].embedding;
              } else {
                  window.resultDescriptor = [];
              }
              window.detectionDone = true;
          }
          process();
      </script>
  </body>
  </html>
  `;
  fs.writeFileSync('temp.html', htmlContent);

  await page.goto('file://' + path.resolve('temp.html'));
  
  // wait for detectionDone
  await page.waitForFunction('window.detectionDone === true', { timeout: 60000 });
  const desc = await page.evaluate('window.resultDescriptor');
  
  fs.writeFileSync('descriptor.json', JSON.stringify(desc));
  console.log('Descriptor extracted successfully: length ' + desc.length);
  await browser.close();
})();
