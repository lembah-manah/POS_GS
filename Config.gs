/**
 * Config.gs
 * Konfigurasi global aplikasi POS Multi-Gerai — Tahap 1.
 *
 * PENTING: ID Spreadsheet database disimpan di Script Properties (bukan hard-code).
 * Tidak perlu diisi manual — setupDatabase() di Setup.gs akan membuatnya otomatis
 * lewat createDatabaseSpreadsheet_() jika belum ada. Lihat initSpreadsheetId_()
 * di bawah hanya jika Anda memilih memakai Spreadsheet yang sudah ada sendiri.
 */

const SHEET_NAMES = {
  USERS: 'USERS',
  OUTLETS: 'OUTLETS',
  TERMINALS: 'TERMINALS',
  AUDIT_LOG: 'AUDIT_LOG',
  CONFIG: 'CONFIG',
  BACKUP_LOG: 'BACKUP_LOG'
};

const BACKUP_ROOT_FOLDER_NAME = 'POS BACKUP';

/** Retensi backup per tipe — backup lama di luar jumlah ini akan di-trash dari Drive (baris log tetap disimpan, ditandai PRUNED). */
const BACKUP_RETENTION = {
  DAILY: 7,
  WEEKLY: 4,
  MONTHLY: 12,
  MANUAL: 20,
  PRE_RESTORE: 5
};

const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN_PUSAT: 'ADMIN_PUSAT',
  MANAGER_AREA: 'MANAGER_AREA',
  MANAGER_OUTLET: 'MANAGER_OUTLET',
  SUPERVISOR: 'SUPERVISOR',
  KASIR: 'KASIR',
  GUDANG: 'GUDANG'
};

const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 jam

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('SPREADSHEET_ID belum diset. Jalankan setupDatabase() sekali dari editor Apps Script — Spreadsheet baru akan dibuat otomatis.');
  }
  return SpreadsheetApp.openById(id);
}

/**
 * Alternatif lama: jika Anda memilih membuat Spreadsheet sendiri dulu lalu bind
 * script ke dalamnya (Extensions > Apps Script dari dalam Sheet), jalankan fungsi
 * ini sekali sebagai ganti createDatabaseSpreadsheet_(). Tidak wajib dipakai jika
 * Anda menjalankan setupDatabase() dari project standalone (lihat README).
 */
function initSpreadsheetId_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Tidak ada Spreadsheet aktif — fungsi ini hanya berlaku jika script di-bind ke dalam sebuah Sheet. Jika script Anda standalone (dibuat dari script.google.com), cukup jalankan setupDatabase() saja — Spreadsheet baru akan dibuat otomatis.');
  }
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('SPREADSHEET_ID diset ke: ' + ss.getId());
}

/**
 * Dipanggil otomatis oleh setupDatabase() jika belum ada Spreadsheet tersimpan.
 * Membuat Spreadsheet Google baru dan menyimpan ID-nya ke Script Properties.
 * Bisa juga dipanggil manual dari editor bila sengaja ingin membuat database baru dari nol.
 */
function createDatabaseSpreadsheet_(name) {
  const ss = SpreadsheetApp.create(name || 'DB-POS-Minimarket');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('Spreadsheet database baru dibuat otomatis: ' + ss.getUrl());
  return ss;
}

function getConfigValue(key, defaultValue) {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.CONFIG);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return defaultValue;
}
