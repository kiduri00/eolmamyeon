# 집핀 Android 앱 (Trusted Web Activity)

https://jaegaebal.alwaysquestions.kr 를 그대로 띄우는 TWA 래퍼입니다. 웹사이트 코드는 건드리지 않습니다.

- packageId: `kr.alwaysquestions.zippin`
- 시작 URL: `https://jaegaebal.alwaysquestions.kr/?src=app`
- fallback: `customtabs` (WebView 금지 — AdSense는 TWA/Custom Tabs 프레임만 허용)
- 알림 위임(notification delegation) 켜짐, Android 13+ POST_NOTIFICATIONS 권한 요청
- 생성 도구: `@bubblewrap/core` 1.27.0 TwaGenerator (설정 원본은 `twa-manifest.json`)
- compileSdk/targetSdk 36, minSdk 24 (androidbrowserhelper 2.7.4 요구), AGP 8.9.1, Gradle 8.11.1, JDK 17 (Temurin)

## 키 (git에 없음)

업로드 키는 저장소 밖에 둡니다. 기본 경로:

```
/home/claude/zippin-keys/zippin-upload.jks        # PKCS12, alias "upload"
/home/claude/zippin-keys/keystore.properties      # storeFile, storePassword, keyAlias, keyPassword
```

다른 위치면 `ZIPPIN_KEYSTORE_PROPERTIES=/path/to/keystore.properties` 환경 변수로 지정합니다.
파일이 없으면 release 빌드는 서명되지 않은 채로 나옵니다. `*.jks`, `*.keystore`, `keystore.properties`는 `.gitignore`에 있습니다.

업로드 키를 잃어버려도 Play App Signing을 쓰면 Play Console에서 업로드 키 재설정을 요청할 수 있습니다. 그래도 백업은 꼭 해 두세요.

## 다시 빌드하기

```sh
export JAVA_HOME=/path/to/jdk17          # JDK 17 정확히
export ANDROID_HOME=/path/to/android-sdk # platforms;android-36, build-tools, platform-tools
cd android
./gradlew --no-daemon bundleRelease assembleRelease
# AAB: app/build/outputs/bundle/release/app-release.aab   (Play 업로드용)
# APK: app/build/outputs/apk/release/app-release.apk      (폰에 직접 설치해 보는 용)
```

`local.properties`(sdk.dir)는 git에 없으므로 ANDROID_HOME을 쓰거나 직접 만듭니다.

## 버전 올리기

Play에 올릴 때마다 `versionCode`는 반드시 이전보다 커야 합니다.

1. `app/build.gradle`의 `versionCode`(정수, +1)와 `versionName`(예: "1.0.1")을 올립니다.
2. `twa-manifest.json`의 `appVersionCode`/`appVersion`도 같이 맞춥니다(나중에 `bubblewrap update`를 쓸 때 기준).

웹 내용만 바뀌면 앱을 다시 낼 필요가 없습니다. 앱 빌드는 색·아이콘·바로가기·권한 같은 래퍼 설정이 바뀔 때만 필요합니다.

## Digital Asset Links (주소창 숨기기)

`https://jaegaebal.alwaysquestions.kr/.well-known/assetlinks.json`에 업로드 키와 **Play App Signing 키** 두 개의 SHA-256을 넣어야 주소창 없이 열립니다.
Play App Signing 지문은 첫 업로드 후 Play Console → 테스트 및 출시 → 설정 → 앱 무결성 → 앱 서명에서 복사합니다.
(이 파일이 사이트에 올라가기 전에는 앱 상단에 주소창(Custom Tab 바)이 보이는 것이 정상입니다.)

## 아이콘

