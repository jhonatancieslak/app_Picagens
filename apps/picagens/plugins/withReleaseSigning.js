// Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
// Assinatura do build de release com a chave de envio da Play (Play App Signing guarda a chave final).
// Caminho, alias e senhas vêm do ambiente na altura do build — nunca ficam no repositório:
//   PICAGENS_UPLOAD_STORE_FILE, PICAGENS_UPLOAD_KEY_ALIAS, PICAGENS_UPLOAD_STORE_PASSWORD, PICAGENS_UPLOAD_KEY_PASSWORD
// Sem estas variáveis o release fica assinado com a chave de debug (só para testes internos).
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// picagens-release-signing';

const SIGNING_CONFIG = `
        release { ${MARKER}
            if (System.getenv('PICAGENS_UPLOAD_STORE_FILE')) {
                storeFile file(System.getenv('PICAGENS_UPLOAD_STORE_FILE'))
                storePassword System.getenv('PICAGENS_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('PICAGENS_UPLOAD_KEY_ALIAS') ?: 'upload'
                keyPassword System.getenv('PICAGENS_UPLOAD_KEY_PASSWORD')
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes(MARKER)) return mod;
    gradle = gradle.replace(/signingConfigs \{(\s*debug \{[^}]*\})/, (match) => `${match}${SIGNING_CONFIG}`);
    gradle = gradle.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release',
    );
    mod.modResults.contents = gradle;
    return mod;
  });
};
