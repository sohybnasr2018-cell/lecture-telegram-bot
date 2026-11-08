const path = require('path');
const fs = require('fs');
require('dotenv').config();

// دعم قائمة مفاتيح مجانية متعددة للتدوير التلقائي (Load Balancing & Auto-rotation)
const geminiKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

const groqKeys = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

const config = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  aiProvider: process.env.AI_PROVIDER || 'gemini', // 'gemini' أو 'groq'
  geminiKeys: geminiKeys,
  geminiApiKey: geminiKeys[0] || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  groqKeys: groqKeys,
  groqApiKey: groqKeys[0] || '',
  tempDir: path.resolve(process.env.TEMP_DIR || './temp'),
  dataDir: path.resolve('./data'),
  telegramApiRoot: process.env.TELEGRAM_API_ROOT || undefined,
};

// التأكد من وجود مجلدات العمل
if (!fs.existsSync(config.tempDir)) {
  fs.mkdirSync(config.tempDir, { recursive: true });
}
if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

module.exports = config;
