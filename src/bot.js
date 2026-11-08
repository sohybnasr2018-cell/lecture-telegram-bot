const { Bot, InputFile } = require('grammy');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const config = require('./config');
const db = require('./db');
const {
  getMainMenuKeyboard,
  getBackKeyboard,
  getLectureActionKeyboard,
  getPdfLanguageSelectionKeyboard,
  getQuizLanguageSelectionKeyboard,
  getAnkiLanguageSelectionKeyboard,
  getDoctorNotesLanguageSelectionKeyboard,
  getSettingsKeyboard,
} = require('./keyboards');
const { generateLecturePdf } = require('./pdf');
const { createAnkiDeck, createAnkiTsv } = require('./anki');
const {
  processLectureAudio,
  adaptLectureForLanguage,
  getLocalizedQuiz,
  getLocalizedFlashcards,
  getLocalizedDoctorNotes,
  answerLectureQuestion,
} = require('./gemini');

if (!config.telegramToken) {
  console.error('⚠️ تحذير: لم يتم تعيين TELEGRAM_BOT_TOKEN في ملف .env!');
}

const botOptions = {};
if (config.telegramApiRoot) {
  botOptions.client = { apiRoot: config.telegramApiRoot };
}

const bot = new Bot(config.telegramToken || 'DUMMY_TOKEN', botOptions);

// حماية ضد أخطاء انتهاء صلاحية الكولباك (Query too old)
bot.use(async (ctx, next) => {
  if (ctx.callbackQuery) {
    const originalAnswer = ctx.answerCallbackQuery.bind(ctx);
    ctx.answerCallbackQuery = async (params) => {
      try {
        return await originalAnswer(params);
      } catch (err) {
        // تجاهل خطأ انتهاء صلاحية الكولباك لمنع توقف البوت
      }
    };
  }
  await next();
});

// معالج الأخطاء العام لضمان عدم توقف البوت أبداً (Global Error Handler)
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`[Bot Error] Handled error in update ${ctx.update.update_id}:`, err.error.message || err.error);
});

// دالة مساعدة لتنزيل ملف من رابط
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const client = url.startsWith('https') ? https : http;
    client.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(destPath));
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// نص الترحيب الرئيسي المطابق للصورة 1
function getWelcomeMessage(userName) {
  return `أهلاً د. ${userName}! 🖐️

🎧 حوّل أي ريكورد محاضرة لمذكرة PDF منظمة بدون استهلاك من باقتك وبدون تحميل للريكورد!
اعمل Forward للريكورد من أي قناة أو جروب في ثواني.

اختار اللي محتاجه من تحت:
🎙️ تفريغ محاضرة: ابعت الريكورد وخد مذكرة PDF أو الأسئلة المهمة اللي الدكتور أكد عليها.
🖼️ صور على المحاضرة: صور توضيحية للمحاضرة في ملف PDF.
🤝 شارك البوت: ابعت رابطك لأصحابك.
⚙️ الإعدادات: الصور جوه المذكرة وخيارات التشغيل.`;
}

// نص شاشة تفريغ المحاضرة المطابق للصورة 2
const LECTURE_INSTRUCTIONS = `🎙️ تفريغ محاضرة

1️⃣ ابعت الريكورد هنا أو حوّله (Forward) من أي قناة أو جروب.
2️⃣ تحته هتلاقي زراير، اختار اللي محتاجه.

📎 أقصى حجم 300 MB، وأقصى مدة 2 ساعة و55 دقيقة.`;

// --- معالجة أمر /start ---
bot.command('start', async (ctx) => {
  const user = db.getUser(ctx.from.id, {
    first_name: ctx.from.first_name,
    username: ctx.from.username,
  });
  db.updateUser(ctx.from.id, { mode: null });

  await ctx.reply(getWelcomeMessage(user.first_name), {
    reply_markup: getMainMenuKeyboard(),
  });
});

