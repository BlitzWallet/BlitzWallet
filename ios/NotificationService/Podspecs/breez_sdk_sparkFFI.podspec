# Prebuilt Breez Spark SDK (Rust) from the official release of
# breez/breez-sdk-spark-swift. Their published podspecs are not kept current,
# so this pins the release artifact directly.
Pod::Spec.new do |s|
  s.name = 'breez_sdk_sparkFFI'
  s.version = '0.28.0'
  s.summary = 'Low-level bindings to the Breez Spark SDK Rust API'
  s.homepage = 'https://breez.technology'
  s.license = { :type => 'MIT' }
  s.author = { 'Breez' => 'contact@breez.technology' }
  s.source = { :http => "https://github.com/breez/breez-sdk-spark-swift/releases/download/#{s.version}/breez_sdk_sparkFFI.xcframework.zip",
               :sha256 => '5c6875bb6006934466f3acce9c11191be67a9a25147d1fa427d7867873a663af' }
  s.ios.deployment_target = '13.0'
  s.vendored_frameworks = 'breez_sdk_sparkFFI.xcframework'
end
