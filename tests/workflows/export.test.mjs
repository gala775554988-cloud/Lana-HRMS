import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";

test("employee export applies active filters and selected column order to every page", async () => {
  const queries = [];
  let exported;
  class NextResponse {
    constructor(bytes, options) { this.bytes = bytes; this.status = options?.status ?? 200; }
    static json(body, options) { return { body, status: options?.status ?? 200 }; }
  }
  const { GET } = await load("app/api/hr/[module]/export/route.ts", {
    "next/server": { NextResponse },
    xlsx: {},
    "@/config/hrms": { getHrmsModule: () => ({ key: "employees", filterFields: ["status"] }) },
    "@/lib/hrms/actions": { listModuleRecords: async query => {
      queries.push(query);
      return { pageCount: 2, records: [{ employeeNumber: "000" + query.page, firstName: "موظف", department: { name: "إدارة" } }] };
    } },
    "@/lib/exports/table-files": {
      buildPdfTable: async (_title, columns, rows) => { exported = { columns, rows }; return new Uint8Array(); },
      buildExcelTable: async () => assert.fail("Wrong export format"),
    },
    "@/lib/i18n-server": { getRequestDictionary: async () => ({ dictionary: { fields: {}, nav: {} } }) },
  });
  const get = query => GET({ nextUrl: new URL("https://fixture.test/export?" + query) }, { params: Promise.resolve({ module: "employees" }) });
  assert.equal((await get("format=pdf&fields=firstName,employeeNumber&department=test-department&hospital=test-hospital")).status, 200);
  assert.equal(queries.length, 2);
  assert.equal(queries[0].filters.department, "test-department");
  assert.equal(queries[1].filters.hospital, "test-hospital");
  assert.equal(Array.from(exported.columns, column => column.key).join(","), "firstName,employeeNumber");
  assert.equal(exported.rows.length, 2);
  assert.equal((await get("fields=passwordHash")).status, 400);
});
