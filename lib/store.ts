import fs from 'fs';
import path from 'path';

// ============================================================================
// STORE HYBRIDE
//  - PROD (Render) : Turso (libSQL) dès que TURSO_URL est défini -> persistant.
//  - DEV local     : fichier JSON (data/store.json) -> zéro config, test immédiat.
// Toute la logique métier est identique ; seul le backend change. Pour migrer
// plus tard (Postgres, Render Disk...), on ne touche QUE ce fichier.
// ============================================================================

const USE_TURSO = !!process.env.TURSO_URL;

// ---- Types ----
export type InviteCode = { code: string; label: string; usedBy?: number };
export type User = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  inviteCode?: string;
  createdAt: string;
};
export type Booking = {
  id: number;
  userId: number;
  pickup: string;
  dropoff: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  distanceKm: number;
  price: number;
  pickupAt: string;
  durationMin: number;
  status: 'pending' | 'confirmed' | 'done' | 'cancelled';
  payment: 'arrival' | 'online' | 'cash';
  deposit: number;
  paid: number;
  createdAt: string;
};
export type Slot = { id: string; date: string; start: string; end: string };
export type Availability = { open: boolean; slots: Slot[] };

const DEFAULT_CODES = ['BIENVENUE1', 'KARIMVTC', 'IDF60'];

// ============================================================================
// BACKEND JSON (dev local)
// ============================================================================
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const file = path.join(dataDir, 'store.json');

type Store = {
  codes: InviteCode[];
  users: User[];
  bookings: Booking[];
  availability: Availability;
};

function rawRead(): Store {
  if (!fs.existsSync(file)) return { codes: [], users: [], bookings: [], availability: { open: true, slots: [] } };
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Store>;
    return {
      codes: s.codes ?? [],
      users: s.users ?? [],
      bookings: s.bookings ?? [],
      availability: s.availability ?? { open: true, slots: [] },
    };
  } catch {
    return { codes: [], users: [], bookings: [], availability: { open: true, slots: [] } };
  }
}
function rawWrite(s: Store) {
  fs.writeFileSync(file, JSON.stringify(s, null, 2));
}
function j(): Store {
  const s = rawRead();
  let changed = false;
  if (!s.codes) s.codes = [];
  DEFAULT_CODES.forEach((code, i) => {
    if (!s.codes.find((c) => c.code === code)) {
      s.codes.push({ code, label: 'seed ' + i });
      changed = true;
    }
  });
  if (!s.availability) s.availability = { open: true, slots: [] };
  if (changed || !fs.existsSync(file)) rawWrite(s);
  return s;
}

