#!/usr/bin/env bash
# Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214
# Cria credentials.json (fora do git, modo 600) para o EAS assinar os builds com a chave de envio da Play
# (/root/.picagens-android/upload.keystore, a mesma da TWA). Correr à mão uma vez: bash scripts/credenciais-chave-envio.sh
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . /root/.picagens-android/senhas.env; set +a
umask 077
python3 - <<'PY'
import json, os
json.dump({"android": {"keystore": {
    "keystorePath": "/root/.picagens-android/upload.keystore",
    "keystorePassword": os.environ["BUBBLEWRAP_KEYSTORE_PASSWORD"],
    "keyAlias": "upload",
    "keyPassword": os.environ["BUBBLEWRAP_KEY_PASSWORD"],
}}}, open("credentials.json", "w"), indent=2)
PY
git check-ignore -q credentials.json && echo "credentials.json criado (fora do git, 600)"
