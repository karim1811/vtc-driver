import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const file = path.join(dataDir, 'store.json');

type InviteCode = { code: string; label: string; usedBy?: number };
type User = {
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
  payment: 'arrival' | 'online';
  paid: number;
  createdAt: string;
};

type Store = { codes: InviteCode[]; users: User[]; bookings: Booking[] };

const DEFAULT_CODES = ['BIENVENUE1', 'KARIMVTC', 'IDF60'];

function rawRead(): Store {
  if (!fs.existsSync(file)) return { codes: [], users: [], bookings: [] };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Store;
  } catch {
    return { codes: [], users: [], bookings: [] };
  }
}
function rawWrite(s: Store) {
  fs.writeFileSync(file, JSON.stringify(s, null, 2));
}

// Seed une seule fois au démarrage (sans récursion)
(function ensureSeed() {
  const s = rawRead();
  let changed = false;
  if (!s.codes) s.codes = [];
  DEFAULT_CODES.forEach((code, i) => {
    if (!s.codes.find((c) => c.code === code)) {
      s.codes.push({ code, label: 'seed ' + i });
      changed = true;
    }
  });
  if (changed || !fs.existsSync(file)) rawWrite(s);
})();

function read(): Store {
  return rawRead();
}
function write(s: Store) {
  rawWrite(s);
}

// ---- codes ----
export function listCodes(): InviteCode[] {
  return read().codes;
}
export function findCode(code: string): InviteCode | undefined {
  return read().codes.find((c) => c.code === code);
}
export function consumeCode(code: string, userId: number) {
  const s = read();
  const c = s.codes.find((x) => x.code === code);
  if (c) c.usedBy = userId;
  write(s);
}
export function seedCodes(codes: string[]) {
  const s = read();
  codes.forEach((code, i) => {
    if (!s.codes.find((c) => c.code === code))
      s.codes.push({ code, label: 'seed ' + i });
  });
  write(s);
}

// ---- users ----
export function createUser(u: Omit<User, 'id' | 'createdAt'>): User {
  const s = read();
  const user: User = {
    id: s.users.length ? Math.max(...s.users.map((x) => x.id)) + 1 : 1,
    createdAt: new Date().toISOString(),
    ...u,
  };
  s.users.push(user);
  write(s);
  return user;
}
export function getUser(id: number): User | undefined {
  return read().users.find((x) => x.id === id);
}

// ---- bookings ----
export function listBookings(): Booking[] {
  return read().bookings;
}
export function getBooking(id: number): Booking | undefined {
  return read().bookings.find((x) => x.id === id);
}
export function createBooking(b: Omit<Booking, 'id' | 'createdAt' | 'status' | 'paid'>): Booking {
  const s = read();
  const booking: Booking = {
    id: s.bookings.length ? Math.max(...s.bookings.map((x) => x.id)) + 1 : 1,
    createdAt: new Date().toISOString(),
    status: 'pending',
    paid: 0,
    ...b,
  };
  s.bookings.push(booking);
  write(s);
  return booking;
}
export function updateBooking(id: number, patch: Partial<Booking>): Booking | undefined {
  const s = read();
  const b = s.bookings.find((x) => x.id === id);
  if (!b) return undefined;
  Object.assign(b, patch);
  write(s);
  return b;
}
