@echo off
chcp 65001 >nul
echo ====================================================
echo   تشغيل بوت تفريغ وتلخيص المحاضرات الذكي 🎓
echo ====================================================

if not exist .env (
    echo [!] لم يتم العثور على ملف .env
    echo [i] جاري إنشاء ملف .env من النموذج .env.example...
    copy .env.example .env
    echo [!] يرجى فتح ملف .env وكتابة TELEGRAM_BOT_TOKEN و GEMINI_API_KEY
    pause
    exit /b
)

echo [*] جاري فحص وتشغيل البوت...
npm start
pause
