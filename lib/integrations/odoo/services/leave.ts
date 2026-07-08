import { OdooSyncService } from "../sync";
import type { SyncOptions } from "../types";

export class OdooLeaveService {
  constructor(private readonly syncService: OdooSyncService) {}

  list(limit = 50) {
    return this.syncService.listOdoo("leave", limit);
  }

  sync(options: SyncOptions = {}) {
    return this.syncService.syncLeave({ ...options, entity: "leave" });
  }

  pushToOdoo(options: SyncOptions = {}) {
    return this.sync({ ...options, direction: "LANA_TO_ODOO" });
  }

  pullFromOdoo(options: SyncOptions = {}) {
    return this.sync({ ...options, direction: "ODOO_TO_LANA" });
  }
}
