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
    name: '집핀 - 서울 재개발 지도',
    launcherName: '집핀',
    startUrl: '/?src=app',
    display: 'standalone',
    orientation: 'default',
    themeColor: '#FFFFFF',
    themeColorDark: '#15181D',
    navigationColor: '#FFFFFF',
    navigationColorDark: '#15181D',
    navigationDividerColor: '#FFFFFF',
    navigationDividerColorDark: '#15181D',
    backgroundColor: '#FFFFFF',
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
  const tm = new TwaManifest(j);
  const err = tm.validate(); if (err) throw new Error(err);
  await new TwaGenerator().createTwaProject(target, tm, new ConsoleLog('gen'));
  // Save twa-manifest.json with public URLs so `bubblewrap update` works later
  const out = tm.toJson();
  const fix = (u) => (typeof u === 'string' ? u.replace(LOCAL, REAL) : u);
  out.webManifestUrl = REAL + '/manifest.webmanifest';
  out.iconUrl = fix(out.iconUrl); out.maskableIconUrl = fix(out.maskableIconUrl);
  out.monochromeIconUrl = REAL + '/icon-monochrome-512.png';  // NOTE: not on the site yet; local copy in android/assets-src/
  out.shortcuts = (out.shortcuts || []).map(s => ({ ...s, url: fix(s.url), chosenIconUrl: fix(s.chosenIconUrl), chosenMaskableIconUrl: fix(s.chosenMaskableIconUrl), chosenMonochromeIconUrl: fix(s.chosenMonochromeIconUrl) }));
  require('fs').writeFileSync(path.join(target, 'twa-manifest.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
  // Replace any local helper-server URLs that leaked into generated text files
  const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
  for (const f of walk(target)) { if (/\.(png|jar|webp)$/.test(f)) continue; const t=fs.readFileSync(f,'utf8'); if (t.includes(LOCAL)) { fs.writeFileSync(f, t.split(LOCAL).join(REAL)); console.log('fixed', f); } }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
