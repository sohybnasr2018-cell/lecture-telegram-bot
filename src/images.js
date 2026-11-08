const https = require('https');
const http = require('http');

/**
 * جلب صورة علمية أو تشريحية أو هندسية حقيقية عالية الدقة من Wikimedia Commons
 * مجانية 100%، بدون API Key وبدون حدود استخدام
 * @param {string} query - كلمات البحث بالإنجليزية (مثل: "cardiac conduction system" أو "nephron anatomy")
 * @returns {Promise<string|null>} رابط الصورة المباشر أو null
 */
async function getWikimediaImage(query) {
  if (!query) return null;
  try {
    const cleanQuery = query.replace(/[^\w\s-]/g, '').trim();
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      cleanQuery
    )}&gsrlimit=3&gsrnamespace=6&prop=imageinfo&iiprop=url|mime&format=json`;

    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'AcademicLectureNoteBot/1.0 (academic; free-education)',
      },
      signal: AbortSignal.timeout(5000), // مهلة 5 ثواني كحد أقصى
    });

    const data = await res.json();
    if (!data.query || !data.query.pages) return null;

    const pages = Object.values(data.query.pages);
    // البحث عن أول صورة ملائمة (تفضيل svg, jpg, png وتجنب pdf أو tiff)
    for (const page of pages) {
      if (page.imageinfo && page.imageinfo[0] && page.imageinfo[0].url) {
        const url = page.imageinfo[0].url;
        const mime = page.imageinfo[0].mime || '';
        if (
          mime.includes('image/jpeg') ||
          mime.includes('image/png') ||
          mime.includes('image/svg+xml') ||
          url.endsWith('.jpg') ||
          url.endsWith('.jpeg') ||
          url.endsWith('.png') ||
          url.endsWith('.svg')
        ) {
          return url;
        }
      }
    }
    return null;
  } catch (err) {
    console.warn(`[Images] Failed to fetch Wikimedia image for "${query}":`, err.message);
    return null;
  }
}

/**
 * تنزيل صورة وتحويلها إلى Base64 Data URI لضمان ظهورها 100% داخل الـ PDF بدون اعتماد على الشبكة
 */
async function fetchImageAsDataUri(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'AcademicLectureNoteBot/1.0',
      },
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.warn(`[Images] Failed to convert image to Data URI (${url}):`, err.message);
    return null;
  }
}

/**
 * توليد مخطط انسيابي فائق الجمال بـ SVG Vector لمسارات الشرح والآليات (Flowchart / Mechanism)
 * يظهر بدقة كريستالية في الطباعة بدون أي تشويش
 */
function generateMechanismSvg(steps, title = 'آلية ومسار العملية') {
  if (!steps || steps.length === 0) return '';

  const stepHeight = 55;
  const arrowHeight = 25;
  const totalHeight = steps.length * (stepHeight + arrowHeight) + 40;
  const width = 650;

  const colors = [
    { bg: '#e0f2fe', border: '#0284c7', text: '#0369a1', badge: '#0284c7' },
    { bg: '#f0fdf4', border: '#10b981', text: '#15803d', badge: '#10b981' },
    { bg: '#fef3c7', border: '#f59e0b', text: '#b45309', badge: '#f59e0b' },
    { bg: '#fae8ff', border: '#d946ef', text: '#86198f', badge: '#d946ef' },
    { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6', badge: '#8b5cf6' },
  ];

  let itemsSvg = '';
  steps.forEach((step, idx) => {
    const color = colors[idx % colors.length];
    const y = 30 + idx * (stepHeight + arrowHeight);

    // صندوق الخطوة
    itemsSvg += `
      <g transform="translate(40, ${y})">
        <rect width="${width - 80}" height="${stepHeight}" rx="10" fill="${color.bg}" stroke="${color.border}" stroke-width="1.5" />
        <circle cx="28" cy="${stepHeight / 2}" r="14" fill="${color.badge}" />
        <text x="28" y="${stepHeight / 2 + 5}" font-family="'Cairo', sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">${idx + 1}</text>
        <text x="55" y="${stepHeight / 2 + 5}" font-family="'Cairo', 'Inter', sans-serif" font-size="13" font-weight="600" fill="${color.text}">${escapeXml(step)}</text>
      </g>
    `;

    // سهم الانتقال للخطوة التالية
    if (idx < steps.length - 1) {
      const arrowY = y + stepHeight;
      itemsSvg += `
        <g transform="translate(${width / 2}, ${arrowY})">
          <line x1="0" y1="2" x2="0" y2="${arrowHeight - 4}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="3,3" />
          <polygon points="-4,${arrowHeight - 4} 4,${arrowHeight - 4} 0,${arrowHeight + 2}" fill="#64748b" />
        </g>
      `;
    }
  });

  return `
    <div style="margin: 20px 0; text-align: center;">
      <div style="font-family: 'Cairo', sans-serif; font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px;">
        🔄 ${escapeXml(title)}
      </div>
      <svg viewBox="0 0 ${width} ${totalHeight}" style="max-width: 100%; height: auto; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 10px;">
        ${itemsSvg}
      </svg>
    </div>
  `;
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  getWikimediaImage,
  fetchImageAsDataUri,
  generateMechanismSvg,
};
