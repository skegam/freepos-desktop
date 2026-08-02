import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, ShoppingCart, Package, FileText, BarChart3, Users as UsersIcon,
  Settings as SettingsIcon, Search, Plus, Minus, Trash2, Printer, X, LogOut,
  AlertTriangle, TrendingUp, Boxes, ClipboardList, Store, Check, Pencil, ChevronLeft,
  DollarSign, ScanBarcode, Tags, Wallet, Power, LayoutGrid
} from "lucide-react";

/* ---------------------------------- constants ---------------------------------- */

// Súbelo cada vez que publiques una versión nueva en GitHub (debe coincidir con el
// tag de la release, ej: si publicas "v0.2.0", pon "0.2.0" aquí).
const APP_VERSION = "0.3.0";

// Repositorio de GitHub donde se publican las actualizaciones de FreePOS.
// Es una propiedad del programa (no de cada negocio), por eso queda fija aquí
// en vez de tener que escribirla en cada computador donde se instale.
const UPDATE_REPO = "skegam/freepos-desktop";

const CURRENCIES = [
  { code: "COP", symbol: "$", decimals: 0, name: "Peso colombiano" },
  { code: "USD", symbol: "$", decimals: 2, name: "Dólar estadounidense" },
  { code: "EUR", symbol: "€", decimals: 2, name: "Euro" },
  { code: "MXN", symbol: "$", decimals: 2, name: "Peso mexicano" },
  { code: "ARS", symbol: "$", decimals: 2, name: "Peso argentino" },
  { code: "PEN", symbol: "S/", decimals: 2, name: "Sol peruano" },
  { code: "CLP", symbol: "$", decimals: 0, name: "Peso chileno" },
  { code: "BRL", symbol: "R$", decimals: 2, name: "Real brasileño" },
  { code: "GBP", symbol: "£", decimals: 2, name: "Libra esterlina" },
];

const PAYMENT_METHODS = ["Efectivo", "Tarjeta", "Transferencia", "Otro"];

const DEFAULT_SETTINGS = {
  businessName: "Mi Negocio",
  address: "Calle Principal #123",
  currency: CURRENCIES[0],
  taxRate: 0,
  paperWidth: "58", // "58" or "80" mm thermal printer
  autoOpenDrawerOnCash: true,
  barcodeScannerEnabled: true,
  dayResetHour: 6, // hora del día en la que se considera que empieza un nuevo "día operativo"
  recoveryCode: null, // se genera automáticamente la primera vez que arranca el programa
  updateRepo: UPDATE_REPO,
  defaultMarginPct: 30, // % de ganancia sugerido por defecto sobre el costo
};

const DEFAULT_CATEGORIES = ["Abarrotes", "Lácteos", "Panadería", "Bebidas", "Aseo"];

const DEFAULT_TABLES = [
  { id: "mostrador", name: "Mostrador", cart: [], discountPct: 0, taxPct: DEFAULT_SETTINGS.taxRate, payment: PAYMENT_METHODS[0], createdAt: new Date().toISOString(), fixed: true },
  { id: "mesa-1", name: "Mesa 1", cart: [], discountPct: 0, taxPct: DEFAULT_SETTINGS.taxRate, payment: PAYMENT_METHODS[0], createdAt: new Date().toISOString(), fixed: false },
  { id: "mesa-2", name: "Mesa 2", cart: [], discountPct: 0, taxPct: DEFAULT_SETTINGS.taxRate, payment: PAYMENT_METHODS[0], createdAt: new Date().toISOString(), fixed: false },
  { id: "mesa-3", name: "Mesa 3", cart: [], discountPct: 0, taxPct: DEFAULT_SETTINGS.taxRate, payment: PAYMENT_METHODS[0], createdAt: new Date().toISOString(), fixed: false },
  { id: "mesa-4", name: "Mesa 4", cart: [], discountPct: 0, taxPct: DEFAULT_SETTINGS.taxRate, payment: PAYMENT_METHODS[0], createdAt: new Date().toISOString(), fixed: false },
];

const DEFAULT_USERS = [
  { id: "u_admin", name: "Administrador", username: "admin", pin: "1234", role: "admin", active: true },
  { id: "u_emp1", name: "Empleado Demo", username: "empleado", pin: "0000", role: "employee", active: true },
];

const DEFAULT_PRODUCTS = [
  { id: "p1", name: "Arroz 1kg", sku: "AR-001", barcode: "7701234500019", category: "Abarrotes", price: 4500, cost: 3200, stock: 40, minStock: 10 },
  { id: "p2", name: "Leche entera 1L", sku: "LE-001", barcode: "7701234500026", category: "Lácteos", price: 3800, cost: 2900, stock: 30, minStock: 8 },
  { id: "p3", name: "Pan tajado", sku: "PA-001", barcode: "7701234500033", category: "Panadería", price: 5200, cost: 3600, stock: 15, minStock: 5 },
  { id: "p4", name: "Gaseosa 350ml", sku: "GA-001", barcode: "7701234500040", category: "Bebidas", price: 2500, cost: 1600, stock: 60, minStock: 12 },
  { id: "p5", name: "Detergente 1kg", sku: "DE-001", barcode: "7701234500057", category: "Aseo", price: 9800, cost: 7200, stock: 5, minStock: 6 },
  { id: "p6", name: "Huevos x30", sku: "HU-001", barcode: "7701234500064", category: "Lácteos", price: 16500, cost: 13000, stock: 12, minStock: 4 },
  { id: "p7", name: "Aceite 1L", sku: "AC-001", barcode: "7701234500071", category: "Abarrotes", price: 11000, cost: 8500, stock: 3, minStock: 5 },
  { id: "p8", name: "Jabón de baño", sku: "JA-001", barcode: "7701234500088", category: "Aseo", price: 2800, cost: 1900, stock: 25, minStock: 8 },
];

const KEYS = {
  settings: "freepos_settings",
  users: "freepos_users",
  products: "freepos_products",
  categories: "freepos_categories",
  purchases: "freepos_purchases",
  sales: "freepos_sales",
  shift: "freepos_current_shift",
  zReports: "freepos_z_reports",
  tables: "freepos_open_tables",
  returns: "freepos_returns",
  suppliers: "freepos_suppliers",
};

/* ---------------------------------- helpers ---------------------------------- */

const uid = (p = "id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// window.__TAURI__ solo existe si "withGlobalTauri" está activado en tauri.conf.json
// (viene APAGADO por defecto en Tauri 2). window.__TAURI_INTERNALS__ en cambio siempre
// está presente dentro de la app de escritorio, sin importar esa configuración — es la
// forma confiable de saber "¿estoy corriendo dentro de Tauri?".
function isTauriApp() {
  return typeof window !== "undefined" && !!(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

// Código de recuperación: se guarda en el propio computador (nunca por internet/email,
// ya que FreePOS funciona sin conexión). Sirve para restablecer el PIN de un administrador
// si se olvida. Se recomienda anotarlo o guardarlo en un lugar seguro.
function generateRecoveryCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos (0/O, 1/I)
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

// El COSTO es lo que pagas por el producto (factura del proveedor).
// El PRECIO es lo que le cobras al cliente. Son conceptos distintos y nunca se mezclan.
// "% de ganancia" aquí es margen sobre el costo: precio = costo x (1 + %/100).
function priceFromCostAndMargin(cost, marginPct) {
  const c = Number(cost) || 0;
  const m = Number(marginPct) || 0;
  return Math.round(c * (1 + m / 100) * 100) / 100;
}
function marginFromCostAndPrice(cost, price) {
  const c = Number(cost) || 0;
  const p = Number(price) || 0;
  if (c <= 0) return 0;
  return Math.round(((p - c) / c) * 1000) / 10; // 1 decimal
}

// NOTA: la comprobación de versión y la descarga/instalación de actualizaciones ahora las
// hace el plugin oficial de Tauri (@tauri-apps/plugin-updater) directamente dentro de App(),
// porque es el único que puede firmar/verificar y de verdad instalar el archivo nuevo.

function formatMoney(amount, currency) {
  const c = currency || DEFAULT_SETTINGS.currency;
  const n = Number(amount) || 0;
  return `${c.symbol}${n.toLocaleString("es-CO", { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals })}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// "Día operativo": para negocios que cierran después de medianoche, el día
// contable puede empezar a otra hora distinta a las 12:00 a.m.
function getBusinessDate(dateInput, resetHour = 0) {
  const d = new Date(dateInput);
  const shifted = new Date(d.getTime() - resetHour * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

// ¿Ya deberíamos recordarle al admin cerrar el turno (Reporte Z)?
function shouldRemindZReport(shift, resetHour, now = new Date()) {
  if (!shift) return false;
  const openedAt = new Date(shift.openedAt);
  const boundary = new Date(openedAt);
  boundary.setHours(resetHour, 0, 0, 0);
  if (boundary <= openedAt) boundary.setDate(boundary.getDate() + 1);
  return now >= boundary;
}

// Calcula todo lo ocurrido durante un turno de caja (para Reporte X y Reporte Z)
function computeShiftStats(shift, sales, purchases, products = [], returns = []) {
  if (!shift) return null;
  const start = new Date(shift.openedAt).getTime();
  const end = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now();
  const shiftSales = sales.filter((s) => {
    const t = new Date(s.date).getTime();
    return t >= start && t <= end;
  });
  const shiftReturns = returns.filter((r) => {
    const t = new Date(r.date).getTime();
    return t >= start && t <= end;
  });
  const salesByPayment = {};
  const returnsByPayment = {};
  PAYMENT_METHODS.forEach((m) => { salesByPayment[m] = 0; returnsByPayment[m] = 0; });
  const categoryOf = {};
  products.forEach((p) => { categoryOf[p.id] = p.category || "Sin categoría"; });
  const salesByCategory = {};
  let totalSales = 0;
  let totalCost = 0;
  shiftSales.forEach((s) => {
    totalSales += s.total;
    salesByPayment[s.paymentMethod] = (salesByPayment[s.paymentMethod] || 0) + s.total;
    totalCost += s.items.reduce((a, i) => a + (i.cost || 0) * i.qty, 0);
    s.items.forEach((i) => {
      const cat = categoryOf[i.productId] || "Sin categoría";
      if (!salesByCategory[cat]) salesByCategory[cat] = { qty: 0, total: 0 };
      salesByCategory[cat].qty += i.qty;
      salesByCategory[cat].total += i.price * i.qty;
    });
  });
  let totalReturns = 0;
  let totalReturnsCost = 0;
  shiftReturns.forEach((r) => {
    totalReturns += r.total;
    returnsByPayment[r.paymentMethod] = (returnsByPayment[r.paymentMethod] || 0) + r.total;
    totalReturnsCost += r.items.reduce((a, i) => a + (i.cost || 0) * i.qty, 0);
    r.items.forEach((i) => {
      const cat = categoryOf[i.productId] || "Sin categoría";
      if (!salesByCategory[cat]) salesByCategory[cat] = { qty: 0, total: 0 };
      salesByCategory[cat].qty -= i.qty;
      salesByCategory[cat].total -= i.price * i.qty;
    });
  });
  const netSales = totalSales - totalReturns;
  const netCost = totalCost - totalReturnsCost;
  const profit = netSales - netCost;
  const startDay = getBusinessDate(shift.openedAt, 0);
  const endDay = getBusinessDate(end, 0);
  const shiftPurchases = purchases.filter((p) => p.date >= startDay && p.date <= endDay);
  const totalPurchases = shiftPurchases.reduce((a, p) => a + p.total, 0);
  const cashSales = salesByPayment["Efectivo"] || 0;
  const cashReturns = returnsByPayment["Efectivo"] || 0;
  const netCashSales = cashSales - cashReturns;
  const expectedCash = (shift.openingCash || 0) + netCashSales;
  return {
    shiftSales, shiftReturns, salesByPayment, returnsByPayment, salesByCategory,
    totalSales, totalReturns, netSales, totalCost, totalReturnsCost, netCost, profit,
    shiftPurchases, totalPurchases, cashSales, cashReturns, netCashSales, expectedCash,
    transactions: shiftSales.length,
  };
}

async function loadCollection(key, fallback) {
  try {
    const res = await window.storage.get(key, true);
    if (!res || res.value === undefined) return fallback;
    return JSON.parse(res.value);
  } catch (e) {
    return fallback;
  }
}

async function saveCollection(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), true);
    return true;
  } catch (e) {
    console.error("Error guardando", key, e);
    return false;
  }
}

/* --- Hardware: cajón de dinero vía puerto serie (impresoras térmicas ESC/POS) --- */
// La mayoría de cajones se conectan a la impresora térmica (cable RJ11) y se abren
// enviando el comando ESC/POS de "kick" directamente al puerto. Esto requiere
// Chrome/Edge de escritorio con Web Serial habilitado. Si no está disponible,
// devolvemos un motivo claro para mostrarlo al usuario.
async function openCashDrawer() {
  if (!navigator.serial) {
    return { ok: false, reason: "unsupported" };
  }
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    const writer = port.writable.getWriter();
    const kick = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]); // ESC p 0 25 250
    await writer.write(kick);
    writer.releaseLock();
    await port.close();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "denied", error: e };
  }
}

/* ---------------------------------- tiny UI kit ---------------------------------- */

const COLORS = {
  bg: "#F4F5F7",
  surface: "#FFFFFF",
  ink: "#1E2530",
  inkSoft: "#6B7280",
  primary: "#0F6E5D",
  primaryDark: "#0B5045",
  primarySoft: "#E4F2EF",
  amber: "#B45309",
  amberSoft: "#FDF0DC",
  danger: "#B42318",
  dangerSoft: "#FBE9E7",
  border: "#E4E6EA",
};

function Button({ children, onClick, variant = "primary", size = "md", disabled, type = "button", className = "" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-5 py-3 text-base" };
  const styles = {
    primary: { background: COLORS.primary, color: "#fff" },
    dark: { background: COLORS.ink, color: "#fff" },
    ghost: { background: "transparent", color: COLORS.ink, border: `1px solid ${COLORS.border}` },
    danger: { background: COLORS.dangerSoft, color: COLORS.danger },
    subtle: { background: COLORS.primarySoft, color: COLORS.primaryDark },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${className}`}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span style={{ color: COLORS.inkSoft }} className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-md px-3 py-2 text-sm outline-none focus:ring-2";
const inputStyle = { border: `1px solid ${COLORS.border}`, background: "#fff" };

const TextInput = React.forwardRef(function TextInput(props, ref) {
  return <input ref={ref} {...props} className={`${inputCls} ${props.className || ""}`} style={{ ...inputStyle, ...(props.style || {}) }} />;
});
function Select(props) {
  return <select {...props} className={`${inputCls} ${props.className || ""}`} style={{ ...inputStyle, ...(props.style || {}) }} />;
}

function Modal({ title, onClose, children, width = "max-w-lg" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,20,25,0.45)" }}>
      <div className={`w-full ${width} rounded-xl shadow-xl overflow-hidden`} style={{ background: COLORS.surface }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <h3 className="font-semibold text-base" style={{ color: COLORS.ink }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Badge({ children, tone = "primary" }) {
  const tones = {
    primary: { background: COLORS.primarySoft, color: COLORS.primaryDark },
    amber: { background: COLORS.amberSoft, color: COLORS.amber },
    danger: { background: COLORS.dangerSoft, color: COLORS.danger },
    gray: { background: "#EEF0F2", color: COLORS.inkSoft },
  };
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={tones[tone]}>
      {children}
    </span>
  );
}

function Logo({ size = 32, radius = 8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="1024" height="1024" rx="204" fill={COLORS.primary} />
      <path d="M292,180 L732,180 L732,660 L696,740 L659,660 L622,740 L585,660 L549,740 L512,660 L475,740 L439,660 L402,740 L365,660 L329,740 L292,660 Z" fill="#FFFFFF" />
      <path d="M400,440 L475,520 L648,320" fill="none" stroke={COLORS.primary} strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <Icon size={30} style={{ color: COLORS.inkSoft }} />
      <p className="font-medium" style={{ color: COLORS.ink }}>{title}</p>
      {subtitle && <p className="text-sm max-w-xs" style={{ color: COLORS.inkSoft }}>{subtitle}</p>}
    </div>
  );
}

function ConfirmModal({ title, message, options, onCancel }) {
  // options: [{ label, variant, onClick }]
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 no-print" style={{ background: "rgba(15,20,25,0.5)" }}>
      <div className="w-full max-w-sm rounded-xl shadow-xl p-6" style={{ background: COLORS.surface }}>
        <h3 className="font-bold text-base mb-1" style={{ color: COLORS.ink }}>{title}</h3>
        {message && <p className="text-sm mb-5" style={{ color: COLORS.inkSoft }}>{message}</p>}
        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <Button key={opt.label} variant={opt.variant || "primary"} onClick={opt.onClick} className="w-full">
              {opt.label}
            </Button>
          ))}
          {onCancel && <Button variant="ghost" onClick={onCancel} className="w-full">Cancelar</Button>}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Login ---------------------------------- */

function LoginScreen({ users, settings, setUsers, onLogin }) {
  const activeUsers = users.filter((u) => u.active);
  const [selected, setSelected] = useState(activeUsers[0]?.id || "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);

  function submit(e) {
    e.preventDefault();
    const user = users.find((u) => u.id === selected);
    if (!user || !user.active) { setError("Selecciona un usuario válido."); return; }
    if (user.pin !== pin) { setError("PIN incorrecto."); return; }
    setError("");
    onLogin(user);
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: COLORS.bg, fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-sm rounded-2xl shadow-lg p-8" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <div className="flex flex-col items-center gap-3 mb-7">
          <div className="rounded-2xl shadow-sm" style={{ boxShadow: "0 8px 20px -6px rgba(15,110,93,0.45)" }}>
            <Logo size={56} />
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: COLORS.ink, fontFamily: "'Space Grotesk', sans-serif" }}>FreePOS</h1>
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>{settings.businessName}</p>
          </div>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Usuario">
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} · {u.role === "admin" ? "Administrador" : "Empleado"}</option>
              ))}
            </Select>
          </Field>
          <Field label="PIN">
            <TextInput type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" autoFocus />
          </Field>
          {error && <p className="text-sm" style={{ color: COLORS.danger }}>{error}</p>}
          <Button type="submit" size="lg">Entrar</Button>
        </form>
        <button onClick={() => setShowRecovery(true)} className="text-xs text-center mt-4 w-full" style={{ color: COLORS.primary }}>
          ¿Olvidaste tu PIN?
        </button>
        <p className="text-xs text-center mt-3" style={{ color: COLORS.inkSoft }}>
          Demo: admin / 1234 · empleado / 0000
        </p>
      </div>
      {showRecovery && <RecoveryModal users={users} settings={settings} setUsers={setUsers} onClose={() => setShowRecovery(false)} />}
    </div>
  );
}

