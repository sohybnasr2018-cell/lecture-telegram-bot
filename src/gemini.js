const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const config = require('./config');

/**
 * فئة إدارة وتدوير المفاتيح المجانية التلقائي (API Key Pool & Load Balancer)
 */
class KeyManager {
  constructor(keys) {
    this.keys = keys && keys.length > 0 ? keys : [];
    this.index = 0;
  }

  getCurrentKey() {
    if (this.keys.length === 0) return null;
    return this.keys[this.index % this.keys.length];
  }

  rotateToNextKey() {
    if (this.keys.length > 1) {
      this.index = (this.index + 1) % this.keys.length;
      console.log(`[KeyManager] Rotated to key #${this.index + 1} of ${this.keys.length}`);
    }
  }

  getClient() {
    const key = this.getCurrentKey();
    if (!key) return null;
    return {
      genAI: new GoogleGenerativeAI(key),
      fileManager: new GoogleAIFileManager(key),
    };
  }
}

const keyManager = new KeyManager(config.geminiKeys);

/**
 * تنفيذ طلب إلى Gemini مع إعادة المحاولة التلقائية وتدوير المفتاح
 */
async function executeWithRotation(operationFn, maxRetries = 3) {
  let attempts = 0;
  const totalKeys = keyManager.keys.length || 1;
  const limit = Math.max(maxRetries, totalKeys);

  while (attempts < limit) {
    attempts++;
    const client = keyManager.getClient();
    if (!client) {
      throw new Error('No API Key configured.');
    }

    try {
      return await operationFn(client);
    } catch (err) {
      console.warn(`[Gemini Attempt ${attempts}] Error: ${err.message}`);
      const isRetryable =
        err.message.includes('429') ||
        err.message.includes('503') ||
        err.message.includes('Service Unavailable') ||
        err.message.includes('RESOURCE_EXHAUSTED') ||
        err.message.includes('Quota exceeded');

      if (isRetryable && keyManager.keys.length > 1) {
        console.log('[Gemini] Rate limit or service busy (503/429). Rotating to next free API key...');
        keyManager.rotateToNextKey();
        continue;
      }

      if (attempts >= limit) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/**
 * تحليل ملف الصوت واستخراج المحاضرة بتفصيل أكاديمي عميق وشامل للغاية مع صور متعددة متناسبة مع الشرح
 */
async function processLectureAudio(audioFilePath, mimeType = 'audio/mp3', userOptions = {}) {
  if (!keyManager.getCurrentKey()) {
    console.warn('No Gemini API Key set. Using intelligent mock lecture generator.');
    return getMockLectureData(userOptions);
  }

  return await executeWithRotation(async (client) => {
    console.log(`Uploading audio to Gemini File API (${path.basename(audioFilePath)})...`);
    const uploadResult = await client.fileManager.uploadFile(audioFilePath, {
      mimeType: mimeType || 'audio/mp3',
      displayName: path.basename(audioFilePath),
    });

    let file = await client.fileManager.getFile(uploadResult.file.name);
    while (file.state === 'PROCESSING') {
      console.log('Waiting for Gemini audio processor...');
      await new Promise((r) => setTimeout(r, 3000));
      file = await client.fileManager.getFile(uploadResult.file.name);
    }

    if (file.state === 'FAILED') {
      throw new Error('فشلت معالجة الملف الصوتي في Gemini.');
    }

    const model = client.genAI.getGenerativeModel({ model: config.geminiModel });

    const prompt = `
أنت بروفيسور وأستاذ جامعي متخصص في إعداد "المذكرات الأكاديمية الرسمية الشاملة" لطلاب الكليات الطبية والهندسية والعلمية.
استمع للتسجيل الصوتي المرفق كاملاً، والمطلوب إعداد مذكرة دراسية تفصيلية وشاملة لأقصى درجة ممكنة تغطي كل كلمة وفكرة ومثال قاله الدكتور.

⚠️ تعليمات صارمة ومهمة جداً:
1. الشمولية والتفصيل (In-Depth Academic Coverage): يُمنع منعاً باتاً الاختصار أو الاكتفاء بالعموميات ورؤوس الأقلام السطحية! المذكرة يجب أن تكون وافية كأنها كتاب دراسي جامعي كامل.
2. تناسب الصور مع الشرح (Proportional Images & Visuals):
   - نظراً لغزارة الشرح، يجب أن يحتوي كل محور على عدة صور توضيحية ورسومات (من 2 إلى 3 صور لكل محور) تغطي تفاصيل العناصر المختلفة المذكورة في المحور، بالإضافة إلى مخطط انسيابي تسلسلي للآليات (Mechanism Steps).
3. دقة تنبيهات وأسئلة الدكتور (Hyper-Accurate Doctor Notes):
   - استخرج بدقة متناهية كل جملة قال فيها الدكتور "ركزوا هنا"، "دي بتيجي في الامتحان"، "الطلاب بيتلخبطوا هنا"، مع توثيق التوقيت الزمني بالدقيقة والثانية [MM:SS]، ونص ما قاله الدكتور حرفياً، والتركة الامتحانية (Exam Trap)، وصيغة السؤال المتوقع في الامتحان وإجابته النموذجية.
4. صمم جداول مقارنة كاملة وجدول مصطلحات شامل وبنك أسئلة مراجعة ذاتية.

يجب أن تقوم بالرد بصيغة JSON فقط متوافقة تماماً مع هذا المخطط الدقيق (Strict JSON Schema):
{
  "title": "عنوان المحاضرة الأكاديمي الدقيق والكامل",
  "doctor": "اسم الدكتور أو المحاضر",
  "duration": "المدة الزمنية التقريبية",
  "summary": "ملخص شامل ووافي من 3-4 فقرات يغطي الصورة الكبرى للمحاضرة وتكامل موضوعاتها",
  "doctorNotes": [
    {
      "timestamp": "MM:SS (التوقيت الدقيق الذي قال فيه الدكتور هذا التنبيه)",
      "topic": "عنوان النقطة والمحور",
      "doctorQuote": "نص ما قاله الدكتور حرفياً أو ما شدد عليه في قاعة المحاضرة",
      "examTrap": "التركة الامتحانية أو الخطأ الشائع الذي حذر الدكتور من الوقوع فيه",
      "expectedQuestion": "صيغة السؤال المتوقع في الامتحان (MCQ أو سؤال مقالي قصير)",
      "correctAnswer": "الإجابة النموذجية الدقيقة والواضحة"
    }
  ],
  "topics": [
    {
      "title": "عنوان المحور التفصيلي",
      "timestamp": "MM:SS",
      "detailedExplanation": "شرح أكاديمي موسع وتفصيلي من 3 إلى 5 فقرات يغطي تفاصيل الفكرة والآليات والتشريح أو المعادلات دون أي اختصار",
      "keyPoints": [
        "نقطة تفصيلية فرعية 1 مع الشرح الوافي",
        "نقطة تفصيلية فرعية 2 مع الشرح الوافي",
        "نقطة تفصيلية فرعية 3 مع الشرح الوافي"
      ],
      "clinicalOrPracticalExamples": [
        "مثال سريري أو تطبيقي واقعي ذكره الدكتور أثناء الشرح"
      ],
      "mechanismSteps": [
        "خطوة 1 في الآلية أو التسلسل",
        "خطوة 2 في الآلية أو التسلسل",
        "خطوة 3 في الآلية أو التسلسل"
      ],
      "illustrations": [
        {
          "searchQuery": "precise english keywords for 1st scientific/medical diagram (e.g. right atrium interior anatomy labeled)",
          "caption": "شرح توضيحي دقيق باللغة العربية لما تظهره هذه الصورة في سياق الشرح"
        },
        {
          "searchQuery": "precise english keywords for 2nd anatomical/scientific diagram (e.g. tricuspid valve papillary muscles)",
          "caption": "شرح توضيحي دقيق للصورة الثانية"
        }
      ]
    }
  ],
  "comparisons": [
    {
      "title": "عنوان جدول المقارنة",
      "columns": ["وجه المقارنة", "العنصر الأول", "العنصر الثاني"],
      "rows": [
        ["الخاصية 1", "تفصيل 1", "تفصيل 2"]
      ]
    }
  ],
  "glossary": [
    {
      "term": "المصطلح العلمي بالإنجليزية",
      "definition": "التعريف والشرح الأكاديمي الدقيق",
      "example": "تطبيق أو مثال سريري ذُكر في المحاضرة"
    }
  ],
  "reviewQuestions": [
    {
      "question": "سؤال امتحاني للمراجعة الذاتية",
      "answer": "الإجابة النموذجية المفصلة المستخرجة من كلام الدكتور"
    }
  ],
  "quiz": [
    {
      "question": "نص سؤال اختيار من متعدد (أقل من 250 حرف)",
      "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
      "correctOptionIndex": 0,
      "explanation": "شرح موجز لسبب صحة هذا الخيار"
    }
  ],
  "flashcards": [
    {
      "front": "سؤال أو مفهوم البطاقة (Front)",
      "back": "الإجابة والشرح الكامل (Back)",
      "tag": "اسم الموضوع"
    }
  ],
  "timestampsIndex": [
    {
      "timestamp": "MM:SS",
      "topic": "الموضوع الذي تم الحديث عنه",
      "detail": "تفاصيل ما ذكره الدكتور في هذه الدقيقة بالضبط"
    }
  ]
}
`;

    console.log('Generating ultra-comprehensive lecture content with model:', config.geminiModel);
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResult.file.mimeType,
          fileUri: uploadResult.file.uri,
        },
      },
      { text: prompt },
    ]);

    const text = result.response.text();
    let cleanedJson = text.trim();
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsedData = JSON.parse(cleanedJson);
    parsedData.geminiFileUri = uploadResult.file.uri;
    return parsedData;
  });
}

