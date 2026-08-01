import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, ShoppingCart, Package, FileText, BarChart3, Users as UsersIcon,
  Settings as SettingsIcon, Search, Plus, Minus, Trash2, Printer, X, LogOut,
  AlertTriangle, TrendingUp, Boxes, ClipboardList, Store, Check, Pencil, ChevronLeft,
  DollarSign, ScanBarcode, Tags
} from "lucide-react";

/* ---------------------------------- constants ---------------------------------- */

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
};

const DEFAULT_CATEGORIES = ["Abarrotes", "Lácteos", "Panadería", "Bebidas", "Aseo"];

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
};

/* ---------------------------------- helpers ---------------------------------- */

const uid = (p = "id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

function formatMoney(amount, currency) {
  const c = currency || DEFAULT_SETTINGS.currency;
  const n = Number(amount) || 0;
  return `${c.symbol}${n.toLocaleString("es-CO", { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals })}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <Icon size={30} style={{ color: COLORS.inkSoft }} />
      <p className="font-medium" style={{ color: COLORS.ink }}>{title}</p>
      {subtitle && <p className="text-sm max-w-xs" style={{ color: COLORS.inkSoft }}>{subtitle}</p>}
    </div>
  );
}

/* ---------------------------------- Login ---------------------------------- */

function LoginScreen({ users, settings, onLogin }) {
  const activeUsers = users.filter((u) => u.active);
  const [selected, setSelected] = useState(activeUsers[0]?.id || "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

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
      <div className="w-full max-w-sm rounded-2xl shadow-lg p-8" style={{ background: COLORS.surface }}>
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: COLORS.primary }}>
            <Store size={24} color="#fff" />
          </div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: COLORS.ink, fontFamily: "'Space Grotesk', sans-serif" }}>FreePOS</h1>
          <p className="text-sm" style={{ color: COLORS.inkSoft }}>{settings.businessName}</p>
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
        <p className="text-xs text-center mt-5" style={{ color: COLORS.inkSoft }}>
          Demo: admin / 1234 · empleado / 0000
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------- Sidebar ---------------------------------- */

function Sidebar({ page, setPage, user, onLogout, settings }) {
  const adminItems = [
    { id: "dashboard", label: "Panel", icon: LayoutDashboard },
    { id: "pos", label: "Ventas", icon: ShoppingCart },
    { id: "inventory", label: "Inventario", icon: Package },
    { id: "purchases", label: "Compras", icon: FileText },
    { id: "reports", label: "Reportes", icon: BarChart3 },
    { id: "users", label: "Usuarios", icon: UsersIcon },
    { id: "settings", label: "Configuración", icon: SettingsIcon },
  ];
  const employeeItems = [{ id: "pos", label: "Ventas", icon: ShoppingCart }];
  const items = user.role === "admin" ? adminItems : employeeItems;

  return (
    <div className="w-56 shrink-0 h-screen sticky top-0 flex flex-col no-print" style={{ background: COLORS.ink }}>
      <div className="px-5 py-5 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: COLORS.primary }}>
          <Store size={16} color="#fff" />
        </div>
        <span className="font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>FreePOS</span>
      </div>
      <nav className="flex-1 px-3 flex flex-col gap-1 mt-2">
        {items.map((it) => {
          const Icon = it.icon;
          const active = page === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setPage(it.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
              style={{ background: active ? COLORS.primary : "transparent", color: active ? "#fff" : "#B7BEC7" }}
            >
              <Icon size={17} />
              {it.label}
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

function Dashboard({ products, sales, settings, setPage }) {
  const today = todayISO();
  const todaySales = sales.filter((s) => s.date.slice(0, 10) === today);
  const revenueToday = todaySales.reduce((a, s) => a + s.total, 0);
  const txCount = todaySales.length;
  const lowStock = products.filter((p) => p.stock <= p.minStock);

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

function POS({ products, categories: savedCategories, settings, user, onCompleteSale }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [cart, setCart] = useState([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [taxPct, setTaxPct] = useState(settings.taxRate || 0);
  const [payment, setPayment] = useState(PAYMENT_METHODS[0]);
  const [receipt, setReceipt] = useState(null);
  const [toast, setToast] = useState(null);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [qtyPrompt, setQtyPrompt] = useState(null); // producto seleccionado esperando cantidad
  const [printReceipt, setPrintReceipt] = useState(true);

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

  function addToCart(product, qty = 1) {
    if (product.stock <= 0) return;
    const addQty = Math.max(1, Math.min(Math.floor(Number(qty)) || 1, product.stock));
    setCart((c) => {
      const existing = c.find((i) => i.id === product.id);
      if (existing) {
        const newQty = Math.min(existing.qty + addQty, product.stock);
        return c.map((i) => (i.id === product.id ? { ...i, qty: newQty } : i));
      }
      return [...c, { id: product.id, name: product.name, price: product.price, cost: product.cost, qty: addQty, maxStock: product.stock }];
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
  }, [products, settings.barcodeScannerEnabled]);

  async function handleOpenDrawer() {
    setDrawerBusy(true);
    const res = await openCashDrawer();
    setDrawerBusy(false);
    if (res.ok) showToast("Cajón abierto", "primary");
    else if (res.reason === "unsupported") showToast("Este navegador no permite abrir el cajón directamente. Configúralo para abrirse al imprimir.", "amber");
    else showToast("No se pudo conectar con el cajón.", "danger");
  }

  function updateQty(id, delta) {
    setCart((c) => c.map((i) => {
      if (i.id !== id) return i;
      const qty = Math.min(Math.max(i.qty + delta, 1), i.maxStock);
      return { ...i, qty };
    }));
  }

  function removeItem(id) {
    setCart((c) => c.filter((i) => i.id !== id));
  }

  const subtotal = cart.reduce((a, i) => a + i.price * i.qty, 0);
  const discountAmt = subtotal * (Number(discountPct) || 0) / 100;
  const taxable = subtotal - discountAmt;
  const taxAmt = taxable * (Number(taxPct) || 0) / 100;
  const total = taxable + taxAmt;

  function charge() {
    if (cart.length === 0) return;
    const sale = {
      id: uid("sale"),
      date: new Date().toISOString(),
      cashier: user.name,
      items: cart.map((i) => ({ productId: i.id, name: i.name, qty: i.qty, price: i.price, cost: i.cost })),
      subtotal, discountPct: Number(discountPct) || 0, discountAmt, taxPct: Number(taxPct) || 0, taxAmt, total,
      paymentMethod: payment,
      invoiced: printReceipt,
    };
    onCompleteSale(sale);
    if (printReceipt) {
      setReceipt(sale);
    } else {
      showToast("Venta registrada sin factura impresa", "primary");
    }
    setCart([]);
    setDiscountPct(0);
    setPayment(PAYMENT_METHODS[0]);
  }

  return (
    <div className="flex gap-5 h-full">
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
        <div className="grid grid-cols-3 gap-3 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 220px)" }}>
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setQtyPrompt(p)}
              disabled={p.stock <= 0}
              className="text-left rounded-xl p-3 flex flex-col gap-1 transition-transform active:scale-95 disabled:opacity-40"
              style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}
            >
              <span className="text-sm font-semibold leading-snug" style={{ color: COLORS.ink }}>{p.name}</span>
              <span className="text-xs" style={{ color: COLORS.inkSoft }}>{p.stock <= 0 ? "Agotado" : `${p.stock} disp.`}</span>
              <span className="font-mono font-bold text-sm mt-1" style={{ color: COLORS.primaryDark }}>{formatMoney(p.price, settings.currency)}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3"><EmptyState icon={Search} title="Sin resultados" subtitle="Prueba con otro nombre, SKU o categoría." /></div>
          )}
        </div>
      </div>

      {/* Receipt-style cart */}
      <div className="w-80 shrink-0 flex flex-col rounded-xl overflow-hidden" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px dashed ${COLORS.border}` }}>
          <h3 className="font-semibold text-sm font-mono" style={{ color: COLORS.ink }}>TICKET ACTUAL</h3>
          <ShoppingCart size={16} style={{ color: COLORS.inkSoft }} />
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: "calc(100vh - 400px)" }}>
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
              <TextInput type="number" min="0" max="100" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} />
            </Field>
            <Field label="Impuesto %">
              <TextInput type="number" min="0" max="100" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} />
            </Field>
          </div>
          <Field label="Pago">
            <Select value={payment} onChange={(e) => setPayment(e.target.value)}>
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

      {qtyPrompt && <QtyPromptModal product={qtyPrompt} settings={settings} onConfirm={confirmQtyPrompt} onClose={() => setQtyPrompt(null)} />}
      {receipt && <ReceiptModal sale={receipt} settings={settings} onClose={() => setReceipt(null)} />}
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
    </div>
  );
}

