// storage.js
// Reemplaza el almacenamiento en la nube de los artefactos de Claude por un
// archivo JSON guardado en el propio computador (carpeta de datos de la app).
// Expone la MISMA forma que window.storage para que App.jsx no tenga que
// cambiar ni una línea de su lógica de datos.

import { load } from "@tauri-apps/plugin-store";

let storePromise = null;
function getStore() {
  if (!storePromise) {
    // Esto crea/abre el archivo "freepos-data.json" en la carpeta de datos
    // de la app (en Windows algo como C:\Users\TU_USUARIO\AppData\Roaming\com.freepos.app)
    storePromise = load("freepos-data.json", { autoSave: false });
  }
  return storePromise;
}

async function get(key /*, shared */) {
  const store = await getStore();
  const value = await store.get(key);
  if (value === undefined || value === null) return null;
  return { key, value, shared: false };
}

async function set(key, value /*, shared */) {
  const store = await getStore();
  await store.set(key, value);
  await store.save();
  return { key, value, shared: false };
}

async function del(key /*, shared */) {
  const store = await getStore();
  await store.delete(key);
  await store.save();
  return { key, deleted: true, shared: false };
}

async function list(prefix /*, shared */) {
  const store = await getStore();
  const keys = await store.keys();
  const filtered = prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
  return { keys: filtered, prefix, shared: false };
}

const storage = { get, set, delete: del, list };

if (typeof window !== "undefined") {
  window.storage = storage;
}

export default storage;
