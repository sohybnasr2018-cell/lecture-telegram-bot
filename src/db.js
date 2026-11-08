const fs = require('fs');
const path = require('path');
const config = require('./config');

const DB_FILE = path.join(config.dataDir, 'database.json');

// الحالة الافتراضية لقاعدة البيانات
const defaultState = {
  users: {},      // userId -> { id, first_name, username, language: 'mix', includeImages: true, activeLectureId: null, mode: null }
  lectures: {},   // lectureId -> { id, fileUniqueId, userId, title, duration, summary, doctorNotes, quiz, flashcards, timestamps, geminiFileUri, createdAt }
};

class Database {
  constructor() {
    this.data = defaultState;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.data = { ...defaultState, ...JSON.parse(raw) };
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Error loading database, resetting to default:', err);
      this.data = defaultState;
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  // --- إدارة المستخدمين ---
  getUser(userId, defaultUser = {}) {
    const id = String(userId);
    if (!this.data.users[id]) {
      this.data.users[id] = {
        id,
        first_name: defaultUser.first_name || 'طالب',
        username: defaultUser.username || '',
        language: 'mix', // لغة مفضلة افتراضية
        includeImages: true,
        activeLectureId: null,
        mode: null,
        quizState: null,
        createdAt: new Date().toISOString()
      };
      this.save();
    }
    return this.data.users[id];
  }

  updateUser(userId, updates) {
    const id = String(userId);
    const user = this.getUser(id);
    this.data.users[id] = { ...user, ...updates };
    this.save();
    return this.data.users[id];
  }

  // --- إدارة المحاضرات والـ Cache الذكي ---
  saveLecture(lecture) {
    this.data.lectures[lecture.id] = lecture;
    this.updateUser(lecture.userId, { activeLectureId: lecture.id });
    this.save();
    return lecture;
  }

  getLecture(lectureId) {
    return this.data.lectures[lectureId] || null;
  }

  // البحث عن محاضرة عبر البصمة الصوتية الفريدة (file_unique_id) لتجنب إعادة الاستهلاك عند تداول نفس الريكورد
  getLectureByFileUniqueId(fileUniqueId) {
    if (!fileUniqueId) return null;
    return Object.values(this.data.lectures).find((l) => l.fileUniqueId === fileUniqueId) || null;
  }

  getUserActiveLecture(userId) {
    const user = this.getUser(userId);
    if (!user.activeLectureId) return null;
    return this.getLecture(user.activeLectureId);
  }

  getUserLectures(userId) {
    return Object.values(this.data.lectures)
      .filter((lec) => String(lec.userId) === String(userId))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

const db = new Database();
module.exports = db;