// --- معالجة الأزرار النصية (القائمة الرئيسية) ---
bot.hears('🎙️ تفريغ محاضرة', async (ctx) => {
  db.updateUser(ctx.from.id, { mode: 'waiting_for_audio' });
  await ctx.reply(LECTURE_INSTRUCTIONS, {
    reply_markup: getBackKeyboard(),
  });
});

bot.hears('🔙 القائمة الرئيسية', async (ctx) => {
  const user = db.getUser(ctx.from.id);
  db.updateUser(ctx.from.id, { mode: null });
  await ctx.reply(getWelcomeMessage(user.first_name), {
    reply_markup: getMainMenuKeyboard(),
  });
});

bot.hears('🖼️ صور على المحاضرة', async (ctx) => {
  const user = db.getUser(ctx.from.id);
  const statusText = user.includeImages ? 'مفعّلة ✅' : 'معطّلة ❌';
  await ctx.reply(
    `🖼️ **الصور والتوضيحات المرئية للمحاضرة**\n\nالحالة الحالية: **${statusText}**\n\nيقوم البوت بتوليد مخططات انسيابية ورسوم توضيحية لمسارات الشرح داخل ملف الـ PDF ليسهل تذكرها بصرياً.\n\nيمكنك تشغيلها أو إيقافها من قائمة ⚙️ الإعدادات.`,
    {
      reply_markup: getSettingsKeyboard(user),
      parse_mode: 'Markdown',
    }
  );
});

bot.hears('🤝 شارك البوت', async (ctx) => {
  const botInfo = await ctx.api.getMe();
  const botUsername = botInfo.username;
  const shareText = encodeURIComponent(
    `🎓 بوت تفريغ وتلخيص المحاضرات الذكي!\nحوّل أي ريكورد لمذكرة PDF، كويز تفاعلي، وبطاقات أنكي في ثواني مجاناً:\nhttps://t.me/${botUsername}`
  );

  await ctx.reply(
    `🤝 **شارك البوت مع زملائك ودُفعتك!**\n\nانشر رابط البوت ليستفيد الجميع:\n\n🔗 https://t.me/${botUsername}\n\n👇 اضغط الزر بالأسفل للمشاركة الفورية:`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🚀 مشاركة البوت في القنوات والجروبات',
              url: `https://t.me/share/url?url=https://t.me/${botUsername}&text=${shareText}`,
            },
          ],
        ],
      },
      parse_mode: 'Markdown',
    }
  );
});

bot.hears('⚙️ الإعدادات', async (ctx) => {
  const user = db.getUser(ctx.from.id);
  await ctx.reply(`⚙️ **إعدادات البوت وتفضيلات المذكرات**`, {
    reply_markup: getSettingsKeyboard(user),
    parse_mode: 'Markdown',
  });
});

// --- معالجة استلام الملفات الصوتية والفويس نوت مع دعم التخزين المؤقت الذكي (Smart Cache) ---
bot.on(':voice', handleAudioUpload);
bot.on(':audio', handleAudioUpload);
bot.on(':document', async (ctx, next) => {
  const doc = ctx.message.document;
  const mime = doc.mime_type || '';
  const name = (doc.file_name || '').toLowerCase();
  if (
    mime.startsWith('audio/') ||
    name.endsWith('.mp3') ||
    name.endsWith('.m4a') ||
    name.endsWith('.wav') ||
    name.endsWith('.ogg') ||
    name.endsWith('.aac')
  ) {
    return handleAudioUpload(ctx);
  }
  return next();
});