function RecoveryModal({ users, settings, setUsers, onClose }) {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(users.find((u) => u.role === "admin")?.id || users[0]?.id || "");
  const [newPin, setNewPin] = useState("");
  const [done, setDone] = useState(false);

  function verifyCode(e) {
    e.preventDefault();
    if (!settings.recoveryCode || code.trim().toUpperCase() !== settings.recoveryCode) {
      setError("Código incorrecto.");
      return;
    }
    setError("");
    setStep(2);
  }

  function resetPin(e) {
    e.preventDefault();
    if (!newPin || newPin.length < 4) { setError("El PIN debe tener al menos 4 caracteres."); return; }
    setUsers((prev) => prev.map((u) => (u.id === selectedUserId ? { ...u, pin: newPin, active: true, role: "admin" } : u)));
    setError("");
    setDone(true);
  }

  return (
    <Modal title="Recuperar acceso" onClose={onClose} width="max-w-sm">
      {done ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: COLORS.ink }}>Listo, el PIN se actualizó y ese usuario quedó como administrador activo. Ya puedes cerrar esta ventana e iniciar sesión con el nuevo PIN.</p>
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      ) : step === 1 ? (
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>
            Ingresa el código de recuperación que se generó cuando se configuró este computador
            (lo encuentras en Configuración → Código de recuperación, o donde lo hayan anotado).
          </p>
          <Field label="Código de recuperación">
            <TextInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX" autoFocus />
          </Field>
          {error && <p className="text-sm" style={{ color: COLORS.danger }}>{error}</p>}
          <Button type="submit">Verificar código</Button>
        </form>
      ) : (
        <form onSubmit={resetPin} className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>
            El usuario que elijas quedará como <strong>administrador activo</strong> con el PIN nuevo que definas aquí.
          </p>
          <Field label="Usuario a restablecer">
            <Select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} · {u.role === "admin" ? "Administrador" : "Empleado"}</option>
              ))}
            </Select>
          </Field>
          <Field label="Nuevo PIN">
            <TextInput value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="Nuevo PIN" autoFocus />
          </Field>
          {error && <p className="text-sm" style={{ color: COLORS.danger }}>{error}</p>}
          <Button type="submit">Guardar nuevo PIN</Button>
        </form>
      )}
    </Modal>
  );
}

/* ---------------------------------- Sidebar ---------------------------------- */

function Sidebar({ page, setPage, user, onLogout, settings, shift }) {
  const adminItems = [
    { id: "dashboard", label: "Panel", icon: LayoutDashboard },
    { id: "pos", label: "Ventas", icon: ShoppingCart },
    { id: "cashregister", label: "Caja", icon: Wallet },
    { id: "inventory", label: "Inventario", icon: Package },
    { id: "purchases", label: "Compras", icon: FileText },
    { id: "reports", label: "Reportes", icon: BarChart3 },
    { id: "users", label: "Usuarios", icon: UsersIcon },
    { id: "settings", label: "Configuración", icon: SettingsIcon },
  ];
  const employeeItems = [
    { id: "pos", label: "Ventas", icon: ShoppingCart },
    { id: "cashregister", label: "Caja", icon: Wallet },
  ];
  const items = user.role === "admin" ? adminItems : employeeItems;
  const zPending = user.role === "admin" && shift && shouldRemindZReport(shift, settings.dayResetHour);

  return (
    <div className="w-56 shrink-0 h-screen sticky top-0 flex flex-col no-print" style={{ background: COLORS.ink }}>
      <div className="px-5 py-5 flex items-center gap-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Logo size={30} />
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-white tracking-tight text-[15px]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>FreePOS</span>
          <span className="text-[11px] truncate max-w-[130px]" style={{ color: "#7E8894" }}>{settings.businessName}</span>
        </div>
      </div>
      <nav className="flex-1 px-3 flex flex-col gap-1 mt-3">
        {items.map((it) => {
          const Icon = it.icon;
          const active = page === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setPage(it.id)}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
              style={{ background: active ? COLORS.primary : "transparent", color: active ? "#fff" : "#B7BEC7" }}
            >
              <span className="flex items-center gap-3"><Icon size={17} />{it.label}</span>
              {it.id === "cashregister" && zPending && <span className="w-2 h-2 rounded-full" style={{ background: COLORS.amber }} />}
            </button>
          );
        })}
      </nav>
      <div className="px-3 pb-4">
        <div className="rounded-lg px-3 py-3 mb-2" style={{ background: "#242C36" }}>
          <p className="text-xs text-gray-400">Sesión activa</p>
          <p className="text-sm font-semibold text-white truncate">{user.name}</p>
          <p className="text-xs" style={{ color: COLORS.primary === "#0F6E5D" ? "#4FBBA4" : "#9CA3AF" }}>{user.role === "admin" ? "Administrador" : "Empleado"}</p>
        </div>
        <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5">
          <LogOut size={16} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- Dashboard ---------------------------------- */

