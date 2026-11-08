const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { getWikimediaImage, fetchImageAsDataUri, generateMechanismSvg } = require('./images');

/**
 * دالة توليد مذكرة PDF أكاديمية شاملة وتفصيلية للغاية ومزودة بصور ورسوم توضيحية حقيقية
 */
async function generateLecturePdf(data, outputPath, options = {}) {
  const language = options.language || 'mix'; // 'ar', 'en', 'mix'
  const isRtl = language !== 'en';
  const includeImages = options.includeImages !== false;

  const title = data.title || 'مذكرة المحاضرة الأكاديمية الشاملة';
  const doctor = data.doctor || 'الدكتور المحاضر';
  const duration = data.duration || 'غير محدد';
  const date = data.date || new Date().toLocaleDateString('ar-EG');
  const summary = data.summary || data.executiveSummary || '';
  const topics = data.topics || [];
  const doctorNotes = data.doctorNotes || [];
  const comparisons = data.comparisons || [];
  const glossary = data.glossary || [];
  const reviewQuestions = data.reviewQuestions || [];

  // 1. جلب الصور الحقيقية وتوليد المخططات الانسيابية بالتوازي السريع
  const enrichedTopics = await Promise.all(
    topics.map(async (topic, i) => {
      const imagesList = [];
      if (includeImages) {
        const queries = [];
        if (topic.illustrations && Array.isArray(topic.illustrations)) {
          topic.illustrations.forEach((ill) => {
            if (ill.searchQuery) queries.push({ query: ill.searchQuery, caption: ill.caption });
          });
        } else if (topic.imageSearchQuery) {
          queries.push({ query: topic.imageSearchQuery, caption: topic.imageCaption });
        }

        const fetched = await Promise.all(
          queries.map(async (qItem) => {
            try {
              const url = await getWikimediaImage(qItem.query);
              if (url) {
                const dataUri = await fetchImageAsDataUri(url);
                if (dataUri) {
                  return { dataUri, caption: qItem.caption };
                }
              }
            } catch (err) {
              console.warn(`[PDF] Image fetch skipped:`, err.message);
            }
            return null;
          })
        );
        fetched.filter(Boolean).forEach((img) => imagesList.push(img));
      }

      let mechanismSvg = '';
      if (includeImages && topic.mechanismSteps && topic.mechanismSteps.length > 0) {
        mechanismSvg = generateMechanismSvg(topic.mechanismSteps, `مسار وآلية: ${topic.title}`);
      }

      return {
        ...topic,
        imagesList,
        mechanismSvg,
      };
    })
  );

  // 2. بناء كود الـ HTML بتصميم مجلة ومذكرة أكاديمية راقية وشاملة
  const html = `
<!DOCTYPE html>
<html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0284c7;
      --primary-dark: #0369a1;
      --primary-deep: #0c4a6e;
      --primary-light: #e0f2fe;
      --accent: #f59e0b;
      --danger: #ef4444;
      --danger-light: #fee2e2;
      --success: #10b981;
      --bg-card: #f8fafc;
      --border: #cbd5e1;
      --text-main: #0f172a;
      --text-muted: #334155;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: ${isRtl ? "'Cairo', 'Inter', sans-serif" : "'Inter', 'Cairo', sans-serif"};
      color: var(--text-main);
      background-color: #ffffff;
      line-height: 1.8;
      font-size: 13.5px;
      padding: 25px 35px;
    }

    /* الغلاف الأكاديمي الرائع */
    .header-banner {
      background: linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%);
      color: #ffffff;
      border-radius: 16px;
      padding: 26px 30px;
      margin-bottom: 25px;
      box-shadow: 0 10px 20px -5px rgba(2, 132, 199, 0.3);
      position: relative;
    }

    .badge-bar {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .badge {
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(8px);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
    }

    .header-title {
      font-size: 24px;
      font-weight: 900;
      margin-bottom: 12px;
      line-height: 1.35;
    }

    .header-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      font-size: 12px;
      opacity: 0.95;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding-top: 12px;
    }

    /* فهرس المحتويات */
    .toc-card {
      background: #f1f5f9;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 25px;
    }

    .toc-title {
      font-size: 14px;
      font-weight: 800;
      color: var(--primary-deep);
      margin-bottom: 10px;
    }

    .toc-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px 15px;
      font-size: 12px;
      list-style-type: none;
    }

    .toc-item {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 4px;
    }

    /* الملخص التنفيذي */
    .summary-card {
      background: #f8fafc;
      border-right: ${isRtl ? '5px solid var(--primary)' : 'none'};
      border-left: ${!isRtl ? '5px solid var(--primary)' : 'none'};
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 25px;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }

    .section-title {
      font-size: 18px;
      font-weight: 900;
      color: var(--primary-deep);
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 2px solid var(--primary-light);
      padding-bottom: 6px;
    }

    /* تنبيهات وأسئلة الفاينال المؤكدة */
    .doctor-notes-card {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-right: ${isRtl ? '6px solid #d97706' : '1px solid #fef3c7'};
      border-left: ${!isRtl ? '6px solid #d97706' : '1px solid #fef3c7'};
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 30px;
      page-break-inside: avoid;
    }

    .doctor-notes-card h3 {
      color: #b45309;
      font-size: 16px;
      font-weight: 900;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .note-item {
      margin-bottom: 12px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #ffffff;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid #fde68a;
    }

    .note-bullet {
      color: #d97706;
      font-weight: bold;
      font-size: 16px;
    }

    /* بطاقة المحور والموضوع التفصيلي */
    .topic-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 30px;
      page-break-inside: avoid;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }

    .topic-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 10px;
    }

    .topic-title {
      font-size: 17px;
      font-weight: 900;
      color: var(--primary-deep);
    }

    .timestamp-badge {
      background: var(--primary-light);
      color: var(--primary-dark);
      padding: 4px 12px;
      border-radius: 14px;
      font-size: 11.5px;
      font-weight: 700;
      font-family: 'Fira Code', monospace;
    }

    /* الحاوية المخصصة للصور التعليمية الحقيقية */
    .image-container {
      text-align: center;
      margin: 18px 0;
      padding: 10px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      page-break-inside: avoid;
    }

    .image-container img {
      max-width: 90%;
      max-height: 340px;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      display: inline-block;
    }

    .image-caption {
      font-size: 11.5px;
      color: #64748b;
      margin-top: 8px;
      font-weight: 600;
      font-style: italic;
    }

    /* الشرح المطول والفقرات */
    .detailed-text {
      color: var(--text-muted);
      line-height: 1.85;
      font-size: 13.5px;
      margin-bottom: 16px;
      text-align: justify;
    }

    .subpoints-box {
      background: #f8fafc;
      border-radius: 10px;
      padding: 14px 18px;
      margin: 14px 0;
      border: 1px solid #e2e8f0;
    }

    .subpoints-title {
      font-weight: 800;
      font-size: 13px;
      color: var(--primary-dark);
      margin-bottom: 8px;
    }

    .topic-bullets {
      list-style-type: none;
      padding: 0;
    }

    .topic-bullets li {
      position: relative;
      padding-right: ${isRtl ? '22px' : '0'};
      padding-left: ${!isRtl ? '22px' : '0'};
      margin-bottom: 10px;
      line-height: 1.7;
    }

    .topic-bullets li::before {
      content: '▪';
      color: var(--primary);
      position: absolute;
      right: ${isRtl ? '4px' : 'auto'};
      left: ${!isRtl ? '4px' : 'auto'};
      font-size: 16px;
    }

    /* صندوق التطبيقات السريرية والعملية */
    .clinical-box {
      background: #eff6ff;
      border-right: ${isRtl ? '4px solid #3b82f6' : 'none'};
      border-left: ${!isRtl ? '4px solid #3b82f6' : 'none'};
      border-radius: 8px;
      padding: 12px 16px;
      margin: 14px 0;
      font-size: 12.5px;
    }

    .clinical-box strong {
      color: #1d4ed8;
      display: block;
      margin-bottom: 4px;
    }

    .term-inline {
      background: #e2e8f0;
      color: #0f172a;
      padding: 2px 7px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      font-family: 'Inter', sans-serif;
      direction: ltr;
      display: inline-block;
    }

    /* جدول المقارنات الشامل */
    .comparison-section {
      margin: 30px 0;
      page-break-inside: avoid;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--border);
      margin-top: 10px;
    }

    th {
      background: #0c4a6e;
      color: #ffffff;
      font-weight: 800;
      padding: 12px 14px;
      text-align: ${isRtl ? 'right' : 'left'};
      font-size: 12.5px;
    }

    td {
      padding: 11px 14px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
      line-height: 1.6;
    }

    tr:nth-child(even) {
      background: #f8fafc;
    }

    /* أسئلة وتطبيقات المراجعة */
    .qa-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .qa-question {
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 6px;
    }

    .qa-answer {
      color: var(--primary-deep);
      background: var(--primary-light);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
    }

    /* ذيل الصفحة */
    .footer {
      margin-top: 40px;
      border-top: 1px solid var(--border);
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      color: #64748b;
      font-size: 11px;
    }
  </style>
</head>
<body>

  <!-- الهيدر الأكاديمي الرئيسي -->
  <div class="header-banner">
    <div class="badge-bar">
      <span class="badge">🎓 مذكرة دراسية تفصيلية شاملة</span>
      <span class="badge">🎙️ تفريغ وتحليل دقيق بالذكاء الاصطناعي</span>
      <span class="badge">${language === 'ar' ? 'اللغة العربية 🇪🇬' : language === 'en' ? 'English 🇬🇧' : 'مكس عربي / مصطلحات إنجليزي 🔄'}</span>
    </div>
    <h1 class="header-title">${escapeHtml(title)}</h1>
    <div class="header-meta">
      <span>👨‍🏫 المحاضر: <strong>${escapeHtml(doctor)}</strong></span>
      <span>⏱️ مدة التسجيل: <strong>${escapeHtml(duration)}</strong></span>
      <span>📅 تاريخ التفريغ: <strong>${escapeHtml(date)}</strong></span>
    </div>
  </div>

  <!-- جدول المحتويات والمحاور -->
  <div class="toc-card">
    <div class="toc-title">📑 محاور وخريطة المحاضرة:</div>
    <ul class="toc-list">
      ${topics.map((t, idx) => `
        <li class="toc-item">
          <span>${idx + 1}. ${escapeHtml(t.title)}</span>
          <span style="font-family: 'Fira Code', monospace; color: #0284c7;">${t.timestamp || ''}</span>
        </li>
      `).join('')}
    </ul>
  </div>

  <!-- الملخص التنفيذي الشامل -->
  <div class="summary-card">
    <h2 class="section-title">📌 الملخص الشامل للمحاضرة</h2>
    <div class="detailed-text">${escapeHtml(summary)}</div>
  </div>

  <!-- تنبيهات وأسئلة الدكتور للامتحان بدقة فائقة -->
  ${doctorNotes.length > 0 ? `
  <div class="doctor-notes-card">
    <h3>🎯 أسئلة وتنبيهات ركز عليها الدكتور أثناء الشرح (توقعات الامتحان الدقيقة):</h3>
    ${doctorNotes.map(note => {
      if (typeof note === 'object' && note !== null) {
        return `
          <div class="note-item" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <span style="font-weight: 800; color: #b45309; font-size: 14px;">📌 ${escapeHtml(note.topic || 'تنبيه امتحاني هام')}</span>
              ${note.timestamp ? `<span class="timestamp-badge">⏱️ ${escapeHtml(note.timestamp)}</span>` : ''}
            </div>
            ${note.doctorQuote ? `<div style="color: #92400e; line-height: 1.6;">📢 <strong>ما شدد عليه الدكتور:</strong> "${escapeHtml(note.doctorQuote)}"</div>` : ''}
            ${note.examTrap ? `<div style="color: #b91c1c; background: #fee2e2; padding: 6px 12px; border-radius: 6px; font-size: 12px;">⚠️ <strong>التركة الامتحانية:</strong> ${escapeHtml(note.examTrap)}</div>` : ''}
            ${note.expectedQuestion ? `
              <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 10px 14px; border-radius: 8px; margin-top: 4px;">
                <div style="font-weight: 700; color: #0369a1;">❓ ${escapeHtml(note.expectedQuestion)}</div>
                ${note.correctAnswer ? `<div style="color: #15803d; font-size: 12px; margin-top: 4px;">✅ <strong>الإجابة النموذجية:</strong> ${escapeHtml(note.correctAnswer)}</div>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }
      return `
        <div class="note-item">
          <span class="note-bullet">⚠️</span>
          <div>${escapeHtml(String(note))}</div>
        </div>
      `;
    }).join('')}
  </div>
  ` : ''}

  <!-- المحاور والموضوعات التفصيلية والشاملة -->
  <h2 class="section-title" style="margin-top: 30px; margin-bottom: 20px;">📖 الشرح التفصيلي لجميع محاور المحاضرة:</h2>

  ${enrichedTopics.map((t, idx) => `
    <div class="topic-card">
      <div class="topic-header">
        <div class="topic-title">${idx + 1}. ${escapeHtml(t.title)}</div>
        ${t.timestamp ? `<div class="timestamp-badge">⏱️ ${t.timestamp}</div>` : ''}
      </div>

      <!-- معرض الصور التعليمية المتناسبة مع الشرح -->
      ${t.imagesList && t.imagesList.length > 0 ? `
        <div class="images-gallery" style="display: grid; grid-template-columns: ${t.imagesList.length > 1 ? 'repeat(2, 1fr)' : '1fr'}; gap: 15px; margin: 18px 0;">
          ${t.imagesList.map((img, imgIdx) => `
            <div class="image-container" style="margin: 0; padding: 8px;">
              <img src="${img.dataUri}" alt="${escapeHtml(t.title)}" />
              ${img.caption ? `<div class="image-caption">الشكل (${idx + 1}.${imgIdx + 1}): ${escapeHtml(img.caption)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- الشرح الأكاديمي الموسع والمفصل -->
      <div class="detailed-text">${escapeHtml(t.detailedExplanation || t.description || '')}</div>

      <!-- المخطط الانسيابي للمسار والآلية إن وجد -->
      ${t.mechanismSvg || ''}

      <!-- النقاط والتفاصيل الفرعية العميقة -->
      ${t.keyPoints && t.keyPoints.length > 0 ? `
        <div class="subpoints-box">
          <div class="subpoints-title">🔍 تفاصيل وعناصر المحور الهامة:</div>
          <ul class="topic-bullets">
            ${t.keyPoints.map(pt => `<li>${escapeHtml(pt)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <!-- التطبيقات السريرية والعملية التي ذكرها الدكتور -->
      ${t.clinicalOrPracticalExamples && t.clinicalOrPracticalExamples.length > 0 ? `
        <div class="clinical-box">
          <strong>💡 تطبيقات عملية وسريرية قيلت في المحاضرة:</strong>
          <ul style="padding-right: 18px; margin-top: 6px;">
            ${t.clinicalOrPracticalExamples.map(ex => `<li>${escapeHtml(ex)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `).join('')}

  <!-- جداول المقارنة الشاملة إن وجدت -->
  ${comparisons.length > 0 ? `
    <h2 class="section-title" style="margin-top: 30px; margin-bottom: 16px;">⚖️ جداول المقارنة لتثبيت الفهم:</h2>
    ${comparisons.map(comp => `
      <div class="comparison-section">
        <h4 style="font-size: 14px; font-weight: 800; color: #0284c7; margin-bottom: 6px;">📊 ${escapeHtml(comp.title)}</h4>
        <table>
          <thead>
            <tr>
              ${comp.columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${comp.rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('')}
  ` : ''}

  <!-- جدول معجم المصطلحات والمفاهيم العلمية -->
  ${glossary.length > 0 ? `
    <h2 class="section-title" style="margin-top: 30px; margin-bottom: 16px;">📚 معجم المصطلحات العلمية والطبية:</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 25%;">المصطلح العلمي (Term)</th>
          <th style="width: 45%;">التعريف والشرح الدقيق (Definition)</th>
          <th style="width: 30%;">أمثلة وتطبيقات</th>
        </tr>
      </thead>
      <tbody>
        ${glossary.map(g => `
          <tr>
            <td><span class="term-inline">${escapeHtml(g.term)}</span></td>
            <td>${escapeHtml(g.definition)}</td>
            <td>${escapeHtml(g.example || '—')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  <!-- بنك أسئلة المراجعة الذاتية -->
  ${reviewQuestions.length > 0 ? `
    <h2 class="section-title" style="margin-top: 35px; margin-bottom: 16px;">❓ بنك أسئلة وتطبيقات المراجعة الذاتية:</h2>
    ${reviewQuestions.map((q, idx) => `
      <div class="qa-card">
        <div class="qa-question">س${idx + 1}: ${escapeHtml(q.question)}</div>
        <div class="qa-answer"><strong>الإجابة النموذجية:</strong> ${escapeHtml(q.answer)}</div>
      </div>
    `).join('')}
  ` : ''}

  <!-- ذيل الصفحة الختامي -->
  <div class="footer">
    <div>تم إعداد هذه المذكرة عبر بوت تفريغ وتلخيص المحاضرات الذكي 🎓</div>
    <div>${escapeHtml(title)}</div>
  </div>

</body>
</html>
  `;

  // توليد الـ PDF عبر Puppeteer
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const launchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  if (fs.existsSync(edgePath)) {
    launchOptions.executablePath = edgePath;
  }

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '18mm',
        bottom: '18mm',
        left: '14mm',
        right: '14mm',
      },
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="font-size: 8.5px; font-family: 'Cairo', 'Inter', sans-serif; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 16mm; direction: ${isRtl ? 'rtl' : 'ltr'};">
          <span>${escapeHtml(title)}</span>
          <span>صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></span>
        </div>
      `,
    });

    return outputPath;
  } finally {
    await browser.close();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  generateLecturePdf,
};
