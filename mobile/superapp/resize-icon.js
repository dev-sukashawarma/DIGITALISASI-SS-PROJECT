const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

async function processIcons() {
  const assetsDir = path.join(__dirname, 'assets');
  const iconPath = path.join(assetsDir, 'icon.png');
  const adaptiveIconPath = path.join(assetsDir, 'adaptive-icon.png');
  const backupIconPath = path.join(assetsDir, 'icon-original-backup.png');
  const backupAdaptiveIconPath = path.join(assetsDir, 'adaptive-icon-original-backup.png');

  // Back up original files if backups don't exist yet
  if (!fs.existsSync(backupIconPath)) {
    fs.copyFileSync(iconPath, backupIconPath);
    console.log('Backed up original icon.png to icon-original-backup.png');
  }
  if (!fs.existsSync(backupAdaptiveIconPath)) {
    fs.copyFileSync(adaptiveIconPath, backupAdaptiveIconPath);
    console.log('Backed up original adaptive-icon.png to adaptive-icon-original-backup.png');
  }

  // 1. Process icon.png (App Icon)
  console.log('Processing icon.png...');
  const iconImg = await Jimp.read(backupIconPath);
  
  // Autocrop transparent borders to isolate logo artwork
  iconImg.autocrop();
  
  // Resize logo to fit inside a 70% safe zone of 1024x1024 (which is 716x716)
  const targetIconSize = 716;
  const aspectIcon = iconImg.width / iconImg.height;
  let newIconW, newIconH;
  if (aspectIcon >= 1) {
    newIconW = targetIconSize;
    newIconH = Math.round(targetIconSize / aspectIcon);
  } else {
    newIconH = targetIconSize;
    newIconW = Math.round(targetIconSize * aspectIcon);
  }
  
  iconImg.resize({ w: newIconW, h: newIconH });
  
  // Create transparent background canvas
  const newIcon = new Jimp({
    width: 1024,
    height: 1024,
    color: 0x00000000
  });
  
  const iconX = Math.round((1024 - newIconW) / 2);
  const iconY = Math.round((1024 - newIconH) / 2);
  newIcon.composite(iconImg, iconX, iconY);
  
  await newIcon.write(iconPath);
  console.log('Saved resized icon.png');

  // 2. Process adaptive-icon.png (Android foreground image)
  console.log('Processing adaptive-icon.png...');
  const adaptiveImg = await Jimp.read(backupAdaptiveIconPath);
  
  // Autocrop transparent borders to isolate logo artwork
  adaptiveImg.autocrop();
  
  // Resize logo to fit inside the Android adaptive icon safe zone (60% of 1024x1024 = 614x614)
  // This guarantees it will NEVER be cropped by any squircle/circle masks on Android!
  const targetAdaptiveSize = 614;
  
  const aspectAdaptive = adaptiveImg.width / adaptiveImg.height;
  let newAdaptiveW, newAdaptiveH;
  if (aspectAdaptive >= 1) {
    newAdaptiveW = targetAdaptiveSize;
    newAdaptiveH = Math.round(targetAdaptiveSize / aspectAdaptive);
  } else {
    newAdaptiveH = targetAdaptiveSize;
    newAdaptiveW = Math.round(targetAdaptiveSize * aspectAdaptive);
  }
  
  adaptiveImg.resize({ w: newAdaptiveW, h: newAdaptiveH });
  
  // Create transparent background canvas (Android adaptive icon foreground MUST have a transparent background)
  const newAdaptive = new Jimp({
    width: 1024,
    height: 1024,
    color: 0x00000000
  });
  
  const adaptiveX = Math.round((1024 - newAdaptiveW) / 2);
  const adaptiveY = Math.round((1024 - newAdaptiveH) / 2);
  newAdaptive.composite(adaptiveImg, adaptiveX, adaptiveY);
  
  await newAdaptive.write(adaptiveIconPath);
  console.log('Saved resized adaptive-icon.png');
  // 3. Process splash.png (Splash Screen Image)
  console.log('Processing splash.png...');
  const splashPath = path.join(assetsDir, 'splash.png');
  
  // We use the icon-original-backup.png (which contains the mascot) 
  // as the source for the splash screen artwork, because the original splash.png 
  // might just be the default Expo image without the mascot!
  if (fs.existsSync(backupIconPath)) {
    const splashImg = await Jimp.read(backupIconPath);
    splashImg.autocrop();
    
    // Expo splash screen standard size: 1242x2436
    // Safe zone for logo inside splash screen is usually around 500-600px wide for a clean look
    const targetSplashSize = 600;
    const aspectSplash = splashImg.width / splashImg.height;
    let newSplashW, newSplashH;
    if (aspectSplash >= 1) {
      newSplashW = targetSplashSize;
      newSplashH = Math.round(targetSplashSize / aspectSplash);
    } else {
      newSplashH = targetSplashSize;
      newSplashW = Math.round(targetSplashSize * aspectSplash);
    }
    
    splashImg.resize({ w: newSplashW, h: newSplashH });
    
    const newSplash = new Jimp({
      width: 1242,
      height: 2436,
      color: 0xFFFFFFFF // Use solid white background for splash screen to match the React Native View!
    });
    
    const splashX = Math.round((1242 - newSplashW) / 2);
    const splashY = Math.round((2436 - newSplashH) / 2);
    newSplash.composite(splashImg, splashX, splashY);
    
    await newSplash.write(splashPath);
    console.log('Saved resized splash.png using mascot logo!');
  } else {
    console.warn('Backup icon not found, cannot generate mascot splash!');
  }
}

processIcons().catch(err => {
  console.error('Error processing icons:', err);
});
