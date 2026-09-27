/**
 * Setup.gs — Membuat struktur database Tahap 1 dan mengisi data contoh.
 *
 * CARA PAKAI (jalankan dari editor Apps Script, bukan dari Web App):
 *   Cukup jalankan setupDatabase() SEKALI. Jika belum ada Spreadsheet yang
 *   tersimpan (SPREADSHEET_ID di Script Properties kosong), fungsi ini akan
 *   otomatis membuat Spreadsheet Google baru bernama "DB-POS-Minimarket" —
 *   tidak perlu membuat Sheet secara manual lebih dulu.
 *
 *   (Opsional) Jika Anda tetap ingin memakai Spreadsheet yang sudah ada sendiri
 *   dengan cara bind script ke dalamnya, jalankan initSpreadsheetId_() di
 *   Config.gs sebagai gantinya SEBELUM menjalankan setupDatabase().
 */

function setupDatabase() {
  ensureSpreadsheetExists_();
  const ss = getSpreadsheet_();

  createSheetIfMissing_(ss, SHEET_NAMES.USERS,
    ['UserID', 'Username', 'Email', 'Nama', 'AuthKey', 'Role', 'OutletID', 'AreaID', 'Status', 'LastLogin', 'CreatedAt', 'UpdatedAt']);

  createSheetIfMissing_(ss, SHEET_NAMES.OUTLETS,
    ['OutletID', 'OutletCode', 'OutletName', 'Address', 'City', 'Province', 'Phone', 'ManagerID', 'AreaID', 'Status', 'OpeningDate', 'CreatedAt', 'UpdatedAt']);

  createSheetIfMissing_(ss, SHEET_NAMES.TERMINALS,
    ['TerminalID', 'OutletID', 'TerminalCode', 'TerminalName', 'Status', 'LastTransactionNumber', 'CreatedAt']);

  createSheetIfMissing_(ss, SHEET_NAMES.AUDIT_LOG,
    ['LogID', 'Timestamp', 'UserID', 'OutletID', 'Action', 'Module', 'ReferenceID', 'OldValue', 'NewValue']);

  createSheetIfMissing_(ss, SHEET_NAMES.CONFIG,
    ['Key', 'Value']);

  createSheetIfMissing_(ss, SHEET_NAMES.BACKUP_LOG,
    ['BackupID', 'Timestamp', 'Type', 'DriveFileId', 'DriveFileUrl', 'FileName', 'TriggeredBy', 'Status', 'Notes']);

  seedConfig_();
  seedSampleData_();
  cleanupDefaultSheet_(ss);

  Logger.log('setupDatabase() selesai. Buka database di: ' + ss.getUrl());
}

/** Membuat Spreadsheet baru otomatis jika belum pernah dibuat/di-set sebelumnya. */
function ensureSpreadsheetExists_() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SPREADSHEET_ID')) {
    createDatabaseSpreadsheet_('DB-POS-Minimarket');
  }
}

/** SpreadsheetApp.create() selalu menyertakan 1 sheet default (mis. "Sheet1") — hapus setelah sheet kita sendiri siap. */
function cleanupDefaultSheet_(ss) {
  const keep = [SHEET_NAMES.USERS, SHEET_NAMES.OUTLETS, SHEET_NAMES.TERMINALS, SHEET_NAMES.AUDIT_LOG, SHEET_NAMES.CONFIG, SHEET_NAMES.BACKUP_LOG];
  const sheets = ss.getSheets();
  if (sheets.length <= keep.length) return; // tidak ada sheet ekstra untuk dibersihkan
  sheets.forEach(function (sh) {
    if (keep.indexOf(sh.getName()) === -1) {
      ss.deleteSheet(sh);
    }
  });
}

function createSheetIfMissing_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function seedConfig_() {
  const sheet = getSheet_(SHEET_NAMES.CONFIG);
  if (sheet.getLastRow() > 1) return; // sudah ada isi, jangan timpa
  const defaults = [
    ['CompanyName', 'Minimarket Pusat'],
    ['TransactionPrefix', 'POS'],
    ['DefaultPayment', 'CASH'],
    ['StockMethod', 'MOVING_AVERAGE'],
    ['TaxRate', '0'],
    ['AdminEmail', ''] // isi dengan email admin agar dapat notifikasi jika backup otomatis gagal
  ];
  defaults.forEach(function (row) { sheet.appendRow(row); });
}

function seedSampleData_() {
  const users = getSheet_(SHEET_NAMES.USERS);
  if (users.getLastRow() > 1) return; // sudah pernah diseed, jangan duplikat

  const outletId = 'OTL001';

  appendRowByHeader_(SHEET_NAMES.OUTLETS, {
    OutletID: outletId, OutletCode: 'OTL001', OutletName: 'Outlet Pusat',
    Address: '-', City: '-', Province: '-', Phone: '-',
    ManagerID: '', AreaID: 'AREA01', Status: 'ACTIVE',
    OpeningDate: new Date(), CreatedAt: new Date(), UpdatedAt: new Date()
  });

  appendRowByHeader_(SHEET_NAMES.TERMINALS, {
    TerminalID: 'POS001', OutletID: outletId, TerminalCode: 'POS001',
    TerminalName: 'Kasir 1', Status: 'ACTIVE', LastTransactionNumber: 0,
    CreatedAt: new Date()
  });

  // Username: superadmin | Password default: Admin123!  -> WAJIB diganti setelah login pertama.
  appendRowByHeader_(SHEET_NAMES.USERS, {
    UserID: 'USR001', Username: 'superadmin', Email: 'admin@example.com',
    Nama: 'Super Administrator', AuthKey: hashPassword_('Admin123!'),
    Role: ROLES.SUPER_ADMIN, OutletID: outletId, AreaID: 'AREA01',
    Status: 'ACTIVE', LastLogin: '', CreatedAt: new Date(), UpdatedAt: new Date()
  });

  Logger.log('Data contoh dibuat. Login: superadmin / Admin123!');
}
