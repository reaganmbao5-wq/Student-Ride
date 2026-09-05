// scripts/copy-apk.js
const fs = require('fs');
const path = require('path');

const candidates = [
    path.join(__dirname, '../frontend/android/app/build/outputs/apk/release/app-release.apk'),
    path.join(__dirname, '../frontend/android/app/build/outputs/apk/debug/app-debug.apk'),
    path.join(__dirname, '../JRide-release-v2.1.2.apk'),
    path.join(__dirname, '../app-debug-885a0b1.apk')
];

const src = candidates.find(p => fs.existsSync(p));
const destDir = path.join(__dirname, '../backend/downloads');
const dest = path.join(destDir, 'jaey-ride.apk');

if (src && fs.existsSync(src)) {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
    const sizeMb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
    console.log('✅ Copied APK (' + src + ') -> backend/downloads/jaey-ride.apk (' + sizeMb + ' MB)');
} else {
    console.warn('⚠️ No built APK found in search paths.');
}
