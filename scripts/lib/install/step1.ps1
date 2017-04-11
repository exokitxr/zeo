if ([bool](([System.Security.Principal.WindowsIdentity]::GetCurrent()).groups -match "S-1-5-32-544")) {
  Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux

  reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /v "AllowDevelopmentWithoutDevLicense" /t REG_DWORD /d "0x1" /f

  LxRun /install

  bash -c "curl https://raw.githubusercontent.com/modulesio/zeo/master/scripts/lib/install/step2.sh | bash"

  mkdir -f "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Zeo VR"
  $shortcut = (New-Object -COM WScript.Shell).CreateShortcut("$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Zeo VR\Zeo VR.lnk")
  $shortcut.TargetPath = "bash"
  $shortcut.Arguments = "-ic 'cd ~/zeo/node_modules/zeo && ./scripts/my.sh'"
  Invoke-WebRequest -Uri https://raw.githubusercontent.com/modulesio/zeo/master/public/favicon.ico -OutFile "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Zeo VR\favicon.ico"
  $shortcut.IconLocation = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\Zeo VR\favicon.ico"
  $shortcut.Save()

  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/modulesio/zeo/master/defaults/crypto/cert/cert.pem" -OutFile $env:temp\cert.pem
  Import-Certificate -FilePath $env:temp\cert.pem -CertStoreLocation Cert:\LocalMachine\Root;
} else {
  echo "This script needs to be run as administrator."
}
