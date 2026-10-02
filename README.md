<!-- Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214 -->
# Picagens — apps React Native (Expo)

Apps da Google Play do Picagens.pt, em React Native com Expo (SDK 57, TypeScript). Uma pasta por app:

| App | Pasta | Package Android | Estado |
|---|---|---|---|
| Picagens Quiosque (tablet partilhado na obra) | `apps/quiosque` | `pt.picagens.quiosque` | 1.0.0 — PIN + foto de confirmação, fila offline, admin, licença |
| Picagens Mobile (telemóvel do colaborador) | `apps/mobile` (a criar) | `pt.picagens.colaborador` | hoje TWA da PWA; a versão React Native entra como atualização do mesmo package |

API e decisões: repo `picagens-saas-v2` — doc 43 (APIs `/api/quiosque/v1` e `/api/v1/mobile`), doc 44 (UI,
protótipo v4, §14: foto sem reconhecimento facial), doc 47 (esta app e como publicar).

## Regras

- Código: identificadores em inglês, textos da interface em português de Portugal, cabeçalho Cieslak Sistemas.
- `android/` e `ios/` são gerados (`npx expo prebuild`) — nunca se editam à mão nem se commitam; mudanças
  nativas vão para `app.json` ou para um config plugin em `plugins/`.
- Dependências sempre com `npx expo install <pacote>` (versões compatíveis com o SDK).
- Antes de dar uma tarefa por feita: `npx tsc --noEmit` e `npx expo-doctor`.
- Nada de reconhecimento facial nem comparação de fotos (dado biométrico, RGPD art. 9.º).

## Build de release (servidor, sem EAS)

Ferramentas em `/opt/android-build` (JDK 17 + Android SDK). Chave de envio em `/root/.picagens-android/`
(fora do repo; a chave final fica com a Google — Play App Signing).

```bash
cd apps/quiosque
export ANDROID_HOME=/opt/android-build/sdk JAVA_HOME=/opt/android-build/jdk
npx expo prebuild --platform android --clean
set -a; . /root/.picagens-android/senhas.env; set +a
export PICAGENS_UPLOAD_STORE_FILE=/root/.picagens-android/upload.keystore PICAGENS_UPLOAD_KEY_ALIAS=upload \
       PICAGENS_UPLOAD_STORE_PASSWORD="$BUBBLEWRAP_KEYSTORE_PASSWORD" PICAGENS_UPLOAD_KEY_PASSWORD="$BUBBLEWRAP_KEY_PASSWORD"
cd android && ./gradlew --no-daemon -PreactNativeArchitectures=arm64-v8a,armeabi-v7a bundleRelease assembleRelease
```

Saída: `android/app/build/outputs/bundle/release/app-release.aab` (Play Console) e
`android/app/build/outputs/apk/release/app-release.apk` (instalar direto num tablet de teste).
Nova versão: subir `version` e `android.versionCode` em `app.json`.
