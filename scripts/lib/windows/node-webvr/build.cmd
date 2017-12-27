cd %~dp0

set npm_config_target=1.7.10
set npm_config_arch=x64
set npm_config_target_arch=x64
set npm_config_disturl=https://atom.io/download/electron
set npm_config_runtime=electron
set npm_config_build_from_source=true

npm install --no-package-lock
