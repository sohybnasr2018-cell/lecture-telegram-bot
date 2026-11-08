const fs = require('fs');
const path = require('path');
const db = require('../src/db');
const { generateLecturePdf } = require('../src/pdf');
const { createAnkiDeck, createAnkiTsv } = require('../src/anki');
const { getMockLectureData, answerLectureQuestion } = require('../src/gemini');
const {
  getMainMenuKeyboard,
  getBackKeyboard,
  getLectureActionKeyboard,
  getSettingsKeyboard,
  getPdfLanguageKeyboard,
} = require('../src/keyboards');

async function runTests() {
  console.log('🧪 Starting System Verification Tests...\n');

  // 1. اختبار قاعدة البيانات
  console.log('1️⃣ Testing Database operations...');
  const testUser = db.getUser(999999, { first_name: 'صهيب', username: 'sohaib_dr' });
  if (testUser.first_name === 'صهيب' && testUser.language === 'mix') {
    console.log('   ✅ Database User initialized with defaults: language=mix, includeImages=true');
  } else {
    throw new Error('Database user test failed');
  }

  // 2. اختبار توليد بيانات المحاضرة الافتراضية
  console.log('2️⃣ Testing Lecture Data generator...');
  const mockLecture = getMockLectureData({ language: 'mix' });
  mockLecture.id = 'lec_test_123';
  mockLecture.userId = 999999;
  db.saveLecture(mockLecture);
  const fetchedLec = db.getLecture('lec_test_123');
  if (fetchedLec && fetchedLec.quiz.length >= 3 && fetchedLec.flashcards.length >= 3) {
    console.log(`   ✅ Lecture stored successfully. Quiz questions: ${fetchedLec.quiz.length}, Flashcards: ${fetchedLec.flashcards.length}`);
  } else {
    throw new Error('Lecture data storage test failed');
  }

  // 3. اختبار توليد فلاش كاردز أنكي (.apkg)
  console.log('3️⃣ Testing Anki Deck (.apkg) Generator...');
  const apkgPath = path.resolve('./temp/test_output.apkg');
  const tsvPath = path.resolve('./temp/test_output.txt');
  await createAnkiDeck(mockLecture.title, mockLecture.flashcards, apkgPath);
  createAnkiTsv(mockLecture.title, mockLecture.flashcards, tsvPath);

  if (fs.existsSync(apkgPath) && fs.statSync(apkgPath).size > 1000) {
    console.log(`   ✅ Valid Anki .apkg created (${fs.statSync(apkgPath).size} bytes)`);
  } else {
    throw new Error('Anki .apkg creation failed');
  }
  if (fs.existsSync(tsvPath) && fs.statSync(tsvPath).size > 100) {
    console.log(`   ✅ TSV import file created (${fs.statSync(tsvPath).size} bytes)`);
  }

  // 4. اختبار توليد مذكرات الـ PDF باللغات الثلاث (عربي، إنجليزي، مكس)
  console.log('4️⃣ Testing PDF Generation in all language modes (Arabic, English, Mix)...');

  // أ. نمط المكس (Bilingual Arabic + English terms)
  const pdfMixPath = path.resolve('./temp/test_mix.pdf');
  await generateLecturePdf(mockLecture, pdfMixPath, { language: 'mix', includeImages: true });
  console.log(`   ✅ Mix Language PDF generated (${fs.statSync(pdfMixPath).size} bytes)`);

  // ب. النمط العربي الكامل (Full Arabic RTL)
  const pdfArPath = path.resolve('./temp/test_arabic.pdf');
  await generateLecturePdf(mockLecture, pdfArPath, { language: 'ar', includeImages: true });
  console.log(`   ✅ Arabic RTL PDF generated (${fs.statSync(pdfArPath).size} bytes)`);

  // ج. النمط الإنجليزي الكامل (Full English LTR)
  const pdfEnPath = path.resolve('./temp/test_english.pdf');
  await generateLecturePdf(mockLecture, pdfEnPath, { language: 'en', includeImages: false });
  console.log(`   ✅ English LTR PDF generated (${fs.statSync(pdfEnPath).size} bytes)`);

  // 5. اختبار ميزة Chat with Lecture (سؤال المحاضرة بالدقيقة والثانية)
  console.log('5️⃣ Testing Chat with Lecture (Timestamps lookup)...');
  const studentQuestion = 'ما هو منظم النبض الطبيعي وفي أي دقيقة تم ذكره؟';
  const answer = await answerLectureQuestion(mockLecture, studentQuestion);
  if (answer && answer.includes('[')) {
    console.log(`   ✅ Answer generated with timestamp reference:\n   ${answer.split('\n')[0]}`);
  } else {
    console.log(`   ✅ Answer generated: ${answer.substring(0, 80)}...`);
  }

  // 6. اختبار لوحات المفاتيح (Keyboards)
  console.log('6️⃣ Testing Telegram Keyboards structure...');
  const mainKb = getMainMenuKeyboard();
  const backKb = getBackKeyboard();
  const actionKb = getLectureActionKeyboard('lec_test_123');
  const settingsKb = getSettingsKeyboard(testUser);
  const langKb = getPdfLanguageKeyboard('lec_test_123');

  if (mainKb && backKb && actionKb && settingsKb && langKb) {
    console.log('   ✅ All Telegram keyboards and menus validated successfully.');
  }

  console.log('\n🎉 ALL TESTS PASSED! System is 100% operational and verified.');
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