/**
 * تكييف المذكرة بالكامل للغة المستهدفة (عربي / إنجليزي / مكس)
 */
async function adaptLectureForLanguage(lectureData, targetLanguage) {
  if (!keyManager.getCurrentKey() || targetLanguage === 'mix') {
    return lectureData;
  }

  return await executeWithRotation(async (client) => {
    const model = client.genAI.getGenerativeModel({ model: config.geminiModel });
    let langPrompt = '';
    if (targetLanguage === 'ar') {
      langPrompt = 'قم بصياغة وترجمة محتوى هذه المذكرة بالكامل باللغة العربية الفصحى الأكاديمية المعربة بالكامل مع الحفاظ على كل التفاصيل والصور.';
    } else if (targetLanguage === 'en') {
      langPrompt = 'Translate and format this entire lecture note into clean, formal academic English preserving all deep explanations and figures.';
    }

    const prompt = `
${langPrompt}
حافظ على نفس بنية الـ JSON بالضبط مع جميع التفاصيل العميقة:
${JSON.stringify({
  title: lectureData.title,
  summary: lectureData.summary,
  topics: lectureData.topics,
  doctorNotes: lectureData.doctorNotes,
  comparisons: lectureData.comparisons || [],
  glossary: lectureData.glossary,
  reviewQuestions: lectureData.reviewQuestions,
})}
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    if (text.startsWith('```json')) {
      text = text.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (text.startsWith('```')) {
      text = text.replace(/^```/, '').replace(/```$/, '').trim();
    }
    const adapted = JSON.parse(text);
    return { ...lectureData, ...adapted };
  });
}

