import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
const symbol = `<g fill="none" stroke="#f4f4df" stroke-width="27" stroke-linecap="round"><ellipse cx="205" cy="258" rx="60" ry="77" transform="rotate(27 205 258)"/><ellipse cx="300" cy="258" rx="60" ry="77" transform="rotate(27 300 258)"/></g><circle cx="365" cy="158" r="17" fill="#d1b269"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#286e55"/>${symbol}</svg>`;
mkdirSync("store/assets", { recursive: true });
writeFileSync("public/icon.svg", svg);
await sharp(Buffer.from(svg)).png().toFile("store/assets/icon-512.png");
for (const [density, size] of Object.entries({
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
})) {
  const dir = `android/app/src/main/res/mipmap-${density}`;
  mkdirSync(dir, { recursive: true });
  for (const name of [
    "ic_launcher",
    "ic_launcher_round",
    "ic_launcher_foreground",
  ])
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(`${dir}/${name}.png`);
}
const vector = `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="512" android:viewportHeight="512"><path android:fillColor="#00000000" android:strokeColor="#f4f4df" android:strokeWidth="24" android:pathData="M250,200 C195,151 130,217 156,285 C185,359 246,313 259,257 C273,195 318,164 349,217 C395,301 315,354 274,302"/><path android:fillColor="#d1b269" android:pathData="M353,159 a15,15 0,1 0,30 0 a15,15 0,1 0,-30 0"/></vector>`;
writeFileSync(
  "android/app/src/main/res/drawable/ic_loop_foreground.xml",
  vector,
);
mkdirSync("android/app/src/main/res/mipmap-anydpi-v26", { recursive: true });
for (const name of ["ic_launcher", "ic_launcher_round"])
  writeFileSync(
    `android/app/src/main/res/mipmap-anydpi-v26/${name}.xml`,
    `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/loop_background"/><foreground android:drawable="@drawable/ic_loop_foreground"/><monochrome android:drawable="@drawable/ic_loop_foreground"/></adaptive-icon>`,
  );
writeFileSync(
  "android/app/src/main/res/values/loop_colors.xml",
  '<resources><color name="loop_background">#286e55</color></resources>',
);
const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500"><rect width="1024" height="500" fill="#e9eddf"/><circle cx="835" cy="245" r="178" fill="none" stroke="#cad4b9"/><circle cx="835" cy="245" r="128" fill="none" stroke="#cad4b9" stroke-dasharray="5 10"/><rect x="74" y="88" width="72" height="72" rx="19" fill="#286e55"/><g transform="translate(74 88) scale(.14)">${symbol}</g><text x="74" y="242" font-family="sans-serif" font-size="62" font-weight="bold" fill="#2b5c42">Loop Chat</text><text x="77" y="301" font-family="sans-serif" font-size="28" fill="#6f8260">Your people. Just a message away.</text><text x="77" y="413" font-family="sans-serif" font-size="16" fill="#829274">NOVAPULSE DIGITAL LLC</text><rect x="692" y="162" width="235" height="81" rx="18" fill="#fffef5" transform="rotate(-7 692 162)"/><text x="721" y="207" font-family="sans-serif" font-size="24" fill="#436343">Hey, you.</text><rect x="736" y="272" width="216" height="78" rx="18" fill="#286e55" transform="rotate(5 736 272)"/><text x="757" y="323" font-family="sans-serif" font-size="22" fill="#ffffed">A little closer.</text></svg>`;
await sharp(Buffer.from(feature))
  .png()
  .toFile("store/assets/feature-1024x500.png");
console.log("Generated Android launcher icons and Google Play artwork.");
