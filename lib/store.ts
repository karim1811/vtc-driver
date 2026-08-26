import fs from 'fs';
import path from 'path';

// ============================================================================
// STORE HYBRIDE
//  - PROD (Render) : Postgres via Neon (https://neon.tech) dès que DATABASE_URL
//    est défini -> persistant, fiable, gratuit sans CB.
//  - DEV local     : fichier JSON (data/store.json) -> zéro config, test immédiat.
// Toute la logique métier est identique ; seul le backend change. Pour migrer
// plus tard, on ne touche QUE ce fichier.
// ============================================================================

// Résilience : on préfère Neon si DATABASE_URL est présent ET valide.
// Si la connexion échoue (ex: URL masquée '***' copiée depuis l'UI Neon dans
// Render), on bascule AUTOMATIQUEMENT sur le store fichier JSON pour que
// l'appli reste vivante (données non persistées entre redémarrages Render free).
type DbState = 'unknown' | 'up' | 'down';
let _dbState: DbState = 'unknown';
let _dbCheck: Promise<boolean> | null = null;

async function dbReady(): Promise<boolean> {
  if (_dbState === 'up') return true;
  if (_dbState === 'down') return false;
  if (!process.env.DATABASE_URL) {
    _dbState = 'down';
    return false;
  }
  if (!_dbCheck) {
    _dbCheck = (async () => {
      try {
        await ensureSchema();
        _dbState = 'up';
        return true;
      } catch (e: any) {
        console.warn(
          '[store] DATABASE_URL invalide ou masqué — repli sur fichier JSON (données non persistantes).',
          e?.message ?? e
        );
        _dbState = 'down';
        return false;
      }
    })();
  }
  return _dbCheck;
}

// Exposé pour /api/health : dit VRAIMENT si on tourne sur la base Postgres
// ('db') ou en repli fichier ('file' / 'error'). Fin du repli silencieux.
export async function dbMode(): Promise<'db' | 'file' | 'error'> {
  if (!process.env.DATABASE_URL) return 'file';
  const ok = await dbReady();
  return ok ? 'db' : 'error';
}

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
export type Driver = {
  id: number;
  name: string;
  phone?: string;
  vehicle?: string; // ex "Peugeot 308, Gris, AB-123-CD"
  bio?: string;
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
  // Suivi véhicule live (géoloc chauffeur)
  driverLat?: number | null;
  driverLng?: number | null;
  sharedAt?: string | null;
  // Paiement scindé (logique métier) :
  // deposit_status : acompte — encaissé par le chauffeur quand le client confirme la présence.
  //   'pending' -> 'collected' (chauffeur encaisse à la présentation)
  // balance_status : solde — reste EN SUSPENS dans l'app jusqu'à la fin de la course.
  //   'held' -> 'settled' (à la cloture 'done') ou 'refunded'/'waived'
  depositStatus?: 'pending' | 'collected';
  balanceStatus?: 'held' | 'settled' | 'cancelled';
};
// Plages hebdomadaires récurrentes (un VTC solo bosse les mêmes jours).
// day: 0=dimanche … 6=samedi (cohérent avec Date.getDay()).
export type WeekdaySlot = { day: number; start: string; end: string };
export type Availability = { open: boolean; weekly: WeekdaySlot[] };

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
  drivers: Driver[];
};

function rawRead(): Store {
  if (!fs.existsSync(file)) return { codes: [], users: [], bookings: [], availability: { open: true, weekly: [] }, drivers: [] };
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Store>;
    return {
      codes: s.codes ?? [],
      users: s.users ?? [],
      bookings: s.bookings ?? [],
      availability: s.availability ?? { open: true, weekly: [] },
      drivers: s.drivers ?? [],
    };
  } catch {
    return { codes: [], users: [], bookings: [], availability: { open: true, weekly: [] }, drivers: [] };
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
  if (!s.availability) s.availability = { open: true, weekly: [] };
  if (!s.drivers) s.drivers = [];
  if (changed || !fs.existsSync(file)) rawWrite(s);
  return s;
}

