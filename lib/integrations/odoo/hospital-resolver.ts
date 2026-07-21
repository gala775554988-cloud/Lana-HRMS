type UpsertDelegate = {
  upsert(args: any): Promise<any>;
  update(args: any): Promise<any>;
};

/** Single source of truth for resolving/creating a Hospital (+ matching Branch)
 * from an Odoo "school"/work-location name. This logic used to be duplicated
 * across 4 call sites with 2 different Hospital.code schemes (ODOO-HOSP-*
 * here vs ODOO-SCHOOL-* elsewhere), which fragmented the same physical
 * hospital into multiple Hospital rows depending on which sync entry point
 * ran last -- and one of the 4 (employee-master sync, the main "Sync Odoo"
 * button) used an invalid `where: { name }` upsert (Hospital.name isn't
 * unique) that always threw and was silently swallowed, so it never linked
 * any employee to a hospital at all. Every sync path must resolve through
 * this one function so hospital identity stays consistent no matter which
 * button triggered the sync. */
export async function resolveOdooHospital(
  hospitalDelegate: UpsertDelegate,
  branchDelegate: UpsertDelegate,
  hospitalName: string
): Promise<{ hospitalId: string; branchId?: string } | null> {
  const cleaned = hospitalName.trim();
  if (!cleaned) return null;

  const cleanSlug = cleaned.replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `HOSP-${Date.now()}`;
  const hospitalCode = `ODOO-HOSP-${cleanSlug}`;

  let hospital: { id: string; branchId?: string | null };
  try {
    hospital = await hospitalDelegate.upsert({
      where: { code: hospitalCode },
      update: { name: cleaned, isActive: true },
      create: { name: cleaned, code: hospitalCode, isActive: true }
    });
  } catch {
    return null;
  }

  let branchId: string | undefined;
  try {
    const branchCode = `HOSP-${hospital.id}`;
    const branch = await branchDelegate.upsert({
      where: { code: branchCode },
      update: { name: cleaned, isActive: true },
      create: { name: cleaned, code: branchCode, isActive: true }
    });
    branchId = branch.id;
    if (hospital.branchId !== branch.id) {
      await hospitalDelegate.update({ where: { id: hospital.id }, data: { branchId: branch.id } });
    }
  } catch {}

  return { hospitalId: hospital.id, branchId };
}
