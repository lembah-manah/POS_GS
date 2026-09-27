/**
 * User.gs — CRUD user. Pembuatan user dibatasi SUPER_ADMIN & ADMIN_PUSAT.
 */

function createUser(token, data) {
  try {
    const session = getSession_(token);
    requireRole_(session, [ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT]);

    return withLock_(function () {
      const users = sheetToObjects_(SHEET_NAMES.USERS);
      if (users.some(function (u) { return u.Username === data.username; })) {
        throw new Error('Username sudah digunakan.');
      }

      const userId = generateId_('USR');
      const newUser = {
        UserID: userId, Username: data.username, Email: data.email || '',
        Nama: data.nama, AuthKey: hashPassword_(data.password),
        Role: data.role, OutletID: data.outletId || '', AreaID: data.areaId || '',
        Status: 'ACTIVE', LastLogin: '', CreatedAt: new Date(), UpdatedAt: new Date()
      };
      appendRowByHeader_(SHEET_NAMES.USERS, newUser);
      writeAudit_(session, 'CREATE_USER', 'User', userId, null, newUser);
      return ok_({ userId: userId }, 'User berhasil dibuat.');
    });
  } catch (err) {
    return fail_('ERROR: ' + err.message);
  }
}

function listUsers(token) {
  try {
    const session = getSession_(token);
    requireRole_(session, [ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.MANAGER_AREA, ROLES.MANAGER_OUTLET]);

    let users = sheetToObjects_(SHEET_NAMES.USERS).map(function (u) {
      delete u.AuthKey; // jangan pernah kirim hash password ke frontend
      delete u._rowIndex;
      return u;
    });

    if (session.role === ROLES.MANAGER_OUTLET) {
      users = users.filter(function (u) { return u.OutletID === session.outletId; });
    } else if (session.role === ROLES.MANAGER_AREA) {
      users = users.filter(function (u) { return u.AreaID === session.areaId; });
    }

    return ok_(users);
  } catch (err) {
    return fail_('ERROR: ' + err.message);
  }
}

function setUserStatus(token, userId, status) {
  try {
    const session = getSession_(token);
    requireRole_(session, [ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT]);

    return withLock_(function () {
      const sheet = getSheet_(SHEET_NAMES.USERS);
      const users = sheetToObjects_(SHEET_NAMES.USERS);
      const target = users.find(function (u) { return u.UserID === userId; });
      if (!target) throw new Error('User tidak ditemukan.');

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const statusCol = headers.indexOf('Status') + 1;
      sheet.getRange(target._rowIndex, statusCol).setValue(status);

      writeAudit_(session, 'SET_USER_STATUS', 'User', userId, { Status: target.Status }, { Status: status });
      return ok_(null, 'Status user diperbarui.');
    });
  } catch (err) {
    return fail_('ERROR: ' + err.message);
  }
}
