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

- 런처/스플래시: 사이트의 `icon-512.png`, 적응형: `icon-maskable-512.png`
- 알림(흰색 실루엣): `assets-src/icon-monochrome.svg` → `assets-src/icon-monochrome-512.png`(결과는 `res/drawable-*/ic_notification_icon.png`).
- 바로가기 4개는 각각 다른 아이콘(디자인 킷 `app_kit/png/shortcuts`): `shortcut_0`=지도(map), `shortcut_1`=관심 구역(favorites),
  `shortcut_2`=월간 리포트(report), `shortcut_3`=구역별 페이지(zone). 원본은 `assets-src/shortcut_*_192.png`, SVG는 `assets-src/shortcuts/`.
  `res/drawable-{mdpi..xxxhdpi}/shortcut_N.png` = 48/72/96/144/192px.
- 사이트에는 모노크롬(`/icon-mono-512.png`, `/icon-monochrome-512.png` 둘 다 404)도 바로가기 아이콘도 없습니다.
  그래서 `twa-manifest.json`의 `monochromeIconUrl`과 바로가기 `chosenIconUrl`은 `http://127.0.0.1:8765/…`(= `assets-src/` 폴더)를 가리킵니다.
  `bubblewrap update` 전에 `npx http-server android/assets-src -p 8765`처럼 이 폴더를 8765 포트로 띄우세요. 나중에 사이트에 올리면 그 주소로 바꾸면 됩니다.
- 재생성 스크립트: `assets-src/generate.js` (@bubblewrap/core로 이 폴더를 다시 만듭니다. 서명 설정·gradle.properties 수정은 다시 적용해야 합니다).

## 스플래시 / 다크 모드

- 스플래시 배경: 밝은 모드 `#FFFFFF`(build.gradle `backgroundColor`), 다크 모드 `#15181D`(`res/values-night/colors.xml`, bubblewrap 템플릿 밖 파일).
  다크 모드에서 흰 화면이 번쩍이지 않게 합니다. 페이드아웃 300ms(`splashScreenFadeOutDuration`).
- 상태바/내비게이션 바 다크 색: `#15181D`.
