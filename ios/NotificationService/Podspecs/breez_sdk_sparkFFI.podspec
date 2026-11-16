# Prebuilt Breez Spark SDK (Rust) from the official release of
# breez/breez-sdk-spark-swift. Their published podspecs are not kept current,
# so this pins the release artifact directly.
Pod::Spec.new do |s|
  s.name = 'breez_sdk_sparkFFI'
  s.version = '0.28.4'
  s.summary = 'Low-level bindings to the Breez Spark SDK Rust API'
  s.homepage = 'https://breez.technology'
  s.license = { :type => 'MIT' }
  s.author = { 'Breez' => 'contact@breez.technology' }
  s.source = { :http => "https://github.com/breez/breez-sdk-spark-swift/releases/download/#{s.version}/breez_sdk_sparkFFI.xcframework.zip",
               :sha256 => '6871e1d43040da1db818068910d164ba6b1ececca6f5c81e54e03fea2470b2ff' }
  s.ios.deployment_target = '13.0'
  s.vendored_frameworks = 'breez_sdk_sparkFFI.xcframework'
end