// ============================================================================
// BACKEND POSTGRES (prod) via @neondatabase/serverless
// ============================================================================
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
let _sql: NeonQueryFunction<false, false> | null = null;
let _schemaReady: Promise<void> | null = null;
function sql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant');
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}
async function ensureSchema(): Promise<void> {
  if (!_schemaReady) {
    _schemaReady = (async () => {
      const q = sql();
      await q`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY, name TEXT, phone TEXT, email TEXT,
          invite_code TEXT, created_at TEXT
        )`;
      await q`
        CREATE TABLE IF NOT EXISTS codes (
          code TEXT PRIMARY KEY, label TEXT, used_by INTEGER
        )`;
      await q`
        CREATE TABLE IF NOT EXISTS bookings (
          id SERIAL PRIMARY KEY, user_id INTEGER, pickup TEXT, dropoff TEXT,
          pickup_lat REAL, pickup_lng REAL, dropoff_lat REAL, dropoff_lng REAL,
          distance_km REAL, price REAL, pickup_at TEXT, duration_min INTEGER,
          status TEXT, payment TEXT, deposit REAL, paid INTEGER, created_at TEXT,
          driver_lat REAL, driver_lng REAL, shared_at TEXT
        )`;
      await q`
        CREATE TABLE IF NOT EXISTS availability (
          id INTEGER PRIMARY KEY CHECK (id = 1), open INTEGER DEFAULT 1, slots TEXT DEFAULT '[]'
        )`;
      await q`
        CREATE TABLE IF NOT EXISTS drivers (
          id SERIAL PRIMARY KEY, name TEXT, phone TEXT, vehicle TEXT, bio TEXT, created_at TEXT
        )`;
      for (let i = 0; i < DEFAULT_CODES.length; i++) {
        await q`INSERT INTO codes (code, label) VALUES (${DEFAULT_CODES[i]}, ${'seed ' + i}) ON CONFLICT (code) DO NOTHING`;
      }
      await q`INSERT INTO availability (id, open, slots) VALUES (1, 1, '[]') ON CONFLICT (id) DO NOTHING`;
      // Colonnes ajoutées après création initiale de la table : on les garantit
      // ici (ADD COLUMN IF NOT EXISTS est idempotent) pour ne pas casser si la
      // table existait déjà sans elles.
      await q`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_lat REAL`;
      await q`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_lng REAL`;
      await q`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS shared_at TEXT`;
      await q`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'pending'`;
      await q`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS balance_status TEXT DEFAULT 'held'`;
    })().catch((e) => {
      _schemaReady = null; // retry next call
      throw e;
    });
  }
  return _schemaReady;
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
    driverLat: r.driver_lat != null ? Number(r.driver_lat) : null,
    driverLng: r.driver_lng != null ? Number(r.driver_lng) : null,
    sharedAt: r.shared_at ?? null,
    depositStatus: r.deposit_status ?? 'pending',
    balanceStatus: r.balance_status ?? 'held',
  };
}

// ============================================================================
// API PUBLIQUE (async partout)
// ============================================================================

// ---- codes ----
export async function listCodes(): Promise<InviteCode[]> {
  if (!(await dbReady())) return j().codes;
  await ensureSchema();
  const rows: any[] = await sql()`SELECT code, label, used_by FROM codes`;
  return rows.map((x) => ({ code: x.code, label: x.label, usedBy: x.used_by != null ? Number(x.used_by) : undefined }));
}
export async function findCode(code: string): Promise<InviteCode | undefined> {
  if (!(await dbReady())) return j().codes.find((c) => c.code === code);
  await ensureSchema();
  const rows: any[] = await sql()`SELECT code, label, used_by FROM codes WHERE code = ${code}`;
  if (!rows[0]) return undefined;
  const x = rows[0];
  return { code: x.code, label: x.label, usedBy: x.used_by != null ? Number(x.used_by) : undefined };
}
export async function consumeCode(code: string, userId: number): Promise<void> {
  if (!(await dbReady())) {
    const s = j();
    const c = s.codes.find((x) => x.code === code);
    if (c) c.usedBy = userId;
    rawWrite(s);
    return;
  }
  await ensureSchema();
  await sql()`UPDATE codes SET used_by = ${userId} WHERE code = ${code}`;
}
export async function seedCodes(codes: string[]): Promise<void> {
  if (!(await dbReady())) {
    const s = j();
    codes.forEach((code, i) => {
      if (!s.codes.find((c) => c.code === code)) s.codes.push({ code, label: 'seed ' + i });
    });
    rawWrite(s);
    return;
  }
  await ensureSchema();
  for (const c of codes) {
    await sql()`INSERT INTO codes (code, label) VALUES (${c}, ${'seed'}) ON CONFLICT (code) DO NOTHING`;
  }
}