async function handleAudioUpload(ctx) {
  const user = db.getUser(ctx.from.id, {
    first_name: ctx.from.first_name,
    username: ctx.from.username,
  });

  const message = ctx.message;
  const fileItem = message.voice || message.audio || message.document;
  if (!fileItem) return;

  const fileSize = fileItem.file_size || 0;
  const fileId = fileItem.file_id;
  const fileUniqueId = fileItem.file_unique_id;

  // التحقق إن كان هذا الريكورد قد عولج مسبقاً لأي طالب آخر في الدفعة (توفير 100% من الكوتا والوقت!)
  const cachedLecture = db.getLectureByFileUniqueId(fileUniqueId);
  if (cachedLecture) {
    console.log(`[Cache Hit] Serving cached lecture for uniqueId: ${fileUniqueId}`);
    db.updateUser(ctx.from.id, { activeLectureId: cachedLecture.id });
    await ctx.reply(
      `⚡ **تم التعرف على هذا الريكورد مسبقاً!**\n\n` +
        `🎓 **عنوان المحاضرة:** ${cachedLecture.title}\n` +
        `👨‍🏫 **المحاضر:** ${cachedLecture.doctor}\n` +
        `⏱️ **المدة:** ${cachedLecture.duration}\n\n` +
        `📌 **ملخص سريع:**\n${cachedLecture.summary.substring(0, 300)}...\n\n` +
        `👇 **اختر الإجراء الذي تريده بالأسفل:**`,
      {
        reply_markup: getLectureActionKeyboard(cachedLecture.id),
        parse_mode: 'Markdown',
      }
    );
    return;
  }

  // التحقق من الحجم لسيرفر تيليجرام الافتراضي
  if (!config.telegramApiRoot && fileSize > 20 * 1024 * 1024) {
    await ctx.reply(
      `⚠️ **تنبيه حول حجم الملف:**\nحجم الملف (${(fileSize / (1024 * 1024)).toFixed(1)} MB) يتجاوز الحد المباشر لسيرفر تيليجرام الافتراضي (20 MB).\n\n💡 لدعم ريكوردات المحاضرات الكبيرة حتى 300MB مجاناً، راجع دليل تشغيل خادم تيليجرام المحلي في ملف README.md.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const statusMsg = await ctx.reply(
    `⏳ **جاري استلام التسجيل الصوتي...**\nالحجم: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`,
    { parse_mode: 'Markdown' }
  );

  try {
    const fileInfo = await ctx.api.getFile(fileId);
    let downloadUrl = `https://api.telegram.org/file/bot${config.telegramToken}/${fileInfo.file_path}`;
    if (config.telegramApiRoot) {
      downloadUrl = `${config.telegramApiRoot}/file/bot${config.telegramToken}/${fileInfo.file_path}`;
    }

    const ext = path.extname(fileInfo.file_path || '.mp3') || '.mp3';
    const localFileName = `audio_${Date.now()}_${fileId.substring(0, 8)}${ext}`;
    const localFilePath = path.join(config.tempDir, localFileName);

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `📥 **تم استلام الريكورد!**\nجاري إرساله للمعالجة والذكاء الاصطناعي... ⏳`,
      { parse_mode: 'Markdown' }
    );

    await downloadFile(downloadUrl, localFilePath);

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `🤖 **جاري الاستماع وتحليل المحاضرة واستخراج الأسئلة والتوقيتات [MM:SS]...** ⏳`,
      { parse_mode: 'Markdown' }
    );

    const mimeType = message.voice ? 'audio/ogg' : message.audio ? message.audio.mime_type || 'audio/mp3' : fileItem.mime_type || 'audio/mp3';
    const lectureData = await processLectureAudio(localFilePath, mimeType, { language: 'mix' });

    const lectureId = `lec_${Date.now()}`;
    lectureData.id = lectureId;
    lectureData.fileUniqueId = fileUniqueId; // حفظ البصمة للـ Cache
    lectureData.userId = ctx.from.id;
    lectureData.audioFilePath = localFilePath;
    lectureData.createdAt = new Date().toISOString();

    db.saveLecture(lectureData);

    // حذف الملف الصوتي المحلي بعد تحليله بنجاح لتوفير مساحة الـ 512MB
    setTimeout(() => {
      fs.unlink(localFilePath, () => {});
    }, 15000);

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `✅ **تم تفريغ وتحليل المحاضرة بنجاح!**\n\n` +
        `🎓 **عنوان المحاضرة:** ${lectureData.title}\n` +
        `👨‍🏫 **المحاضر:** ${lectureData.doctor}\n` +
        `⏱️ **المدة:** ${lectureData.duration}\n\n` +
        `📌 **ملخص سريع:**\n${lectureData.summary.substring(0, 300)}...\n\n` +
        `👇 **اضغط على (📄 إنشاء مذكرة PDF) لتحديد لغة المذكرة التي تناسبك:**`,
      {
        reply_markup: getLectureActionKeyboard(lectureId),
        parse_mode: 'Markdown',
      }
    );
  } catch (err) {
    console.error('Error handling audio:', err);
    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      `❌ حدث خطأ أثناء معالجة الريكورد: ${err.message}`
    );
  }
}

