import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class SqliteHelper {
  static Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'board_scanner_local.db');

    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        // Create local folders table
        await db.execute('''
          CREATE TABLE folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parentId TEXT,
            isSynced INTEGER DEFAULT 0,
            isDeleted INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL
          )
        ''');

        // Create local scans table
        await db.execute('''
          CREATE TABLE scans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            filePath TEXT NOT NULL,
            boardType TEXT NOT NULL,
            storageSize INTEGER NOT NULL,
            ocrText TEXT,
            folderId TEXT,
            isSynced INTEGER DEFAULT 0,
            isDeleted INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL
          )
        ''');
      },
    );
  }

  // Folders Operations
  Future<void> insertFolder(Map<String, dynamic> folder) async {
    final db = await database;
    await db.insert('folders', folder, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<Map<String, dynamic>>> getFolders(String? parentId) async {
    final db = await database;
    if (parentId == null) {
      return await db.query('folders', where: 'parentId IS NULL AND isDeleted = 0');
    }
    return await db.query('folders', where: 'parentId = ? AND isDeleted = 0', whereArgs: [parentId]);
  }

  // Scans Operations
  Future<void> insertScan(Map<String, dynamic> scan) async {
    final db = await database;
    await db.insert('scans', scan, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<Map<String, dynamic>>> getScans(String? folderId) async {
    final db = await database;
    if (folderId == null) {
      return await db.query('scans', where: 'folderId IS NULL AND isDeleted = 0');
    }
    return await db.query('scans', where: 'folderId = ? AND isDeleted = 0', whereArgs: [folderId]);
  }

  // Soft delete scan offline
  Future<void> deleteScan(String id) async {
    final db = await database;
    await db.update('scans', {'isDeleted': 1, 'isSynced': 0}, where: 'id = ?', whereArgs: [id]);
  }

  // Mark items as synced
  Future<void> markScanSynced(String id) async {
    final db = await database;
    await db.update('scans', {'isSynced': 1}, where: 'id = ?', whereArgs: [id]);
  }
}
