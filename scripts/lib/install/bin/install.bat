REM switch to script directory
cd /d %~dp0

REM install WSL
REM https://github.com/alwsl/alwsl/blob/master/alwsl.bat
FOR /F "tokens=3,* skip=2" %%L IN ('reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /v "AllowDevelopmentWithoutDevLicense"') DO (
  if not "%%L" == "0x1" (
    reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /v "AllowDevelopmentWithoutDevLicense" /t REG_DWORD /d "0x1"
  )
)
lxrun /install /y
lxrun /setdefaultuser root /y

REM install root certificate
powershell -c 'Import-Certificate -FilePath scripts/lib/install/crypto/cert.pem -CertStoreLocation Cert:\LocalMachine\Root'

REM install packages
bash -c "dpkg -i pkg/*.deb"

REM unpack symlinks
bash -c "./scripts/lib/install/symlink/unpack-symlinks.sh <symlinks.txt && rm -Rf symlinks.txt"
