# Prebuilt Breez Spark SDK (Rust) from the official release of
# breez/breez-sdk-spark-swift. Their published podspecs are not kept current,
# so this pins the release artifact directly.
Pod::Spec.new do |s|
  s.name = 'breez_sdk_sparkFFI'
  s.version = '0.26.0'
  s.summary = 'Low-level bindings to the Breez Spark SDK Rust API'
  s.homepage = 'https://breez.technology'
  s.license = { :type => 'MIT' }
  s.author = { 'Breez' => 'contact@breez.technology' }
  s.source = { :http => "https://github.com/breez/breez-sdk-spark-swift/releases/download/#{s.version}/breez_sdk_sparkFFI.xcframework.zip",
               :sha256 => 'ce99caf704cc536626325bfd02e1d6d6b080fd02e9601bd92c9a0e6c66583c44' }
  s.ios.deployment_target = '13.0'
  s.vendored_frameworks = 'breez_sdk_sparkFFI.xcframework'
end
