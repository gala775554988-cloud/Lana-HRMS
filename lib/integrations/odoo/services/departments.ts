import { OdooSyncService } from "../sync";
import type { SyncOptions } from "../types";

export class OdooDepartmentsService {
  constructor(private readonly syncService: OdooSyncService) {}

  list(limit = 50) {
    return this.syncService.listOdoo("departments", limit);
  }

  sync(options: SyncOptions = {}) {
    return this.syncService.syncDepartments({ ...options, entity: "departments" });
  }

  pushToOdoo(options: SyncOptions = {}) {
    return this.sync({ ...options, direction: "LANA_TO_ODOO" });
  }

  pullFromOdoo(options: SyncOptions = {}) {
    return this.sync({ ...options, direction: "ODOO_TO_LANA" });
  }
}