/**
 * توليد أو ترجمة الكويز التفاعلي للغة المختارة (عربي / إنجليزي / مكس)
 */
async function getLocalizedQuiz(lectureData, targetLanguage) {
  const baseQuiz = lectureData.quiz || [];
  if (baseQuiz.length === 0 || targetLanguage === 'mix' || !keyManager.getCurrentKey()) {
    return baseQuiz;
  }

  try {
    return await executeWithRotation(async (client) => {
      const model = client.genAI.getGenerativeModel({ model: config.geminiModel });
      const langName = targetLanguage === 'ar' ? 'اللغة العربية الفصحى' : 'English language';
      const prompt = `
قم بصياغة وترجمة أسئلة الكويز التالية لتكون بـ ${langName}:
${JSON.stringify(baseQuiz)}

أعد النتيجة بصيغة JSON مصفوفة فقط [ { "question": "...", "options": [...], "correctOptionIndex": 0, "explanation": "..." } ]
`;
      const res = await model.generateContent(prompt);
      let text = res.response.text().trim();
      if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '').trim();
      else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '').trim();
      return JSON.parse(text);
    });
  } catch (err) {
    console.warn('[Quiz] Localization error, falling back to base quiz:', err.message);
    return baseQuiz;
  }
}

/**
 * توليد أو ترجمة فلاش كاردز أنكي للغة المختارة (عربي / إنجليزي / مكس)
 */
async function getLocalizedFlashcards(lectureData, targetLanguage) {
  const baseCards = lectureData.flashcards || [];
  if (baseCards.length === 0 || targetLanguage === 'mix' || !keyManager.getCurrentKey()) {
    return baseCards;
  }

  try {
    return await executeWithRotation(async (client) => {
      const model = client.genAI.getGenerativeModel({ model: config.geminiModel });
      const langName = targetLanguage === 'ar' ? 'اللغة العربية الفصحى' : 'English language';
      const prompt = `
قم بصياغة وترجمة بطاقات أنكي التالية لتكون بـ ${langName}:
${JSON.stringify(baseCards)}

أعد النتيجة بصيغة JSON مصفوفة فقط [ { "front": "...", "back": "...", "tag": "..." } ]
`;
      const res = await model.generateContent(prompt);
      let text = res.response.text().trim();
      if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '').trim();
      else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '').trim();
      return JSON.parse(text);
    });
  } catch (err) {
    console.warn('[Anki] Localization error, falling back to base cards:', err.message);
    return baseCards;
  }
}

/**
 * توليد أو ترجمة تنبيهات وأسئلة الدكتور للغة المختارة
 */
async function getLocalizedDoctorNotes(lectureData, targetLanguage) {
  const baseNotes = lectureData.doctorNotes || [];
  if (baseNotes.length === 0 || targetLanguage === 'mix' || !keyManager.getCurrentKey()) {
    return baseNotes;
  }

  try {
    return await executeWithRotation(async (client) => {
      const model = client.genAI.getGenerativeModel({ model: config.geminiModel });
      const langName = targetLanguage === 'ar' ? 'اللغة العربية الفصحى' : 'English language';
      const prompt = `
قم بصياغة وترجمة تنبيهات وأسئلة الدكتور التالية بدقة لتكون بـ ${langName}:
${JSON.stringify(baseNotes)}

أعد النتيجة بنفس صيغة الـ JSON بالضبط.
`;
      const res = await model.generateContent(prompt);
      let text = res.response.text().trim();
      if (text.startsWith('```json')) text = text.replace(/^```json/, '').replace(/```$/, '').trim();
      else if (text.startsWith('```')) text = text.replace(/^```/, '').replace(/```$/, '').trim();
      return JSON.parse(text);
    });
  } catch (err) {
    console.warn('[DoctorNotes] Localization error, falling back to base notes:', err.message);
    return baseNotes;
  }
}