// --- معالجة اختيار اللغة الصريح للمذكرة (لا يتم التحديد تلقائياً) ---

// عند الضغط على زر إنشاء المذكرة، نعرض خيارات اللغة فوراً ليختار الطالب يدوياً
bot.callbackQuery(/^choose_pdf_lang_(.+)$/, async (ctx) => {
  const lectureId = ctx.match[1];
  const lecture = db.getLecture(lectureId);

  if (!lecture) {
    return ctx.answerCallbackQuery({ text: 'المحاضرة غير موجودة!', show_alert: true });
  }

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `🌐 **اختر لغة المذكرة التي تفضلها لهذه المحاضرة:**\n\n` +
      `• **🇪🇬 عربي:** مذكرة باللغة العربية الفصحى.\n` +
      `• **🇬🇧 English:** مذكرة أكاديمية بالإنجليزية بالكامل.\n` +
      `• **🔄 مكس:** شرح عربي مفصل مع إبقاء جميع المصطلحات الطبية والعلمية بالإنجليزية.\n\n` +
      `👇 اضغط على خيارك ليتم توليد الـ PDF فوراً:`,
    {
      reply_markup: getPdfLanguageSelectionKeyboard(lectureId),
      parse_mode: 'Markdown',
    }
  );
});

// توليد المذكرة باللغة التي اختارها الطالب صراحة
bot.callbackQuery(/^create_pdf_(.+)_(ar|en|mix)$/, async (ctx) => {
  const lectureId = ctx.match[1];
  const chosenLang = ctx.match[2];
  const lecture = db.getLecture(lectureId);
  const user = db.getUser(ctx.from.id);

  if (!lecture) {
    return ctx.answerCallbackQuery({ text: 'المحاضرة غير موجودة!', show_alert: true });
  }

  const langNames = {
    ar: 'باللغة العربية 🇪🇬',
    en: 'باللغة الإنجليزية 🇬🇧',
    mix: 'مكس (عربي + مصطلحات إنجليزي) 🔄',
  };

  await ctx.answerCallbackQuery({ text: `جاري التوليد: ${langNames[chosenLang]}` });

  const waitingMsg = await ctx.reply(
    `⏳ **جاري إعداد مذكرة المحاضرة (${langNames[chosenLang]})...**\nتنسيق الخطوط الأكاديمية والرسوم التوضيحية 📄`,
    { parse_mode: 'Markdown' }
  );

  try {
    // تكييف أو ترجمة المحتوى إذا اختار الطالب لغة محددة
    let finalLectureData = lecture;
    if (chosenLang !== 'mix') {
      try {
        finalLectureData = await adaptLectureForLanguage(lecture, chosenLang);
      } catch (adaptErr) {
        console.warn('Adapt error, falling back to original content:', adaptErr.message);
      }
    }

    const pdfFileName = `lecture_${chosenLang}_${Date.now()}.pdf`;
    const pdfPath = path.join(config.tempDir, pdfFileName);

    await generateLecturePdf(finalLectureData, pdfPath, {
      language: chosenLang,
      includeImages: user.includeImages,
    });

    await ctx.api.deleteMessage(ctx.chat.id, waitingMsg.message_id);

    await ctx.replyWithDocument(new InputFile(pdfPath, `${lecture.title} (${chosenLang}).pdf`), {
      caption:
        `📄 **مذكرة المحاضرة جاهزة!**\n\n` +
        `🎓 **العنوان:** ${lecture.title}\n` +
        `🌐 **اللغة المختارة:** ${langNames[chosenLang]}\n` +
        `🖼️ **الرسوم والمخططات:** ${user.includeImages ? 'مضمّنة ✅' : 'معطّلة ❌'}\n\n` +
        `💡 يمكنك إعادة توليدها بلغة أخرى في أي وقت، أو تجربة **الكويز التفاعلي** وبطاقات **أنكي** من الأزرار أدناه:`,
      reply_markup: getLectureActionKeyboard(lectureId),
      parse_mode: 'Markdown',
    });

    // تنظيف فوري لملف الـ PDF المؤقت للحفاظ على مساحة الـ 512MB
    setTimeout(() => {
      fs.unlink(pdfPath, () => {});
    }, 20000);
  } catch (err) {
    console.error('PDF generation error:', err);
    await ctx.reply(`❌ فشل إنشاء ملف الـ PDF: ${err.message}`);
  }
});

