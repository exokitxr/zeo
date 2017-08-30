& node\node.exe index.js 2>&1 | tee error-log.txt
if ($LastExitCode) {
  (New-Object -ComObject Wscript.Shell).Popup('Log saved to error-log.txt',0,'Zeo VR Error',16)
}