/**
 * ميزة سؤال المحاضرة بالدقيقة والثانية
 */
async function answerLectureQuestion(lectureData, userQuestion) {
  if (!keyManager.getCurrentKey()) {
    return `⏱️ **التوقيت في التسجيل:** [14:30]\n💡 **الإجابة:** هذه النقطة من الأساسيات الهامة التي أكد عليها المحاضر.\n📢 **ما قاله الدكتور:** ركزوا عليها للامتحان النهائي.`;
  }

  return await executeWithRotation(async (client) => {
    const model = client.genAI.getGenerativeModel({ model: config.geminiModel });

    const prompt = `
أنت المساعد الأكاديمي الذكي المخصص لمحاضرة: "${lectureData.title}".
بيانات المحاضرة وفهرس التوقيتات:
${JSON.stringify({
  title: lectureData.title,
  summary: lectureData.summary,
  topics: lectureData.topics,
  timestampsIndex: lectureData.timestampsIndex || lectureData.topics,
  doctorNotes: lectureData.doctorNotes,
  glossary: lectureData.glossary,
}, null, 2)}

سؤال الطالب: "${userQuestion}"

المطلوب:
1. إجابة وافية ودقيقة ومفصلة.
2. التوقيت الزمني الدقيق [MM:SS] الذي وردت فيه المعلومة بالتسجيل.
3. اقتباس ما قاله الدكتور ونصائحه للامتحان.

التنسيق:
⏱️ **التوقيت في التسجيل:** [MM:SS]
💡 **الإجابة والشرح:** ...
📢 **ما قاله الدكتور بالضبط:** ...
`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  });
}

/**
 * بيانات دراسية عميقة وشاملة للاختبار
 */