function Dashboard({ products, sales, settings, setPage, shift }) {
  const today = todayISO();
  const todaySales = sales.filter((s) => s.date.slice(0, 10) === today);
  const revenueToday = todaySales.reduce((a, s) => a + s.total, 0);
  const txCount = todaySales.length;
  const lowStock = products.filter((p) => p.stock <= p.minStock);
  const zPending = shift && shouldRemindZReport(shift, settings.dayResetHour);

  const topMap = {};
  todaySales.forEach((s) => s.items.forEach((it) => {
    topMap[it.name] = (topMap[it.name] || 0) + it.qty;
  }));
  const top = Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: COLORS.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Panel de hoy</h1>
        <p className="text-sm" style={{ color: COLORS.inkSoft }}>{settings.businessName} · {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      {!shift ? (
        <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: COLORS.amberSoft }}>
          <div className="flex items-center gap-3">
            <Wallet size={20} style={{ color: COLORS.amber }} />
            <p className="text-sm font-medium" style={{ color: COLORS.amber }}>La caja está cerrada. Ábrela para empezar a vender.</p>
          </div>
          <Button size="sm" onClick={() => setPage("cashregister")}>Ir a Caja</Button>
        </div>
      ) : zPending ? (
        <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: COLORS.amberSoft }}>
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} style={{ color: COLORS.amber }} />
            <p className="text-sm font-medium" style={{ color: COLORS.amber }}>Ya pasó la hora configurada de cierre. Considera generar el Reporte Z.</p>
          </div>
          <Button size="sm" onClick={() => setPage("cashregister")}>Ir a Caja</Button>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="Ventas de hoy" value={formatMoney(revenueToday, settings.currency)} tone="primary" />
        <StatCard icon={ClipboardList} label="Transacciones" value={txCount} tone="gray" />
        <StatCard icon={AlertTriangle} label="Productos con bajo stock" value={lowStock.length} tone={lowStock.length ? "amber" : "gray"} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-5" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <h3 className="font-semibold mb-3 text-sm" style={{ color: COLORS.ink }}>Más vendidos hoy</h3>
          {top.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>Aún no hay ventas registradas hoy.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {top.map(([name, qty]) => (
                <li key={name} className="flex items-center justify-between text-sm">
                  <span style={{ color: COLORS.ink }}>{name}</span>
                  <span className="font-mono font-semibold" style={{ color: COLORS.primaryDark }}>{qty} u.</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl p-5" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm" style={{ color: COLORS.ink }}>Alertas de inventario</h3>
            <button onClick={() => setPage("inventory")} className="text-xs font-semibold" style={{ color: COLORS.primary }}>Ver inventario →</button>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>Todo el inventario está en buen nivel.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lowStock.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: COLORS.ink }}>{p.name}</span>
                  <Badge tone="amber">{p.stock} en stock</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button onClick={() => setPage("pos")} className="self-start">
        <Button size="lg"><ShoppingCart size={18} /> Ir a Ventas</Button>
      </button>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  const bg = tone === "primary" ? COLORS.primarySoft : tone === "amber" ? COLORS.amberSoft : "#F1F2F4";
  const color = tone === "primary" ? COLORS.primaryDark : tone === "amber" ? COLORS.amber : COLORS.ink;
  return (
    <div className="rounded-xl p-5 flex items-center gap-4" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
      <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>{label}</p>
        <p className="text-xl font-bold font-mono" style={{ color: COLORS.ink }}>{value}</p>
      </div>
    </div>
  );
}

/* ---------------------------------- POS ---------------------------------- */

function POS({ products, categories: savedCategories, settings, user, onCompleteSale, tables, setTables, shift }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [activeTableId, setActiveTableId] = useState(tables[0]?.id || "mostrador");
  const [receipt, setReceipt] = useState(null);
  const [toast, setToast] = useState(null);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [qtyPrompt, setQtyPrompt] = useState(null); // producto seleccionado esperando cantidad
  const [printReceipt, setPrintReceipt] = useState(true);
  const [addingTable, setAddingTable] = useState(false);
  const [confirmDeleteTable, setConfirmDeleteTable] = useState(null);

  const activeTable = tables.find((t) => t.id === activeTableId) || tables[0];

  const categories = useMemo(() => {
    const fromProducts = products.map((p) => p.category).filter(Boolean);
    return ["Todos", ...Array.from(new Set([...(savedCategories || []), ...fromProducts]))];
  }, [products, savedCategories]);

  const filtered = products.filter((p) => {
    const matchesCat = category === "Todos" || p.category === category;
    const q = search.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || "").includes(search);
    return matchesCat && matchesSearch;
  });

  function showToast(text, tone = "primary") {
    setToast({ text, tone });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2200);
  }

  function updateTable(id, patch) {
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));
  }

  // Cuánto de un producto ya está "reservado" en el carrito de OTRAS mesas/servicios
  function reservedElsewhere(productId) {
    return tables.reduce((sum, t) => {
      if (!activeTable || t.id === activeTable.id) return sum;
      const item = t.cart.find((i) => i.id === productId);
      return sum + (item ? item.qty : 0);
    }, 0);
  }

  // Stock realmente disponible para la mesa activa (descontando lo que otras mesas ya tienen apartado)
  function availableStock(product) {
    return Math.max(0, product.stock - reservedElsewhere(product.id));
  }

  function addToCart(product, qty = 1) {
    if (!activeTable) return;
    const avail = availableStock(product);
    if (avail <= 0) return;
    const addQty = Math.max(1, Math.min(Math.floor(Number(qty)) || 1, avail));
    updateTable(activeTable.id, (t) => {
      const existing = t.cart.find((i) => i.id === product.id);
      let newCart;
      if (existing) {
        const newQty = Math.min(existing.qty + addQty, avail);
        newCart = t.cart.map((i) => (i.id === product.id ? { ...i, qty: newQty } : i));
      } else {
        newCart = [...t.cart, { id: product.id, name: product.name, price: product.price, cost: product.cost, qty: Math.min(addQty, avail) }];
      }
      return { cart: newCart };
    });
  }

  function confirmQtyPrompt(qty) {
    if (!qtyPrompt) return;
    addToCart(qtyPrompt, qty);
    setQtyPrompt(null);
  }

  // Lector de código de barras: la mayoría son dispositivos "keyboard wedge" que
  // escriben muy rápido y terminan con Enter. Detectamos rachas de teclas rápidas.
  useEffect(() => {
    if (!settings.barcodeScannerEnabled) return;
    let buffer = "";
    let lastTime = 0;
    function handleKeyDown(e) {
      const now = Date.now();
      if (now - lastTime > 60) buffer = "";
      lastTime = now;
      if (e.key === "Enter") {
        const code = buffer.trim();
        buffer = "";
        if (code.length >= 4) {
          const product = products.find((p) => p.barcode === code || p.sku === code);
          if (product) {
            addToCart(product);
            showToast(`Agregado: ${product.name}`, "primary");
          } else {
            showToast(`Código no encontrado: ${code}`, "danger");
          }
        }
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products, settings.barcodeScannerEnabled, activeTable]);

  async function handleOpenDrawer() {
    setDrawerBusy(true);
    const res = await openCashDrawer();
    setDrawerBusy(false);
    if (res.ok) showToast("Cajón abierto", "primary");
    else if (res.reason === "unsupported") showToast("Este navegador no permite abrir el cajón directamente. Configúralo para abrirse al imprimir.", "amber");
    else showToast("No se pudo conectar con el cajón.", "danger");
  }

  function updateQty(id, delta) {
    if (!activeTable) return;
    const product = products.find((p) => p.id === id);
    const cap = product ? availableStock(product) : Infinity;
    updateTable(activeTable.id, (t) => ({
      cart: t.cart.map((i) => {
        if (i.id !== id) return i;
        const qty = Math.min(Math.max(i.qty + delta, 1), cap);
        return { ...i, qty };
      }),
    }));
  }

  function removeItem(id) {
    if (!activeTable) return;
    updateTable(activeTable.id, (t) => ({ cart: t.cart.filter((i) => i.id !== id) }));
  }

  function addTable(name) {
    const clean = (name || "").trim();
    if (!clean) return;
    const newTable = { id: uid("tbl"), name: clean, cart: [], discountPct: 0, taxPct: settings.taxRate || 0, payment: PAYMENT_METHODS[0], createdAt: new Date().toISOString(), fixed: false };
    setTables((prev) => [...prev, newTable]);
    setActiveTableId(newTable.id);
    setAddingTable(false);
  }

  function deleteTable(table) {
    setTables((prev) => prev.filter((t) => t.id !== table.id));
    if (activeTableId === table.id) setActiveTableId(tables.find((t) => t.id !== table.id)?.id || "mostrador");
    setConfirmDeleteTable(null);
  }

  const cart = activeTable ? activeTable.cart : [];
  const discountPct = activeTable ? activeTable.discountPct : 0;
  const taxPct = activeTable ? activeTable.taxPct : 0;
  const payment = activeTable ? activeTable.payment : PAYMENT_METHODS[0];

  const subtotal = cart.reduce((a, i) => a + i.price * i.qty, 0);
  const discountAmt = subtotal * (Number(discountPct) || 0) / 100;
  const taxable = subtotal - discountAmt;
  const taxAmt = taxable * (Number(taxPct) || 0) / 100;
  const total = taxable + taxAmt;

  function charge() {
    if (!activeTable || cart.length === 0) return;
    const sale = {
      id: uid("sale"),
      date: new Date().toISOString(),
      cashier: user.name,
      tableName: activeTable.name,
      items: cart.map((i) => ({ productId: i.id, name: i.name, qty: i.qty, price: i.price, cost: i.cost })),
      subtotal, discountPct: Number(discountPct) || 0, discountAmt, taxPct: Number(taxPct) || 0, taxAmt, total,
      paymentMethod: payment,
      invoiced: printReceipt,
    };
    onCompleteSale(sale);
    updateTable(activeTable.id, { cart: [], discountPct: 0, payment: PAYMENT_METHODS[0] });
    if (printReceipt) {
      setReceipt(sale);
    } else {
      showToast("Venta registrada sin factura impresa", "primary");
    }
  }

  if (!shift) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState icon={Wallet} title="La caja está cerrada" subtitle="Un administrador o empleado debe abrir la caja (indicando el efectivo inicial) antes de poder registrar ventas. Ve a la sección Caja." />
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col h-full gap-3">
      <div className="flex gap-5 flex-1 min-h-0">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.inkSoft }} />
              <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto, SKU o escanear código de barras..." className="pl-9" />
            </div>
            <Button variant="ghost" onClick={handleOpenDrawer} disabled={drawerBusy}>
              <DollarSign size={16} /> Abrir cajón
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold"
                style={category === c ? { background: COLORS.primary, color: "#fff" } : { background: "#EEF0F2", color: COLORS.inkSoft }}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 330px)" }}>
            {filtered.map((p) => {
              const avail = availableStock(p);
              return (
                <button
                  key={p.id}
                  onClick={() => setQtyPrompt(p)}
                  disabled={avail <= 0}
                  className="text-left rounded-xl p-3 flex flex-col gap-1 transition-transform active:scale-95 disabled:opacity-40"
                  style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
                >
                  <span className="text-sm font-semibold leading-snug" style={{ color: COLORS.ink }}>{p.name}</span>
                  <span className="text-xs" style={{ color: COLORS.inkSoft }}>{avail <= 0 ? "Agotado" : `${avail} disp.`}</span>
                  <span className="font-mono font-bold text-sm mt-1" style={{ color: COLORS.primaryDark }}>{formatMoney(p.price, settings.currency)}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-3"><EmptyState icon={Search} title="Sin resultados" subtitle="Prueba con otro nombre, SKU o categoría." /></div>
            )}
          </div>
        </div>

        {/* Receipt-style cart */}
        <div className="w-80 shrink-0 flex flex-col rounded-xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px dashed ${COLORS.border}` }}>
          <h3 className="font-semibold text-sm font-mono" style={{ color: COLORS.ink }}>{(activeTable?.name || "TICKET").toUpperCase()}</h3>
          <ShoppingCart size={16} style={{ color: COLORS.inkSoft }} />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: "calc(100vh - 430px)" }}>
          {cart.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: COLORS.inkSoft }}>Agrega productos tocando la grilla.</p>
          ) : (
            <ul className="flex flex-col gap-3 font-mono text-xs">
              {cart.map((i) => (
                <li key={i.id} className="flex flex-col gap-1 pb-2" style={{ borderBottom: `1px dashed ${COLORS.border}` }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold" style={{ color: COLORS.ink }}>{i.name}</span>
                    <button onClick={() => removeItem(i.id)}><Trash2 size={13} style={{ color: COLORS.danger }} /></button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(i.id, -1)} className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "#EEF0F2" }}><Minus size={11} /></button>
                      <span>{i.qty}</span>
                      <button onClick={() => updateQty(i.id, 1)} className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "#EEF0F2" }}><Plus size={11} /></button>
                    </div>
                    <span style={{ color: COLORS.primaryDark }}>{formatMoney(i.price * i.qty, settings.currency)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-4 py-3 flex flex-col gap-2" style={{ borderTop: `1px dashed ${COLORS.border}` }}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Desc. %">
              <TextInput type="number" min="0" max="100" value={discountPct} onChange={(e) => updateTable(activeTable.id, { discountPct: e.target.value })} />
            </Field>
            <Field label="Impuesto %">
              <TextInput type="number" min="0" max="100" value={taxPct} onChange={(e) => updateTable(activeTable.id, { taxPct: e.target.value })} />
            </Field>
          </div>
          <Field label="Pago">
            <Select value={payment} onChange={(e) => updateTable(activeTable.id, { payment: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <div className="font-mono text-xs flex flex-col gap-1 mt-1">
            <div className="flex justify-between"><span style={{ color: COLORS.inkSoft }}>Subtotal</span><span>{formatMoney(subtotal, settings.currency)}</span></div>
            <div className="flex justify-between"><span style={{ color: COLORS.inkSoft }}>Descuento</span><span>-{formatMoney(discountAmt, settings.currency)}</span></div>
            <div className="flex justify-between"><span style={{ color: COLORS.inkSoft }}>Impuesto</span><span>+{formatMoney(taxAmt, settings.currency)}</span></div>
            <div className="flex justify-between text-base font-bold pt-1" style={{ color: COLORS.ink }}><span>TOTAL</span><span>{formatMoney(total, settings.currency)}</span></div>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium" style={{ color: COLORS.ink }}>
            <input type="checkbox" checked={printReceipt} onChange={(e) => setPrintReceipt(e.target.checked)} />
            Imprimir factura al cobrar
          </label>
          <Button size="lg" onClick={charge} disabled={cart.length === 0}>
            {printReceipt ? <Printer size={18} /> : <Check size={18} />}
            {printReceipt ? "Cobrar e imprimir" : "Cobrar sin factura"}
          </Button>
        </div>
      </div>
      </div>

      {/* Mesas / servicios: permiten llevar varias ventas abiertas al mismo tiempo, siempre visibles abajo */}
      <div className="flex items-center gap-2 flex-wrap px-1 py-2 rounded-xl" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <LayoutGrid size={15} style={{ color: COLORS.inkSoft }} className="ml-1" />
        {tables.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTableId(t.id)}
            className="pl-3 pr-2 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2"
            style={activeTableId === t.id ? { background: COLORS.ink, color: "#fff" } : { background: "#EEF0F2", color: COLORS.inkSoft }}
          >
            {t.name}
            {t.cart.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: activeTableId === t.id ? "rgba(255,255,255,0.2)" : COLORS.primarySoft, color: activeTableId === t.id ? "#fff" : COLORS.primaryDark }}>
                {t.cart.reduce((a, i) => a + i.qty, 0)}
              </span>
            )}
            {!t.fixed && (
              <span onClick={(e) => { e.stopPropagation(); setConfirmDeleteTable(t); }}>
                <X size={12} />
              </span>
            )}
          </button>
        ))}
        <button onClick={() => setAddingTable(true)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: COLORS.primarySoft, color: COLORS.primaryDark }}>
          <Plus size={14} />
        </button>
      </div>
    </div>

    {qtyPrompt && <QtyPromptModal product={qtyPrompt} maxQty={availableStock(qtyPrompt)} settings={settings} onConfirm={confirmQtyPrompt} onClose={() => setQtyPrompt(null)} />}
    {receipt && <ReceiptModal sale={receipt} settings={settings} onClose={() => setReceipt(null)} />}
    {addingTable && <AddTableModal onConfirm={addTable} onClose={() => setAddingTable(false)} />}
    {confirmDeleteTable && (
      <ConfirmModal
        title="Cerrar mesa/servicio"
        message={confirmDeleteTable.cart.length > 0 ? `"${confirmDeleteTable.name}" todavía tiene productos sin cobrar. ¿Seguro que quieres cerrarla? Se perderá lo que tenga agregado.` : `¿Cerrar "${confirmDeleteTable.name}"?`}
        options={[{ label: "Cerrar mesa", variant: "danger", onClick: () => deleteTable(confirmDeleteTable) }]}
        onCancel={() => setConfirmDeleteTable(null)}
      />
    )}
    {toast && (
      <div
        className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium no-print"
        style={{
          background: toast.tone === "danger" ? COLORS.dangerSoft : toast.tone === "amber" ? COLORS.amberSoft : COLORS.primarySoft,
          color: toast.tone === "danger" ? COLORS.danger : toast.tone === "amber" ? COLORS.amber : COLORS.primaryDark,
        }}
      >
        {toast.text}
      </div>
    )}
    </>
  );
}

function AddTableModal({ onConfirm, onClose }) {
  const [name, setName] = useState("");
  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirm(name);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print" style={{ background: "rgba(15,20,25,0.45)" }} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-xl shadow-xl p-5 flex flex-col gap-3" style={{ background: COLORS.surface }}>
        <h3 className="font-semibold text-sm" style={{ color: COLORS.ink }}>Nueva mesa / servicio</h3>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Mesa 4, Domicilio, Para llevar..." autoFocus />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1">Crear</Button>
        </div>
      </form>
    </div>
  );
}

function QtyPromptModal({ product, maxQty, settings, onConfirm, onClose }) {
  const [qty, setQty] = useState("1");
  const inputRef = useRef(null);
  const cap = typeof maxQty === "number" ? maxQty : product.stock;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  function submit(e) {
    e.preventDefault();
    const n = Math.max(1, Math.min(Math.floor(Number(qty)) || 1, cap));
    onConfirm(n);
  }

  const lineTotal = (Number(qty) || 0) * product.price;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print" style={{ background: "rgba(15,20,25,0.45)" }} onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-xl shadow-xl p-5 flex flex-col gap-3"
        style={{ background: COLORS.surface }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{product.name}</p>
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>{cap} disponibles (entre todas las mesas) · {formatMoney(product.price, settings.currency)} c/u</p>
        </div>
        <Field label="Cantidad">
          <TextInput
            ref={inputRef}
            type="number"
            min="1"
            max={cap}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </Field>
        <div className="flex justify-between text-sm font-mono font-semibold" style={{ color: COLORS.primaryDark }}>
          <span>Subtotal</span><span>{formatMoney(lineTotal, settings.currency)}</span>
        </div>
        <div className="flex gap-2 mt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1"><Check size={16} /> Agregar</Button>
        </div>
      </form>
    </div>
  );
}

function ReceiptModal({ sale, settings, returns = [], user, onReturn, onClose }) {
  const previewWidth = settings.paperWidth === "80" ? "300px" : "220px";
  const [showReturn, setShowReturn] = useState(false);

  const alreadyReturned = {};
  returns.filter((r) => r.saleId === sale.id).forEach((r) => r.items.forEach((i) => {
    alreadyReturned[i.productId] = (alreadyReturned[i.productId] || 0) + i.qty;
  }));
  const totalAlreadyReturned = returns.filter((r) => r.saleId === sale.id).reduce((a, r) => a + r.total, 0);
  const hasReturns = totalAlreadyReturned > 0;
  const canReturnMore = sale.items.some((it) => (alreadyReturned[it.productId] || 0) < it.qty);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,20,25,0.45)" }}>
      <div className="w-full max-w-sm rounded-xl shadow-xl overflow-hidden" style={{ background: COLORS.surface }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <h3 className="font-semibold text-sm">Venta completada · Papel {settings.paperWidth || "58"}mm</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5">
          <div id="freepos-receipt" className="receipt-print font-mono text-xs mx-auto" style={{ width: previewWidth, color: "#111" }}>
            <p className="text-center font-bold text-sm">{settings.businessName}</p>
            <p className="text-center">{settings.address}</p>
            <p className="text-center mb-2">{new Date(sale.date).toLocaleString("es-CO")}</p>
            <p className="mb-1">Ticket: {sale.id}</p>
            <p className="mb-2">Cajero: {sale.cashier}</p>
            <div style={{ borderTop: "1px dashed #999", borderBottom: "1px dashed #999" }} className="py-2 my-2 flex flex-col gap-1">
              {sale.items.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{it.qty}x {it.name}{alreadyReturned[it.productId] ? ` (${alreadyReturned[it.productId]} devuelto)` : ""}</span>
                  <span>{formatMoney(it.price * it.qty, settings.currency)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(sale.subtotal, settings.currency)}</span></div>
            <div className="flex justify-between"><span>Descuento</span><span>-{formatMoney(sale.discountAmt, settings.currency)}</span></div>
            <div className="flex justify-between"><span>Impuesto</span><span>+{formatMoney(sale.taxAmt, settings.currency)}</span></div>
            <div className="flex justify-between font-bold text-sm mt-1"><span>TOTAL</span><span>{formatMoney(sale.total, settings.currency)}</span></div>
            <p className="mt-2">Pago: {sale.paymentMethod}</p>
            {hasReturns && <p className="mt-1">Devuelto: {formatMoney(totalAlreadyReturned, settings.currency)}</p>}
            <p className="text-center mt-3">¡Gracias por su compra!</p>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cerrar</Button>
          {onReturn && canReturnMore && (
            <Button variant="danger" onClick={() => setShowReturn(true)} className="flex-1">Devolver</Button>
          )}
          <Button onClick={() => window.print()} className="flex-1"><Printer size={16} /> Imprimir</Button>
        </div>
      </div>
      {showReturn && (
        <ReturnModal
          sale={sale}
          alreadyReturned={alreadyReturned}
          settings={settings}
          user={user}
          onConfirm={(rec) => { onReturn(rec); setShowReturn(false); }}
          onClose={() => setShowReturn(false)}
        />
      )}
    </div>
  );
}