// زر العودة للوحة المحاضرة
bot.callbackQuery(/^back_lecture_(.+)$/, async (ctx) => {
  const lectureId = ctx.match[1];
  await ctx.answerCallbackQuery();
  await ctx.reply(`لوحة تحكم المحاضرة:`, {
    reply_markup: getLectureActionKeyboard(lectureId),
  });
});

// --- معالجة الكويز التفاعلي مع اختيار اللغة الصريح ---
bot.callbackQuery(/^(?:choose_quiz_lang_|quiz_)(.+)$/, async (ctx) => {
  const lectureId = ctx.match[1];
  const lecture = db.getLecture(lectureId);

  if (!lecture) {
    return ctx.answerCallbackQuery({ text: 'المحاضرة غير موجودة!', show_alert: true });
  }

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `🎯 **الكويز التفاعلي (Interactive Quiz)**\n\n` +
      `🌐 **اختر لغة الكويز التي تناسبك:**\n\n` +
      `• **🇪🇬 عربي:** أسئلة واختيارات بالعربية الفصحى.\n` +
      `• **🇬🇧 English:** Questions and options in full English.\n` +
      `• **🔄 مكس:** أسئلة بالعربية مع المصطلحات العلمية بالإنجليزية.\n\n` +
      `اضغط على خيارك للبدء الفوري 👇:`,
    {
      reply_markup: getQuizLanguageSelectionKeyboard(lectureId),
      parse_mode: 'Markdown',
    }
  );
});

bot.callbackQuery(/^start_quiz_(.+)_(ar|en|mix)$/, async (ctx) => {
  const lectureId = ctx.match[1];
  const chosenLang = ctx.match[2];
  const lecture = db.getLecture(lectureId);

  if (!lecture) {
    return ctx.answerCallbackQuery({ text: 'المحاضرة غير موجودة!', show_alert: true });
  }

  await ctx.answerCallbackQuery({ text: 'جاري تجهيز الكويز باللغة المختارة...' });

  const waitingMsg = await ctx.reply('⏳ **جاري تحضير أسئلة الكويز...**', { parse_mode: 'Markdown' });

  const quizList = await getLocalizedQuiz(lecture, chosenLang);
  await ctx.api.deleteMessage(ctx.chat.id, waitingMsg.message_id);

  if (!quizList || quizList.length === 0) {
    return ctx.reply('عذراً، لم تتوفر أسئلة كويز لهذه المحاضرة.');
  }

  await ctx.reply(
    `🎯 **بدء الكويز التفاعلي (${chosenLang === 'ar' ? 'العربية 🇪🇬' : chosenLang === 'en' ? 'English 🇬🇧' : 'مكس 🔄'})**\n` +
      `اضغط على الإجابة لتظهر لك النتيجة والشرح فوراً 🚀:`,
    { parse_mode: 'Markdown' }
  );

  const selectedQuestions = quizList.slice(0, 5);
  for (let i = 0; i < selectedQuestions.length; i++) {
    const q = selectedQuestions[i];
    try {
      await ctx.api.sendPoll(ctx.chat.id, `سؤال ${i + 1}: ${q.question}`, q.options, {
        type: 'quiz',
        correct_option_id: q.correctOptionIndex,
        explanation: q.explanation || 'إجابة صحيحة وفق ما ذكره الدكتور في المحاضرة!',
        is_anonymous: false,
      });
      await new Promise((r) => setTimeout(r, 600));
    } catch (pollErr) {
      console.error('Poll error:', pollErr);
    }
  }

  await ctx.reply(`✨ أحسنت! يمكنك أيضاً تنزيل بطاقات أنكي أو مذكرة الـ PDF:`, {
    reply_markup: getLectureActionKeyboard(lectureId),
  });
});