function QtyPromptModal({ product, settings, onConfirm, onClose }) {
  const [qty, setQty] = useState("1");
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  function submit(e) {
    e.preventDefault();
    const n = Math.max(1, Math.min(Math.floor(Number(qty)) || 1, product.stock));
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
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>{product.stock} disponibles · {formatMoney(product.price, settings.currency)} c/u</p>
        </div>
        <Field label="Cantidad">
          <TextInput
            ref={inputRef}
            type="number"
            min="1"
            max={product.stock}
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

function ReceiptModal({ sale, settings, onClose }) {
  const previewWidth = settings.paperWidth === "80" ? "300px" : "220px";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print" style={{ background: "rgba(15,20,25,0.45)" }}>
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
                  <span>{it.qty}x {it.name}</span>
                  <span>{formatMoney(it.price * it.qty, settings.currency)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(sale.subtotal, settings.currency)}</span></div>
            <div className="flex justify-between"><span>Descuento</span><span>-{formatMoney(sale.discountAmt, settings.currency)}</span></div>
            <div className="flex justify-between"><span>Impuesto</span><span>+{formatMoney(sale.taxAmt, settings.currency)}</span></div>
            <div className="flex justify-between font-bold text-sm mt-1"><span>TOTAL</span><span>{formatMoney(sale.total, settings.currency)}</span></div>
            <p className="mt-2">Pago: {sale.paymentMethod}</p>
            <p className="text-center mt-3">¡Gracias por su compra!</p>
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

/* ---------------------------------- Inventory ---------------------------------- */

const NEW_CATEGORY_VALUE = "__new__";

function ProductForm({ initial, categories, onAddCategory, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: "", sku: "", barcode: "", category: categories[0] || "", price: "", cost: "", stock: "", minStock: "" });
  const [newCategory, setNewCategory] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio de venta"><TextInput type="number" value={form.price} onChange={(e) => set("price", e.target.value)} required /></Field>
          <Field label="Costo"><TextInput type="number" value={form.cost} onChange={(e) => set("cost", e.target.value)} /></Field>
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
              {["Producto", "SKU", "Código de barras", "Categoría", "Precio", "Costo", "Stock", ""].map((h) => (
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
                <td className="px-4 py-2.5 font-mono">{formatMoney(p.price, settings.currency)}</td>
                <td className="px-4 py-2.5 font-mono" style={{ color: COLORS.inkSoft }}>{formatMoney(p.cost, settings.currency)}</td>
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

function PurchaseForm({ products, onSave, onClose }) {
  const [supplier, setSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState([{ productId: products[0]?.id || "", qty: 1, cost: products[0]?.cost || 0 }]);

  function updateRow(idx, patch) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }
  function addRow() {
    setRows((r) => [...r, { productId: products[0]?.id || "", qty: 1, cost: products[0]?.cost || 0 }]);
  }
  function removeRow(idx) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }

  const total = rows.reduce((a, r) => a + Number(r.qty || 0) * Number(r.cost || 0), 0);

  function submit(e) {
    e.preventDefault();
    if (!supplier || rows.length === 0) return;
    onSave({
      id: uid("pur"), supplier, invoiceNumber, date,
      items: rows.map((r) => ({ ...r, qty: Number(r.qty) || 0, cost: Number(r.cost) || 0 })),
      total,
    });
  }

  return (
    <Modal title="Registrar factura de entrada" onClose={onClose} width="max-w-2xl">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Proveedor"><TextInput value={supplier} onChange={(e) => setSupplier(e.target.value)} required /></Field>
          <Field label="N° de factura"><TextInput value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></Field>
          <Field label="Fecha"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5"><Field label="Producto">
                <Select value={row.productId} onChange={(e) => updateRow(idx, { productId: e.target.value })}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field></div>
              <div className="col-span-3"><Field label="Cantidad">
                <TextInput type="number" min="1" value={row.qty} onChange={(e) => updateRow(idx, { qty: e.target.value })} />
              </Field></div>
              <div className="col-span-3"><Field label="Costo unit.">
                <TextInput type="number" value={row.cost} onChange={(e) => updateRow(idx, { cost: e.target.value })} />
              </Field></div>
              <div className="col-span-1 pb-2">
                <button type="button" onClick={() => removeRow(idx)}><Trash2 size={16} style={{ color: COLORS.danger }} /></button>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="subtle" onClick={addRow} className="self-start"><Plus size={14} /> Agregar línea</Button>
        <div className="flex justify-end font-mono font-bold text-sm" style={{ color: COLORS.ink }}>Total: {formatMoney(total, CURRENCIES[0])}</div>
        <div className="flex gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1">Guardar e ingresar mercancía</Button>
        </div>
      </form>
    </Modal>
  );
}

function Purchases({ products, setProducts, purchases, setPurchases, settings }) {
  const [showForm, setShowForm] = useState(false);

  function savePurchase(purchase) {
    setPurchases((prev) => [purchase, ...prev]);
    setProducts((prev) => prev.map((p) => {
      const line = purchase.items.find((i) => i.productId === p.id);
      if (!line) return p;
      return { ...p, stock: p.stock + line.qty, cost: line.cost || p.cost };
    }));
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
                <td className="px-4 py-2.5 font-medium" style={{ color: COLORS.ink }}>{p.supplier}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{p.invoiceNumber || "—"}</td>
                <td className="px-4 py-2.5">{p.items.length} productos</td>
                <td className="px-4 py-2.5 font-mono font-semibold">{formatMoney(p.total, settings.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {purchases.length === 0 && <EmptyState icon={FileText} title="Sin compras registradas" subtitle="Registra facturas de proveedores para actualizar tu inventario automáticamente." />}
      </div>
      {showForm && <PurchaseForm products={products} onSave={savePurchase} onClose={() => setShowForm(false)} />}
    </div>
  );
}

/* ---------------------------------- Reports ---------------------------------- */

function Reports({ sales, products, settings }) {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const inRange = sales.filter((s) => {
    const d = s.date.slice(0, 10);
    return d >= from && d <= to;
  });

  const revenue = inRange.reduce((a, s) => a + s.total, 0);
  const cost = inRange.reduce((a, s) => a + s.items.reduce((b, i) => b + (i.cost || 0) * i.qty, 0), 0);
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
      <div className="flex items-end gap-3">
        <Field label="Desde"><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Hasta"><TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Ingresos" value={formatMoney(revenue, settings.currency)} tone="primary" />
        <StatCard icon={ClipboardList} label="Costo de venta" value={formatMoney(cost, settings.currency)} tone="gray" />
        <StatCard icon={BarChart3} label="Utilidad" value={formatMoney(profit, settings.currency)} tone="primary" />
        <StatCard icon={BarChart3} label="Margen" value={`${margin.toFixed(1)}%`} tone="gray" />
      </div>

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
              {["Fecha", "Cajero", "Pago", "Total"].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: COLORS.inkSoft }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inRange.slice().reverse().map((s) => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <td className="px-4 py-2.5">{new Date(s.date).toLocaleString("es-CO")}</td>
                <td className="px-4 py-2.5">{s.cashier}</td>
                <td className="px-4 py-2.5">{s.paymentMethod}</td>
                <td className="px-4 py-2.5 font-mono font-semibold">{formatMoney(s.total, settings.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {inRange.length === 0 && <EmptyState icon={BarChart3} title="Sin ventas en este rango" />}
      </div>
    </div>
  );
}

/* ---------------------------------- Users ---------------------------------- */

function UserForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: "", username: "", pin: "", role: "employee", active: true });
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function submit(e) {
    e.preventDefault();
    if (!form.name || !form.username || !form.pin) return;
    onSave({ ...form, id: form.id || uid("u") });
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
      {showForm && <UserForm initial={editing} onSave={saveUser} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

/* ---------------------------------- Settings ---------------------------------- */

function SettingsPage({ settings, setSettings }) {
  const [form, setForm] = useState(settings);
  const [drawerTest, setDrawerTest] = useState(null);
  const [drawerBusy, setDrawerBusy] = useState(false);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function save(e) {
    e.preventDefault();
    setSettings(form);
  }

  async function testDrawer() {
    setDrawerBusy(true);
    const res = await openCashDrawer();
    setDrawerBusy(false);
    setDrawerTest(res);
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

        <Button type="submit" className="self-start mt-2"><Check size={16} /> Guardar cambios</Button>
      </form>
      <p className="text-xs" style={{ color: COLORS.inkSoft }}>
        Los datos de FreePOS se guardan en la nube de este artefacto y son compartidos por todas las personas que usen este mismo enlace.
      </p>
    </div>
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
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");

  useEffect(() => {
    (async () => {
      const [s, u, p, cat, pu, sa] = await Promise.all([
        loadCollection(KEYS.settings, DEFAULT_SETTINGS),
        loadCollection(KEYS.users, DEFAULT_USERS),
        loadCollection(KEYS.products, DEFAULT_PRODUCTS),
        loadCollection(KEYS.categories, DEFAULT_CATEGORIES),
        loadCollection(KEYS.purchases, []),
        loadCollection(KEYS.sales, []),
      ]);
      const mergedSettings = { ...DEFAULT_SETTINGS, ...s };
      setSettingsState(mergedSettings);
      setUsersState(u); setProductsState(p); setCategoriesState(cat); setPurchasesState(pu); setSalesState(sa);
      setLoading(false);
      // persist seeds / merged defaults on first run
      saveCollection(KEYS.settings, mergedSettings);
      saveCollection(KEYS.users, u);
      saveCollection(KEYS.products, p);
      saveCollection(KEYS.categories, cat);
    })();
  }, []);

  function setSettings(next) { setSettingsState(next); saveCollection(KEYS.settings, next); }
  function setUsers(fn) { setUsersState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.users, next); return next; }); }
  function setProducts(fn) { setProductsState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.products, next); return next; }); }
  function setCategories(fn) { setCategoriesState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.categories, next); return next; }); }
  function setPurchases(fn) { setPurchasesState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.purchases, next); return next; }); }
  function setSales(fn) { setSalesState((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; saveCollection(KEYS.sales, next); return next; }); }

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg }}>
        <p className="text-sm" style={{ color: COLORS.inkSoft }}>Cargando FreePOS...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <GlobalStyle settings={settings} />
        <LoginScreen users={users} settings={settings} onLogin={(u) => { setUser(u); setPage(u.role === "admin" ? "dashboard" : "pos"); }} />
      </>
    );
  }

  return (
    <>
      <GlobalStyle settings={settings} />
      <div className="flex min-h-screen" style={{ background: COLORS.bg, fontFamily: "'Inter', sans-serif" }}>
        <Sidebar page={page} setPage={setPage} user={user} onLogout={() => setUser(null)} settings={settings} />
        <main className="flex-1 p-6 min-w-0">
          {page === "dashboard" && user.role === "admin" && <Dashboard products={products} sales={sales} settings={settings} setPage={setPage} />}
          {page === "pos" && <POS products={products} categories={categories} settings={settings} user={user} onCompleteSale={completeSale} />}
          {page === "inventory" && user.role === "admin" && <Inventory products={products} setProducts={setProducts} categories={categories} setCategories={setCategories} addCategory={addCategory} settings={settings} />}
          {page === "purchases" && user.role === "admin" && <Purchases products={products} setProducts={setProducts} purchases={purchases} setPurchases={setPurchases} settings={settings} />}
          {page === "reports" && user.role === "admin" && <Reports sales={sales} products={products} settings={settings} />}
          {page === "users" && user.role === "admin" && <UsersPage users={users} setUsers={setUsers} currentUser={user} />}
          {page === "settings" && user.role === "admin" && <SettingsPage settings={settings} setSettings={setSettings} />}
        </main>
      </div>
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
