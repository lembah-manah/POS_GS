/**
 * Auth.gs — Login, logout, session (CacheService), dan otorisasi role.
 */

function loginUser(username, password) {
  try {
    if (!username || !password) return fail_('Username dan password wajib diisi.');

    const users = sheetToObjects_(SHEET_NAMES.USERS);
    const user = users.find(function (u) { return u.Username === username; });

    if (!user) return fail_('Username atau password salah.');
    if (user.Status !== 'ACTIVE') return fail_('Akun tidak aktif. Hubungi admin.');
    if (!verifyPassword_(password, user.AuthKey)) return fail_('Username atau password salah.');

    const token = Utilities.getUuid();
    const session = {
      token: token,
      userId: user.UserID,
      username: user.Username,
      nama: user.Nama,
      role: user.Role,
      outletId: user.OutletID,
      areaId: user.AreaID
    };

    CacheService.getScriptCache().put('session_' + token, JSON.stringify(session), SESSION_DURATION_SECONDS);

    updateLastLogin_(user._rowIndex);
    writeAudit_(session, 'LOGIN', 'Auth', user.UserID);

    return ok_(session, 'Login berhasil.');
  } catch (err) {
    return fail_('ERROR: ' + err.message);
  }
}

function logoutUser(token) {
  if (token) CacheService.getScriptCache().remove('session_' + token);
  return ok_(null, 'Logout berhasil.');
}

/** Dipanggil oleh modul lain untuk memvalidasi token sebelum eksekusi fungsi apa pun. */
function getSession_(token) {
  if (!token) throw new Error('Sesi tidak ditemukan. Silakan login ulang.');
  const raw = CacheService.getScriptCache().get('session_' + token);
  if (!raw) throw new Error('Sesi kedaluwarsa. Silakan login ulang.');
  return JSON.parse(raw);
}

/** Lempar error jika role pada session tidak termasuk allowedRoles. */
function requireRole_(session, allowedRoles) {
  if (allowedRoles.indexOf(session.role) === -1) {
    throw new Error('Anda tidak memiliki izin untuk melakukan aksi ini.');
  }
}

function updateLastLogin_(rowIndex) {
  const sheet = getSheet_(SHEET_NAMES.USERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = headers.indexOf('LastLogin') + 1;
  sheet.getRange(rowIndex, col).setValue(new Date());
}