function getMockLectureData(userOptions = {}) {
  const lang = userOptions.language || 'mix';
  return {
    title: lang === 'en'
      ? 'Anatomy of the Heart Chambers, Valves & Coronary Vessels'
      : 'تشريح تجاويف القلب وصماماته والشرايين التاجية (Internal Anatomy of the Heart)',
    doctor: 'أ.د. صهيب محمد',
    duration: '1 ساعة و 20 دقيقة',
    summary:
      'مذكرة تشريحية متعمقة ومفصلة لجميع التراكيب الداخلية لتجاويف القلب الأربعة (الأذين الأيمن والأيسر، والبطين الأيمن والأيسر)، والصمامات الأذينية البطينية والصمامات الهلالية، ومسارات الشرايين التاجية اليمنى واليسرى وتفريعاتها السريرية، ومسار الجيب التاجي والأوردة القلبية، مع تركيز شديد على الأهمية الجنينية والتطبيقية لامتحانات الفاينال والتريكات الإكلينيكية.',
    doctorNotes: [
      {
        timestamp: '08:45',
        topic: 'الجدار الفاصل بين الأذينين (Interatrial Septum) والـ Fossa Ovalis',
        doctorQuote: 'ركزوا هنا يا شباب دي بتيجي كل سنة في امتحان الفاينال MCQ، لازم تفرقوا بين أرضية الحفرة وحافتها الجنينية!',
        examTrap: 'الخلط بين أصل الـ Fossa ovalis (من Septum primum) وأصل الـ Limbus fossae ovalis (من Septum secundum).',
        expectedQuestion: 'س: ما هو الأصل الجنيني لكل من أرضية الـ Fossa Ovalis وحافتها العلوية (Limbus)؟',
        correctAnswer: 'ج: أرضية الـ Fossa ovalis مشتقة من Septum primum، بينما حافة الـ Limbus fossae ovalis مشتقة من Septum secundum.'
      },
      {
        timestamp: '24:30',
        topic: 'الشريط المنظم (Moderator Band / Trabecula Septomarginalis) في البطين الأيمن',
        doctorQuote: 'سؤال عملي ونظري مكرر: ما هو المحتوى العصبي الحيوي الذي يعبر داخل الـ Moderator band؟',
        examTrap: 'نسيان أن الـ Moderator band يربط بين الجدار الفاصل (Interventricular septum) وقاعدة العضلة الحليمية الأمامية (Anterior papillary muscle).',
        expectedQuestion: 'س: ما هي الأهمية الوظيفية والكهربائية لشريط الـ Moderator Band؟',
        correctAnswer: 'ج: يحمل بداخله الفرع الأيمن لحزمة هيس (Right Bundle Branch) لنقل الإشارة الكهربائية بسرعة إلى العضلة الحليمية الأمامية لشد الشرفات ومنع ارتجاع الدم قبل الانقباض.'
      },
      {
        timestamp: '52:10',
        topic: 'التروية الدموية للـ AV Node والـ Dominance للشرايين التاجية',
        doctorQuote: 'انتبهوا جداً لمفهوم الـ Coronary Dominance، 90% من البشر Right Dominant لأن شريان الـ PDA يخرج من الـ Right Coronary Artery!',
        examTrap: 'اعتقاد أن الـ Dominance تعتمد على حجم الشريان، بينما هي تعتمد حصراً على الشريان الذي يغذي الـ Posterior Interventricular Groove.',
        expectedQuestion: 'س: كيف يتم تحديد السيادة الشريانية القلبية (Coronary Dominance) وما أهميتها السريرية؟',
        correctAnswer: 'ج: تتحدد بمنشأ شريان الـ Posterior Descending Artery (PDA)؛ فإذا نشأ من الـ RCA يكون Right dominant (وهو السائد في 90% من البشر)، وهو الذي يغذي الـ AV Node.'
      }
    ],
    topics: [
      {
        title: 'التشريح الداخلي للأذين الأيمن (Interior of Right Atrium)',
        timestamp: '04:15',
        detailedExplanation:
          'ينقسم التجويف الداخلي للأذين الأيمن تشريحياً ووظيفياً إلى جزأين متباينين تماماً يفصل بينهما من الداخل نتوء عضلي رأسي يسمى Crista Terminalis، ويقابله من الخارج أخدود Sulcus Terminalis.\n\nأولاً: الجزء الخلفي الأملس (Sinus Venarum): وهو مشتق جنينياً من الـ Sinus Venosus. يستقبل الدم غير المؤكسج من الوريد الأجوف العلوي (SVC) في أعلاه، والوريد الأجوف السفلي (IVC) في أسفله والذي يحتوي على صمام جنيني بدائي (Eustachian valve)، كما يستقبل فتحة الجيب التاجي (Coronary Sinus) المحمية بصمام Thebesian valve.\n\nثانياً: الجزء الأمامي الخشن (Atrium Proper): يحتوي على عضلات مشطية بارزة تسمى Musculi Pectinati تتجه أفقياً كشعر المشط، وتمتد لتملأ الزائدة الأذينية اليمنى (Right Auricle).\n\nالجدار الداخلي الفاصل (Interatrial Septum): يتميز بوجود انخفاض بيضاوي مميز هو الـ Fossa Ovalis التي تمثل بقايا الثقب البيضاوي الجنيني (Foramen Ovale)، وتحيط بها من الأعلى والأمام حافة بارزة سميكة تسمى Limbus Fossae Ovalis.',
        keyPoints: [
          'يفصل الـ Crista Terminalis داخلياً بين الجزء الأملس الخلفي والجزء الخشن الأمامي.',
          'الـ Sinus Venarum يستقبل SVC و IVC والـ Coronary Sinus.',
          'الـ Musculi Pectinati توجد فقط في الجزء الأمامي والـ Auricle.',
          'الـ Fossa Ovalis أرضيتها مشتقة من Septum Primum وحافتها من Septum Secundum.'
        ],
        clinicalOrPracticalExamples: [
          'في حالات عيب الحاجز الأذيني (Atrial Septal Defect - ASD)، تفشل الحافة والأرضية في الالتئام الكامل بعد الولادة مسببة Patent Foramen Ovale ومرور الدم المؤكسج من الأيسر إلى الأيمن.'
        ],
        mechanismSteps: [
          'دخول الدم غير المؤكسج من الوريدين الأجوفين العلوي والسفلي إلى الـ Sinus Venarum',
          'مرور الدم عبر تجويف الأذين الأيمن واستقبال دم عضلة القلب من الـ Coronary Sinus',
          'انقباض العضلات المشطية (Musculi Pectinati) لدفع الدم نحو الصمام ثلاثي الشرفات',
          'عبور الدم من الأذين الأيمن إلى البطين الأيمن عبر الفوهة الأذينية البطينية'
        ],
        illustrations: [
          {
            searchQuery: 'interior right atrium labeled heart anatomy',
            caption: 'التشريح الداخلي للأذين الأيمن موضحاً الـ Crista Terminalis والـ Fossa Ovalis والعضلات المشطية'
          },
          {
            searchQuery: 'fossa ovalis limbus interatrial septum heart',
            caption: 'الحاجز الأذيني موضحاً حافة وأرضية الحفرة البيضاوية (Fossa Ovalis)'
          }
        ]
      },
      {
        title: 'التشريح الداخلي للبطين الأيمن (Interior of Right Ventricle)',
        timestamp: '22:40',
        detailedExplanation:
          'يمتلك البطين الأيمن جداراً عضلياً متوسط السماكة (حوالي 4-5 مم)، ويبدو مقطعه العرضي هلالي الشكل (Crescentic) لأنه يحيط بالبطين الأيسر الدائري. ينقسم تجويف البطين الأيمن إلى:\n\n1. الجزء الداخلي المتدفق (Inflow Tract): ويتميز بوجود أعمدة وبروزات عضلية كثيفة تسمى Trabeculae Carneae تنقسم إلى ثلاثة أنواع: أعمدة ملتصقة بالجدار، وجسور عضلية حرة، وعضلات حليمية (Papillary Muscles) يخرج من قممها حبال وترية (Chordae Tendineae) ترتبط بشرفات الصمام ثلاثي الشرفات (Tricuspid Valve).\n\n2. الشريط المنظم (Moderator Band): جسر عضلي مميز وشهير يمتد من الحاجز بين البطينين إلى قاعدة العضلة الحليمية الأمامية، ويحمل الفرع الأيمن من حزمة هيس (Right Bundle Branch).\n\n3. الجزء الخارجي القمعي الأملس (Outflow Tract / Infundibulum / Conus Arteriosus): جزء ذو جدار أملس يخلو تماماً من الـ Trabeculae Carneae ويتجه لأعلى ليصل إلى الصمام الرئوي (Pulmonary Valve).',
        keyPoints: [
          'توجد 3 عضلات حليمية: Anterior (الأكبر)، Posterior، و Septal.',
          'الـ Moderator Band ينقل التنبيه الكهربائي السريع للعضلة الحليمية الأمامية.',
          'الـ Infundibulum هو الجزء الأملس المؤدي للشريان الرئوي ومستمد جنينياً من الـ Bulbus Cordis.',
          'الصمام الرئوي يتكون من 3 شرفات هلالية (Anterior, Right, Left Semilunar Cusps).'
        ],
        clinicalOrPracticalExamples: [
          'في متلازمة رباعية فالوت (Tetralogy of Fallot)، يحدث تضيق شديد في الـ Infundibulum الرئوي مسبباً نقص تدفق الدم إلى الرئتين وزرقة دم المريض.'
        ],
        mechanismSteps: [
          'استقبال الدم من الأذين الأيمن عبر الصمام ثلاثي الشرفات في الـ Inflow Tract',
          'انتقال الإشارة الكهربائية عبر الـ Moderator Band إلى العضلات الحليمية',
          'انقباض العضلات الحليمية وشد الـ Chordae Tendineae لتثبيت شرفات الصمام',
          'اندفاع الدم عبر الـ Infundibulum الأملس وفتح الصمام الرئوي نحو الشريان الرئوي'
        ],
        illustrations: [
          {
            searchQuery: 'right ventricle interior moderator band papillary muscles heart',
            caption: 'التشريح الداخلي للبطين الأيمن يوضح الـ Moderator Band والعضلات الحليمية والـ Trabeculae Carneae'
          },
          {
            searchQuery: 'pulmonary valve semilunar cusps heart anatomy',
            caption: 'صمامات القلب الهلالية وشرفات الصمام الرئوي عند قاعدة الـ Infundibulum'
          }
        ]
      },
      {
        title: 'البطين الأيسر وتوزيع الشرايين التاجية (Left Ventricle & Coronary Circulation)',
        timestamp: '48:15',
        detailedExplanation:
          'يمثل البطين الأيسر مضخة الضغط العالي في الدورة الجهازية، ولذلك يتميز جدار العضلة بسماكة تفوق سماكة البطين الأيمن بثلاثة أضعاف (12-15 مم)، ويبدو مقطعه العرضي دائرياً تماماً (Circular).\n\nيحتوي على عضلتين حليميتين ضخمتين فقط (Anterior & Posterior Papillary Muscles) ترتبطان بشرفتي الصمام الميترالي (Bicuspid / Mitral Valve). الجزء الأملس العلوي المؤدي للأورطي يسمى الدهليز الأبهري (Aortic Vestibule).\n\nالتروية الشريانية التاجية (Coronary Circulation):\nينشأ الشريانان التاجيان من الجيوب الأبهرية (Aortic Sinuses) في قاعدة الشريان الأورطي:\n- الشريان التاجي الأيسر (Left Coronary Artery - LCA): ينقسم سريعاً إلى الشريان بين البطينين الأمامي (LAD - Left Anterior Descending)، ويسمى شريان صانع الأرامل (Widow Maker) لأنه يروي ثلثي الحاجز بين البطينين والجدار الأمامي، والشريان المنعطف (Circumflex Artery).\n- الشريان التاجي الأيمن (Right Coronary Artery - RCA): يسير في الأخدود التاجي الأيمن ويعطي الشريان الهامشي (Marginal Artery) والشريان بين البطينين الخلفي (PDA) الذي يغذي الـ SA Node والـ AV Node في 90% من البشر.',
        keyPoints: [
          'جدار البطين الأيسر أسمك بثلاث مرات لمقاومة ضغط الدورة الدموية الكبرى (Afterload).',
          'الصمام الميترالي يتكون من شرفتين فقط (Anterior & Posterior).',
          'شريان الـ LAD هو الأكثر إصابة بالانسداد والجلطات القلبية (Myocardial Infarction).',
          'الـ Coronary Sinus يصب في الأذين الأيمن ويجمع 60% من دم عضلة القلب الوريدي.'
        ],
        clinicalOrPracticalExamples: [
          'انسداد شريان الـ LAD يؤدي إلى احتشاء عضلة القلب الأمامي الجداري (Anterior Wall STEMI) وقصور حاد في انقباض البطين الأيسر.',
          'انسداد الـ RCA يؤدي لاحتشاء الجدار السفلي (Inferior Wall MI) واضطراب خطير في كهربائية القلب (Complete Heart Block) بسبب انقطاع التروية عن الـ AV Node.'
        ],
        mechanismSteps: [
          'امتلاء الجيوب الأبهرية (Aortic Sinuses) بالدم أثناء مرحلة الانبساط (Ventricular Diastole)',
          'تدفق الدم التاجي في الشريانين التاجيين الأيمن والأيسر أثناء انبساط العضلة',
          'توزيع الدم عبر تفريعات الـ LAD والـ Circumflex والـ Marginal والـ PDA',
          'تجمع الدم الوريدي غير المؤكسج في الوريد القلبي الكبير والأوسط نحو الجيب التاجي (Coronary Sinus)',
          'تفريغ الجيب التاجي في الأذين الأيمن عبر فتحة محمية بصمام Thebesian Valve'
        ],
        illustrations: [
          {
            searchQuery: 'coronary arteries anatomy anterior posterior heart view',
            caption: 'المسار التشريحي للشرايين التاجية وتفريعات الـ LAD والـ RCA والـ Circumflex'
          },
          {
            searchQuery: 'left ventricle interior papillary muscles mitral valve',
            caption: 'التشريح الداخلي للبطين الأيسر موضحاً الصمام الميترالي وسماكة الجدار العضلي'
          }
        ]
      }
    ],
    comparisons: [
      {
        title: 'مقارنة تشريحية وسريرية دقيقة بين البطين الأيمن والبطين الأيسر',
        columns: ['وجه المقارنة (Feature)', 'البطين الأيمن (Right Ventricle)', 'البطين الأيسر (Left Ventricle)'],
        rows: [
          ['سماكة الجدار العضلي', '4 - 5 مم (رقيق نسبياً)', '12 - 15 مم (أسمك بـ 3 أضعاف)'],
          ['شكل المقطع العرضي', 'هلالي الشكل (Crescentic)', 'دائري كامل (Circular)'],
          ['الضغط المتولد أثناء الانقباض', 'ضغط منخفض (25 مم زئبق)', 'ضغط مرتفع (120 مم زئبق)'],
          ['صمام المدخل (Inlet Valve)', 'ثلاثي الشرفات (Tricuspid Valve)', 'ثنائي الشرفات / ميترالي (Mitral Valve)'],
          ['عدد العضلات الحليمية', '3 عضلات (Anterior, Posterior, Septal)', 'عضلتان ضخمتان فقط (Anterior, Posterior)'],
          ['الجزء المتدفق للخارج (Outflow)', 'Infundibulum / Conus Arteriosus', 'Aortic Vestibule'],
          ['وجود الـ Moderator Band', 'موجود دائماً ويحمل الـ Right Bundle', 'غير موجود إطلاقاً']
        ]
      }
    ],
    glossary: [
      {
        term: 'Crista Terminalis',
        definition: 'حافة عضلية بارزة رأسية داخل الأذين الأيمن تفصل بين الجزء الأملس الخلفي والخشن الأمامي.',
        example: 'تمثل الموقع التشريحي الخارجي للـ Sulcus Terminalis وتوجد الـ SA Node عند قمتها.'
      },
      {
        term: 'Trabeculae Carneae',
        definition: 'بروزات وأعمدة عضلية تغطي الجدران الداخلية للبطينين تمنع شفط والتصاق الجدران أثناء الانقباض.',
        example: 'تنقسم إلى أعمدة ثابتة وجسور عضلية وعضلات حليمية متصلة بالأوتار.'
      },
      {
        term: 'Moderator Band',
        definition: 'جسر عضلي يمتد من الحاجز بين البطينين لقاعدة العضلة الحليمية الأمامية في البطين الأيمن.',
        example: 'يحمل الفرع الأيمن لحزمة هيس لضمان الانقباض المتزامن.'
      },
      {
        term: 'Coronary Dominance',
        definition: 'تحديد الشريان التاجي المسؤول عن إعطاء شريان الـ Posterior Interventricular Artery (PDA).',
        example: '90% من البشر Right Dominant من الشريان التاجي الأيمن RCA.'
      },
      {
        term: 'Chordae Tendineae',
        definition: 'حبال وترية ليفية قوية تربط قمم العضلات الحليمية بحواف شرفات الصمامات الأذينية البطينية.',
        example: 'تمنع انقلاب الشرفات إلى داخل الأذينين أثناء الانقباض البطيني العنيف.'
      }
    ],
    reviewQuestions: [
      {
        question: 'ما هي التراكيب التشريحية التي تفصل بين جزأي الأذين الأيمن داخلياً وخارجياً؟',
        answer: 'داخلياً يفصل بينهما الـ Crista Terminalis، وخارجياً يقابله الـ Sulcus Terminalis.'
      },
      {
        question: 'لماذا يُعد انسداد شريان الـ LAD الأكثر خطورة سريرياً ويُطلق عليه "صانع الأرامل"؟',
        answer: 'لأنه يغذي ثلثي الحاجز بين البطينين، والجدار الأمامي للبطين الأيسر، ومعظم ألياف حزمة التوصيل الكهربائي، وانسداده يؤدي لفشل قلبي حاد أو توقف مفاجئ للقلب.'
      },
      {
        question: 'علل: لماذا يمتلك البطين الأيسر جداراً أسمك بثلاث مرات من البطين الأيمن؟',
        answer: 'لأن البطين الأيسر يضخ الدم ضد المقاومة الوعائية الجهازية العالية (Systemic Vascular Resistance) بضغط 120 مم زئبق، مقارنة بالدورة الرئوية منخفضة الضغط (25 مم زئبق).'
      }
    ],
    quiz: [
      {
        question: 'ما هو التركيب الذي يعبر داخل شريط الـ Moderator Band في البطين الأيمن؟',
        options: [
          'الفرع الأيمن لحزمة هيس (Right Bundle Branch)',
          'الشريان التاجي الأيمن',
          'العصب الحائر الأيمن',
          'الجيب التاجي'
        ],
        correctOptionIndex: 0,
        explanation: 'الـ Moderator band يحمل ألياف الفرع الأيمن لحزمة هيس للعضلة الحليمية الأمامية.'
      },
      {
        question: 'ما هو الأصل الجنيني لأرضية الحفرة البيضاوية (Floor of Fossa Ovalis)؟',
        options: ['Septum Primum', 'Septum Secundum', 'Bulbus Cordis', 'Sinus Venosus'],
        correctOptionIndex: 0,
        explanation: 'أرضية الـ Fossa ovalis مشتقة من Septum primum بينما الحافة Limbus من Septum secundum.'
      },
      {
        question: 'أي شريان تاجي يُعرف سريرياً بلقب "Widow Maker"؟',
        options: [
          'شريان الـ LAD (Left Anterior Descending)',
          'الشريان التاجي الأيمن RCA',
          'الشريان المنعطف Circumflex',
          'الشريان الهامشي Marginal'
        ],
        correctOptionIndex: 0,
        explanation: 'الـ LAD يروي معظم جدار البطين الأيسر والحاجز وانسداده يسبب احتشاءً قاتلاً.'
      }
    ],
    flashcards: [
      {
        front: 'ما هي محتويات الـ Moderator Band ووظيفته؟',
        back: 'يحمل الفرع الأيمن لحزمة هيس ويوصل الإشارة العصبية للعضلة الحليمية الأمامية لمنع ارتجاع الدم.',
        tag: 'Anatomy_RV'
      },
      {
        front: 'قارن بين أصل Fossa Ovalis وأصل حافتها Limbus.',
        back: 'الأرضية من Septum Primum، والحافة العلوية (Limbus) من Septum Secundum.',
        tag: 'Embryology'
      },
      {
        front: 'ما هو الشريان الذي يحدد الـ Coronary Dominance في القلب؟',
        back: 'شريان الـ Posterior Interventricular Artery (PDA)؛ إن نشأ من RCA فالشخص Right Dominant (90%).',
        tag: 'Coronary'
      }
    ],
    timestampsIndex: [
      {
        timestamp: '08:45',
        topic: 'الجدار الفاصل بين الأذينين والـ Fossa Ovalis والتريكة الجنينية',
        detail: 'شدد الدكتور على أن أرضية الحفرة من Septum Primum وحافتها من Septum Secundum وتأتي دائماً كـ MCQ.'
      },
      {
        timestamp: '24:30',
        topic: 'الشريط المنظم (Moderator Band) في البطين الأيمن والـ Right Bundle',
        detail: 'أكد الدكتور على نقل الإشارة الكهربائية للعضلة الحليمية الأمامية قبل الانقباض.'
      },
      {
        timestamp: '52:10',
        topic: 'التروية الدموية للـ AV Node والـ Coronary Dominance والـ PDA',
        detail: 'شرح الدكتور أن 90% من الناس Right Dominant وأن انسداد RCA يسبب بطء وإحصار القلب.'
      }
    ]
  };
}

module.exports = {
  processLectureAudio,
  adaptLectureForLanguage,
  getLocalizedQuiz,
  getLocalizedFlashcards,
  getLocalizedDoctorNotes,
  answerLectureQuestion,
  getMockLectureData,
  keyManager,
};
