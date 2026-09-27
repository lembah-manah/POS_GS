/**
 * Backup.gs — Backup database (copy file Spreadsheet) ke Google Drive,
 * retensi otomatis, penjadwalan trigger, dan restore dengan safety-snapshot.
 *
 * Struktur Drive yang dihasilkan:
 *   POS BACKUP/
 *     └── 2026/
 *          └── 09/
 *               ├── Backup_MANUAL_2026-09-27_143000.gsheet
 *               ├── Backup_DAILY_2026-09-27_020000.gsheet
 *               └── ...
 *
 * Semua backup dicatat di sheet BACKUP_LOG agar histori tidak hilang
 * meski file Drive-nya nanti di-prune sesuai retensi (poin 40: jangan hapus histori).
 */

// ------------------------------------------------------------------
// FOLDER HELPERS
// ------------------------------------------------------------------

function getOrCreateBackupRootFolder_() {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty('BACKUP_ROOT_FOLDER_ID');

  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      // folder lama terhapus manual dari Drive — buat ulang di bawah
    }
  }

  const iter = DriveApp.getFoldersByName(BACKUP_ROOT_FOLDER_NAME);
  const folder = iter.hasNext() ? iter.next() : DriveApp.createFolder(BACKUP_ROOT_FOLDER_NAME);
  props.setProperty('BACKUP_ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function getOrCreateSubfolder_(parentFolder, name) {
  const iter = parentFolder.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : parentFolder.createFolder(name);
}

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

// ------------------------------------------------------------------
// CORE BACKUP
// ------------------------------------------------------------------

/** Inti proses backup. type: MANUAL | DAILY | WEEKLY | MONTHLY | PRE_RESTORE */
function performBackup_(type, triggeredBy) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = pad2_(now.getMonth() + 1);
  const stamp = year + month + pad2_(now.getDate()) + '_' + pad2_(now.getHours()) + pad2_(now.getMinutes()) + pad2_(now.getSeconds());

  const root = getOrCreateBackupRootFolder_();
  const yearFolder = getOrCreateSubfolder_(root, year);
  const monthFolder = getOrCreateSubfolder_(yearFolder, month);

  const ss = getSpreadsheet_();
  const fileName = 'Backup_' + type + '_' + stamp;
  const sourceFile = DriveApp.getFileById(ss.getId());
  const copy = sourceFile.makeCopy(fileName, monthFolder);

  const backupId = generateId_('BKP');
  appendRowByHeader_(SHEET_NAMES.BACKUP_LOG, {
    BackupID: backupId,
    Timestamp: now,
    Type: type,
    DriveFileId: copy.getId(),
    DriveFileUrl: copy.getUrl(),
    FileName: fileName,
    TriggeredBy: triggeredBy || 'SYSTEM',
    Status: 'SUCCESS',
    Notes: ''
  });

  if (type !== 'PRE_RESTORE') {
    pruneOldBackups_(type);
  }

  return { backupId: backupId, driveFileId: copy.getId(), url: copy.getUrl(), fileName: fileName };
}

function logBackupFailure_(type, triggeredBy, errorMessage) {
  try {
    appendRowByHeader_(SHEET_NAMES.BACKUP_LOG, {
      BackupID: generateId_('BKP'),
      Timestamp: new Date(),
      Type: type,
      DriveFileId: '',
      DriveFileUrl: '',
      FileName: '',
      TriggeredBy: triggeredBy || 'SYSTEM',
      Status: 'FAILED',
      Notes: errorMessage
    });
  } catch (e) {
    Logger.log('Gagal mencatat kegagalan backup: ' + e.message);
  }

  try {
    const adminEmail = getConfigValue('AdminEmail', '');
    if (adminEmail) {
      MailApp.sendEmail(adminEmail, 'GAGAL: Backup POS Minimarket (' + type + ')',
        'Backup otomatis tipe ' + type + ' gagal pada ' + new Date() + '.\nPesan error: ' + errorMessage);
    }
  } catch (e) {
    Logger.log('Gagal mengirim email notifikasi: ' + e.message);
  }
}

// ------------------------------------------------------------------
// RETENSI (PRUNING)
// ------------------------------------------------------------------

function pruneOldBackups_(type) {
  const retention = BACKUP_RETENTION[type];
  if (!retention) return;

  const sheet = getSheet_(SHEET_NAMES.BACKUP_LOG);
  const rows = sheetToObjects_(SHEET_NAMES.BACKUP_LOG)
    .filter(function (r) { return r.Type === type && r.Status === 'SUCCESS'; })
    .sort(function (a, b) { return new Date(b.Timestamp) - new Date(a.Timestamp); });

  if (rows.length <= retention) return;

  const toPrune = rows.slice(retention); // yang paling lama, di luar batas retensi
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('Status') + 1;
  const notesCol = headers.indexOf('Notes') + 1;

  toPrune.forEach(function (row) {
    try {
      if (row.DriveFileId) DriveApp.getFileById(row.DriveFileId).setTrashed(true);
    } catch (e) {
      // file mungkin sudah dihapus manual dari Drive — abaikan, tetap tandai baris
    }
    sheet.getRange(row._rowIndex, statusCol).setValue('PRUNED');
    sheet.getRange(row._rowIndex, notesCol).setValue('Di-trash otomatis sesuai retensi (' + retention + ' terakhir)');
  });
}

// ------------------------------------------------------------------
// FUNGSI DIPANGGIL DARI UI (google.script.run)
// ------------------------------------------------------------------

