# Swift bindings from the official breez/breez-sdk-spark-swift release (same
# version as breez_sdk_sparkFFI). Passkey helpers are left out: they need an
# ObjC module the extension does not use.
Pod::Spec.new do |s|
  s.name = 'BreezSdkSpark'
  s.version = '0.28.4'
  s.summary = 'Swift bindings to the Breez Spark SDK'
  s.homepage = 'https://breez.technology'
  s.license = { :type => 'MIT' }
  s.author = { 'Breez' => 'contact@breez.technology' }
  # Pinned by commit (tag 0.28.4 -> 51716bec): a moved tag must not change the
  # Swift compiled into the seed-holding extension.
  s.source = { :git => 'https://github.com/breez/breez-sdk-spark-swift.git', :commit => '51716bec252dcab6eabd0303c0b2afbf41dd8f3f' }
  s.ios.deployment_target = '13.0'
  s.swift_version = '5.0'
  s.source_files = ['Sources/BreezSdkSpark/breez_sdk_spark.swift', 'Sources/BreezSdkSpark/breez_sdk_spark_bindings.swift']
  s.static_framework = true
  s.dependency 'breez_sdk_sparkFFI', s.version.to_s
  s.dependency 'Swift-BigInt', '~> 2.4'
end
