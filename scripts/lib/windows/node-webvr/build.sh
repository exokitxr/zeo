#!/bin/bash

export npm_config_target=1.7.9
export npm_config_arch=x64
export npm_config_target_arch=x64
export npm_config_disturl=https://atom.io/download/electron
export npm_config_runtime=electron
export npm_config_build_from_source=true

npm install --no-package-lock