function ReturnModal({ sale, alreadyReturned, settings, user, onConfirm, onClose }) {
  const [qtyByProduct, setQtyByProduct] = useState({});
  const [reason, setReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(sale.paymentMethod);
  const [manualTotal, setManualTotal] = useState("");

  function maxReturnable(item) {
    return Math.max(0, item.qty - (alreadyReturned[item.productId] || 0));
  }

  function setQty(productId, value, max) {
    const n = Math.max(0, Math.min(Math.floor(Number(value)) || 0, max));
    setQtyByProduct((prev) => ({ ...prev, [productId]: n }));
  }

  const computedTotal = sale.items.reduce((a, it) => a + (Number(qtyByProduct[it.productId]) || 0) * it.price, 0);
  const finalTotal = manualTotal !== "" ? Number(manualTotal) || 0 : computedTotal;

  function submit(e) {
    e.preventDefault();
    const items = sale.items
      .filter((it) => (Number(qtyByProduct[it.productId]) || 0) > 0)
      .map((it) => ({ productId: it.productId, name: it.name, qty: Number(qtyByProduct[it.productId]), price: it.price, cost: it.cost }));
    if (items.length === 0) return;
    onConfirm({
      id: uid("ret"),
      saleId: sale.id,
      date: new Date().toISOString(),
      processedBy: user ? user.name : "—",
      reason,
      items,
      total: finalTotal,
      paymentMethod,
    });
  }

  return (
    <Modal title={`Devolución — Ticket ${sale.id}`} onClose={onClose} width="max-w-md">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm" style={{ color: COLORS.inkSoft }}>Indica cuántas unidades de cada producto está devolviendo el cliente.</p>
        <div className="flex flex-col gap-2">
          {sale.items.map((it) => {
            const max = maxReturnable(it);
            return (
              <div key={it.productId} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg" style={{ background: "#FAFAFB", border: `1px solid ${COLORS.border}` }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: COLORS.ink }}>{it.name}</p>
                  <p className="text-xs" style={{ color: COLORS.inkSoft }}>Vendido: {it.qty} · Disponible para devolver: {max}</p>
                </div>
                <TextInput
                  type="number" min="0" max={max}
                  value={qtyByProduct[it.productId] || ""}
                  onChange={(e) => setQty(it.productId, e.target.value, max)}
                  disabled={max === 0}
                  className="w-20"
                />
              </div>
            );
          })}
        </div>
        <Field label="Motivo (opcional)">
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: producto defectuoso, cliente se arrepintió..." />
        </Field>
        <Field label="Se devuelve el dinero por">
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Monto a devolver">
          <TextInput type="number" value={manualTotal !== "" ? manualTotal : computedTotal} onChange={(e) => setManualTotal(e.target.value)} />
        </Field>
        <p className="text-xs" style={{ color: COLORS.inkSoft }}>
          Se calcula automáticamente según lo seleccionado; puedes ajustarlo si necesitas prorratear un descuento o impuesto de la venta original.
        </p>
        <div className="flex gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" variant="danger" className="flex-1">Confirmar devolución</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------- Inventory ---------------------------------- */

const NEW_CATEGORY_VALUE = "__new__";

function ProductForm({ initial, categories, onAddCategory, settings, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    if (initial) {
      return { ...initial, marginPct: marginFromCostAndPrice(initial.cost, initial.price) };
    }
    return { name: "", sku: "", barcode: "", category: categories[0] || "", price: "", cost: "", marginPct: settings.defaultMarginPct, stock: "", minStock: "" };
  });
  const [newCategory, setNewCategory] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  // Costo, % de ganancia y precio de venta se recalculan entre sí para que nunca queden desincronizados.
  function setCost(v) {
    setForm((f) => ({ ...f, cost: v, price: priceFromCostAndMargin(v, f.marginPct) }));
  }
  function setMargin(v) {
    setForm((f) => ({ ...f, marginPct: v, price: priceFromCostAndMargin(f.cost, v) }));
  }
  function setPrice(v) {
    setForm((f) => ({ ...f, price: v, marginPct: marginFromCostAndPrice(f.cost, v) }));
  }

  function handleCategoryChange(e) {
    if (e.target.value === NEW_CATEGORY_VALUE) {
      setCreatingCategory(true);
    } else {
      setCreatingCategory(false);
      set("category", e.target.value);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!form.name || form.price === "") return;
    let finalCategory = form.category;
    if (creatingCategory) {
      finalCategory = newCategory.trim();
      if (!finalCategory) return;
      onAddCategory(finalCategory);
    }
    onSave({
      ...form,
      category: finalCategory,
      id: form.id || uid("p"),
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      marginPct: Number(form.marginPct) || 0,
      stock: Number(form.stock) || 0,
      minStock: Number(form.minStock) || 0,
    });
  }

  return (
    <Modal title={initial ? "Editar producto" : "Nuevo producto"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nombre"><TextInput value={form.name} onChange={(e) => set("name", e.target.value)} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU"><TextInput value={form.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
          <Field label="Código de barras"><TextInput value={form.barcode} onChange={(e) => set("barcode", e.target.value)} placeholder="Escanéalo aquí" /></Field>
        </div>
        <Field label="Categoría">
          <Select value={creatingCategory ? NEW_CATEGORY_VALUE : form.category} onChange={handleCategoryChange}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={NEW_CATEGORY_VALUE}>+ Nueva categoría…</option>
          </Select>
        </Field>
        {creatingCategory && (
          <TextInput value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nombre de la nueva categoría" autoFocus />
        )}
        <div className="rounded-lg p-3 flex flex-col gap-3" style={{ background: COLORS.primarySoft }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.primaryDark }}>Costo y precio (son cosas distintas)</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Costo (lo que pagas)"><TextInput type="number" value={form.cost} onChange={(e) => setCost(e.target.value)} /></Field>
            <Field label="% Ganancia"><TextInput type="number" value={form.marginPct} onChange={(e) => setMargin(e.target.value)} /></Field>
            <Field label="Precio de venta"><TextInput type="number" value={form.price} onChange={(e) => setPrice(e.target.value)} required /></Field>
          </div>
          <p className="text-xs" style={{ color: COLORS.primaryDark }}>
            Cambia el costo o el % de ganancia y el precio se recalcula solo — o escribe el precio directamente y el % se ajusta.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock actual"><TextInput type="number" value={form.stock} onChange={(e) => set("stock", e.target.value)} /></Field>
          <Field label="Stock mínimo"><TextInput type="number" value={form.minStock} onChange={(e) => set("minStock", e.target.value)} /></Field>
        </div>
        <div className="flex gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1">Guardar</Button>
        </div>
      </form>
    </Modal>
  );
}

function CategoryManager({ categories, setCategories, products, onClose }) {
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  function addCategory(e) {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean || categories.includes(clean)) return;
    setCategories((prev) => [...prev, clean]);
    setNewName("");
  }

  function removeCategory(name) {
    const inUse = products.some((p) => p.category === name);
    if (inUse) { alert("No puedes eliminar una categoría que tiene productos asignados."); return; }
    setCategories((prev) => prev.filter((c) => c !== name));
  }

  function startRename(name) { setRenaming(name); setRenameValue(name); }

  function confirmRename(oldName) {
    const clean = renameValue.trim();
    if (!clean) { setRenaming(null); return; }
    setCategories((prev) => prev.map((c) => (c === oldName ? clean : c)));
    setRenaming(null);
  }

  return (
    <Modal title="Categorías" onClose={onClose} width="max-w-sm">
      <form onSubmit={addCategory} className="flex gap-2 mb-4">
        <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nueva categoría" />
        <Button type="submit"><Plus size={16} /></Button>
      </form>
      <ul className="flex flex-col gap-2">
        {categories.map((c) => (
          <li key={c} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: "#FAFAFB", border: `1px solid ${COLORS.border}` }}>
            {renaming === c ? (
              <TextInput value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={() => confirmRename(c)} autoFocus className="flex-1" />
            ) : (
              <span className="text-sm" style={{ color: COLORS.ink }}>{c}</span>
            )}
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => startRename(c)}><Pencil size={14} style={{ color: COLORS.inkSoft }} /></button>
              <button type="button" onClick={() => removeCategory(c)}><Trash2 size={14} style={{ color: COLORS.danger }} /></button>
            </div>
          </li>
        ))}
        {categories.length === 0 && <p className="text-sm" style={{ color: COLORS.inkSoft }}>Aún no hay categorías.</p>}
      </ul>
    </Modal>
  );
}

