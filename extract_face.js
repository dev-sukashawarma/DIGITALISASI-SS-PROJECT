import fs from 'fs';
import { Human } from '@vladmandic/human';

async function extractFace() {
  const human = new Human({
    modelBasePath: 'file://' + process.cwd() + '/apps/absensi/public/models',
    backend: 'wasm', // or cpu
    debug: false,
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

  const buffer = fs.readFileSync('C:/Users/Creator MPB/.gemini/antigravity/brain/d5714403-fa62-4e45-85fe-fa36bc4e286d/.user_uploaded/media__1785397559232.png');
  
  // @vladmandic/human node helper
  const tensor = human.tf.node.decodeImage(buffer, 3);
  const result = await human.detect(tensor);
  
  if (result.face && result.face.length > 0) {
    const descriptor = result.face[0].embedding;
    console.log(JSON.stringify(descriptor));
  } else {
    console.error('No face detected');
  }
}

extractFace().catch(console.error);
