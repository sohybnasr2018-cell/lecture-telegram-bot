// نقطة الدخول الرئيسية للبوت في السيرفرات السحابية
const { startBot } = require('./src/bot.js');

startBot().catch((err) => {
  console.error('Fatal bot launch error:', err);
  process.exit(1);
});
