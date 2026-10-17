const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'gallery.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDatabase() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
      UNIQUE(section_id, slug)
    );

    CREATE TABLE IF NOT EXISTS artworks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      section_id INTEGER NOT NULL,
      category_id INTEGER,
      original_filename TEXT NOT NULL,
      original_path TEXT NOT NULL,
      display_path TEXT NOT NULL,
      thumbnail_path TEXT NOT NULL,
      webp_display_path TEXT,
      webp_thumbnail_path TEXT,
      width INTEGER,
      height INTEGER,
      display_width INTEGER,
      display_height INTEGER,
      thumbnail_width INTEGER,
      thumbnail_height INTEGER,
      orientation TEXT,
      file_size INTEGER,
      mime_type TEXT,
      tags TEXT,
      is_featured INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_artworks_section ON artworks(section_id);
    CREATE INDEX IF NOT EXISTS idx_artworks_category ON artworks(category_id);
    CREATE INDEX IF NOT EXISTS idx_artworks_uuid ON artworks(uuid);
    CREATE INDEX IF NOT EXISTS idx_artworks_active ON artworks(is_active);
    CREATE INDEX IF NOT EXISTS idx_artworks_featured ON artworks(is_featured);
    CREATE INDEX IF NOT EXISTS idx_categories_section ON categories(section_id);
  `);

  // Create default admin user if none exists
  const adminExists = database.prepare('SELECT id FROM users LIMIT 1').get();
  if (!adminExists) {
    const username = process.env.ADMIN_USERNAME || 'pyrolux';
    const password = process.env.ADMIN_PASSWORD || 'changeme123';
    const hashedPassword = bcrypt.hashSync(password, 12);
    database.prepare('INSERT INTO users (username, password) VALUES (?, ?)')
      .run(username, hashedPassword);
    console.log(`✅ Default admin created: ${username}`);
  }

  // Create default sections based on Pyrolux Gallery structure
  const sectionsExist = database.prepare('SELECT id FROM sections LIMIT 1').get();
  if (!sectionsExist) {
    const defaultSections = [
      { name: 'Digital Art', slug: 'digital-art', description: 'Digital artwork and illustrations', order: 1 },
      { name: 'Traditional Art', slug: 'traditional-art', description: 'Traditional paintings and drawings', order: 2 },
      { name: 'Concept Art', slug: 'concept-art', description: 'Concept art and design work', order: 3 },
      { name: 'Character Design', slug: 'character-design', description: 'Character designs and studies', order: 4 },
      { name: 'Environment', slug: 'environment', description: 'Environment art and landscapes', order: 5 },
      { name: 'Sketches', slug: 'sketches', description: 'Sketches and studies', order: 6 },
      { name: 'Commissions', slug: 'commissions', description: 'Commissioned artwork', order: 7 },
      { name: 'Fan Art', slug: 'fan-art', description: 'Fan art and tributes', order: 8 }
    ];

    const insertSection = database.prepare(
      'INSERT INTO sections (name, slug, description, display_order) VALUES (?, ?, ?, ?)'
    );
    const insertCategory = database.prepare(
      'INSERT INTO categories (section_id, name, slug, description, display_order) VALUES (?, ?, ?, ?, ?)'
    );

    const insertSections = database.transaction(() => {
      for (const section of defaultSections) {
        const result = insertSection.run(section.name, section.slug, section.description, section.order);

        // Add default categories for each section
        const defaultCategories = [
          { name: 'Featured', slug: 'featured', description: 'Featured works', order: 1 },
          { name: 'Recent', slug: 'recent', description: 'Recent works', order: 2 },
          { name: 'Archive', slug: 'archive', description: 'Archived works', order: 3 }
        ];

        for (const cat of defaultCategories) {
          insertCategory.run(result.lastInsertRowid, cat.name, cat.slug, cat.description, cat.order);
        }
      }
    });

    insertSections();
    console.log('✅ Default sections and categories created');
  }

  console.log('✅ Database initialized');
  return database;
}

module.exports = { getDb, initDatabase };
