function Get-ScriptDirectory {
  Split-Path -parent $PSCommandPath
}

$indexJs = Join-Path (Get-ScriptDirectory) '../index.js'

node "$indexJs" server \
  port="$PORT" \
  siteUrl='https://zeovr.io' \
  hubUrl='https://hub.zeovr.io:8000' \
  dataDirectorySrc='defaults/data' \
  cryptoDirectorySrc='defaults/crypto' \
  installDirectorySrc='installed'