// --- معالجة بطاقات أنكي (.apkg) مع اختيار اللغة الصريح ---
bot.callbackQuery(/^(?:choose_anki_lang_|anki_)(.+)$/, async (ctx) => {
  const lectureId = ctx.match[1];
  const lecture = db.getLecture(lectureId);

  if (!lecture) {
    return ctx.answerCallbackQuery({ text: 'المحاضرة غير موجودة!', show_alert: true });
  }

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `🗂️ **بطاقات أنكي التعليمية (Anki Flashcards)**\n\n` +
      `🌐 **اختر لغة البطاقات التي تفضلها:**\n\n` +
      `• **🇪🇬 عربي:** أسئلة وإجابات بالعربية الفصحى.\n` +
      `• **🇬🇧 English:** Flashcards in full academic English.\n` +
      `• **🔄 مكس:** سؤال وشرح عربي مع الحفاظ على المصطلحات بالإنجليزية.\n\n` +
      `اضغط على خيارك لتوليد ملف الـ .apkg فوراً 👇:`,
    {
      reply_markup: getAnkiLanguageSelectionKeyboard(lectureId),
      parse_mode: 'Markdown',
    }
  );
});

bot.callbackQuery(/^gen_anki_(.+)_(ar|en|mix)$/, async (ctx) => {
  const lectureId = ctx.match[1];
  const chosenLang = ctx.match[2];
  const lecture = db.getLecture(lectureId);

  if (!lecture) {
    return ctx.answerCallbackQuery({ text: 'المحاضرة غير موجودة!', show_alert: true });
  }

  await ctx.answerCallbackQuery({ text: 'جاري إنشاء حزمة أنكي باللغة المختارة...' });
  const waitingMsg = await ctx.reply('⏳ **جاري توليد ملف Anki Deck (.apkg)...**', { parse_mode: 'Markdown' });

  try {
    const flashcards = await getLocalizedFlashcards(lecture, chosenLang);
    const langLabel = chosenLang === 'ar' ? 'Arabic' : chosenLang === 'en' ? 'English' : 'Bilingual';
    const deckTitle = `${lecture.title} (${langLabel})`;

    const apkgFileName = `${deckTitle.replace(/[\\/:*?"<>|]/g, '_')}.apkg`;
    const apkgPath = path.join(config.tempDir, apkgFileName);
    const tsvFileName = `${deckTitle.replace(/[\\/:*?"<>|]/g, '_')}_import.txt`;
    const tsvPath = path.join(config.tempDir, tsvFileName);

    await createAnkiDeck(deckTitle, flashcards, apkgPath);
    createAnkiTsv(deckTitle, flashcards, tsvPath);

    await ctx.api.deleteMessage(ctx.chat.id, waitingMsg.message_id);

    await ctx.replyWithDocument(new InputFile(apkgPath, apkgFileName), {
      caption:
        `🗂️ **حزمة بطاقات أنكي (.apkg) جاهزة!**\n\n` +
        `📦 **المجموعة:** ${deckTitle}\n` +
        `🃏 **عدد البطاقات:** ${flashcards.length} بطاقة ذكية\n` +
        `🌐 **اللغة:** ${chosenLang === 'ar' ? 'العربية 🇪🇬' : chosenLang === 'en' ? 'English 🇬🇧' : 'مكس 🔄'}\n\n` +
        `📱 اضغط على الملف لفتحه مباشرة في تطبيق **Anki / AnkiDroid / AnkiMobile**! 🎉`,
      reply_markup: getLectureActionKeyboard(lectureId),
      parse_mode: 'Markdown',
    });

    await ctx.replyWithDocument(new InputFile(tsvPath, tsvFileName), {
      caption: `📑 ملف نصي بديل (TSV) جاهز للاستيراد السريع في أنكي.`,
    });
  } catch (err) {
    console.error('Anki error:', err);
    await ctx.reply(`❌ فشل توليد بطاقات أنكي: ${err.message}`);
  }
});

