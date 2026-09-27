/**
 * Utility.gs — helper umum dipakai semua modul lain.
 */

function ok_(data, message) {
  return { success: true, data: (data === undefined ? null : data), message: message || '' };
}

function fail_(message) {
  return { success: false, data: null, message: message };
}

function getSheet_(name) {
  const sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" tidak ditemukan. Jalankan setupDatabase() dulu.');
  return sheet;
}

/** Ambil seluruh baris sebuah sheet sebagai array of object; key = header baris 1. */
function sheetToObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const obj = {};
    headers.forEach(function (h, idx) { obj[h] = values[i][idx]; });
    obj._rowIndex = i + 1; // 1-based, untuk update baris spesifik nanti
    rows.push(obj);
  }
  return rows;
}

function appendRowByHeader_(sheetName, dataObj) {
  const sheet = getSheet_(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(function (h) { return dataObj[h] !== undefined ? dataObj[h] : ''; });
  sheet.appendRow(row);
}

/** ID untuk master data (User, Outlet, Terminal, dst) — BUKAN nomor transaksi. */
function generateId_(prefix) {
  return prefix + Utilities.getUuid().substring(0, 8).toUpperCase();
}

/** Hash password dengan SHA-256 + salt acak. Disimpan sebagai "salt:hash". */
function hashPassword_(password, salt) {
  salt = salt || Utilities.getUuid();
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + password);
  const hash = raw.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
  return salt + ':' + hash;
}

function verifyPassword_(password, stored) {
  const parts = String(stored).split(':');
  if (parts.length !== 2) return false;
  return hashPassword_(password, parts[0]) === stored;
}

/** Jalankan fn di dalam LockService — cegah race condition (mis. dua user dibuat dgn username sama bersamaan). */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  const gotLock = lock.tryLock(10000); // tunggu maks 10 detik
  if (!gotLock) throw new Error('Sistem sedang sibuk, coba lagi beberapa saat.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function writeAudit_(session, action, module, refId, oldValue, newValue) {
  appendRowByHeader_(SHEET_NAMES.AUDIT_LOG, {
    LogID: generateId_('LOG'),
    Timestamp: new Date(),
    UserID: session ? session.userId : 'SYSTEM',
    OutletID: session ? session.outletId : '',
    Action: action,
    Module: module,
    ReferenceID: refId || '',
    OldValue: oldValue ? JSON.stringify(oldValue) : '',
    NewValue: newValue ? JSON.stringify(newValue) : ''
  });
}