- 런처 아이콘 = Play 아이콘(v5 틴트, `brand_v5/play_icon_512.png`)과 같은 그림. 디자인 노트 `app_kit/design_tokens.md` §7.
  - 적응형(Android 8+, `mipmap-anydpi-v26/ic_launcher.xml`·`ic_launcher_round.xml`): 배경 `@color/ic_launcher_background` = `#F2F5FC`
    (`values/ic_launcher_background.xml`), 전경 `drawable/ic_launcher_foreground.xml`(벡터, 108dp 캔버스에 남색 핀+집 마크 51.5dp,
    Play 아이콘 비율의 94% — 1.0.0 r3에서 원형 마스크가 꽉 차 보이지 않게 6% 축소, 66dp 안전 원 안), 모노크롬 `mipmap-*/ic_launcher_monochrome.png`(Android 13 테마 아이콘, `assets-src/icon-monochrome.svg` 모양).
  - 레거시(Android 7 이하): `mipmap-{mdpi..xxxhdpi}/ic_launcher.png`(둥근 사각) · `ic_launcher_round.png`(원), 48/72/96/144/192px, `#F2F5FC` 바탕.
    mdpi·hdpi는 노란 문을 픽셀 격자에 맞춰 1px 키운 힌팅 버전(r3, 48px에서도 문이 보이게). xhdpi 이상은 Play 아이콘과 같은 그림.
    매니페스트에 `android:roundIcon="@mipmap/ic_launcher_round"`.
  - 다시 그리기: `NODE_PATH=$(npm root -g) node android/assets-src/launcher/render-launcher.js [resDir] [preview.png]`
    (playwright + Chromium). 위 파일을 모두 다시 쓰고 미리보기 시트(마스크 4종·테마 아이콘·레거시)를 만듭니다.
  - **재생성 주의**: bubblewrap은 `icon-maskable-512.png`를 흰 배경에 얹은 `ic_maskable`을 만들고 모노크롬 층·roundIcon이 없습니다.
    `generate.js`는 생성 뒤 이 프로젝트의 런처 리소스를 복사하고 `ic_maskable.png`를 지우고 roundIcon을 넣어 주므로 유지됩니다.
    `bubblewrap update`/`build`(CLI)로 다시 만들었다면 위 파일과 AndroidManifest의 roundIcon을 git에서 되살리세요.
- 스플래시: 사이트의 `icon-512.png`
- 알림(흰색 실루엣): `assets-src/icon-monochrome.svg` → `assets-src/icon-monochrome-512.png`(결과는 `res/drawable-*/ic_notification_icon.png`).
- 바로가기 4개는 각각 다른 아이콘(디자인 킷 `app_kit/png/shortcuts`): `shortcut_0`=지도(map), `shortcut_1`=관심 구역(favorites),
  `shortcut_2`=월간 리포트(report), `shortcut_3`=구역별 페이지(zone). 원본은 `assets-src/shortcut_*_192.png`, SVG는 `assets-src/shortcuts/`.
  `res/drawable-{mdpi..xxxhdpi}/shortcut_N.png` = 48/72/96/144/192px.
- `twa-manifest.json`의 아이콘 주소는 모두 사이트 공개 주소입니다(2026-10-26 사이트 배포 뒤 제공).
  - `monochromeIconUrl` → `https://jaegaebal.alwaysquestions.kr/icon-mono-512.png`
  - 바로가기 `chosenIconUrl` → `/sc-map-192.png`, `/sc-fav-192.png`, `/sc-report-192.png`, `/sc-zone-192.png`
    (`assets-src/shortcut_{map,favorites,report,zone}_192.png`와 바이트까지 같음)
  - `bubblewrap update` 전에 이 주소들이 200으로 열리는지 확인하세요(배포 전에는 404).
  - 주의: 사이트 `/icon-mono-512.png`는 지금 AAB의 알림 아이콘 원본(`assets-src/icon-monochrome-512.png`)과 그림이 조금 다릅니다
    (같은 핀+집 모양, 여백이 더 큼). `bubblewrap update`로 다시 만들면 알림 아이콘이 사이트 그림으로 바뀝니다.
    지금 모양을 그대로 두려면 `generate.js`를 쓰세요(생성은 `assets-src/` 로컬 사본으로 함).
- 재생성 스크립트: `assets-src/generate.js` (@bubblewrap/core로 이 폴더를 다시 만듭니다. 서명 설정·gradle.properties 수정은 다시 적용해야 합니다).

## 스플래시 / 다크 모드

- 스플래시 배경: 밝은 모드 `#FFFFFF`(build.gradle `backgroundColor`), 다크 모드 `#15181D`(`res/values-night/colors.xml`, bubblewrap 템플릿 밖 파일).
- **재생성 주의**: `values-night/colors.xml`(다크 스플래시 `#15181D`, 바로가기 배경 `#2A2E35`)은 손으로 넣은 리소스입니다.
  `twa-manifest.json`에는 이 값을 담을 칸이 없어서 `bubblewrap update`/`bubblewrap build`로 프로젝트를 다시 만들면 사라집니다.
  `assets-src/generate.js`는 이 파일을 다시 써 주므로 그 스크립트로 재생성하면 유지됩니다. 다른 방법으로 재생성했다면 이 파일을 git에서 되살리세요
  (`git checkout android -- android/app/src/main/res/values-night/colors.xml`).
  다크 모드에서 흰 화면이 번쩍이지 않게 합니다. 페이드아웃 300ms(`splashScreenFadeOutDuration`).
- 상태바/내비게이션 바 다크 색: `#15181D`.
