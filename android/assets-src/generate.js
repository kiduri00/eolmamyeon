// Regenerates the TWA Gradle project with @bubblewrap/core (npm i @bubblewrap/core@1.27.0).
// Before running, download into this folder: manifest.webmanifest, icon-512.png,
// icon-maskable-512.png, icon-192.png from https://jaegaebal.alwaysquestions.kr/ (they are served
// to the generator from a local helper server because bubblewrap's fetch ignores HTTPS_PROXY).
// Usage: node android/assets-src/generate.js /tmp/out   (then diff/copy into android/, and re-apply
// the signingConfigs block in app/build.gradle, minSdk 24, gradle.properties, mavenCentral()).
const path = require('path');
const { TwaManifest, TwaGenerator, ConsoleLog } = require('@bubblewrap/core');
const LOCAL = 'http://127.0.0.1:8765';
const REAL = 'https://jaegaebal.alwaysquestions.kr';
(async () => {
  const http=require('http'),fs=require('fs');
  const srv=http.createServer((q,r)=>{const f=path.join(__dirname,path.basename(q.url.split('?')[0]));if(!fs.existsSync(f)){r.writeHead(404);return r.end();}r.writeHead(200,{'Content-Type':f.endsWith('.png')?'image/png':'application/manifest+json'});r.end(fs.readFileSync(f));});
  await new Promise(ok=>srv.listen(8765,'127.0.0.1',ok));
  const target = process.argv[2];
  const webManifest = JSON.parse(require('fs').readFileSync(path.join(__dirname,'manifest.webmanifest'),'utf8'));
  const base = TwaManifest.fromWebManifestJson(new URL(LOCAL + '/manifest.webmanifest'), webManifest);
  const j = base.toJson();
  Object.assign(j, {
    packageId: 'kr.alwaysquestions.zippin',
    host: 'jaegaebal.alwaysquestions.kr',
    name: '재개픽 - 서울 재개발 지도',
    launcherName: '재개픽',
    startUrl: '/?src=app',
    display: 'standalone',
    orientation: 'default',
    themeColor: '#1F3A87',      // splash-time status bar (brand navy); site theme-color takes over in app mode
    themeColorDark: '#13265E',
    navigationColor: '#FFFFFF',
    navigationColorDark: '#15181D',
    navigationDividerColor: '#FFFFFF',
    navigationDividerColorDark: '#15181D',
    backgroundColor: '#1F3A87', // splash background (brand navy); night = #13265E below
    enableNotifications: true,
    fallbackType: 'customtabs',
    iconUrl: LOCAL + '/icon-512.png',
    maskableIconUrl: LOCAL + '/icon-maskable-512.png',
    monochromeIconUrl: LOCAL + '/icon-monochrome-512.png',
    appVersionCode: 1,
    appVersion: '1.0.0',
    signingKey: { path: '/home/claude/zippin-keys/zippin-upload.jks', alias: 'upload' },
    enableSiteSettingsShortcut: true,
    generatorApp: 'bubblewrap-core-script',
    fullScopeUrl: REAL + '/',
    webManifestUrl: LOCAL + '/manifest.webmanifest',
  });
  // Distinct shortcut icons (design kit app_kit/png/shortcuts, copied into this folder).
  // 1.0.0 r5: the app's shortcuts 3-4 are SPA views (소식 #news, 입주 계산 #planner) instead of the static
  // /report/ and /z/ pages (back closed the app there). The web manifest still lists report/z, so set them here.
  const SC = ['map', 'favorites', 'news', 'planner'];
  const APP_SC = [
    { name: '지도로 보기', shortName: '지도', url: REAL + '/?src=app#map' },
    { name: '관심 구역', shortName: '관심 구역', url: REAL + '/?src=app#favTop' },
    { name: '소식', shortName: '소식', url: REAL + '/?src=app#news' },
    { name: '입주 계산', shortName: '입주 계산', url: REAL + '/?src=app#planner' },
  ];
  j.shortcuts = APP_SC.map((s, i) => ({ ...s, chosenIconUrl: LOCAL + '/shortcut_' + SC[i] + '_192.png' }));
  const tm = new TwaManifest(j);
  const err = tm.validate(); if (err) throw new Error(err);
  await new TwaGenerator().createTwaProject(target, tm, new ConsoleLog('gen'));
  // Save twa-manifest.json with public URLs so `bubblewrap update` works later
  const out = tm.toJson();
  const fix = (u) => (typeof u === 'string' ? u.replace(LOCAL, REAL) : u);
  out.webManifestUrl = REAL + '/manifest.webmanifest';
  out.iconUrl = fix(out.iconUrl); out.maskableIconUrl = fix(out.maskableIconUrl);
  // Monochrome + shortcut icons are served by the site since the 2026-10-26 deploy. The generator above
  // still reads the byte-identical local copies in assets-src/ (bubblewrap's fetch ignores HTTPS_PROXY),
  // but the saved twa-manifest.json points at the public files so `bubblewrap update` works without :8765.
  //   shortcut_map/favorites_192.png == /sc-map|fav-192.png (same md5). /sc-news-192.png and /sc-planner-192.png
  //   are NOT on the site yet (r5): copy assets-src/shortcut_news|planner_192.png there before `bubblewrap update`.
  //   assets-src/icon-monochrome-512.png != /icon-mono-512.png (site mark has more padding; see README)
  out.monochromeIconUrl = REAL + '/icon-mono-512.png';
  const SCPUB = { map: 'map', favorites: 'fav', news: 'news', planner: 'planner' };
  out.shortcuts = (out.shortcuts || []).map((s, i) => ({ ...s, url: fix(s.url), chosenIconUrl: REAL + '/sc-' + SCPUB[SC[i]] + '-192.png' }));
  require('fs').writeFileSync(path.join(target, 'twa-manifest.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
  // Replace any local helper-server URLs that leaked into generated text files
  const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
  for (const f of walk(target)) { if (/\.(png|jar|webp)$/.test(f) || path.basename(f) === 'twa-manifest.json') continue; const t=fs.readFileSync(f,'utf8'); if (t.includes(LOCAL)) { fs.writeFileSync(f, t.split(LOCAL).join(REAL)); console.log('fixed', f); } }
  // Dark splash background (values-night) is not part of the bubblewrap template: a manual resource,
  // written here so a generate.js run keeps it. `bubblewrap update`/`build` (CLI) will NOT recreate it.
  fs.mkdirSync(path.join(target, 'app/src/main/res/values-night'), { recursive: true });
  fs.writeFileSync(path.join(target, 'app/src/main/res/values-night/colors.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="backgroundColor">#13265E</color>\n    <color name="shortcut_background">#2A2E35</color>\n</resources>\n');
  // Launcher icon = Play icon v5 (#F2F5FC + navy mark, design_tokens.md §7). Not expressible in twa-manifest.json
  // (bubblewrap would put the maskable PNG on a white background, with no monochrome layer), so copy the committed
  // resources made by launcher/render-launcher.js from this project and drop bubblewrap's ic_maskable mipmaps.
  const SRC_RES = path.join(__dirname, '../app/src/main/res'), DST_RES = path.join(target, 'app/src/main/res');
  const LAUNCHER = ['values/ic_launcher_background.xml', 'drawable/ic_launcher_foreground.xml',
    'mipmap-anydpi-v26/ic_launcher.xml', 'mipmap-anydpi-v26/ic_launcher_round.xml'];
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    for (const n of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_monochrome']) LAUNCHER.push('mipmap-' + d + '/' + n + '.png');
    fs.rmSync(path.join(DST_RES, 'mipmap-' + d, 'ic_maskable.png'), { force: true });
  }
  for (const f of LAUNCHER) { fs.mkdirSync(path.dirname(path.join(DST_RES, f)), { recursive: true }); fs.copyFileSync(path.join(SRC_RES, f), path.join(DST_RES, f)); }
  // Brand splash (1.0.0 r4): vector @drawable/splash (assets-src/splash/render-splash.js) replaces bubblewrap's
  // splash.png, and LauncherActivity gets Theme.Zippin.Launcher (values-v31 = Android 12+ system splash).
  for (const f of ['drawable/splash.xml', 'values/themes.xml', 'values-v31/themes.xml']) {
    fs.mkdirSync(path.dirname(path.join(DST_RES, f)), { recursive: true }); fs.copyFileSync(path.join(SRC_RES, f), path.join(DST_RES, f)); }
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) fs.rmSync(path.join(DST_RES, 'drawable-' + d, 'splash.png'), { force: true });
  const MF = path.join(target, 'app/src/main/AndroidManifest.xml');
  let mf = fs.readFileSync(MF, 'utf8');
  if (!mf.includes('Theme.Zippin.Launcher')) mf = mf.replace(/(<activity android:name="LauncherActivity"\n)/, '$1            android:theme="@style/Theme.Zippin.Launcher"\n');
  if (!mf.includes('android:theme="@style/Theme.Zippin.Launcher"')) throw new Error('could not set the LauncherActivity theme');
  if (!mf.includes('android:roundIcon')) mf = mf.replace(/( *)android:icon="@mipmap\/ic_launcher"\n/, (m, sp) => m + sp + 'android:roundIcon="@mipmap/ic_launcher_round"\n');
  if (!mf.includes('android:roundIcon="@mipmap/ic_launcher_round"')) throw new Error('could not add roundIcon to AndroidManifest.xml');
  fs.writeFileSync(MF, mf);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
