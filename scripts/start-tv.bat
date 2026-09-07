@echo off
chcp 65001 >nul
setlocal

REM ============================================================
REM  เปิดจอคิวห้องเก็บเงินบนทีวี — เสียงออกเองไม่ต้องแตะจอ
REM
REM  หัวใจอยู่ที่ --autoplay-policy=no-user-gesture-required
REM  ปกติ Chrome จะไม่ยอมให้หน้าเว็บส่งเสียงจนกว่าจะมีคนคลิกก่อน
REM  ทีวีไม่มีเมาส์ไม่มีคีย์บอร์ด จอเลยเงียบตลอด แฟลกนี้ปิดกฎนั้นทิ้ง
REM
REM  --user-data-dir แยกโปรไฟล์ต่างหาก เพราะถ้า Chrome ตัวอื่นเปิดอยู่
REM  Chrome จะไปเปิดแท็บในหน้าต่างเดิมและ "ไม่สนใจแฟลกทั้งหมด" - เสียงจะไม่ออก
REM
REM  วิธีให้เปิดเองตอนเปิดเครื่อง:
REM    กด Win+R พิมพ์ shell:startup กด Enter
REM    แล้วลากไฟล์นี้ไปวาง (หรือสร้าง shortcut) ในโฟลเดอร์ที่เปิดขึ้นมา
REM ============================================================

REM ── แก้ IP ตรงนี้ให้ตรงกับเครื่องที่รัน docker ──
set "URL=http://192.168.200.56:4500"

set "PROFILE=%LOCALAPPDATA%\ppc-tvboard-profile"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if not exist "%CHROME%" (
  echo [ผิดพลาด] หา chrome.exe ไม่เจอ
  echo           ติดตั้ง Google Chrome ก่อน หรือแก้ตัวแปร CHROME ในไฟล์นี้
  pause
  exit /b 1
)

echo เปิดจอคิว: %URL%
echo (ปิดจอด้วย Alt+F4)

start "" "%CHROME%" ^
  --kiosk ^
  --autoplay-policy=no-user-gesture-required ^
  --user-data-dir="%PROFILE%" ^
  --no-first-run ^
  --no-default-browser-check ^
  --disable-session-crashed-bubble ^
  --disable-infobars ^
  --hide-crash-restore-bubble ^
  --disable-features=TranslateUI ^
  --check-for-update-interval=31536000 ^
  "%URL%"
