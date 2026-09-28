# bitcoin-core/secp256k1 (upstream, pinned) with only the modules the NWC
# extension uses: extrakeys + schnorrsig (BIP-340) and ecdh.
Pod::Spec.new do |s|
  s.name = 'BlitzSecp256k1'
  s.version = '0.7.0'
  s.summary = 'libsecp256k1 for the Blitz NWC notification service extension'
  s.homepage = 'https://github.com/bitcoin-core/secp256k1'
  s.license = { :type => 'MIT', :file => 'COPYING' }
  s.author = 'Bitcoin Core developers'
  s.source = { :git => 'https://github.com/bitcoin-core/secp256k1.git', :tag => "v#{s.version}" }
  s.ios.deployment_target = '15.1'
  s.source_files = [
    'src/secp256k1.c', 'src/precomputed_ecmult.c', 'src/precomputed_ecmult_gen.c',
    'src/*.h', 'src/modules/{extrakeys,schnorrsig,ecdh}/*.h', 'include/*.h',
  ]
  s.public_header_files = [
    'include/secp256k1.h', 'include/secp256k1_extrakeys.h', 'include/secp256k1_schnorrsig.h',
    'include/secp256k1_ecdh.h',
  ]
  s.compiler_flags = '-DENABLE_MODULE_EXTRAKEYS=1 -DENABLE_MODULE_SCHNORRSIG=1 -DENABLE_MODULE_ECDH=1 -Wno-unused-function -Wno-shorten-64-to-32 -Wno-conditional-uninitialized'
  s.pod_target_xcconfig = { 'HEADER_SEARCH_PATHS' => '"${PODS_TARGET_SRCROOT}" "${PODS_TARGET_SRCROOT}/src"' }
end
