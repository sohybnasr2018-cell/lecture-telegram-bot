@echo off
chcp 65001 >nul
echo ========================================================
echo       رفع ملفات البوت إلى مستودع GitHub تلقائياً 🚀
echo ========================================================
echo.
echo [*] المستودع المستهدف: sohybnasr2018-cell/lecture-telegram-bot
echo.

git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/sohybnasr2018-cell/lecture-telegram-bot.git

echo [*] جاري رفع الملفات إلى الفرع main في GitHub...
git push -u origin main

echo.
echo ========================================================
echo   إذا ظهر لك خطأ في الرفع، يرجى تسجيل الدخول إلى GitHub
echo ========================================================
pause