// ============================================================================
// BACKEND TURSO (prod)
// ============================================================================
import { createClient, type Client } from '@libsql/client';
let _db: Client | null = null;
function db(): Client {
  if (!_db) {
    _db = createClient({ url: process.env.TURSO_URL!, authToken: process.env.TURSO_TOKEN });
  }
  return _db;
}
async function t(): Promise<void> {
  await db().execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, email TEXT,
      invite_code TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS codes (
      code TEXT PRIMARY KEY, label TEXT, used_by INTEGER
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, pickup TEXT, dropoff TEXT,
      pickup_lat REAL, pickup_lng REAL, dropoff_lat REAL, dropoff_lng REAL,
      distance_km REAL, price REAL, pickup_at TEXT, duration_min INTEGER,
      status TEXT, payment TEXT, deposit REAL, paid INTEGER, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS availability (
      id INTEGER PRIMARY KEY CHECK (id = 1), open INTEGER DEFAULT 1, slots TEXT DEFAULT '[]'
    );
  `);
  for (let i = 0; i < DEFAULT_CODES.length; i++) {
    await db().execute({
      sql: 'INSERT OR IGNORE INTO codes (code, label) VALUES (?, ?)',
      args: [DEFAULT_CODES[i], 'seed ' + i],
    });
  }
  await db().execute({
    sql: 'INSERT OR IGNORE INTO availability (id, open, slots) VALUES (1, 1, ?)',
    args: ['[]'],
  });
}
function rowToBooking(r: any): Booking {
  return {
    id: Number(r.id),
    userId: Number(r.user_id),
    pickup: r.pickup,
    dropoff: r.dropoff,
    pickupLat: Number(r.pickup_lat),
    pickupLng: Number(r.pickup_lng),
    dropoffLat: Number(r.dropoff_lat),
    dropoffLng: Number(r.dropoff_lng),
    distanceKm: Number(r.distance_km),
    price: Number(r.price),
    pickupAt: r.pickup_at,
    durationMin: Number(r.duration_min),
    status: r.status,
    payment: r.payment,
    deposit: Number(r.deposit ?? 0),
    paid: Number(r.paid ?? 0),
    createdAt: r.created_at,
  };
}

// ============================================================================
// API PUBLIQUE (async partout)
// ============================================================================

// ---- codes ----
export async function listCodes(): Promise<InviteCode[]> {
  if (!USE_TURSO) return j().codes;
  await t();
  const r = await db().execute('SELECT code, label, used_by FROM codes');
  return r.rows.map((x: any) => ({ code: x.code, label: x.label, usedBy: x.used_by ? Number(x.used_by) : undefined }));
}
export async function findCode(code: string): Promise<InviteCode | undefined> {
  if (!USE_TURSO) return j().codes.find((c) => c.code === code);
  await t();
  const r = await db().execute({ sql: 'SELECT code, label, used_by FROM codes WHERE code = ?', args: [code] });
  if (!r.rows[0]) return undefined;
  const x: any = r.rows[0];
  return { code: x.code, label: x.label, usedBy: x.used_by ? Number(x.used_by) : undefined };
}
export async function consumeCode(code: string, userId: number): Promise<void> {
  if (!USE_TURSO) {
    const s = j();
    const c = s.codes.find((x) => x.code === code);
    if (c) c.usedBy = userId;
    rawWrite(s);
    return;
  }
  await t();
  await db().execute({ sql: 'UPDATE codes SET used_by = ? WHERE code = ?', args: [userId, code] });
}
export async function seedCodes(codes: string[]): Promise<void> {
  if (!USE_TURSO) {
    const s = j();
    codes.forEach((code, i) => {
      if (!s.codes.find((c) => c.code === code)) s.codes.push({ code, label: 'seed ' + i });
    });
    rawWrite(s);
    return;
  }
  await t();
  for (const c of codes) {
    await db().execute({ sql: 'INSERT OR IGNORE INTO codes (code, label) VALUES (?, ?)', args: [c, 'seed'] });
  }
}

// ---- users ----
export async function createUser(u: Omit<User, 'id' | 'createdAt'>): Promise<User> {
  if (!USE_TURSO) {
    const s = j();
    const user: User = {
      id: s.users.length ? Math.max(...s.users.map((x) => x.id)) + 1 : 1,
      createdAt: new Date().toISOString(),
      ...u,
    };
    s.users.push(user);
    rawWrite(s);
    return user;
  }
  await t();
  const res = await db().execute({
    sql: 'INSERT INTO users (name, phone, email, invite_code, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [u.name, u.phone ?? null, u.email ?? null, u.inviteCode ?? null, new Date().toISOString()],
  });
  const id = Number(res.lastInsertRowid);
  return { id, createdAt: new Date().toISOString(), ...u };
}
export async function getUser(id: number): Promise<User | undefined> {
  if (!USE_TURSO) return j().users.find((x) => x.id === id);
  await t();
  const r = await db().execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
  if (!r.rows[0]) return undefined;
  const x: any = r.rows[0];
  return { id: Number(x.id), name: x.name, phone: x.phone, email: x.email, inviteCode: x.invite_code, createdAt: x.created_at };
}

// ---- bookings ----
export async function listBookings(): Promise<Booking[]> {
  if (!USE_TURSO) return j().bookings;
  await t();
  const r = await db().execute('SELECT * FROM bookings ORDER BY pickup_at');
  return r.rows.map(rowToBooking);
}
export async function getBooking(id: number): Promise<Booking | undefined> {
  if (!USE_TURSO) return j().bookings.find((x) => x.id === id);
  await t();
  const r = await db().execute({ sql: 'SELECT * FROM bookings WHERE id = ?', args: [id] });
  return r.rows[0] ? rowToBooking(r.rows[0]) : undefined;
}
export async function createBooking(
  b: Omit<Booking, 'id' | 'createdAt' | 'status' | 'paid' | 'deposit'> & { deposit?: number }
): Promise<Booking> {
  if (!USE_TURSO) {
    const s = j();
    const booking: Booking = {
      id: s.bookings.length ? Math.max(...s.bookings.map((x) => x.id)) + 1 : 1,
      createdAt: new Date().toISOString(),
      status: 'pending',
      paid: 0,
      deposit: b.deposit ?? 0,
      ...b,
    };
    s.bookings.push(booking);
    rawWrite(s);
    return booking;
  }
  await t();
  const res = await db().execute({
    sql: `INSERT INTO bookings
      (user_id, pickup, dropoff, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
       distance_km, price, pickup_at, duration_min, status, payment, deposit, paid, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 0, ?)`,
    args: [
      b.userId, b.pickup, b.dropoff, b.pickupLat, b.pickupLng, b.dropoffLat, b.dropoffLng,
      b.distanceKm, b.price, b.pickupAt, b.durationMin, b.payment, b.deposit ?? 0, new Date().toISOString(),
    ],
  });
  const id = Number(res.lastInsertRowid);
  return { id, createdAt: new Date().toISOString(), status: 'pending', paid: 0, deposit: b.deposit ?? 0, ...b };
}
export async function updateBooking(id: number, patch: Partial<Booking>): Promise<Booking | undefined> {
  if (!USE_TURSO) {
    const s = j();
    const b = s.bookings.find((x) => x.id === id);
    if (!b) return undefined;
    Object.assign(b, patch);
    rawWrite(s);
    return b;
  }
  await t();
  const cur = await getBooking(id);
  if (!cur) return undefined;
  const merged = { ...cur, ...patch };
  await db().execute({
    sql: `UPDATE bookings SET status = ?, payment = ?, deposit = ?, paid = ? WHERE id = ?`,
    args: [merged.status, merged.payment, merged.deposit, merged.paid, id],
  });
  return merged;
}

// ---- availability ----
export async function getAvailability(): Promise<Availability> {
  if (!USE_TURSO) return j().availability;
  await t();
  const r = await db().execute('SELECT open, slots FROM availability WHERE id = 1');
  const x: any = r.rows[0];
  return { open: !!Number(x.open), slots: JSON.parse(x.slots || '[]') };
}
export async function setAvailability(av: Availability): Promise<void> {
  if (!USE_TURSO) {
    const s = j();
    s.availability = av;
    rawWrite(s);
    return;
  }
  await t();
  await db().execute({
    sql: 'UPDATE availability SET open = ?, slots = ? WHERE id = 1',
    args: [av.open ? 1 : 0, JSON.stringify(av.slots)],
  });
}
export async function isAvailableAt(pickupAt: string): Promise<boolean> {
  const av = await getAvailability();
  if (!av.open) return false;
  if (av.slots.length === 0) return true; // pas de planning => ouvert
  const t = new Date(pickupAt).getTime();
  return av.slots.some((s) => {
    const start = new Date(`${s.date}T${s.start}`).getTime();
    const end = new Date(`${s.date}T${s.end}`).getTime();
    return t >= start && t <= end;
  });
}
