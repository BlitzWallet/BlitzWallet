#!/bin/sh
# Builds NotificationService/NwcCrypto.swift for macOS against libsecp256k1 and
# runs it over the shared NWC crypto vectors. Uses the pod checkout from
# `pod install` unless SECP256K1_SRC points at a bitcoin-core/secp256k1 tree.
set -e
cd "$(dirname "$0")"
SRC="${SECP256K1_SRC:-../Pods/BlitzSecp256k1}"
OUT="${TMPDIR:-/tmp}/nwc-crypto-check"
rm -rf "$OUT" && mkdir -p "$OUT/module"
clang -O2 -c -DENABLE_MODULE_EXTRAKEYS=1 -DENABLE_MODULE_SCHNORRSIG=1 -DENABLE_MODULE_ECDH=1 \
  -I"$SRC" -I"$SRC/src" "$SRC/src/secp256k1.c" -o "$OUT/secp256k1.o"
clang -O2 -c -I"$SRC" -I"$SRC/src" "$SRC/src/precomputed_ecmult.c" -o "$OUT/ecmult.o"
clang -O2 -c -I"$SRC" -I"$SRC/src" "$SRC/src/precomputed_ecmult_gen.c" -o "$OUT/ecmult_gen.o"
cp "$SRC"/include/secp256k1*.h "$OUT/module/"
cat > "$OUT/module/module.modulemap" <<MAP
module BlitzSecp256k1 {
  header "secp256k1.h"
  header "secp256k1_extrakeys.h"
  header "secp256k1_schnorrsig.h"
  header "secp256k1_ecdh.h"
  export *
}
MAP
swiftc -O -module-cache-path "$OUT/mc" -I "$OUT/module" ../NotificationService/NwcCrypto.swift \
  ../NotificationService/NwcStorage.swift main.swift \
  "$OUT/secp256k1.o" "$OUT/ecmult.o" "$OUT/ecmult_gen.o" -lsqlite3 -o "$OUT/check"
"$OUT/check" ../../android/app/src/test/resources/nwc-crypto-vectors.json "$OUT/storage"