// --- معالجة أسئلة وتنبيهات الدكتور للامتحان بدقة فائقة مع اختيار اللغة ---
bot.callbackQuery(/^(?:choose_doc_lang_|doctor_notes_)(.+)$/, async (ctx) => {
  const lectureId = ctx.match[1];
  const lecture = db.getLecture(lectureId);

  if (!lecture) {
    return ctx.answerCallbackQuery({ text: 'المحاضرة غير موجودة!', show_alert: true });
  }

  await ctx.answerCallbackQuery();
  await ctx.reply(
    `🎯 **تنبيهات وأسئلة ركز عليها الدكتور للامتحان**\n\n` +
      `🌐 **اختر لغة العرض:**\n\n` +
      `• **🇪🇬 عربي:** عرض التنبيهات باللغة العربية.\n` +
      `• **🇬🇧 English:** Display notes and traps in English.\n` +
      `• **🔄 مكس:** شرح عربي مع المصطلحات بالإنجليزية.\n\n` +
      `اضغط على خيارك لعرض التنبيهات الدقيقة 👇:`,
    {
      reply_markup: getDoctorNotesLanguageSelectionKeyboard(lectureId),
      parse_mode: 'Markdown',
    }
  );
});

bot.callbackQuery(/^show_doc_notes_(.+)_(ar|en|mix)$/, async (ctx) => {
  const lectureId = ctx.match[1];
  const chosenLang = ctx.match[2];
  const lecture = db.getLecture(lectureId);

  if (!lecture) {
    return ctx.answerCallbackQuery({ text: 'المحاضرة غير موجودة!', show_alert: true });
  }

  await ctx.answerCallbackQuery();
  const notes = await getLocalizedDoctorNotes(lecture, chosenLang);

  if (!notes || notes.length === 0) {
    return ctx.reply('لا توجد تنبيهات مسجلة لهذه المحاضرة.', {
      reply_markup: getLectureActionKeyboard(lectureId),
    });
  }

  let text = `🎯 **أهم ما ركّز عليه الدكتور للامتحان (دقة فائقة بالدقيقة والثانية):**\n\n`;

  notes.forEach((note, idx) => {
    if (typeof note === 'object' && note !== null) {
      text += `📌 **تنبيه ${idx + 1}: ${note.topic || 'نقطة هامة'}**\n`;
      if (note.timestamp) text += `⏱️ **التوقيت في التسجيل:** [${note.timestamp}]\n`;
      if (note.doctorQuote) text += `📢 **ما قاله الدكتور:** "${note.doctorQuote}"\n`;
      if (note.examTrap) text += `⚠️ **التركة الامتحانية:** ${note.examTrap}\n`;
      if (note.expectedQuestion) text += `❓ **السؤال المتوقع في الامتحان:** ${note.expectedQuestion}\n`;
      if (note.correctAnswer) text += `✅ **الإجابة النموذجية:** ${note.correctAnswer}\n`;
      text += `\n────────────────────\n\n`;
    } else {
      text += `⚠️ **${idx + 1}.** ${String(note)}\n\n`;
    }
  });

  await ctx.reply(text, {
    reply_markup: getLectureActionKeyboard(lectureId),
    parse_mode: 'Markdown',
  });
});

