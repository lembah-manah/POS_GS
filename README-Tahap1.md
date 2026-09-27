# Tahap 1: Database + Authentication + Multi Outlet

## Isi tahap ini
Sheet **USERS, OUTLETS, TERMINALS, AUDIT_LOG, CONFIG**, login berbasis Username/Password (bukan Google Account — supaya kasir tanpa akun Google tetap bisa login), sesi via `CacheService`, dan RBAC dasar (SUPER_ADMIN, ADMIN_PUSAT, MANAGER_AREA, MANAGER_OUTLET, SUPERVISOR, KASIR, GUDANG). Modul Produk, Harga, POS, dll menyusul di tahap berikutnya sesuai roadmap.

## 1. Cara membuat project & pasang kode (sekarang otomatis — tidak perlu membuat Sheet manual)
1. Buka **script.google.com** → **New project** (project berdiri sendiri/*standalone*, tidak perlu dibuat dari dalam Google Sheets lagi).
2. Beri nama project, misalnya `POS Minimarket Pusat` (klik judul "Untitled project" di kiri atas).
3. Hapus isi default `Code.gs`, lalu buat file-file berikut satu per satu (**+ → Script** untuk `.gs`, **+ → HTML** untuk `.html`) dan tempel kode dari masing-masing file yang sudah dibuat:
   - `Config.gs`, `Utility.gs`, `Setup.gs`, `Auth.gs`, `User.gs`, `Outlet.gs`, `Backup.gs`, `Code.gs`
   - `index.html`, `css.html`, `js.html`
4. Buka **Project Settings (ikon gerigi)** → centang "Show `appsscript.json` manifest file in editor" → isi sesuai `appsscript.json` yang disediakan.

> Jika Anda tetap lebih suka membuat Spreadsheet-nya sendiri dulu secara manual lalu bind script ke dalamnya (**Extensions → Apps Script** dari dalam Sheet), itu masih bisa — jalankan `initSpreadsheetId_()` sekali sebelum `setupDatabase()`. Tapi untuk sebagian besar kasus, langkah di bawah ini (otomatis) sudah cukup.

## 2. Jalankan setup (sekali saja) — Spreadsheet database dibuat otomatis
1. Di editor Apps Script, pilih fungsi `setupDatabase` dari dropdown fungsi di toolbar → klik **Run (▶)**.
2. Google akan menampilkan peringatan izin akses ("unverified app") karena ini project pribadi Anda sendiri — klik **Review permissions → Advanced → Buka [nama project] (tidak aman) → Allow**. Ini normal dan hanya muncul sekali.
3. Fungsi ini otomatis: **membuat Spreadsheet Google baru** bernama `DB-POS-Minimarket`, membuat semua sheet (`USERS`, `OUTLETS`, `TERMINALS`, `AUDIT_LOG`, `CONFIG`, `BACKUP_LOG`) beserta header, mengisi config default, dan mengisi 1 outlet contoh (`OTL001`), 1 terminal (`POS001`), dan 1 user.
4. Buka tab **Executions** (ikon jam di sisi kiri editor) → klik eksekusi `setupDatabase` terakhir → lihat log: akan tertulis URL Spreadsheet yang baru dibuat, misalnya `Spreadsheet database baru dibuat otomatis: https://docs.google.com/spreadsheets/d/xxxxx/edit`. Buka link itu untuk melihat/mengelola data secara langsung bila perlu.
5. Login pertama:
   - **Username:** `superadmin`
   - **Password:** `Admin123!`
   - Ganti password ini setelah pengujian pertama (fungsi ganti password menyusul di Tahap 2 lanjutan/`User.gs` — untuk sekarang bisa diganti manual: jalankan `hashPassword_('PasswordBaru')` dari editor lalu tempel hasilnya ke kolom `AuthKey` baris user tsb, langsung di Spreadsheet).

> **Menjalankan `setupDatabase()` lagi di kemudian hari** (misalnya setelah menambah `Backup.gs`) itu aman — fungsi ini tidak menimpa data yang sudah ada, hanya menambahkan sheet yang belum ada.

## 3. Deploy sebagai Web App
1. **Deploy → New deployment**.
2. Pilih tipe **Web app**.
3. Execute as: **Me** (atau **User deploying** sesuai `appsscript.json`). Access: **Anyone** (atau **Anyone within [organisasi]** jika pakai Google Workspace, supaya tidak publik ke internet).
4. **Deploy**, salin URL Web App yang muncul — ini alamat aplikasi POS-nya.

## 4. Testing
| Skenario | Langkah | Hasil yang diharapkan |
|---|---|---|
| Login valid | Buka URL Web App, isi `superadmin` / `Admin123!` | Masuk ke tampilan app, tabel Outlet & User tampil |
| Login salah password | Isi password sembarang | Pesan "Username atau password salah." |
| Login user nonaktif | Set `Status` user jadi `INACTIVE` di sheet, coba login | Pesan "Akun tidak aktif. Hubungi admin." |
| Sesi kedaluwarsa | Tunggu >8 jam atau hapus manual key `session_...` di Cache, lalu panggil fungsi apa pun | Pesan "Sesi kedaluwarsa. Silakan login ulang." |
| Buat user baru | Panggil `createUser(token, {...})` dari editor (Execute function, isi token hasil login manual) sebagai role KASIR | Baris baru muncul di sheet `USERS`, tercatat di `AUDIT_LOG` |
| Batasan role | Login sebagai KASIR (buat user contoh dulu), coba akses `listUsers` | Pesan "Anda tidak memiliki izin untuk melakukan aksi ini." |
| Outlet-scoping | Login sebagai `MANAGER_OUTLET` milik `OTL001`, panggil `listOutlets` | Hanya `OTL001` yang muncul, bukan outlet lain |

## 5. Contoh pemanggilan dari editor (untuk uji manual sebelum ada UI penuh)
```javascript
function testLogin() {
  const res = loginUser('superadmin', 'Admin123!');
  Logger.log(JSON.stringify(res));
}

function testCreateOutlet() {
  const login = loginUser('superadmin', 'Admin123!');
  const res = createOutlet(login.data.token, {
    outletCode: 'OTL002', outletName: 'Outlet Cabang 1',
    city: 'Jepara', areaId: 'AREA01'
  });
  Logger.log(JSON.stringify(res));
}
```

## 6. Error yang mungkin terjadi & solusinya
| Error | Penyebab | Solusi |
|---|---|---|
| `SPREADSHEET_ID belum diset` | Lupa jalankan `initSpreadsheetId_()` | Jalankan dari editor, sekali saja |
| `Sheet "USERS" tidak ditemukan` | Lupa jalankan `setupDatabase()` | Jalankan dari editor |
| `Authorization required` saat Run pertama kali | Wajar — script baru pertama kali minta izin | Klik **Review permissions → Advanced → Buka (tidak aman)** → **Allow** |
| Web App menampilkan halaman kosong/putih | File `index.html`/`css.html`/`js.html` belum lengkap atau nama file salah (case-sensitive) | Cocokkan nama file persis: `index`, `css`, `js` |
| `Sistem sedang sibuk, coba lagi` | Dua eksekusi berebut `LockService` bersamaan (>10 detik) | Coba ulang; jika sering terjadi, cek apakah ada proses lain yang lama menahan lock |
| Ingin ganti ke Spreadsheet baru yang lain | `SPREADSHEET_ID` di Script Properties masih menunjuk ke database lama | Buka **Project Settings → Script Properties**, hapus/ubah `SPREADSHEET_ID`, lalu jalankan `setupDatabase()` lagi untuk membuat yang baru (data lama di Spreadsheet sebelumnya tidak ikut terhapus) |
| Login berhasil di editor tapi gagal di Web App browser | Deployment lama (URL lama) masih dipakai setelah update kode | Setiap ubah kode, buat **New deployment** lagi atau **Manage deployments → Edit → New version** |

## Selanjutnya
Setelah Tahap 1 ini diuji dan berjalan baik di spreadsheet Anda, lanjut ke **Tahap 3: Master Product** (Products, Categories, Price List) — beri tahu saya jika sudah siap lanjut, atau jika ada bagian Tahap 1 yang perlu direvisi dulu (mis. tambah role, ubah durasi sesi, atau ganti mekanisme login).
