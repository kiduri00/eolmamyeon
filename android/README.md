# 재개픽 Android 앱 (Trusted Web Activity)

https://jaegaebal.alwaysquestions.kr 를 그대로 띄우는 TWA 래퍼입니다. 웹사이트 코드는 건드리지 않습니다.

- packageId: `kr.alwaysquestions.jaegaepick`
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

다른 위치면 `JAEGAEPICK_KEYSTORE_PROPERTIES=/path/to/keystore.properties` 환경 변수로 지정합니다(예전 이름 `ZIPPIN_KEYSTORE_PROPERTIES`도 됩니다).
키 폴더·파일 이름은 처음 만든 그대로 둡니다. 패키지를 바꿔도 같은 업로드 키를 씁니다(SHA-256 `CA:7E:87:…:0F:9B`, 아래 assetlinks 참고).
파일이 없으면 release 빌드는 서명되지 않은 채로 나옵니다. `*.jks`, `*.keystore`, `keystore.properties`는 `.gitignore`에 있습니다.

업로드 키를 잃어버려도 Play App Signing을 쓰면 Play Console에서 업로드 키 재설정을 요청할 수 있습니다. 그래도 백업은 꼭 해 두세요.

## 패키지 이름 변경 (1.0.0 jp1)

- 집핀 시절 패키지(`kr.alwaysquestions.zippin`)는 Play 첫 업로드 전에 바꿨습니다(Play App Signing 지문이 아직 없음 = 업로드 전). 첫 업로드부터 `kr.alwaysquestions.jaegaepick`입니다.
- 바꾼 곳: `app/build.gradle`(applicationId·namespace·twaManifest.applicationId), `AndroidManifest.xml` package,
  `java/kr/alwaysquestions/jaegaepick/`(3개 파일 package 선언), `res/xml/shortcuts.xml`(빌드 때 다시 생성),
  `twa-manifest.json` packageId, 런처 테마 이름 `Theme.Jaegaepick.Launcher`, `res/raw/web_app_manifest.json`(사이트 매니페스트 사본).
- 패키지 이름은 Play에 처음 올린 뒤에는 바꿀 수 없습니다.

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
- 스플래시(1.0.0 r4, 브랜드형): 화면 전체 남색(라이트 `#1F3A87`, 다크 `values-night` `#13265E`) + 가운데 흰 핀 마크(집은 바탕색으로 뚫림, 노란 문).
  - 그림 하나(`drawable/splash.xml`, 벡터 240dp, 핀 92dp)를 두 단계에 같이 씁니다.
    Android 12+ 시스템 스플래시(`values-v31/themes.xml`의 `Theme.Jaegaepick.Launcher`, 아이콘 배경도 남색, 160dp 원 안)와
    TWA 스플래시(`SPLASH_IMAGE_DRAWABLE`, 배경 `@color/backgroundColor`, 페이드 300ms). API 24~30은 TWA 스플래시만 보입니다.
  - 상태바: TWA 상태바 색(`themeColor`)을 남색으로 둡니다. 페이지가 검증(Digital Asset Links)되면 Chrome이 사이트의
    `theme-color`(#FFFFFF / #15181D)를 쓰므로 웹이 뜬 뒤에는 예전 색입니다. 검증 실패 상태(assetlinks에 Play 서명 키가 없을 때)에서는
    주소창 툴바와 상태바가 남색으로 남습니다.
  - 내비바: TWA 내비바 색은 기존(#FFFFFF / #15181D) 그대로입니다. Chrome은 웹 쪽 색으로 내비바를 바꾸지 않으므로 남색으로 두면 웹 사용 중에도
    남색이 됩니다. Android 12+ 시스템 스플래시와 Chrome이 edge-to-edge로 그릴 때(Android 15+)는 남색 바탕이 그대로 보입니다.
  - 다시 그리기: `NODE_PATH=$(npm root -g) node android/assets-src/splash/render-splash.js [resDir] [preview.png]`
- 알림(흰색 실루엣): `assets-src/icon-monochrome.svg` → `assets-src/icon-monochrome-512.png`(결과는 `res/drawable-*/ic_notification_icon.png`).
- 바로가기 4개는 각각 다른 아이콘(디자인 킷 `app_kit/png/shortcuts`): `shortcut_0`=지도(map), `shortcut_1`=관심 구역(favorites),
  `shortcut_2`=소식(news, `/?src=app#news`), `shortcut_3`=입주 계산(planner, `/?src=app#planner`). 원본은 `assets-src/shortcut_*_192.png`, SVG는 `assets-src/shortcuts/`.
  `res/drawable-{mdpi..xxxhdpi}/shortcut_N.png` = 48/72/96/144/192px.
  - 1.0.0 r5: 예전 3·4번(월간 리포트 `/report/`, 구역별 페이지 `/z/`)은 정적 페이지라 뒤로 한 번에 앱이 닫혀서 SPA 화면으로 바꿨습니다.
    웹 매니페스트(`public/manifest.webmanifest`)의 shortcuts는 아직 report/z이므로 `generate.js`가 앱용 목록을 직접 넣습니다.
- `twa-manifest.json`의 아이콘 주소는 모두 사이트 공개 주소입니다(1.0.0 jp1, 재개픽 v7 아이콘).
  - `iconUrl` → `/icons/icon-512.png`, `maskableIconUrl` → `/icons/icon-maskable-512.png`, `monochromeIconUrl` → `/icons/icon-monochrome-512.png`
    (사이트의 옛 `/icon-512.png`·`/icon-maskable-512.png`·`/icon-mono-512.png`는 이전 마크라 쓰지 않습니다.)
  - 바로가기 `chosenIconUrl` → `/sc-map-192.png`, `/sc-fav-192.png`, `/sc-news-192.png`, `/sc-planner-192.png`
  - `/icons/*`는 리뉴얼 배포 뒤에 라이브에 생깁니다. `bubblewrap update` 전에 이 주소들이 200으로 열리는지 확인하세요.
  - 런처·스플래시·알림 아이콘은 이미 v7 리소스로 커밋돼 있습니다. `bubblewrap update`로 다시 만들면 이 리소스가 덮어써지므로
    `generate.js`를 쓰거나 git에서 되살리세요.
- 재생성 스크립트: `assets-src/generate.js` (@bubblewrap/core로 이 폴더를 다시 만듭니다. 서명 설정·gradle.properties 수정은 다시 적용해야 합니다).

## 스플래시 / 다크 모드

- 스플래시 배경: 밝은 모드 `#FFFFFF`(build.gradle `backgroundColor`), 다크 모드 `#15181D`(`res/values-night/colors.xml`, bubblewrap 템플릿 밖 파일).
- **재생성 주의**: `values-night/colors.xml`(다크 스플래시 `#15181D`, 바로가기 배경 `#2A2E35`)은 손으로 넣은 리소스입니다.
  `twa-manifest.json`에는 이 값을 담을 칸이 없어서 `bubblewrap update`/`bubblewrap build`로 프로젝트를 다시 만들면 사라집니다.
  `assets-src/generate.js`는 이 파일을 다시 써 주므로 그 스크립트로 재생성하면 유지됩니다. 다른 방법으로 재생성했다면 이 파일을 git에서 되살리세요
  (`git checkout android -- android/app/src/main/res/values-night/colors.xml`).
  다크 모드에서 흰 화면이 번쩍이지 않게 합니다. 페이드아웃 300ms(`splashScreenFadeOutDuration`).
- 상태바/내비게이션 바 다크 색: `#15181D`.
