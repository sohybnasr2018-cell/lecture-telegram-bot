const { Keyboard, InlineKeyboard } = require('grammy');

// القائمة الرئيسية (مطابقة للصورة 1 تماماً)
function getMainMenuKeyboard() {
  return new Keyboard()
    .text('🎙️ تفريغ محاضرة')
    .row()
    .text('🖼️ صور على المحاضرة')
    .text('🤝 شارك البوت')
    .row()
    .text('⚙️ الإعدادات')
    .resized();
}

// زر الرجوع للقائمة الرئيسية (مطابق للصورة 2)
function getBackKeyboard() {
  return new Keyboard()
    .text('🔙 القائمة الرئيسية')
    .resized();
}

// لوحة تحكم المحاضرة (بعد رفع وتحليل الريكورد)
function getLectureActionKeyboard(lectureId) {
  return new InlineKeyboard()
    .text('📄 إنشاء مذكرة PDF (اختر اللغة)', `choose_pdf_lang_${lectureId}`)
    .row()
    .text('❓ كويز تفاعلي (اختر اللغة)', `choose_quiz_lang_${lectureId}`)
    .text('🗂️ بطاقات أنكي (اختر اللغة)', `choose_anki_lang_${lectureId}`)
    .row()
    .text('🎯 أسئلة وتنبيهات الدكتور (دقيقة جداً)', `choose_doc_lang_${lectureId}`)
    .row()
    .text('💬 اسأل المحاضرة بالدقيقة والثانية [MM:SS]', `chat_${lectureId}`)
    .row()
    .text('🔙 القائمة الرئيسية', 'back_to_main');
}

// أزرار اختيار اللغة الصريحة لمذكرة الـ PDF
function getPdfLanguageSelectionKeyboard(lectureId) {
  return new InlineKeyboard()
    .text('🇪🇬 باللغة العربية', `create_pdf_${lectureId}_ar`)
    .row()
    .text('🇬🇧 باللغة الإنجليزية (English)', `create_pdf_${lectureId}_en`)
    .row()
    .text('🔄 مكس (شرح عربي + مصطلحات إنجليزي)', `create_pdf_${lectureId}_mix`)
    .row()
    .text('🔙 العودة للوحة المحاضرة', `back_lecture_${lectureId}`);
}

// أزرار اختيار اللغة للكويز التفاعلي
function getQuizLanguageSelectionKeyboard(lectureId) {
  return new InlineKeyboard()
    .text('🇪🇬 كويز باللغة العربية', `start_quiz_${lectureId}_ar`)
    .row()
    .text('🇬🇧 Quiz in English', `start_quiz_${lectureId}_en`)
    .row()
    .text('🔄 كويز مكس (عربي بمصطلحات إنجليزية)', `start_quiz_${lectureId}_mix`)
    .row()
    .text('🔙 العودة للوحة المحاضرة', `back_lecture_${lectureId}`);
}

// أزرار اختيار اللغة لبطاقات أنكي
function getAnkiLanguageSelectionKeyboard(lectureId) {
  return new InlineKeyboard()
    .text('🇪🇬 بطاقات بالعربية', `gen_anki_${lectureId}_ar`)
    .row()
    .text('🇬🇧 Cards in English', `gen_anki_${lectureId}_en`)
    .row()
    .text('🔄 بطاقات مكس (سؤال/شرح عربي ومصطلحات)', `gen_anki_${lectureId}_mix`)
    .row()
    .text('🔙 العودة للوحة المحاضرة', `back_lecture_${lectureId}`);
}

// أزرار اختيار اللغة لتنبيهات وأسئلة الدكتور
function getDoctorNotesLanguageSelectionKeyboard(lectureId) {
  return new InlineKeyboard()
    .text('🇪🇬 عرض بالعربية', `show_doc_notes_${lectureId}_ar`)
    .row()
    .text('🇬🇧 Show in English', `show_doc_notes_${lectureId}_en`)
    .row()
    .text('🔄 عرض مكس (عربي مع مصطلحات إنجليزية)', `show_doc_notes_${lectureId}_mix`)
    .row()
    .text('🔙 العودة للوحة المحاضرة', `back_lecture_${lectureId}`);
}

// لوحة مفاتيح الإعدادات
function getSettingsKeyboard(user) {
  const imgStatus = user.includeImages ? 'مفعّلة ✅' : 'معطّلة ❌';

  return new InlineKeyboard()
    .text(`🖼️ الصور والمخططات التوضيحية: ${imgStatus}`, 'toggle_images')
    .row()
    .text('🔙 القائمة الرئيسية', 'back_to_main');
}

module.exports = {
  getMainMenuKeyboard,
  getBackKeyboard,
  getLectureActionKeyboard,
  getPdfLanguageSelectionKeyboard,
  getQuizLanguageSelectionKeyboard,
  getAnkiLanguageSelectionKeyboard,
  getDoctorNotesLanguageSelectionKeyboard,
  getSettingsKeyboard,
};