function Inventory({ products, setProducts, categories, setCategories, addCategory, settings }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()) || (p.barcode || "").includes(search));

  function saveProduct(p) {
    setProducts((prev) => {
      const exists = prev.some((x) => x.id === p.id);
      return exists ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p];
    });
    setShowForm(false);
    setEditing(null);
  }

  function deleteProduct(id) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setConfirmDelete(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: COLORS.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Inventario</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShowCategories(true)}><Tags size={16} /> Categorías</Button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Nuevo producto</Button>
        </div>
      </div>
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.inkSoft }} />
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto, SKU o código de barras..." className="pl-9" />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#FAFAFB", borderBottom: `1px solid ${COLORS.border}` }}>
              {["Producto", "SKU", "Código de barras", "Categoría", "Costo", "Margen", "Precio", "Stock", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: COLORS.inkSoft }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: COLORS.ink }}>{p.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs" style={{ color: COLORS.inkSoft }}>{p.sku}</td>
                <td className="px-4 py-2.5 font-mono text-xs" style={{ color: COLORS.inkSoft }}>{p.barcode || "—"}</td>
                <td className="px-4 py-2.5">{p.category}</td>
                <td className="px-4 py-2.5 font-mono" style={{ color: COLORS.inkSoft }}>{formatMoney(p.cost, settings.currency)}</td>
                <td className="px-4 py-2.5 font-mono" style={{ color: COLORS.primaryDark }}>{marginFromCostAndPrice(p.cost, p.price)}%</td>
                <td className="px-4 py-2.5 font-mono">{formatMoney(p.price, settings.currency)}</td>
                <td className="px-4 py-2.5">
                  {p.stock <= p.minStock ? <Badge tone="amber">{p.stock} bajo</Badge> : <span className="font-mono">{p.stock}</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setEditing(p); setShowForm(true); }}><Pencil size={15} style={{ color: COLORS.inkSoft }} /></button>
                    <button onClick={() => setConfirmDelete(p)}><Trash2 size={15} style={{ color: COLORS.danger }} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState icon={Boxes} title="Sin productos" subtitle="Agrega tu primer producto para empezar a vender." />}
      </div>

      {showForm && (
        <ProductForm
          initial={editing}
          categories={categories}
          onAddCategory={addCategory}
          settings={settings}
          onSave={saveProduct}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
      {showCategories && (
        <CategoryManager categories={categories} setCategories={setCategories} products={products} onClose={() => setShowCategories(false)} />
      )}
      {confirmDelete && (
        <Modal title="Eliminar producto" onClose={() => setConfirmDelete(null)} width="max-w-sm">
          <p className="text-sm mb-4" style={{ color: COLORS.ink }}>¿Seguro que deseas eliminar <strong>{confirmDelete.name}</strong>? Esta acción no se puede deshacer.</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)} className="flex-1">Cancelar</Button>
            <Button variant="danger" onClick={() => deleteProduct(confirmDelete.id)} className="flex-1">Eliminar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------------------------- Purchases ---------------------------------- */

const NEW_SUPPLIER_VALUE = "__new_supplier__";

function PurchaseForm({ products, suppliers, settings, onSave, onClose }) {
  const firstProduct = products[0];
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || NEW_SUPPLIER_VALUE);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState(todayISO());

  function rowFromProduct(product) {
    if (!product) return { productId: "", qty: 1, cost: 0, marginPct: settings.defaultMarginPct, price: 0 };
    const marginPct = product.marginPct != null
      ? product.marginPct
      : (product.cost > 0 ? marginFromCostAndPrice(product.cost, product.price) : settings.defaultMarginPct);
    return { productId: product.id, qty: 1, cost: product.cost, marginPct, price: product.price };
  }

  const [rows, setRows] = useState([rowFromProduct(firstProduct)]);

  function updateRow(idx, patch) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }
  function changeRowProduct(idx, productId) {
    const product = products.find((p) => p.id === productId);
    updateRow(idx, rowFromProduct(product));
  }
  function changeRowCost(idx, cost) {
    updateRow(idx, { cost, price: priceFromCostAndMargin(cost, rows[idx].marginPct) });
  }
  function changeRowMargin(idx, marginPct) {
    updateRow(idx, { marginPct, price: priceFromCostAndMargin(rows[idx].cost, marginPct) });
  }
  function changeRowPrice(idx, price) {
    updateRow(idx, { price, marginPct: marginFromCostAndPrice(rows[idx].cost, price) });
  }
  function addRow() {
    setRows((r) => [...r, rowFromProduct(products[0])]);
  }
  function removeRow(idx) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }

  const total = rows.reduce((a, r) => a + Number(r.qty || 0) * Number(r.cost || 0), 0);

  function submit(e) {
    e.preventDefault();
    const supplierName = supplierId === NEW_SUPPLIER_VALUE ? newSupplierName.trim() : (suppliers.find((s) => s.id === supplierId)?.name || "");
    if (!supplierName || rows.length === 0) return;
    onSave({
      id: uid("pur"),
      supplierId: supplierId === NEW_SUPPLIER_VALUE ? null : supplierId,
      supplierName,
      invoiceNumber, date,
      items: rows.map((r) => ({
        productId: r.productId,
        qty: Number(r.qty) || 0,
        cost: Number(r.cost) || 0,
        marginPct: Number(r.marginPct) || 0,
        price: Number(r.price) || 0,
      })),
      total,
    });
  }

  return (
    <Modal title="Registrar factura de entrada" onClose={onClose} width="max-w-3xl">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Proveedor">
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value={NEW_SUPPLIER_VALUE}>+ Nuevo proveedor…</option>
            </Select>
          </Field>
          {supplierId === NEW_SUPPLIER_VALUE ? (
            <Field label="Nombre del proveedor nuevo">
              <TextInput value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} required autoFocus />
            </Field>
          ) : (
            <Field label="N° de factura"><TextInput value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></Field>
          )}
          <Field label="Fecha"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {supplierId === NEW_SUPPLIER_VALUE && (
          <Field label="N° de factura"><TextInput value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></Field>
        )}

        <div className="flex flex-col gap-2 mt-1">
          {rows.map((row, idx) => {
            const product = products.find((p) => p.id === row.productId);
            return (
              <div key={idx} className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "#FAFAFB", border: `1px solid ${COLORS.border}` }}>
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4"><Field label="Producto">
                    <Select value={row.productId} onChange={(e) => changeRowProduct(idx, e.target.value)}>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                  </Field></div>
                  <div className="col-span-2"><Field label="Cantidad">
                    <TextInput type="number" min="1" value={row.qty} onChange={(e) => updateRow(idx, { qty: e.target.value })} />
                  </Field></div>
                  <div className="col-span-2"><Field label="Costo unit.">
                    <TextInput type="number" value={row.cost} onChange={(e) => changeRowCost(idx, e.target.value)} />
                  </Field></div>
                  <div className="col-span-2"><Field label="% Ganancia">
                    <TextInput type="number" value={row.marginPct} onChange={(e) => changeRowMargin(idx, e.target.value)} />
                  </Field></div>
                  <div className="col-span-1"><Field label="P. venta">
                    <TextInput type="number" value={row.price} onChange={(e) => changeRowPrice(idx, e.target.value)} />
                  </Field></div>
                  <div className="col-span-1 pb-2 flex justify-center">
                    <button type="button" onClick={() => removeRow(idx)}><Trash2 size={16} style={{ color: COLORS.danger }} /></button>
                  </div>
                </div>
                {product && (
                  <p className="text-xs" style={{ color: COLORS.inkSoft }}>
                    Antes de esta factura: stock {product.stock} · costo {formatMoney(product.cost, settings.currency)} · precio de venta {formatMoney(product.price, settings.currency)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <Button type="button" variant="subtle" onClick={addRow} className="self-start"><Plus size={14} /> Agregar línea</Button>
        <div className="flex justify-end font-mono font-bold text-sm" style={{ color: COLORS.ink }}>Total factura: {formatMoney(total, settings.currency)}</div>
        <div className="flex gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1">Guardar e ingresar mercancía</Button>
        </div>
      </form>
    </Modal>
  );
}

function Purchases({ products, setProducts, purchases, setPurchases, suppliers, setSuppliers, settings }) {
  const [showForm, setShowForm] = useState(false);

  function savePurchase(purchase) {
    setPurchases((prev) => [purchase, ...prev]);
    setProducts((prev) => prev.map((p) => {
      const line = purchase.items.find((i) => i.productId === p.id);
      if (!line) return p;
      return { ...p, stock: p.stock + line.qty, cost: line.cost, price: line.price, marginPct: line.marginPct };
    }));
    // Guarda el proveedor y qué productos le compramos, automáticamente.
    setSuppliers((prev) => {
      const productIds = purchase.items.map((i) => i.productId);
      const existing = purchase.supplierId ? prev.find((s) => s.id === purchase.supplierId) : prev.find((s) => s.name.toLowerCase() === purchase.supplierName.toLowerCase());
      if (existing) {
        return prev.map((s) => (s.id === existing.id
          ? { ...s, productIds: Array.from(new Set([...(s.productIds || []), ...productIds])), lastPurchaseAt: purchase.date }
          : s));
      }
      return [...prev, { id: uid("sup"), name: purchase.supplierName, productIds, lastPurchaseAt: purchase.date }];
    });
    setShowForm(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: COLORS.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Compras y facturas de entrada</h1>
        <Button onClick={() => setShowForm(true)}><Plus size={16} /> Registrar factura</Button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#FAFAFB", borderBottom: `1px solid ${COLORS.border}` }}>
              {["Fecha", "Proveedor", "N° Factura", "Items", "Total"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: COLORS.inkSoft }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <td className="px-4 py-2.5">{p.date}</td>
                <td className="px-4 py-2.5 font-medium" style={{ color: COLORS.ink }}>{p.supplierName || p.supplier}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{p.invoiceNumber || "—"}</td>
                <td className="px-4 py-2.5">{p.items.length} productos</td>
                <td className="px-4 py-2.5 font-mono font-semibold">{formatMoney(p.total, settings.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {purchases.length === 0 && <EmptyState icon={FileText} title="Sin compras registradas" subtitle="Registra facturas de proveedores para actualizar tu inventario automáticamente." />}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <h3 className="font-semibold text-sm" style={{ color: COLORS.ink }}>Proveedores</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#FAFAFB", borderBottom: `1px solid ${COLORS.border}` }}>
              {["Proveedor", "Productos que surte", "Última compra"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: COLORS.inkSoft }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: COLORS.ink }}>{s.name}</td>
                <td className="px-4 py-2.5">
                  {(s.productIds || []).map((pid) => products.find((p) => p.id === pid)?.name).filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-2.5">{s.lastPurchaseAt || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {suppliers.length === 0 && <EmptyState icon={UsersIcon} title="Todavía no hay proveedores" subtitle="Se guardan automáticamente cuando registras una factura." />}
      </div>

      {showForm && <PurchaseForm products={products} suppliers={suppliers} settings={settings} onSave={savePurchase} onClose={() => setShowForm(false)} />}
    </div>
  );
}

/* ---------------------------------- Reports ---------------------------------- */

function Reports({ sales, products, returns, settings, user, onReturn }) {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [searchId, setSearchId] = useState("");
  const [viewSale, setViewSale] = useState(null);

  const bySearch = searchId.trim()
    ? sales.filter((s) => s.id.toLowerCase().includes(searchId.trim().toLowerCase()))
    : null;

  const inRange = bySearch || sales.filter((s) => {
    const d = s.date.slice(0, 10);
    return d >= from && d <= to;
  });

  const inRangeIds = new Set(inRange.map((s) => s.id));
  const returnsInRange = (returns || []).filter((r) => inRangeIds.has(r.saleId));

  const grossRevenue = inRange.reduce((a, s) => a + s.total, 0);
  const grossCost = inRange.reduce((a, s) => a + s.items.reduce((b, i) => b + (i.cost || 0) * i.qty, 0), 0);
  const totalReturned = returnsInRange.reduce((a, r) => a + r.total, 0);
  const totalReturnedCost = returnsInRange.reduce((a, r) => a + r.items.reduce((b, i) => b + (i.cost || 0) * i.qty, 0), 0);
  const revenue = grossRevenue - totalReturned;
  const cost = grossCost - totalReturnedCost;
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const topMap = {};
  inRange.forEach((s) => s.items.forEach((it) => {
    topMap[it.name] = (topMap[it.name] || 0) + it.price * it.qty;
  }));
  const top = Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const lowStock = products.filter((p) => p.stock <= p.minStock);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold" style={{ color: COLORS.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Reportes</h1>
      <div className="flex items-end gap-3 flex-wrap">
        <Field label="Desde"><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={!!searchId} /></Field>
        <Field label="Hasta"><TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={!!searchId} /></Field>
        <Field label="Buscar por código de factura">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.inkSoft }} />
            <TextInput value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="Ej: sale_..." className="pl-8 w-56" />
          </div>
        </Field>
        {searchId && <p className="text-xs pb-2" style={{ color: COLORS.inkSoft }}>Buscando en todas las fechas — quita el texto para volver al rango de fechas.</p>}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Ingresos netos" value={formatMoney(revenue, settings.currency)} tone="primary" />
        <StatCard icon={ClipboardList} label="Costo de venta" value={formatMoney(cost, settings.currency)} tone="gray" />
        <StatCard icon={BarChart3} label="Utilidad" value={formatMoney(profit, settings.currency)} tone="primary" />
        <StatCard icon={BarChart3} label="Margen" value={`${margin.toFixed(1)}%`} tone="gray" />
      </div>
      {totalReturned > 0 && (
        <p className="text-xs" style={{ color: COLORS.amber }}>
          Ingresos brutos: {formatMoney(grossRevenue, settings.currency)} · Devoluciones: -{formatMoney(totalReturned, settings.currency)} ({returnsInRange.length})
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-5" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <h3 className="font-semibold mb-3 text-sm">Top productos por ingreso</h3>
          {top.length === 0 ? <p className="text-sm" style={{ color: COLORS.inkSoft }}>Sin datos en el rango seleccionado.</p> : (
            <ul className="flex flex-col gap-2">
              {top.map(([name, amt]) => (
                <li key={name} className="flex justify-between text-sm">
                  <span>{name}</span>
                  <span className="font-mono font-semibold" style={{ color: COLORS.primaryDark }}>{formatMoney(amt, settings.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl p-5" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <h3 className="font-semibold mb-3 text-sm">Bajo stock</h3>
          {lowStock.length === 0 ? <p className="text-sm" style={{ color: COLORS.inkSoft }}>Todo en buen nivel.</p> : (
            <ul className="flex flex-col gap-2">
              {lowStock.map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span>{p.name}</span><Badge tone="amber">{p.stock}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#FAFAFB", borderBottom: `1px solid ${COLORS.border}` }}>
              {["Factura", "Fecha", "Cajero", "Pago", "Total", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: COLORS.inkSoft }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inRange.slice().reverse().map((s) => {
              const wasReturned = (returns || []).some((r) => r.saleId === s.id);
              return (
                <tr
                  key={s.id}
                  onClick={() => setViewSale(s)}
                  className="cursor-pointer hover:bg-black/[0.02]"
                  style={{ borderBottom: `1px solid ${COLORS.border}` }}
                >
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: COLORS.inkSoft }}>{s.id}</td>
                  <td className="px-4 py-2.5">{new Date(s.date).toLocaleString("es-CO")}</td>
                  <td className="px-4 py-2.5">{s.cashier}</td>
                  <td className="px-4 py-2.5">{s.paymentMethod}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold">
                    {formatMoney(s.total, settings.currency)}
                    {wasReturned && <Badge tone="amber">Con devolución</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setViewSale(s); }}><FileText size={13} /> Ver factura</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {inRange.length === 0 && <EmptyState icon={BarChart3} title="Sin ventas en este rango" />}
      </div>

      {returnsInRange.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
            <h3 className="font-semibold text-sm" style={{ color: COLORS.ink }}>Devoluciones en este rango</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#FAFAFB", borderBottom: `1px solid ${COLORS.border}` }}>
                {["Fecha", "Factura original", "Procesó", "Motivo", "Monto"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: COLORS.inkSoft }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {returnsInRange.slice().reverse().map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td className="px-4 py-2.5">{new Date(r.date).toLocaleString("es-CO")}</td>
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: COLORS.inkSoft }}>{r.saleId}</td>
                  <td className="px-4 py-2.5">{r.processedBy}</td>
                  <td className="px-4 py-2.5">{r.reason || "—"}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: COLORS.danger }}>-{formatMoney(r.total, settings.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewSale && (
        <ReceiptModal
          sale={viewSale}
          settings={settings}
          returns={returns || []}
          user={user}
          onReturn={user && user.role === "admin" ? onReturn : undefined}
          onClose={() => setViewSale(null)}
        />
      )}
    </div>
  );
}

/* ---------------------------------- Caja (turno, Reporte X, Reporte Z) ---------------------------------- */

function OpenShiftModal({ user, onConfirm }) {
  const [amount, setAmount] = useState("0");
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 no-print" style={{ background: "rgba(15,20,25,0.65)" }}>
      <div className="w-full max-w-sm rounded-xl shadow-xl p-6" style={{ background: COLORS.surface }}>
        <div className="flex items-center gap-2 mb-1">
          <Wallet size={20} style={{ color: COLORS.primary }} />
          <h3 className="font-bold text-lg" style={{ color: COLORS.ink }}>Abrir caja</h3>
        </div>
        <p className="text-sm mb-4" style={{ color: COLORS.inkSoft }}>Ingresa el efectivo con el que inicia la caja.</p>
        <Field label="Monto inicial en efectivo">
          <TextInput type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Button size="lg" className="w-full mt-4" onClick={() => onConfirm(Number(amount) || 0)}>Abrir caja y continuar</Button>
        <p className="text-xs mt-3 text-center" style={{ color: COLORS.inkSoft }}>Abre: {user.name}</p>
      </div>
    </div>
  );
}

function XReportModal({ shift, sales, purchases, products, returns, settings, onClose }) {
  const stats = computeShiftStats(shift, sales, purchases, products, returns);
  return (
    <Modal title="Reporte X — corte de caja" onClose={onClose} width="max-w-sm">
      <div className="font-mono text-xs flex flex-col gap-1 mx-auto receipt-print" style={{ width: "260px", color: "#111" }} id="freepos-xreport">
        <p className="text-center font-bold text-sm">{settings.businessName}</p>
        <p className="text-center">Reporte X (sin cerrar caja)</p>
        <p className="text-center mb-2">{new Date().toLocaleString("es-CO")}</p>
        <div style={{ borderTop: "1px dashed #999", borderBottom: "1px dashed #999" }} className="py-2 my-1 flex flex-col gap-1">
          <div className="flex justify-between"><span>Caja abierta</span><span>{new Date(shift.openedAt).toLocaleString("es-CO")}</span></div>
          <div className="flex justify-between"><span>Monto inicial</span><span>{formatMoney(shift.openingCash, settings.currency)}</span></div>
          <div className="flex justify-between"><span>Ventas en efectivo</span><span>{formatMoney(stats.cashSales, settings.currency)}</span></div>
          {stats.cashReturns > 0 && <div className="flex justify-between"><span>Devoluciones en efectivo</span><span>-{formatMoney(stats.cashReturns, settings.currency)}</span></div>}
          <div className="flex justify-between font-bold"><span>Efectivo esperado</span><span>{formatMoney(stats.expectedCash, settings.currency)}</span></div>
        </div>
        <p className="font-semibold mt-1">Ventas por método de pago</p>
        {Object.entries(stats.salesByPayment).map(([m, v]) => (
          <div key={m} className="flex justify-between"><span>{m}</span><span>{formatMoney(v, settings.currency)}</span></div>
        ))}
        <div className="flex justify-between font-bold mt-1"><span>Total ventas</span><span>{formatMoney(stats.totalSales, settings.currency)}</span></div>
        {stats.totalReturns > 0 && (
          <>
            <div className="flex justify-between"><span>Devoluciones ({stats.shiftReturns.length})</span><span>-{formatMoney(stats.totalReturns, settings.currency)}</span></div>
            <div className="flex justify-between font-bold"><span>Ventas netas</span><span>{formatMoney(stats.netSales, settings.currency)}</span></div>
          </>
        )}
        <div className="flex justify-between"><span>Transacciones</span><span>{stats.transactions}</span></div>
        {Object.keys(stats.salesByCategory).length > 0 && (
          <>
            <p className="font-semibold mt-2">Ventas por departamento (netas)</p>
            {Object.entries(stats.salesByCategory).map(([cat, v]) => (
              <div key={cat} className="flex justify-between"><span>{cat} ({v.qty}u)</span><span>{formatMoney(v.total, settings.currency)}</span></div>
            ))}
          </>
        )}
      </div>
      <div className="flex gap-2 mt-5">
        <Button variant="ghost" onClick={onClose} className="flex-1">Cerrar</Button>
        <Button onClick={() => window.print()} className="flex-1"><Printer size={16} /> Imprimir</Button>
      </div>
    </Modal>
  );
}

function ZReportConfirmModal({ shift, sales, purchases, products, returns, settings, user, onConfirm, onClose }) {
  const [countedCash, setCountedCash] = useState("");
  const stats = computeShiftStats(shift, sales, purchases, products, returns);
  const counted = Number(countedCash) || 0;
  const difference = counted - stats.expectedCash;

  return (
    <Modal title="Reporte Z — cerrar caja y reiniciar el día" onClose={onClose} width="max-w-md">
      <div className="font-mono text-xs flex flex-col gap-1" style={{ color: "#111" }}>
        <div className="flex justify-between"><span>Caja abierta</span><span>{new Date(shift.openedAt).toLocaleString("es-CO")}</span></div>
        <div className="flex justify-between"><span>Cerrada por</span><span>{user.name}</span></div>
        <div style={{ borderTop: "1px dashed #999", borderBottom: "1px dashed #999" }} className="py-2 my-1 flex flex-col gap-1">
          <p className="font-semibold">Ventas por método de pago</p>
          {Object.entries(stats.salesByPayment).map(([m, v]) => (
            <div key={m} className="flex justify-between"><span>{m}</span><span>{formatMoney(v, settings.currency)}</span></div>
          ))}
          <div className="flex justify-between font-bold"><span>Total ventas ({stats.transactions} tx)</span><span>{formatMoney(stats.totalSales, settings.currency)}</span></div>
          {stats.totalReturns > 0 && (
            <>
              <div className="flex justify-between"><span>Devoluciones ({stats.shiftReturns.length})</span><span>-{formatMoney(stats.totalReturns, settings.currency)}</span></div>
              <div className="flex justify-between font-bold"><span>Ventas netas</span><span>{formatMoney(stats.netSales, settings.currency)}</span></div>
            </>
          )}
          <div className="flex justify-between"><span>Costo de venta neto</span><span>{formatMoney(stats.netCost, settings.currency)}</span></div>
          <div className="flex justify-between font-bold"><span>Utilidad</span><span>{formatMoney(stats.profit, settings.currency)}</span></div>
        </div>
        {Object.keys(stats.salesByCategory).length > 0 && (
          <div style={{ borderBottom: "1px dashed #999" }} className="pb-2 mb-1 flex flex-col gap-1">
            <p className="font-semibold">Ventas por departamento (netas)</p>
            {Object.entries(stats.salesByCategory).map(([cat, v]) => (
              <div key={cat} className="flex justify-between"><span>{cat} ({v.qty}u)</span><span>{formatMoney(v.total, settings.currency)}</span></div>
            ))}
          </div>
        )}
        <div className="flex justify-between"><span>Compras del día ({stats.shiftPurchases.length})</span><span>{formatMoney(stats.totalPurchases, settings.currency)}</span></div>
      </div>

      <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${COLORS.border}` }}>
        <div className="grid grid-cols-2 gap-3 font-mono text-xs mb-3">
          <div><p style={{ color: COLORS.inkSoft }}>Monto inicial</p><p className="font-bold">{formatMoney(shift.openingCash, settings.currency)}</p></div>
          <div><p style={{ color: COLORS.inkSoft }}>Efectivo esperado</p><p className="font-bold">{formatMoney(stats.expectedCash, settings.currency)}</p></div>
        </div>
        <Field label="Efectivo contado físicamente (opcional)">
          <TextInput type="number" min="0" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} placeholder="0" />
        </Field>
        {countedCash !== "" && (
          <p className="text-xs mt-2 font-mono" style={{ color: difference === 0 ? COLORS.primaryDark : difference > 0 ? COLORS.primaryDark : COLORS.danger }}>
            {difference === 0 ? "Cuadra exacto." : difference > 0 ? `Sobrante: ${formatMoney(difference, settings.currency)}` : `Faltante: ${formatMoney(Math.abs(difference), settings.currency)}`}
          </p>
        )}
      </div>

      <div className="flex gap-2 mt-5">
        <Button variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button variant="danger" onClick={() => onConfirm(counted)} className="flex-1"><Wallet size={16} /> Cerrar caja y reiniciar</Button>
      </div>
    </Modal>
  );
}

function ZReportPrintModal({ report, settings, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(15,20,25,0.5)" }}>
      <div className="w-full max-w-sm rounded-xl shadow-xl overflow-hidden" style={{ background: COLORS.surface }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <h3 className="font-semibold text-sm">Caja cerrada</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5">
          <div className="receipt-print font-mono text-xs mx-auto flex flex-col gap-1" style={{ width: settings.paperWidth === "80" ? "300px" : "220px", color: "#111" }}>
            <p className="text-center font-bold text-sm">{settings.businessName}</p>
            <p className="text-center font-bold">REPORTE Z</p>
            <p className="text-center mb-2">{new Date(report.closedAt).toLocaleString("es-CO")}</p>
            <div style={{ borderTop: "1px dashed #999", borderBottom: "1px dashed #999" }} className="py-2 my-1 flex flex-col gap-1">
              <div className="flex justify-between"><span>Abierta</span><span>{new Date(report.openedAt).toLocaleString("es-CO")}</span></div>
              <div className="flex justify-between"><span>Abrió</span><span>{report.openedBy}</span></div>
              <div className="flex justify-between"><span>Cerró</span><span>{report.closedBy}</span></div>
            </div>
            {Object.entries(report.salesByPayment).map(([m, v]) => (
              <div key={m} className="flex justify-between"><span>{m}</span><span>{formatMoney(v, settings.currency)}</span></div>
            ))}
            <div className="flex justify-between font-bold"><span>Total ventas</span><span>{formatMoney(report.totalSales, settings.currency)}</span></div>
            {report.totalReturns > 0 && (
              <>
                <div className="flex justify-between"><span>Devoluciones</span><span>-{formatMoney(report.totalReturns, settings.currency)}</span></div>
                <div className="flex justify-between font-bold"><span>Ventas netas</span><span>{formatMoney(report.netSales, settings.currency)}</span></div>
              </>
            )}
            <div className="flex justify-between"><span>Utilidad</span><span>{formatMoney(report.profit, settings.currency)}</span></div>
            <div className="flex justify-between"><span>Compras</span><span>{formatMoney(report.totalPurchases, settings.currency)}</span></div>
            {report.salesByCategory && Object.keys(report.salesByCategory).length > 0 && (
              <div style={{ borderTop: "1px dashed #999" }} className="pt-1 mt-1 flex flex-col gap-1">
                <p className="font-semibold">Por departamento</p>
                {Object.entries(report.salesByCategory).map(([cat, v]) => (
                  <div key={cat} className="flex justify-between"><span>{cat} ({v.qty}u)</span><span>{formatMoney(v.total, settings.currency)}</span></div>
                ))}
              </div>
            )}
            <div style={{ borderTop: "1px dashed #999" }} className="pt-1 mt-1 flex flex-col gap-1">
              <div className="flex justify-between"><span>Monto inicial</span><span>{formatMoney(report.openingCash, settings.currency)}</span></div>
              <div className="flex justify-between"><span>Efectivo esperado</span><span>{formatMoney(report.expectedCash, settings.currency)}</span></div>
              <div className="flex justify-between"><span>Efectivo contado</span><span>{formatMoney(report.countedCash, settings.currency)}</span></div>
              <div className="flex justify-between font-bold"><span>Diferencia</span><span>{formatMoney(report.difference, settings.currency)}</span></div>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cerrar</Button>
          <Button onClick={() => window.print()} className="flex-1"><Printer size={16} /> Imprimir</Button>
        </div>
      </div>
    </div>
  );
}

function CashRegisterPage({ shift, sales, purchases, products, returns, zReports, settings, user, onCloseShift }) {
  const [showX, setShowX] = useState(false);
  const [showZConfirm, setShowZConfirm] = useState(false);
  const [lastZ, setLastZ] = useState(null);

  const stats = shift ? computeShiftStats(shift, sales, purchases, products, returns) : null;

  function confirmZ(counted) {
    const finalStats = computeShiftStats(shift, sales, purchases, products, returns);
    const report = {
      id: uid("z"),
      shiftId: shift.id,
      openedAt: shift.openedAt,
      closedAt: new Date().toISOString(),
      openedBy: shift.openedBy,
      closedBy: user.name,
      openingCash: shift.openingCash,
      ...finalStats,
      countedCash: counted,
      difference: counted - finalStats.expectedCash,
    };
    setShowZConfirm(false);
    setLastZ(report);
    onCloseShift(report);
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold" style={{ color: COLORS.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Caja</h1>

      {!shift ? (
        <EmptyState icon={Wallet} title="La caja está cerrada" subtitle="Espera a que se abra un turno para poder ver los reportes de caja." />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon={Wallet} label="Monto inicial" value={formatMoney(shift.openingCash, settings.currency)} tone="gray" />
            <StatCard icon={DollarSign} label="Ventas en efectivo (netas)" value={formatMoney(stats.netCashSales, settings.currency)} tone="primary" />
            <StatCard icon={TrendingUp} label="Efectivo esperado" value={formatMoney(stats.expectedCash, settings.currency)} tone="primary" />
            <StatCard icon={ClipboardList} label="Transacciones" value={stats.transactions} tone="gray" />
          </div>
          {stats.totalReturns > 0 && (
            <p className="text-xs" style={{ color: COLORS.amber }}>
              Incluye {formatMoney(stats.totalReturns, settings.currency)} en devoluciones ({stats.shiftReturns.length}) durante este turno.
            </p>
          )}
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>
            Caja abierta desde {new Date(shift.openedAt).toLocaleString("es-CO")} por {shift.openedBy}.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowX(true)}><FileText size={16} /> Reporte X (solo efectivo)</Button>
            {user.role === "admin" && (
              <Button variant="danger" onClick={() => setShowZConfirm(true)}><Wallet size={16} /> Reporte Z (cerrar caja y reiniciar el día)</Button>
            )}
          </div>
          {user.role !== "admin" && (
            <p className="text-xs" style={{ color: COLORS.inkSoft }}>Solo un administrador puede cerrar la caja con el Reporte Z.</p>
          )}
        </>
      )}

      <div className="rounded-xl overflow-hidden mt-2" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <h3 className="font-semibold text-sm" style={{ color: COLORS.ink }}>Historial de cierres (Reporte Z)</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#FAFAFB", borderBottom: `1px solid ${COLORS.border}` }}>
              {["Cierre", "Cerró", "Ventas netas", "Utilidad", "Diferencia"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: COLORS.inkSoft }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zReports.map((z) => (
              <tr key={z.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <td className="px-4 py-2.5">{new Date(z.closedAt).toLocaleString("es-CO")}</td>
                <td className="px-4 py-2.5">{z.closedBy}</td>
                <td className="px-4 py-2.5 font-mono">{formatMoney(z.netSales != null ? z.netSales : z.totalSales, settings.currency)}</td>
                <td className="px-4 py-2.5 font-mono">{formatMoney(z.profit, settings.currency)}</td>
                <td className="px-4 py-2.5 font-mono" style={{ color: z.difference < 0 ? COLORS.danger : COLORS.primaryDark }}>{formatMoney(z.difference, settings.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {zReports.length === 0 && <EmptyState icon={Wallet} title="Sin cierres registrados todavía" />}
      </div>

      {showX && shift && <XReportModal shift={shift} sales={sales} purchases={purchases} products={products} returns={returns} settings={settings} onClose={() => setShowX(false)} />}
      {showZConfirm && shift && (
        <ZReportConfirmModal shift={shift} sales={sales} purchases={purchases} products={products} returns={returns} settings={settings} user={user} onConfirm={confirmZ} onClose={() => setShowZConfirm(false)} />
      )}
      {lastZ && <ZReportPrintModal report={lastZ} settings={settings} onClose={() => setLastZ(null)} />}
    </div>
  );
}

/* ---------------------------------- Users ---------------------------------- */

function UserForm({ initial, allUsers, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: "", username: "", pin: "", role: "employee", active: true });
  const [error, setError] = useState("");
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function submit(e) {
    e.preventDefault();
    if (!form.name || !form.username || !form.pin) return;
    const finalUser = { ...form, id: form.id || uid("u") };
    const resulting = allUsers.some((u) => u.id === finalUser.id)
      ? allUsers.map((u) => (u.id === finalUser.id ? finalUser : u))
      : [...allUsers, finalUser];
    const hasActiveAdmin = resulting.some((u) => u.role === "admin" && u.active);
    if (!hasActiveAdmin) {
      setError("No puedes dejar el sistema sin ningún administrador activo. Deja este usuario como administrador activo, o primero crea/activa otro administrador.");
      return;
    }
    setError("");
    onSave(finalUser);
  }
  return (
    <Modal title={initial ? "Editar usuario" : "Nuevo usuario"} onClose={onClose} width="max-w-sm">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Nombre"><TextInput value={form.name} onChange={(e) => set("name", e.target.value)} required /></Field>
        <Field label="Usuario"><TextInput value={form.username} onChange={(e) => set("username", e.target.value)} required /></Field>
        <Field label="PIN"><TextInput value={form.pin} onChange={(e) => set("pin", e.target.value)} required /></Field>
        <Field label="Rol">
          <Select value={form.role} onChange={(e) => set("role", e.target.value)}>
            <option value="employee">Empleado</option>
            <option value="admin">Administrador</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
          Usuario activo
        </label>
        {error && <p className="text-sm" style={{ color: COLORS.danger }}>{error}</p>}
        <div className="flex gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1">Guardar</Button>
        </div>
      </form>
    </Modal>
  );
}

function UsersPage({ users, setUsers, currentUser }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function saveUser(u) {
    setUsers((prev) => (prev.some((x) => x.id === u.id) ? prev.map((x) => (x.id === u.id ? u : x)) : [...prev, u]));
    setShowForm(false); setEditing(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: COLORS.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Usuarios</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Nuevo usuario</Button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#FAFAFB", borderBottom: `1px solid ${COLORS.border}` }}>
              {["Nombre", "Usuario", "Rol", "Estado", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: COLORS.inkSoft }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: COLORS.ink }}>{u.name}{u.id === currentUser.id && " (tú)"}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-2.5"><Badge tone={u.role === "admin" ? "primary" : "gray"}>{u.role === "admin" ? "Administrador" : "Empleado"}</Badge></td>
                <td className="px-4 py-2.5">{u.active ? <Badge tone="primary">Activo</Badge> : <Badge tone="danger">Inactivo</Badge>}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => { setEditing(u); setShowForm(true); }}><Pencil size={15} style={{ color: COLORS.inkSoft }} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && <UserForm initial={editing} allUsers={users} onSave={saveUser} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

/* ---------------------------------- Settings ---------------------------------- */

function SettingsPage({ settings, setSettings, user, onExportBackup, onImportBackup, updateStatus, onCheckUpdates, onRelaunch, onOpenExternal, onFactoryReset }) {
  const [form, setForm] = useState(settings);
  const [drawerTest, setDrawerTest] = useState(null);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [showFactoryReset, setShowFactoryReset] = useState(false);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  async function save(e) {
    e.preventDefault();
    setSaveStatus("saving");
    const ok = await setSettings(form);
    setSaveStatus(ok ? "saved" : "error");
    window.setTimeout(() => setSaveStatus(null), 3000);
  }

  async function testDrawer() {
    setDrawerBusy(true);
    const res = await openCashDrawer();
    setDrawerBusy(false);
    setDrawerTest(res);
  }

  async function handleExport() {
    setBackupBusy(true);
    const res = await onExportBackup();
    setBackupBusy(false);
    if (res.ok) setBackupMsg({ ok: true, text: `Copia guardada correctamente en: ${res.path}` });
    else if (res.reason === "cancelled") setBackupMsg(null);
    else if (res.reason === "unsupported") setBackupMsg({ ok: false, text: "Esta función solo está disponible en la app de escritorio (Tauri)." });
    else setBackupMsg({ ok: false, text: `No se pudo guardar la copia de seguridad. Detalle técnico: ${res.message || "desconocido"}` });
  }

  async function handleImport() {
    setBackupBusy(true);
    const res = await onImportBackup();
    setBackupBusy(false);
    if (res.ok) setBackupMsg({ ok: true, text: "Copia importada. Se cerró la sesión — vuelve a entrar con los usuarios del archivo importado." });
    else if (res.reason === "cancelled") setBackupMsg(null);
    else if (res.reason === "invalid") setBackupMsg({ ok: false, text: "Ese archivo no parece ser una copia de seguridad válida de FreePOS." });
    else if (res.reason === "unsupported") setBackupMsg({ ok: false, text: "Esta función solo está disponible en la app de escritorio (Tauri)." });
    else setBackupMsg({ ok: false, text: `No se pudo importar el archivo. Detalle técnico: ${res.message || "desconocido"}` });
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <h1 className="text-2xl font-bold" style={{ color: COLORS.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Configuración</h1>
      <form onSubmit={save} className="rounded-xl p-5 flex flex-col gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Negocio</h3>
        <Field label="Nombre del negocio"><TextInput value={form.businessName} onChange={(e) => set("businessName", e.target.value)} /></Field>
        <Field label="Dirección"><TextInput value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="Moneda">
          <Select value={form.currency.code} onChange={(e) => set("currency", CURRENCIES.find((c) => c.code === e.target.value))}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
          </Select>
        </Field>
        <Field label="Impuesto por defecto (%)"><TextInput type="number" value={form.taxRate} onChange={(e) => set("taxRate", Number(e.target.value))} /></Field>
        <Field label="% de ganancia sugerido por defecto">
          <TextInput type="number" value={form.defaultMarginPct} onChange={(e) => set("defaultMarginPct", Number(e.target.value))} />
        </Field>
        <p className="text-xs -mt-1" style={{ color: COLORS.inkSoft }}>
          Se usa como punto de partida al crear productos o registrar compras — siempre lo puedes
          cambiar producto por producto. Precio de venta = costo × (1 + % de ganancia / 100).
        </p>
        <Field label="Hora de reinicio del día operativo">
          <Select value={form.dayResetHour} onChange={(e) => set("dayResetHour", Number(e.target.value))}>
            {Array.from({ length: 24 }).map((_, h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
            ))}
          </Select>
        </Field>
        <p className="text-xs -mt-1" style={{ color: COLORS.inkSoft }}>
          Útil si el negocio cierra después de medianoche (ej: un bar). A esta hora FreePOS te recordará
          generar el Reporte Z, aunque el cierre de caja siempre lo decides tú manualmente.
        </p>

        <h3 className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: COLORS.inkSoft }}>Impresora térmica</h3>
        <Field label="Ancho de papel">
          <Select value={form.paperWidth} onChange={(e) => set("paperWidth", e.target.value)}>
            <option value="58">58 mm</option>
            <option value="80">80 mm</option>
          </Select>
        </Field>
        <p className="text-xs -mt-1" style={{ color: COLORS.inkSoft }}>
          El recibo se ajusta automáticamente a este ancho. Al imprimir (botón Imprimir en el recibo), selecciona tu impresora térmica como destino en el diálogo del navegador.
        </p>

        <h3 className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: COLORS.inkSoft }}>Cajón de dinero</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.autoOpenDrawerOnCash} onChange={(e) => set("autoOpenDrawerOnCash", e.target.checked)} />
          Abrir el cajón automáticamente al cobrar en efectivo
        </label>
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" onClick={testDrawer} disabled={drawerBusy}><DollarSign size={16} /> Probar cajón</Button>
          {drawerTest && (
            <span className="text-xs" style={{ color: drawerTest.ok ? COLORS.primaryDark : COLORS.danger }}>
              {drawerTest.ok ? "Conectado y abierto correctamente." : drawerTest.reason === "unsupported"
                ? "Tu navegador no soporta acceso directo (Web Serial). Configura tu impresora para abrir el cajón al imprimir, o usa Chrome/Edge de escritorio."
                : "No se pudo conectar. Verifica el cable USB/serial del cajón."}
            </span>
          )}
        </div>
        <p className="text-xs" style={{ color: COLORS.inkSoft }}>
          La mayoría de cajones se conectan por cable a la impresora térmica. Si tu impresora no admite Web Serial, actívalo desde las propiedades del driver de la impresora ("abrir cajón al imprimir") en Windows/macOS.
        </p>

        <h3 className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: COLORS.inkSoft }}>Lector de código de barras</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.barcodeScannerEnabled} onChange={(e) => set("barcodeScannerEnabled", e.target.checked)} />
          Activar lectura automática en Ventas
        </label>
        <p className="text-xs" style={{ color: COLORS.inkSoft }}>
          Funciona con cualquier lector USB o Bluetooth que se comporte como teclado (la gran mayoría). Solo escanea mientras estés en la pantalla de Ventas: el producto se agrega automáticamente al carrito.
        </p>

        <div className="flex items-center gap-3 mt-2">
          <Button type="submit" disabled={saveStatus === "saving"}><Check size={16} /> Guardar cambios</Button>
          {saveStatus === "saved" && <span className="text-xs font-medium" style={{ color: COLORS.primaryDark }}>Cambios guardados correctamente.</span>}
          {saveStatus === "error" && <span className="text-xs font-medium" style={{ color: COLORS.danger }}>No se pudo guardar. Revisa la consola / permisos del plugin "store".</span>}
        </div>
      </form>

      <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Código de recuperación</h3>
        <p className="text-sm" style={{ color: COLORS.ink }}>
          Úsalo si algún día olvidan el PIN de todos los administradores. Como FreePOS funciona sin
          internet, no hay recuperación por correo — este código es la única forma de recuperar el acceso.
          <strong> Anótalo y guárdalo en un lugar seguro fuera de este computador</strong> (papel, gestor de contraseñas, etc.).
        </p>
        <div className="px-4 py-3 rounded-lg text-center font-mono text-lg font-bold tracking-widest" style={{ background: COLORS.primarySoft, color: COLORS.primaryDark }}>
          {settings.recoveryCode || "—"}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="self-start"
          onClick={() => {
            if (window.confirm("Esto invalida el código anterior. ¿Generar uno nuevo?")) {
              setSettings({ ...settings, recoveryCode: generateRecoveryCode() });
            }
          }}
        >
          Generar nuevo código
        </Button>
      </div>

      <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Copias de seguridad</h3>
        <p className="text-sm" style={{ color: COLORS.ink }}>
          Guarda todo lo del negocio (inventario, ventas, compras, usuarios, turno de caja) en un
          archivo que puedes mover a otro computador con FreePOS instalado — por ejemplo para tener
          el mismo negocio en dos cajas, o para restaurar todo si cambias de equipo.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button type="button" variant="ghost" onClick={handleExport} disabled={backupBusy}><FileText size={16} /> Exportar copia de seguridad</Button>
          <Button type="button" variant="subtle" onClick={handleImport} disabled={backupBusy}><FileText size={16} /> Importar copia de seguridad</Button>
        </div>
        {backupMsg && (
          <p className="text-xs" style={{ color: backupMsg.ok ? COLORS.primaryDark : COLORS.danger }}>{backupMsg.text}</p>
        )}
        <p className="text-xs" style={{ color: COLORS.inkSoft }}>
          Importar <strong>reemplaza por completo</strong> los datos actuales de este computador por
          los del archivo — úsalo quieras "clonar" otro equipo, no para combinar información de dos cajas.
        </p>
        <div style={{ borderTop: `1px dashed ${COLORS.border}` }} className="pt-3 mt-1">
          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: COLORS.inkSoft }}>Backups automáticos (por cortes de luz)</p>
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>
            Además de guardar cada cambio al instante, FreePOS deja una copia completa aparte cada
            5 minutos (y también al cerrar la caja con el Reporte Z), guardando las últimas 10, en la
            carpeta <span className="font-mono">auto-backups</span> dentro de los datos de la app
            (en Mac: <span className="font-mono">~/Library/Application Support/com.freepos.app/auto-backups</span>).
            Si algún día el archivo principal se dañara, puedes restaurar el más reciente de esa
            carpeta con "Importar copia de seguridad" de arriba.
          </p>
        </div>
      </div>

      <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.inkSoft }}>Actualizaciones</h3>
        <p className="text-sm" style={{ color: COLORS.ink }}>
          Versión instalada: <span className="font-mono font-semibold">v{APP_VERSION}</span>
        </p>
        <p className="text-sm" style={{ color: COLORS.ink }}>
          Repositorio: <span className="font-mono">{UPDATE_REPO}</span>
        </p>
        <p className="text-xs -mt-1" style={{ color: COLORS.inkSoft }}>
          Cada vez que abres FreePOS, revisa solo si hay una versión más nueva y, si la hay, la
          <strong> descarga e instala automáticamente</strong> en segundo plano — solo falta que
          reinicies cuando te convenga para que quede aplicada.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Button type="button" variant="ghost" onClick={onCheckUpdates} disabled={updateStatus && (updateStatus.state === "checking" || updateStatus.state === "downloading")}>
            Buscar e instalar ahora
          </Button>
          {updateStatus && updateStatus.state === "checking" && (
            <span className="text-xs" style={{ color: COLORS.inkSoft }}>Buscando...</span>
          )}
          {updateStatus && updateStatus.state === "downloading" && (
            <span className="text-xs" style={{ color: COLORS.primaryDark }}>Descargando e instalando v{updateStatus.version}...</span>
          )}
          {updateStatus && updateStatus.state === "upToDate" && (
            <span className="text-xs" style={{ color: COLORS.inkSoft }}>Ya tienes la última versión.</span>
          )}
          {updateStatus && updateStatus.state === "ready" && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: COLORS.primaryDark }}>v{updateStatus.version} instalada, falta reiniciar.</span>
              <Button size="sm" onClick={onRelaunch}>Reiniciar ahora</Button>
            </div>
          )}
          {updateStatus && updateStatus.state === "error" && (
            <span className="text-xs" style={{ color: COLORS.danger }}>{updateStatus.message || "No se pudo revisar actualizaciones."}</span>
          )}
        </div>
      </div>

      <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: COLORS.dangerSoft, border: `1px solid #F3C9C4` }}>
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.danger }}>Zona de peligro</h3>
        <p className="text-sm" style={{ color: COLORS.ink }}>
          Formatear borra por completo el inventario, ventas, compras, proveedores, usuarios,
          turno de caja e historial de reportes de este computador, y deja FreePOS como recién
          instalado. Los archivos de copia de seguridad que hayas exportado tú a mano
          <strong> no se ven afectados</strong> — siguen intactos donde los hayas guardado.
        </p>
        <Button type="button" variant="danger" className="self-start" onClick={() => setShowFactoryReset(true)}>
          Formatear FreePOS (dejar de fábrica)
        </Button>
      </div>

      <p className="text-xs" style={{ color: COLORS.inkSoft }}>
        Todos los datos de FreePOS (inventario, ventas, usuarios, facturas) se guardan en un archivo
        dentro de este computador — no dependen de internet ni de la nube.
      </p>

      {showFactoryReset && (
        <FactoryResetModal user={user} onConfirm={async () => { await onFactoryReset(); setShowFactoryReset(false); }} onClose={() => setShowFactoryReset(false)} />
      )}
    </div>
  );
}

function FactoryResetModal({ user, onConfirm, onClose }) {
  const [pin, setPin] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (pin !== user.pin) { setError("PIN incorrecto."); return; }
    if (confirmText.trim().toUpperCase() !== "FORMATEAR") { setError('Escribe la palabra "FORMATEAR" (en mayúsculas está bien, no importa) para confirmar.'); return; }
    setError("");
    setBusy(true);
    await onConfirm();
  }

  return (
    <Modal title="Formatear FreePOS" onClose={onClose} width="max-w-sm">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium" style={{ color: COLORS.danger }}>
          Esto borra TODO lo guardado en este computador: inventario, ventas, compras, proveedores,
          usuarios, turnos de caja y reportes Z. Vuelve a quedar como recién instalado (usuario
          admin de fábrica, PIN 1234).
        </p>
        <p className="text-sm" style={{ color: COLORS.ink }}>
          Las copias de seguridad que hayas exportado tú a mano (archivos .json que guardaste en
          USB, escritorio, etc.) <strong>no se tocan</strong> — esto solo afecta el archivo interno
          de este computador.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Tu PIN de administrador">
            <TextInput type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
          </Field>
          <Field label='Escribe "FORMATEAR" para confirmar'>
            <TextInput value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </Field>
          {error && <p className="text-sm" style={{ color: COLORS.danger }}>{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" variant="danger" className="flex-1" disabled={busy}>Formatear y reiniciar</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

/* ---------------------------------- App ---------------------------------- */

export default function App() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS);
  const [users, setUsersState] = useState(DEFAULT_USERS);
  const [products, setProductsState] = useState(DEFAULT_PRODUCTS);
  const [categories, setCategoriesState] = useState(DEFAULT_CATEGORIES);
  const [purchases, setPurchasesState] = useState([]);
  const [sales, setSalesState] = useState([]);
  const [shift, setShiftState] = useState(null);
  const [zReports, setZReportsState] = useState([]);
  const [tables, setTablesState] = useState(DEFAULT_TABLES);
  const [returns, setReturnsState] = useState([]);
  const [suppliers, setSuppliersState] = useState([]);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [closeChoice, setCloseChoice] = useState(false); // ventana del SO pidió cerrarse (Tauri)
  const [updateStatus, setUpdateStatus] = useState(null); // { state: 'checking'|'downloading'|'ready'|'upToDate'|'error', version, message }
  const [updateDismissed, setUpdateDismissed] = useState(false);

  // Referencia con los datos más recientes, para que el backup automático (temporizador)
  // siempre guarde lo último sin tener que recrear el temporizador en cada cambio.
  const dataRef = useRef(null);
  dataRef.current = { settings, users, products, categories, purchases, sales, shift, zReports, tables, returns, suppliers };

  useEffect(() => {
    (async () => {
      const [s, u, p, cat, pu, sa, sh, z, tb, ret, sup] = await Promise.all([
        loadCollection(KEYS.settings, DEFAULT_SETTINGS),
        loadCollection(KEYS.users, DEFAULT_USERS),
        loadCollection(KEYS.products, DEFAULT_PRODUCTS),
        loadCollection(KEYS.categories, DEFAULT_CATEGORIES),
        loadCollection(KEYS.purchases, []),
        loadCollection(KEYS.sales, []),
        loadCollection(KEYS.shift, null),
        loadCollection(KEYS.zReports, []),
        loadCollection(KEYS.tables, DEFAULT_TABLES),
        loadCollection(KEYS.returns, []),
        loadCollection(KEYS.suppliers, []),
      ]);
      const mergedSettings = { ...DEFAULT_SETTINGS, ...s };
      if (!mergedSettings.recoveryCode) {
        mergedSettings.recoveryCode = generateRecoveryCode();
      }
      if (!mergedSettings.updateRepo) {
        mergedSettings.updateRepo = UPDATE_REPO;
      }
      setSettingsState(mergedSettings);
      setUsersState(u); setProductsState(p); setCategoriesState(cat); setPurchasesState(pu); setSalesState(sa);
      setShiftState(sh); setZReportsState(z); setTablesState(tb && tb.length ? tb : DEFAULT_TABLES);
      setReturnsState(ret);
      setSuppliersState(sup);
      setLoading(false);
      // persist seeds / merged defaults on first run
      saveCollection(KEYS.settings, mergedSettings);
      saveCollection(KEYS.users, u);
      saveCollection(KEYS.products, p);
      saveCollection(KEYS.categories, cat);
      saveCollection(KEYS.tables, tb && tb.length ? tb : DEFAULT_TABLES);
    })();
  }, []);

  // Intercepta el botón de cerrar la ventana (solo dentro de la app de escritorio Tauri)
  useEffect(() => {
    if (!isTauriApp()) return;
    let unlisten;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        unlisten = await win.onCloseRequested((event) => {
          event.preventDefault();
          setCloseChoice(true);
        });
      } catch (e) {
        console.error("No se pudo interceptar el cierre de ventana", e);
      }
    })();
    return () => { if (unlisten) unlisten(); };
  }, []);

  async function quitApp() {
    if (isTauriApp()) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().destroy();
        return;
      } catch (e) {
        console.error("No se pudo cerrar el programa", e);
        window.alert(`No se pudo cerrar el programa automáticamente. Detalle técnico: ${(e && (e.message || e.toString())) || "desconocido"}\n\nPuedes forzar el cierre desde el menú del sistema (Cmd+Q en Mac, o Alt+F4 en Windows).`);
      }
    }
    setCloseChoice(false);
  }

  // Revisa si hay una versión nueva publicada y, si la hay, la DESCARGA E INSTALA sola en
  // segundo plano (usa el plugin oficial de actualizaciones de Tauri, con firma verificada).
  // Solo falta reiniciar para que quede aplicada — eso se lo dejamos pedir al usuario con un
  // botón, para no interrumpirlo de golpe si está a mitad de una venta.
  async function checkAndAutoUpdate() {
    if (!isTauriApp()) {
      setUpdateStatus({ state: "error", message: "Esta función solo está disponible en la app de escritorio (Tauri)." });
      return;
    }
    setUpdateStatus({ state: "checking" });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update) {
        setUpdateStatus({ state: "downloading", version: update.version });
        await update.downloadAndInstall();
        setUpdateStatus({ state: "ready", version: update.version, notes: update.body || "" });
        setUpdateDismissed(false);
      } else {
        setUpdateStatus({ state: "upToDate" });
      }
    } catch (e) {
      console.error("Error revisando/instalando actualización", e);
      setUpdateStatus({ state: "error", message: (e && (e.message || e.toString())) || "Error desconocido. Revisa que el repositorio sea público y tenga una release publicada con archivos de actualización (latest.json)." });
    }
  }

  async function relaunchApp() {
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      console.error("No se pudo reiniciar automáticamente", e);
      window.alert("La actualización ya se instaló, pero no se pudo reiniciar sola. Cierra y vuelve a abrir FreePOS a mano para terminar de aplicarla.");
    }
  }

  // Revisa (y descarga/instala) sola, una vez, cada vez que se abre el programa.
  useEffect(() => {
    if (loading) return;
    checkAndAutoUpdate();
  }, [loading]);

  async function openExternal(url) {
    try {
      const { open } = await import("@tauri-apps/plugin-opener");
      await open(url);
    } catch (e) {
      window.open(url, "_blank");
    }
  }

  async function setSettings(next) {
    setSettingsState(next);
    const ok = await saveCollection(KEYS.settings, next);
    return ok;
  }
  function setUsers(fn) { setUsersState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.users, next); return next; }); }
  function setProducts(fn) { setProductsState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.products, next); return next; }); }
  function setCategories(fn) { setCategoriesState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.categories, next); return next; }); }
  function setPurchases(fn) { setPurchasesState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.purchases, next); return next; }); }
  function setSales(fn) { setSalesState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.sales, next); return next; }); }
  function setShift(next) { setShiftState(next); saveCollection(KEYS.shift, next); }
  function setZReports(fn) { setZReportsState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.zReports, next); return next; }); }
  function setTables(fn) { setTablesState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.tables, next); return next; }); }
  function setReturns(fn) { setReturnsState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.returns, next); return next; }); }
  function setSuppliers(fn) { setSuppliersState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.suppliers, next); return next; }); }

  function addCategory(name) {
    const clean = (name || "").trim();
    if (!clean) return;
    setCategories((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
  }

  function completeSale(sale) {
    setSales((prev) => [...prev, sale]);
    setProducts((prev) => prev.map((p) => {
      const line = sale.items.find((i) => i.productId === p.id);
      if (!line) return p;
      return { ...p, stock: Math.max(0, p.stock - line.qty) };
    }));
    if (sale.paymentMethod === "Efectivo" && settings.autoOpenDrawerOnCash) {
      openCashDrawer().catch(() => {});
    }
  }

  // Registra una devolución: guarda el registro y regresa el stock devuelto al inventario.
  function handleReturn(returnRecord) {
    setReturns((prev) => [...prev, returnRecord]);
    setProducts((prev) => prev.map((p) => {
      const line = returnRecord.items.find((i) => i.productId === p.id);
      if (!line) return p;
      return { ...p, stock: p.stock + line.qty };
    }));
    if (returnRecord.paymentMethod === "Efectivo" && settings.autoOpenDrawerOnCash) {
      openCashDrawer().catch(() => {});
    }
  }

  // Deja FreePOS como recién instalado: borra inventario, ventas, compras, proveedores,
  // usuarios (vuelve al admin de fábrica), turno de caja y reportes. Esto SOLO toca el
  // archivo interno de datos de la app — nunca borra ni toca los archivos .json que hayas
  // exportado a mano con "Exportar copia de seguridad", porque esos viven donde tú los
  // hayas guardado (USB, Escritorio, etc.), completamente fuera de este archivo.
  async function factoryReset() {
    const freshSettings = { ...DEFAULT_SETTINGS, recoveryCode: generateRecoveryCode(), updateRepo: UPDATE_REPO };
    await setSettings(freshSettings);
    setUsers(() => DEFAULT_USERS);
    setProducts(() => DEFAULT_PRODUCTS);
    setCategories(() => DEFAULT_CATEGORIES);
    setPurchases(() => []);
    setSales(() => []);
    setShift(null);
    setZReports(() => []);
    setTables(() => DEFAULT_TABLES);
    setReturns(() => []);
    setSuppliers(() => []);
    setUser(null);
  }

  function handleLogin(u) {
    setUser(u);
    setPage(u.role === "admin" ? "dashboard" : "pos");
    if (!shift) setShowOpenShift(true);
  }

  function handleOpenShift(amount) {
    setShift({ id: uid("shift"), openedAt: new Date().toISOString(), openedBy: user ? user.name : "—", openingCash: amount, status: "open" });
    setShowOpenShift(false);
  }

  function handleCloseShift(zReport) {
    setZReports((prev) => [zReport, ...prev]);
    setShift(null);
    setShowOpenShift(true); // encadena inmediatamente la apertura del nuevo turno
    writeAutoBackup(); // punto de control natural: guarda una copia justo al cerrar caja
  }

  // Copia de seguridad AUTOMÁTICA (silenciosa, no la ves en pantalla): además del guardado
  // normal de cada cambio, cada cierto tiempo FreePOS deja una copia completa aparte, en una
  // carpeta separada, conservando solo las últimas 10. Esto protege contra el caso de que el
  // archivo principal se dañe (por ejemplo por un corte de luz justo mientras se escribía) —
  // si eso pasara, siempre queda un respaldo reciente del que se puede restaurar a mano
  // (Configuración → Importar copia de seguridad) usando el archivo más nuevo de esa carpeta.
  async function writeAutoBackup() {
    if (!isTauriApp()) return;
    try {
      const { appDataDir, join } = await import("@tauri-apps/api/path");
      const { mkdir, writeTextFile, readDir, remove } = await import("@tauri-apps/plugin-fs");
      const dir = await appDataDir();
      const backupsDir = await join(dir, "auto-backups");
      try { await mkdir(backupsDir, { recursive: true }); } catch (e) { /* puede que ya exista */ }

      const d = dataRef.current;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `auto-backup-${stamp}.json`;
      const filePath = await join(backupsDir, fileName);
      const data = {
        freeposBackup: true, version: 1, auto: true, exportedAt: new Date().toISOString(),
        businessName: d.settings.businessName,
        settings: d.settings, users: d.users, products: d.products, categories: d.categories,
        purchases: d.purchases, sales: d.sales, shift: d.shift, zReports: d.zReports,
        tables: d.tables, returns: d.returns, suppliers: d.suppliers,
      };
      await writeTextFile(filePath, JSON.stringify(data));

      // Rotación: conservar solo los 10 respaldos automáticos más recientes.
      try {
        const entries = await readDir(backupsDir);
        const files = entries
          .filter((e) => !e.isDirectory && e.name && e.name.startsWith("auto-backup-"))
          .map((e) => e.name)
          .sort();
        if (files.length > 10) {
          const toDelete = files.slice(0, files.length - 10);
          for (const f of toDelete) {
            await remove(await join(backupsDir, f));
          }
        }
      } catch (e) {
        console.error("No se pudo limpiar backups automáticos viejos", e);
      }
    } catch (e) {
      console.error("No se pudo crear el backup automático", e);
    }
  }

  // Backup automático cada 5 minutos mientras el programa está abierto.
  useEffect(() => {
    if (loading) return;
    const interval = window.setInterval(() => { writeAutoBackup(); }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [loading]);

  // Exporta TODOS los datos del negocio (inventario, ventas, usuarios, facturas, turno, etc.)
  // a un archivo .json que se puede llevar a otro computador con FreePOS instalado.
  async function exportBackup() {
    if (!isTauriApp()) {
      return { ok: false, reason: "unsupported" };
    }
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const data = {
        freeposBackup: true,
        version: 1,
        exportedAt: new Date().toISOString(),
        businessName: settings.businessName,
        settings, users, products, categories, purchases, sales, shift, zReports, tables, returns, suppliers,
      };
      const path = await save({
        defaultPath: `freepos-backup-${todayISO()}.json`,
        filters: [{ name: "Copia de seguridad FreePOS", extensions: ["json"] }],
      });
      if (!path) return { ok: false, reason: "cancelled" };
      await writeTextFile(path, JSON.stringify(data, null, 2));
      return { ok: true, path };
    } catch (e) {
      console.error("Error exportando copia de seguridad", e);
      return { ok: false, reason: "error", message: (e && (e.message || e.toString())) || String(e) };
    }
  }

  // Importa un archivo de copia de seguridad (de este mismo computador u otro) y
  // REEMPLAZA todos los datos actuales.
  async function importBackup() {
    if (!isTauriApp()) {
      return { ok: false, reason: "unsupported" };
    }
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await open({
        multiple: false,
        filters: [{ name: "Copia de seguridad FreePOS", extensions: ["json"] }],
      });
      if (!path) return { ok: false, reason: "cancelled" };
      const text = await readTextFile(path);
      const data = JSON.parse(text);
      if (!data || !data.settings || !data.users || !data.products) {
        return { ok: false, reason: "invalid" };
      }
      const confirmed = window.confirm(
        `Vas a reemplazar TODOS los datos actuales (inventario, ventas, usuarios, facturas) por los del archivo${data.businessName ? ` de "${data.businessName}"` : ""}. Esta acción no se puede deshacer. ¿Continuar?`
      );
      if (!confirmed) return { ok: false, reason: "cancelled" };

      setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      setUsers(() => data.users || DEFAULT_USERS);
      setProducts(() => data.products || DEFAULT_PRODUCTS);
      setCategories(() => data.categories || DEFAULT_CATEGORIES);
      setPurchases(() => data.purchases || []);
      setSales(() => data.sales || []);
      setShift(data.shift || null);
      setZReports(() => data.zReports || []);
      setTables(() => (data.tables && data.tables.length ? data.tables : DEFAULT_TABLES));
      setReturns(() => data.returns || []);
      setSuppliers(() => data.suppliers || []);
      setUser(null); // vuelve al login para entrar con los usuarios recién importados
      return { ok: true };
    } catch (e) {
      console.error("Error importando copia de seguridad", e);
      return { ok: false, reason: "error", message: (e && (e.message || e.toString())) || String(e) };
    }
  }

  let content;
  if (loading) {
    content = (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg }}>
        <p className="text-sm" style={{ color: COLORS.inkSoft }}>Cargando FreePOS...</p>
      </div>
    );
  } else if (!user) {
    content = <LoginScreen users={users} settings={settings} setUsers={setUsers} onLogin={handleLogin} />;
  } else {
    content = (
      <div className="flex min-h-screen" style={{ background: COLORS.bg, fontFamily: "'Inter', sans-serif" }}>
        <Sidebar page={page} setPage={setPage} user={user} onLogout={() => setConfirmLogout(true)} settings={settings} shift={shift} />
        <main className="flex-1 p-6 min-w-0">
          {updateStatus && updateStatus.state === "ready" && !updateDismissed && (
            <div className="mb-4 rounded-xl p-3 flex items-center justify-between no-print" style={{ background: COLORS.primarySoft }}>
              <p className="text-sm font-medium" style={{ color: COLORS.primaryDark }}>
                Ya se descargó e instaló FreePOS v{updateStatus.version}. Reinicia para terminar de aplicarla.
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={relaunchApp}>Reiniciar ahora</Button>
                <button onClick={() => setUpdateDismissed(true)} className="p-1"><X size={16} style={{ color: COLORS.primaryDark }} /></button>
              </div>
            </div>
          )}
          {page === "dashboard" && user.role === "admin" && <Dashboard products={products} sales={sales} settings={settings} setPage={setPage} shift={shift} />}
          {page === "pos" && <POS products={products} categories={categories} settings={settings} user={user} onCompleteSale={completeSale} tables={tables} setTables={setTables} shift={shift} />}
          {page === "cashregister" && <CashRegisterPage shift={shift} sales={sales} purchases={purchases} products={products} returns={returns} zReports={zReports} settings={settings} user={user} onCloseShift={handleCloseShift} />}
          {page === "inventory" && user.role === "admin" && <Inventory products={products} setProducts={setProducts} categories={categories} setCategories={setCategories} addCategory={addCategory} settings={settings} />}
          {page === "purchases" && user.role === "admin" && <Purchases products={products} setProducts={setProducts} purchases={purchases} setPurchases={setPurchases} suppliers={suppliers} setSuppliers={setSuppliers} settings={settings} />}
          {page === "reports" && user.role === "admin" && <Reports sales={sales} products={products} returns={returns} settings={settings} user={user} onReturn={handleReturn} />}
          {page === "users" && user.role === "admin" && <UsersPage users={users} setUsers={setUsers} currentUser={user} />}
          {page === "settings" && user.role === "admin" && <SettingsPage settings={settings} setSettings={setSettings} user={user} onExportBackup={exportBackup} onImportBackup={importBackup} updateStatus={updateStatus} onCheckUpdates={checkAndAutoUpdate} onRelaunch={relaunchApp} onOpenExternal={openExternal} onFactoryReset={factoryReset} />}
        </main>
      </div>
    );
  }

  return (
    <>
      <GlobalStyle settings={settings} />
      {content}

      {user && showOpenShift && <OpenShiftModal user={user} onConfirm={handleOpenShift} />}

      {user && confirmLogout && (
        <ConfirmModal
          title="Cerrar sesión"
          message={`¿Seguro que quieres cerrar sesión, ${user.name}? Las mesas y ventas quedan guardadas, cualquiera puede continuar donde quedaste.`}
          options={[{ label: "Cerrar sesión", variant: "danger", onClick: () => { setUser(null); setConfirmLogout(false); } }]}
          onCancel={() => setConfirmLogout(false)}
        />
      )}

      {closeChoice && (
        <ConfirmModal
          title="¿Qué quieres hacer?"
          message={user ? "Puedes cerrar sesión y dejar el programa abierto para el siguiente turno, o cerrar el programa por completo." : "¿Deseas cerrar el programa por completo?"}
          options={[
            ...(user ? [{ label: "Cerrar sesión (dejar el programa abierto)", variant: "subtle", onClick: () => { setUser(null); setCloseChoice(false); } }] : []),
            { label: "Cerrar el programa por completo", variant: "danger", onClick: quitApp },
          ]}
          onCancel={() => setCloseChoice(false)}
        />
      )}
    </>
  );
}

function GlobalStyle({ settings }) {
  const mm = settings && settings.paperWidth === "80" ? 80 : 58;
  const contentWidth = mm === 80 ? 72 : 48;
  const fontSize = mm === 80 ? "11px" : "10px";
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
      .font-mono { font-family: 'JetBrains Mono', monospace; }
      @page { size: ${mm}mm auto; margin: 0; }
      @media print {
        body * { visibility: hidden; }
        .receipt-print, .receipt-print * { visibility: visible; }
        .receipt-print { position: absolute; top: 0; left: 0; width: ${contentWidth}mm; font-size: ${fontSize}; line-height: 1.35; }
        .no-print { display: none !important; }
      }
    `}</style>
  );
}
