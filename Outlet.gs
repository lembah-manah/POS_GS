/**
 * Outlet.gs — CRUD Outlet & Terminal. Daftar difilter sesuai cakupan akses role.
 */

function createOutlet(token, data) {
  try {
    const session = getSession_(token);
    requireRole_(session, [ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT]);

    return withLock_(function () {
      const outletId = generateId_('OTL');
      const newOutlet = {
        OutletID: outletId, OutletCode: data.outletCode, OutletName: data.outletName,
        Address: data.address || '', City: data.city || '', Province: data.province || '',
        Phone: data.phone || '', ManagerID: data.managerId || '', AreaID: data.areaId || '',
        Status: 'ACTIVE', OpeningDate: new Date(), CreatedAt: new Date(), UpdatedAt: new Date()
      };
      appendRowByHeader_(SHEET_NAMES.OUTLETS, newOutlet);
      writeAudit_(session, 'CREATE_OUTLET', 'Outlet', outletId, null, newOutlet);
      return ok_({ outletId: outletId }, 'Outlet berhasil dibuat.');
    });
  } catch (err) {
    return fail_('ERROR: ' + err.message);
  }
}

/** Level akses: SUPER_ADMIN/ADMIN_PUSAT lihat semua; MANAGER_AREA lihat area-nya; sisanya hanya outlet sendiri. */
function listOutlets(token) {
  try {
    const session = getSession_(token);
    let outlets = sheetToObjects_(SHEET_NAMES.OUTLETS).map(function (o) {
      delete o._rowIndex;
      return o;
    });

    if (session.role === ROLES.MANAGER_AREA) {
      outlets = outlets.filter(function (o) { return o.AreaID === session.areaId; });
    } else if ([ROLES.MANAGER_OUTLET, ROLES.SUPERVISOR, ROLES.KASIR, ROLES.GUDANG].indexOf(session.role) !== -1) {
      outlets = outlets.filter(function (o) { return o.OutletID === session.outletId; });
    }
    // SUPER_ADMIN & ADMIN_PUSAT: tanpa filter, lihat semua outlet

    return ok_(outlets);
  } catch (err) {
    return fail_('ERROR: ' + err.message);
  }
}

function createTerminal(token, data) {
  try {
    const session = getSession_(token);
    requireRole_(session, [ROLES.SUPER_ADMIN, ROLES.ADMIN_PUSAT, ROLES.MANAGER_OUTLET]);

    if (session.role === ROLES.MANAGER_OUTLET && data.outletId !== session.outletId) {
      throw new Error('Manager Outlet hanya boleh menambah terminal di outlet sendiri.');
    }

    return withLock_(function () {
      const terminalId = generateId_('TRM');
      const newTerminal = {
        TerminalID: terminalId, OutletID: data.outletId, TerminalCode: data.terminalCode,
        TerminalName: data.terminalName, Status: 'ACTIVE', LastTransactionNumber: 0,
        CreatedAt: new Date()
      };
      appendRowByHeader_(SHEET_NAMES.TERMINALS, newTerminal);
      writeAudit_(session, 'CREATE_TERMINAL', 'Terminal', terminalId, null, newTerminal);
      return ok_({ terminalId: terminalId }, 'Terminal berhasil dibuat.');
    });
  } catch (err) {
    return fail_('ERROR: ' + err.message);
  }
}

function listTerminals(token, outletId) {
  try {
    getSession_(token); // hanya memastikan sesi valid
    const terminals = sheetToObjects_(SHEET_NAMES.TERMINALS)
      .filter(function (t) { return t.OutletID === outletId; })
      .map(function (t) { delete t._rowIndex; return t; });
    return ok_(terminals);
  } catch (err) {
    return fail_('ERROR: ' + err.message);
  }
}
