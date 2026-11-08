const initSqlJs = require('sql.js');
const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha1(str) {
  return crypto.createHash('sha1').update(str).digest('hex');
}

function fieldChecksum(str) {
  const hash = sha1(str);
  return parseInt(hash.substring(0, 8), 16);
}

// إنشاء معرف فريد للبطاقات
function generateGuid() {
  return crypto.randomBytes(8).toString('base64').replace(/[\/+=]/g, '_');
}

/**
 * إنشاء ملف Anki Deck (.apkg) كامل وجاهز للاستيراد
 * @param {string} deckName - اسم حزمة البطاقات
 * @param {Array<{front: string, back: string, tag?: string}>} cards - قائمة البطاقات
 * @param {string} outputPath - مسار حفظ الملف
 */
async function createAnkiDeck(deckName, cards, outputPath) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  const now = Math.floor(Date.now() / 1000);
  const deckId = Date.now();
  const modelId = deckId + 1;

  // 1. إنشاء الجداول القياسية لتطبيق أنكي
  db.run(`
    CREATE TABLE col (
      id integer primary key,
      crt integer not null,
      mod integer not null,
      scm integer not null,
      ver integer not null,
      dty integer not null,
      usn integer not null,
      ls integer not null,
      conf text not null,
      models text not null,
      decks text not null,
      dconf text not null,
      tags text not null
    );

    CREATE TABLE notes (
      id integer primary key,
      guid text not null,
      mid integer not null,
      mod integer not null,
      usn integer not null,
      tags text not null,
      flds text not null,
      sfld text not null,
      csum integer not null,
      flags integer not null,
      data text not null
    );

    CREATE TABLE cards (
      id integer primary key,
      nid integer not null,
      did integer not null,
      ord integer not null,
      mod integer not null,
      usn integer not null,
      type integer not null,
      queue integer not null,
      due integer not null,
      ivl integer not null,
      factor integer not null,
      reps integer not null,
      lapses integer not null,
      left integer not null,
      odue integer not null,
      odid integer not null,
      flags integer not null,
      data text not null
    );

    CREATE INDEX ix_notes_usn on notes (usn);
    CREATE INDEX ix_cards_usn on cards (usn);
    CREATE INDEX ix_cards_nid on cards (nid);
    CREATE INDEX ix_cards_sched on cards (did, queue, due);
  `);

  // 2. إعداد مواصفات النموذج (Model) والمجموعة (Deck)
  const models = {};
  models[modelId] = {
    id: modelId,
    name: "Standard Lecture Flashcard",
    type: 0,
    mod: now,
    usn: -1,
    sortf: 0,
    did: deckId,
    tmpls: [
      {
        name: "Card 1",
        ord: 0,
        qfmt: `<div style="font-family: 'Cairo', Arial, sans-serif; direction: rtl; text-align: center; font-size: 22px; color: #1e293b; padding: 20px;">{{Front}}</div>`,
        afmt: `{{FrontSide}}<hr id="answer"><div style="font-family: 'Cairo', Arial, sans-serif; direction: rtl; text-align: center; font-size: 19px; color: #0284c7; padding: 20px; line-height: 1.6;">{{Back}}</div>`,
        did: null,
        bqfmt: "",
        bafmt: ""
      }
    ],
    flds: [
      { name: "Front", ord: 0, sticky: false, rtl: true, font: "Arial", size: 20 },
      { name: "Back", ord: 1, sticky: false, rtl: true, font: "Arial", size: 20 }
    ],
    css: ".card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }",
    latexPre: "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
    latexPost: "\\end{document}",
    req: [[0, "all", [0]]]
  };

  const decks = {};
  decks[deckId] = {
    id: deckId,
    name: deckName,
    desc: "تم توليد هذه البطاقات آلياً بواسطة بوت تلخيص المحاضرات الذكي 🎓",
    mod: now,
    usn: -1,
    collapsed: false,
    browserCollapsed: false,
    dyn: 0,
    conf: 1,
    extendNew: 10,
    extendRev: 50
  };

  const dconf = {
    1: {
      id: 1,
      name: "Default",
      mod: 0,
      usn: 0,
      maxTaken: 60,
      autoplay: true,
      timer: 0,
      replayq: true,
      new: { bury: false, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20 },
      rev: { bury: false, ease4: 1.3, fzs: 0, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 100 },
      lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 }
    }
  };

  const conf = {
    nextPos: 1,
    estTimes: true,
    activeDecks: [1],
    sortType: "noteFld",
    timeLim: 0,
    sortBackwards: false,
    addToCur: true,
    curDeck: 1,
    curModel: modelId,
    collapseTime: 1200
  };

  db.run(`
    INSERT INTO col VALUES (
      1, $crt, $mod, $scm, 11, 0, 0, 0,
      $conf, $models, $decks, $dconf, '{}'
    )
  `, {
    $crt: now,
    $mod: now * 1000,
    $scm: now * 1000,
    $conf: JSON.stringify(conf),
    $models: JSON.stringify(models),
    $decks: JSON.stringify(decks),
    $dconf: JSON.stringify(dconf)
  });

  // 3. إضافة البطاقات
  let cardIndex = 1;
  for (const card of cards) {
    const noteId = Date.now() + cardIndex;
    const cardId = Date.now() + cardIndex + 50000;
    const guid = generateGuid();
    const frontText = card.front.trim();
    const backText = card.back.trim();
    const flds = `${frontText}\x1f${backText}`;
    const csum = fieldChecksum(frontText);

    db.run(`
      INSERT INTO notes VALUES (
        $id, $guid, $mid, $mod, -1, $tags, $flds, $sfld, $csum, 0, ''
      )
    `, {
      $id: noteId,
      $guid: guid,
      $mid: modelId,
      $mod: now,
      $tags: card.tag || "محاضرة",
      $flds: flds,
      $sfld: frontText,
      $csum: csum
    });

    db.run(`
      INSERT INTO cards VALUES (
        $id, $nid, $did, 0, $mod, -1, 0, 0, $due, 0, 2500, 0, 0, 0, 0, 0, 0, ''
      )
    `, {
      $id: cardId,
      $nid: noteId,
      $did: deckId,
      $mod: now,
      $due: cardIndex
    });

    cardIndex++;
  }

  // 4. تصدير قاعدة البيانات وضغطها في ملف ZIP (.apkg)
  const binaryDb = db.export();
  db.close();

  const zip = new JSZip();
  zip.file("collection.anki2", Buffer.from(binaryDb));
  zip.file("media", "{}");

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const zipContent = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(outputPath, zipContent);

  return outputPath;
}

/**
 * تصدير البطاقات كملف نصي TSV جاهز للاستيراد السريع
 */
function createAnkiTsv(deckName, cards, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let content = `#separator:tab\n#html:true\n#deck:${deckName}\n#tags column:3\n`;
  for (const c of cards) {
    const front = c.front.replace(/\t/g, ' ').replace(/\n/g, '<br>');
    const back = c.back.replace(/\t/g, ' ').replace(/\n/g, '<br>');
    const tag = (c.tag || 'محاضرة').replace(/\s+/g, '_');
    content += `${front}\t${back}\t${tag}\n`;
  }
  fs.writeFileSync(outputPath, content, 'utf8');
  return outputPath;
}

module.exports = {
  createAnkiDeck,
  createAnkiTsv
};