// زر تبديل الصور التوضيحية
bot.callbackQuery('toggle_images', async (ctx) => {
  const user = db.getUser(ctx.from.id);
  const updatedUser = db.updateUser(ctx.from.id, { includeImages: !user.includeImages });
  const status = updatedUser.includeImages ? 'مفعّلة ✅' : 'معطّلة ❌';
  await ctx.answerCallbackQuery({ text: `الصور التوضيحية أصبحت: ${status}` });
  await ctx.editMessageReplyMarkup({ reply_markup: getSettingsKeyboard(updatedUser) });
});

bot.callbackQuery('back_to_main', async (ctx) => {
  await ctx.answerCallbackQuery();
  const user = db.getUser(ctx.from.id);
  db.updateUser(ctx.from.id, { mode: null });
  await ctx.reply(getWelcomeMessage(user.first_name), {
    reply_markup: getMainMenuKeyboard(),
  });
});

// --- معالجة الرسائل في وضع Chat with Lecture ---
bot.on('message:text', async (ctx) => {
  const user = db.getUser(ctx.from.id);

  if (user.mode === 'chat_with_lecture') {
    const lecture = db.getUserActiveLecture(ctx.from.id);
    if (!lecture) {
      db.updateUser(ctx.from.id, { mode: null });
      return ctx.reply('عذراً، لم يتم العثور على محاضرة نشطة. يرجى إرسال ريكورد أولاً.', {
        reply_markup: getMainMenuKeyboard(),
      });
    }

    const question = ctx.message.text;
    const waitingMsg = await ctx.reply('🔍 **جاري البحث في المحاضرة عن الإجابة والدقيقة والثانية...**', {
      parse_mode: 'Markdown',
    });

    try {
      const answer = await answerLectureQuestion(lecture, question);
      await ctx.api.deleteMessage(ctx.chat.id, waitingMsg.message_id);
      await ctx.reply(
        `💬 **سؤالك:** ${question}\n\n${answer}\n\n---\n💡 يمكنك طرح سؤال آخر، أو اضغط **🔙 القائمة الرئيسية** للخروج.`,
        {
          reply_markup: getBackKeyboard(),
          parse_mode: 'Markdown',
        }
      );
    } catch (err) {
      console.error('Answer question error:', err);
      await ctx.reply(`❌ حدث خطأ أثناء البحث عن الإجابة: ${err.message}`);
    }
    return;
  }

  await ctx.reply(getWelcomeMessage(user.first_name), {
    reply_markup: getMainMenuKeyboard(),
  });
});

// تشغيل البوت
async function startBot() {
  if (!config.telegramToken || config.telegramToken === 'your_telegram_bot_token_here') {
    console.log('يرجى وضع TELEGRAM_BOT_TOKEN في ملف .env');
    return;
  }

  // خادم فحص الصحة للتوافق التام مع استضافة Render السحابية المجانية (Render Health Check)
  const port = process.env.PORT || 3000;
  http
    .createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('🎓 Smart Lecture Telegram Bot is active and running 24/7!');
    })
    .listen(port, () => {
      console.log(`🌐 Health-check server listening on port ${port}`);
    });

  console.log('🚀 Starting Telegram Bot...');
  await bot.start({
    onStart: (botInfo) => {
      console.log(`✅ البوت يعمل بنجاح باسم: @${botInfo.username}`);
    },
  });
}

if (require.main === module) {
  startBot().catch((err) => {
    console.error('Bot launch error:', err);
  });
}

module.exports = {
  bot,
  startBot,
};