function manualBackup(token) {
  try {
    const session = getSession_(token);
    requireRole_(session, [ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT]);

    const result = performBackup_('MANUAL', session.userId);
    writeAudit_(session, 'MANUAL_BACKUP', 'Backup', result.backupId, null, result);
    return ok_(result, 'Backup manual berhasil dibuat.');
  } catch (err) {
    return fail_('ERROR: ' + err.message);
  }
}

function listBackups(token, filterType) {
  try {
    const session = getSession_(token);
    requireRole_(session, [ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT]);

    let backups = sheetToObjects_(SHEET_NAMES.BACKUP_LOG).map(function (b) { delete b._rowIndex; return b; });
    if (filterType) backups = backups.filter(function (b) { return b.Type === filterType; });
    backups.sort(function (a, b) { return new Date(b.Timestamp) - new Date(a.Timestamp); });

    return ok_(backups);
  } catch (err) {
    return fail_('ERROR: ' + err.message);
  }
}

/**
 * Restore database dari sebuah backup.
 * WAJIB confirm === true (double-confirm di UI) karena operasi ini destruktif.
 * Sebelum menimpa data, sistem otomatis membuat PRE_RESTORE snapshot terlebih dahulu.
 */
function restoreDatabase(token, driveFileId, confirm) {
  try {
    const session = getSession_(token);
    requireRole_(session, [ROLES.SUPER_ADMIN]);

    if (confirm !== true) {
      return fail_('Konfirmasi eksplisit diperlukan (confirm=true) sebelum restore dijalankan — operasi ini menimpa data saat ini.');
    }
    if (!driveFileId) return fail_('driveFileId wajib diisi.');

    return withLock_(function () {
      // 1) Snapshot pengaman sebelum menimpa apa pun.
      const preRestore = performBackup_('PRE_RESTORE', session.userId);

      // 2) Buka file backup sumber.
      let backupSS;
      try {
        backupSS = SpreadsheetApp.openById(driveFileId);
      } catch (e) {
        throw new Error('File backup tidak ditemukan atau bukan Google Sheet: ' + e.message);
      }

      const currentSS = getSpreadsheet_();
      // Sengaja TIDAK memasukkan BACKUP_LOG — supaya histori backup/restore yang sedang
      // berjalan ini sendiri tidak ikut tertimpa oleh isi lama di file backup.
      const restorableSheets = [SHEET_NAMES.USERS, SHEET_NAMES.OUTLETS, SHEET_NAMES.TERMINALS, SHEET_NAMES.AUDIT_LOG, SHEET_NAMES.CONFIG];

      const restored = [];
      const skipped = [];

      restorableSheets.forEach(function (name) {
        const src = backupSS.getSheetByName(name);
        if (!src) { skipped.push(name); return; }

        const values = src.getDataRange().getValues();
        const dest = currentSS.getSheetByName(name);
        dest.clearContents();
        if (values.length > 0) {
          dest.getRange(1, 1, values.length, values[0].length).setValues(values);
        }
        restored.push(name);
      });

      writeAudit_(session, 'RESTORE_DATABASE', 'Backup', driveFileId,
        { preRestoreBackupId: preRestore.backupId },
        { restoredSheets: restored, skippedSheets: skipped });

      return ok_({ restored: restored, skipped: skipped, preRestoreBackupId: preRestore.backupId },
        'Restore selesai. Sheet dipulihkan: ' + restored.join(', ') +
        (skipped.length ? ' (dilewati, tidak ada di file backup: ' + skipped.join(', ') + ')' : '') +
        '. Snapshot pengaman sebelum restore: ' + preRestore.backupId + '.');
    });
  } catch (err) {
    return fail_('ERROR: ' + err.message);
  }
}

// ------------------------------------------------------------------
// TRIGGER TERJADWAL (dipanggil otomatis oleh ScriptApp, bukan dari UI)
// ------------------------------------------------------------------

function backupDaily() {
  try { performBackup_('DAILY', 'TRIGGER'); }
  catch (err) { logBackupFailure_('DAILY', 'TRIGGER', err.message); }
}

function backupWeekly() {
  try { performBackup_('WEEKLY', 'TRIGGER'); }
  catch (err) { logBackupFailure_('WEEKLY', 'TRIGGER', err.message); }
}

function backupMonthly() {
  try { performBackup_('MONTHLY', 'TRIGGER'); }
  catch (err) { logBackupFailure_('MONTHLY', 'TRIGGER', err.message); }
}

/**
 * Jalankan SEKALI dari editor Apps Script (bukan dari UI) untuk memasang jadwal.
 * Aman dipanggil berulang — trigger lama dengan handler yang sama dihapus dulu.
 */
function setupBackupTriggers() {
  removeTriggersFor_('backupDaily');
  removeTriggersFor_('backupWeekly');
  removeTriggersFor_('backupMonthly');

  ScriptApp.newTrigger('backupDaily').timeBased().everyDays(1).atHour(2).create();
  ScriptApp.newTrigger('backupWeekly').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
  ScriptApp.newTrigger('backupMonthly').timeBased().onMonthDay(1).atHour(4).create();

  Logger.log('Trigger backup terpasang: DAILY 02:00, WEEKLY Minggu 03:00, MONTHLY tanggal 1 pukul 04:00 (zona waktu sesuai appsscript.json: Asia/Jakarta).');
}

function removeTriggersFor_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(t);
  });
}
