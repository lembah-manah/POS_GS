# Fitur Backup & Restore Database

Menambah pada Tahap 1 yang sudah ada. **File baru:** `Backup.gs`. **File yang diperbarui:** `Config.gs` (tambah `SHEET_NAMES.BACKUP_LOG` + konstanta retensi), `Setup.gs` (tambah sheet `BACKUP_LOG` + config `AdminEmail`), `index.html` & `js.html` & `css.html` (tambah panel Backup/Restore di UI).

## Cara kerja
- **Backup** = membuat *copy* utuh file Spreadsheet (via `DriveApp`) ke folder `POS BACKUP/{tahun}/{bulan}/`, lalu dicatat di sheet `BACKUP_LOG`. Ini paling aman untuk database berbasis Sheets karena menyalin seluruh struktur+data apa adanya.
- **Retensi otomatis**: DAILY disimpan 7 terakhir, WEEKLY 4 terakhir, MONTHLY 12 terakhir, MANUAL 20 terakhir. Backup di luar batas ini file Drive-nya di-*trash* (bukan dihapus permanen — masih ada di Trash Drive ~30 hari), tapi baris di `BACKUP_LOG` tetap ada dengan status `PRUNED` supaya histori tidak hilang.
- **Restore**: hanya `SUPER_ADMIN`, wajib `confirm=true`. Sebelum menimpa apa pun, sistem otomatis membuat backup pengaman (`PRE_RESTORE`) dulu — jadi restore yang salah pun masih bisa dibatalkan dengan me-restore ulang dari snapshot itu. Sheet yang dipulihkan: `USERS, OUTLETS, TERMINALS, AUDIT_LOG, CONFIG` (sengaja **tidak** termasuk `BACKUP_LOG`, supaya histori backup/restore yang sedang berjalan tidak ikut tertimpa).

## Setup (jalankan dari editor Apps Script, sekali saja)
1. Tempel kode `Backup.gs`, dan pastikan `Config.gs` & `Setup.gs` sudah versi terbaru (lihat perubahan di atas).
2. Jalankan `setupDatabase()` lagi — aman dijalankan ulang, hanya akan menambahkan sheet `BACKUP_LOG` yang belum ada tanpa mengubah data lain.
3. (Opsional tapi disarankan) Isi kolom `AdminEmail` di sheet `CONFIG` dengan email yang akan menerima notifikasi jika backup terjadwal gagal.
4. Jalankan fungsi `setupBackupTriggers()` sekali dari editor untuk memasang jadwal otomatis:
   - **Harian** 02:00
   - **Mingguan** — Minggu, 03:00
   - **Bulanan** — tanggal 1, 04:00
   - (Zona waktu mengikuti `appsscript.json`: `Asia/Jakarta`.)
5. Refresh Web App — panel **Backup Database** akan muncul untuk `SUPER_ADMIN`/`ADMIN_PUSAT`, dan panel **Restore Database** khusus `SUPER_ADMIN`.

## Testing
| Skenario | Langkah | Hasil yang diharapkan |
|---|---|---|
| Backup manual | Login sebagai `superadmin` → klik "Backup Manual Sekarang" | File baru muncul di Drive `POS BACKUP/{tahun}/{bulan}/`, baris baru di `BACKUP_LOG` status `SUCCESS`, muncul di tabel UI |
| Retensi | Jalankan `manualBackup` lebih dari 20 kali (atau turunkan sementara nilai `BACKUP_RETENTION.MANUAL` di `Config.gs` untuk uji cepat) | Backup tertua di-trash dari Drive, baris log berubah status `PRUNED` |
| Restore | Salin `DriveFileId` dari salah satu baris backup di tabel → tempel ke kolom Restore → centang konfirmasi → klik Restore | Muncul snapshot `PRE_RESTORE` baru dulu di log, lalu data `USERS/OUTLETS/TERMINALS/CONFIG` berubah sesuai isi backup tsb |
| Restore tanpa konfirmasi | Klik Restore tanpa centang kotak konfirmasi | Pesan "Centang kotak konfirmasi terlebih dahulu." — tidak ada perubahan data |
| Restore oleh non-Super Admin | Panggil `restoreDatabase` dengan token role `ADMIN_PUSAT` | "Anda tidak memiliki izin untuk melakukan aksi ini." |
| Trigger otomatis | Jalankan manual `backupDaily()` dari editor (simulasi trigger) | Perilaku sama seperti backup manual, `TriggeredBy` tercatat `TRIGGER` |
| Simulasi gagal (opsional) | Ubah sementara nama sheet/`ss.getId()` agar salah, jalankan `backupDaily()` | Baris `BACKUP_LOG` status `FAILED`, email ke `AdminEmail` terkirim (jika sudah diisi) |

## Error yang mungkin terjadi & solusinya
| Error | Penyebab | Solusi |
|---|---|---|
| `File backup tidak ditemukan atau bukan Google Sheet` | `DriveFileId` salah/typo, atau file sudah di-trash permanen | Ambil ulang ID yang benar dari kolom File di tabel Backup, atau dari Drive |
| Restore "berhasil" tapi tidak ada perubahan | Backup yang dipilih justru snapshot terbaru (sama dengan data sekarang) | Pilih backup dengan tanggal yang benar-benar lebih lama |
| Trigger tidak jalan otomatis | `setupBackupTriggers()` belum pernah dijalankan, atau kuota trigger harian Google Apps Script terlampaui | Jalankan ulang `setupBackupTriggers()`; cek **Triggers** (ikon jam) di editor untuk memastikan 3 trigger terpasang |
| Backup gagal karena kuota Drive penuh | Akun Google Drive penyimpanannya penuh | Kosongkan Drive, atau perkecil retensi (`BACKUP_RETENTION`) di `Config.gs` |
| Email notifikasi gagal tidak terkirim | `AdminEmail` di sheet `CONFIG` masih kosong | Isi kolom tsb dengan email admin |

## Catatan penting
- Backup ini menyalin **satu file Spreadsheet database pusat** (bukan per-outlet), karena arsitektur Tahap 1 memakai satu Spreadsheet untuk semua outlet dengan kolom `OutletID` sebagai pembeda — sesuai desain multi-gerai di blueprint awal.
- Restore bersifat **destruktif** terhadap sheet yang direstore — selalu ada snapshot `PRE_RESTORE` otomatis sebagai jaring pengaman, tapi tetap gunakan dengan hati-hati di jam sepi transaksi.
