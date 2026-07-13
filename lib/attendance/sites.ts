import { prisma } from '@/lib/prisma';

export type AttendanceSiteAssignmentType = 'hospital' | 'branch' | 'department' | 'sponsor' | 'text';

export type AttendanceSite = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  assignmentType: AttendanceSiteAssignmentType;
  assignmentValue: string;
  isActive: boolean;
  requirePhoto?: boolean;
  createdAt: string;
  updatedAt: string;
};

type AttendanceSiteStore = { version: 1; sites: Record<string, AttendanceSite> };

const STORE_KEY = 'attendance.geofence.sites';

export function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeStore(value: unknown): AttendanceSiteStore {
  if (!value || typeof value !== 'object') return { version: 1, sites: {} };
  const raw = value as Partial<AttendanceSiteStore>;
  return { version: 1, sites: raw.sites && typeof raw.sites === 'object' ? raw.sites : {} };
}

export async function getAttendanceSiteStore() {
  const setting = await prisma.appSetting.findUnique({ where: { key: STORE_KEY } }).catch(() => null);
  return normalizeStore(setting?.value);
}

async function saveAttendanceSiteStore(store: AttendanceSiteStore) {
  await prisma.appSetting.upsert({
    where: { key: STORE_KEY },
    update: { value: store },
    create: { key: STORE_KEY, value: store, description: 'Attendance geofence sites without schema changes' },
  });
}

export async function listAttendanceSites() {
  const store = await getAttendanceSiteStore();
  return Object.values(store.sites).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

export async function upsertAttendanceSite(input: Partial<AttendanceSite> & { name: string; latitude: number; longitude: number; radiusMeters: number; assignmentValue: string }) {
  const store = await getAttendanceSiteStore();
  const now = new Date().toISOString();
  const id = input.id || `site-${Date.now()}`;
  const previous = store.sites[id];
  const site: AttendanceSite = {
    id,
    name: input.name.trim(),
    latitude: Number(input.latitude),
    longitude: Number(input.longitude),
    radiusMeters: Math.max(Number(input.radiusMeters || 150), 25),
    assignmentType: (input.assignmentType || previous?.assignmentType || 'hospital') as AttendanceSiteAssignmentType,
    assignmentValue: input.assignmentValue.trim(),
    isActive: input.isActive ?? previous?.isActive ?? true,
    requirePhoto: input.requirePhoto ?? previous?.requirePhoto ?? false,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  store.sites[id] = site;
  await saveAttendanceSiteStore(store);
  return site;
}

export async function deleteAttendanceSite(id: string) {
  const store = await getAttendanceSiteStore();
  if (!store.sites[id]) return null;
  store.sites[id] = { ...store.sites[id], isActive: false, updatedAt: new Date().toISOString() };
  await saveAttendanceSiteStore(store);
  return store.sites[id];
}

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earth = 6371000;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export async function employeeMatchesSite(employee: any, site: AttendanceSite) {
  const value = normalizeText(site.assignmentValue);
  if (!value) return false;
  const fullName = normalizeText(`${employee.firstName ?? ''} ${employee.lastName ?? ''}`);
  const fields = {
    branch: normalizeText(employee.branch?.name),
    department: normalizeText(employee.department?.name),
    sponsor: normalizeText(employee.sponsor),
    text: [fullName, employee.employeeNumber, employee.nationalId, employee.email, employee.phone, employee.branch?.name, employee.department?.name, employee.position?.title, employee.sponsor].map(normalizeText).join(' '),
  } as Record<string, string>;
  if (site.assignmentType === 'hospital') {
    const setting = await prisma.appSetting.findUnique({ where: { key: `employee.extra.${employee.id}` }, select: { value: true } }).catch(() => null);
    const hospital = normalizeText((setting?.value as any)?.hospital);
    return hospital === value || hospital.includes(value) || fields.text.includes(value);
  }
  const field = fields[site.assignmentType] ?? fields.text;
  return field === value || field.includes(value);
}

export async function findAllowedSiteForEmployee(employee: any, coords: { latitude: number; longitude: number }, requestedSiteId?: string) {
  const sites = (await listAttendanceSites()).filter((site) => site.isActive && (!requestedSiteId || site.id === requestedSiteId));
  const checked: Array<{ site: AttendanceSite; distance: number; employeeAllowed: boolean; inside: boolean }> = [];
  for (const site of sites) {
    const employeeAllowed = await employeeMatchesSite(employee, site);
    const distance = Math.round(distanceMeters(coords, site));
    const inside = distance <= site.radiusMeters;
    checked.push({ site, distance, employeeAllowed, inside });
    if (employeeAllowed && inside) return { allowed: true as const, site, distance, checked };
  }
  return { allowed: false as const, checked };
}

export function riyadhWorkDate(value = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [year, month, day] = formatter.format(value).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