export async function createCode(label?: string): Promise<InviteCode> {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus
  const gen = () => {
    let c = '';
    for (let i = 0; i < 8; i++) c += alphabet[Math.floor(Math.random() * alphabet.length)];
    return c;
  };
  if (!(await dbReady())) {
    const s = j();
    let code = gen();
    while (s.codes.find((x) => x.code === code)) code = gen();
    const entry = { code, label: label || 'invitation' };
    s.codes.push(entry);
    rawWrite(s);
    return entry;
  }
  await ensureSchema();
  let code = gen();
  for (let attempt = 0; attempt < 10; attempt++) {
    await sql()`INSERT INTO codes (code, label) VALUES (${code}, ${label || 'invitation'}) ON CONFLICT (code) DO NOTHING`;
    const rows: any[] = await sql()`SELECT code, label, used_by FROM codes WHERE code = ${code}`;
    if (rows[0]) return { code: rows[0].code, label: rows[0].label, usedBy: rows[0].used_by != null ? Number(rows[0].used_by) : undefined };
    code = gen();
  }
  throw new Error('impossible de générer un code unique');
}

// ---- users ----
export async function createUser(u: Omit<User, 'id' | 'createdAt'>): Promise<User> {
  if (!(await dbReady())) {
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
  await ensureSchema();
  const res: any[] = await sql()`INSERT INTO users (name, phone, email, invite_code, created_at)
    VALUES (${u.name}, ${u.phone ?? null}, ${u.email ?? null}, ${u.inviteCode ?? null}, ${new Date().toISOString()})
    RETURNING id`;
  const id = Number(res[0].id);
  return { id, createdAt: new Date().toISOString(), ...u };
}
export async function getUser(id: number): Promise<User | undefined> {
  if (!(await dbReady())) return j().users.find((x) => x.id === id);
  await ensureSchema();
  const rows: any[] = await sql()`SELECT * FROM users WHERE id = ${id}`;
  if (!rows[0]) return undefined;
  const x = rows[0];
  return { id: Number(x.id), name: x.name, phone: x.phone, email: x.email, inviteCode: x.invite_code, createdAt: x.created_at };
}

// ---- drivers (profil chauffeur) ----
export async function upsertDriver(d: Omit<Driver, 'id' | 'createdAt'> & { id?: number }): Promise<Driver> {
  if (!(await dbReady())) {
    const s = j();
    let driver = s.drivers.find((x) => x.id === d.id);
    if (!driver) {
      driver = { id: s.drivers.length ? Math.max(...s.drivers.map((x) => x.id)) + 1 : 1, createdAt: new Date().toISOString(), name: d.name };
      s.drivers.push(driver);
    }
    Object.assign(driver, d);
    rawWrite(s);
    return driver;
  }
  await ensureSchema();
  if (d.id) {
    await sql()`UPDATE drivers SET name = ${d.name}, phone = ${d.phone ?? null}, vehicle = ${d.vehicle ?? null}, bio = ${d.bio ?? null} WHERE id = ${d.id}`;
    return (await getDriver(d.id))!;
  }
  const res: any[] = await sql()`INSERT INTO drivers (name, phone, vehicle, bio, created_at) VALUES (${d.name}, ${d.phone ?? null}, ${d.vehicle ?? null}, ${d.bio ?? null}, ${new Date().toISOString()}) RETURNING id`;
  return (await getDriver(Number(res[0].id)))!;
}
export async function getDriver(id: number): Promise<Driver | undefined> {
  if (!(await dbReady())) return j().drivers.find((x) => x.id === id);
  await ensureSchema();
  const rows: any[] = await sql()`SELECT * FROM drivers WHERE id = ${id}`;
  if (!rows[0]) return undefined;
  const x = rows[0];
  return { id: Number(x.id), name: x.name, phone: x.phone, vehicle: x.vehicle, bio: x.bio, createdAt: x.created_at };
}

// ---- bookings ----
export async function listBookings(): Promise<Booking[]> {
  if (!(await dbReady())) return j().bookings;
  await ensureSchema();
  const rows: any[] = await sql()`SELECT * FROM bookings ORDER BY pickup_at`;
  return rows.map(rowToBooking);
}
export async function getBooking(id: number): Promise<Booking | undefined> {
  if (!(await dbReady())) return j().bookings.find((x) => x.id === id);
  await ensureSchema();
  const rows: any[] = await sql()`SELECT * FROM bookings WHERE id = ${id}`;
  return rows[0] ? rowToBooking(rows[0]) : undefined;
}
export async function createBooking(
  b: Omit<Booking, 'id' | 'createdAt' | 'status' | 'paid' | 'deposit'> & { deposit?: number }
): Promise<Booking> {
  if (!(await dbReady())) {
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
  await ensureSchema();
  const res: any[] = await sql()`INSERT INTO bookings
    (user_id, pickup, dropoff, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
     distance_km, price, pickup_at, duration_min, status, payment, deposit, paid, created_at)
    VALUES (${b.userId}, ${b.pickup}, ${b.dropoff}, ${b.pickupLat}, ${b.pickupLng}, ${b.dropoffLat}, ${b.dropoffLng},
     ${b.distanceKm}, ${b.price}, ${b.pickupAt}, ${b.durationMin}, ${'pending'}, ${b.payment}, ${b.deposit ?? 0}, ${0}, ${new Date().toISOString()})
    RETURNING id`;
  const id = Number(res[0].id);
  return { id, createdAt: new Date().toISOString(), status: 'pending', paid: 0, deposit: b.deposit ?? 0, ...b };
}
export async function updateBooking(id: number, patch: Partial<Booking>): Promise<Booking | undefined> {
  if (!(await dbReady())) {
    const s = j();
    const b = s.bookings.find((x) => x.id === id);
    if (!b) return undefined;
    Object.assign(b, patch);
    rawWrite(s);
    return b;
  }
  await ensureSchema();
  const cur = await getBooking(id);
  if (!cur) return undefined;
  const merged = { ...cur, ...patch };
  await sql()`UPDATE bookings SET status = ${merged.status}, payment = ${merged.payment}, deposit = ${merged.deposit}, paid = ${merged.paid}, driver_lat = ${merged.driverLat ?? null}, driver_lng = ${merged.driverLng ?? null}, shared_at = ${merged.sharedAt ?? null}, deposit_status = ${merged.depositStatus ?? 'pending'}, balance_status = ${merged.balanceStatus ?? 'held'} WHERE id = ${id}`;
  return merged;
}

// ---- suivi véhicule live ----
export async function updateDriverLocation(
  id: number,
  lat: number,
  lng: number
): Promise<Booking | undefined> {
  return updateBooking(id, { driverLat: lat, driverLng: lng, sharedAt: new Date().toISOString() });
}

// ---- availability ----
export async function getAvailability(): Promise<Availability> {
  if (!(await dbReady())) return j().availability;
  await ensureSchema();
  const rows: any[] = await sql()`SELECT open, slots FROM availability WHERE id = 1`;
  const x = rows[0];
  return { open: !!Number(x.open), weekly: JSON.parse(x.slots || '[]') };
}
export async function setAvailability(av: Availability): Promise<void> {
  if (!(await dbReady())) {
    const s = j();
    s.availability = av;
    rawWrite(s);
    return;
  }
  await ensureSchema();
  // La colonne DB s'appelle `slots` mais stocke le JSON des plages hebdo.
  await sql()`UPDATE availability SET open = ${av.open ? 1 : 0}, slots = ${JSON.stringify(av.weekly)} WHERE id = 1`;
}
export async function isAvailableAt(pickupAt: string): Promise<boolean> {
  const av = await getAvailability();
  if (!av.open) return false;
  if (av.weekly.length === 0) return true; // pas de planning => ouvert tous les jours
  const d = new Date(pickupAt);
  const day = d.getDay(); // 0=dim … 6=sam
  const hhmm = pickupAt.slice(11, 16); // "HH:MM" extrait de l'ISO
  const slot = av.weekly.find((s) => s.day === day);
  if (!slot) return false;
  return hhmm >= slot.start && hhmm <= slot.end;
}
