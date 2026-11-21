// Aplicación principal: sesión (login/MFA/multiempresa), layout, menú y enrutador por hash. Cada página vive en ./pages/<nombre>.js
import { createApp, reactive, defineAsyncComponent } from './vendor/vue.esm-browser.prod.min.js';   // copia local de Vue 3.4.38 (R303): sin dependencia de un CDN externo
import { PALETAS, aplicarPaleta } from './paletas.js';
import { PATHS } from './iconos.js';   // iconos de línea del prototipo FISITAAP by Brillante Agencia
import { MENU, ICONO_MENU, TIPOS_NEGOCIO, NOMBRES_MODULO, menuTipo, rutaDeOtroTipoDe, rutaSinModuloDe, rutaPermitidaDe, decodificarRuta, hijoOkDe, conHijosDe, menuOkDe, menuVisibleDe, rrhhConCandadoDe, candadoDe, AVISO_RRHH_MFA, RUTA_RRHH_MFA } from './menu.js';   // un solo árbol de menú (3.77); 4.5: decodificarRuta
import { api, toasts, toast, token, setToken, onExpirar, cerrarSesionServidor, fecha, fechaHora, demo, monedas, mock, fijarEmpresaTab, avisoSesion, datosToken, TOKEN_KEY, pantalla, fijarSucursal } from './api.js';
import * as C from './components.js';
import { limpiarTablas as limpiarTablasRRHH } from './pages/rrhh/_datos.js';   // caché de parámetros de RRHH por empresa (R313)
import { iniciarAvisos } from './avisos.js';   // avisos de pedido nuevo en el dispositivo (FISITAAP, 3.58)

// ---- menú, tipos de negocio y reglas de visibilidad: viven en menu.js (3.77) y aquí se amarran a la sesión del ERP ----
export { MENU, ICONO_MENU, TIPOS_NEGOCIO, NOMBRES_MODULO, menuTipo };
export const Icono = { props: { n: String }, computed: { d() { return PATHS[this.n] || PATHS.box; } }, template: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="d"></path></svg>' };
export function rutaDeOtroTipo(path) { return rutaDeOtroTipoDe(sesion, path); }
export function rutaSinModulo(path) { return rutaSinModuloDe(sesion, path); }
export function rutaPermitida(path) { return rutaPermitidaDe(sesion, path); }
export function hotelActivo() { if (sesion.tipo !== 'hospitalidad') return false; const c = mock.get('hotel_config', null); return !!(c && c.activo); }   // solo en el tipo Hospitalidad (2.5)
export function hijoOk(c) { return hijoOkDe(sesion, hotelActivo, c); }
export function conHijos(it) { return conHijosDe(sesion, hotelActivo, it); }
export function menuOk(it) { return menuOkDe(sesion, hotelActivo, it); }
export function menuVisible() { return sesion.sinCaja ? [] : menuVisibleDe(sesion, hotelActivo); }   // 3.87: rol de solo caja sin el punto de venta: nada


// 3.87: lo único que abre el administrador del sistema sin empresa elegida; lo demás vuelve a la consola
const SIN_EMPRESA = new Set(['/admin', '/configuracion/perfil']);
const ROUTES = {
  '/inicio': 'inicio', '/bandeja': 'bandeja', '/admin': 'admin',
  '/ventas/facturas': 'ventas/facturas', '/ventas/importar': 'ventas/importar', '/ventas/facturas/nueva': 'ventas/factura-form', '/ventas/facturas/:id': 'ventas/factura-form',
  '/ventas/recurrentes': 'ventas/recurrentes', '/ventas/pagos': 'ventas/pagos', '/ventas/pagos/nuevo': 'ventas/pago-form',
  '/ventas/notas-credito': 'ventas/notas-credito', '/ventas/notas-credito/nueva': 'ventas/nota-form',
  '/ventas/notas-debito': 'ventas/notas-debito', '/ventas/notas-debito/nueva': 'ventas/nota-form',
  '/ventas/cotizaciones': 'ventas/cotizaciones', '/ventas/cotizaciones/nueva': 'ventas/cotizacion-form', '/ventas/cotizaciones/:id': 'ventas/cotizacion-form',
  '/ventas/remisiones': 'ventas/remisiones', '/ventas/remisiones/nueva': 'ventas/cotizacion-form', '/ventas/remisiones/:id': 'ventas/cotizacion-form',
  '/gastos/compras': 'gastos/compras', '/gastos/compras/nueva': 'gastos/compra-form',
  '/gastos/gastos': 'gastos/compras', '/gastos/rectificaciones': 'gastos/rectificaciones',   // 4.23: la misma pantalla de Compras con lo clasificado como gasto; y las rectificaciones
  '/gastos/pagos': 'gastos/pagos', '/gastos/pagos/nuevo': 'gastos/pago-form',
  '/gastos/recurrentes': 'gastos/recurrentes', '/gastos/notas-debito': 'gastos/notas-debito',
  '/gastos/ordenes': 'gastos/ordenes', '/gastos/ordenes/nueva': 'gastos/orden-form',
  '/gastos/recepcion': 'gastos/recepcion',
  '/contactos': 'contactos/lista', '/contactos/nuevo': 'contactos/form', '/contactos/revendedoras': 'reportes/revendedoras', '/contactos/estado-cuenta': 'reportes/revendedora', '/contactos/estado-cuenta/:id': 'reportes/revendedora', '/contactos/:id': 'contactos/form',   // 4.9: revendedoras y estado de cuenta (antes de /contactos/:id)
  '/inventario/items': 'inventario/items', '/inventario/items/nuevo': 'inventario/item-form', '/inventario/items/:id': 'inventario/item-form',
  '/inventario/valor': 'inventario/valor', '/inventario/ajustes': 'inventario/ajustes', '/inventario/ajustes/nuevo': 'inventario/ajuste-form', '/inventario/traslados': 'inventario/traslados',
  '/inventario/gestion': 'inventario/gestion', '/inventario/listas-precios': 'inventario/listas-precios', '/inventario/recetas': 'inventario/recetas', '/pos/recetas': 'inventario/recetas',
  '/inventario/bodegas': 'inventario/bodegas', '/inventario/categorias': 'inventario/categorias', '/inventario/atributos': 'inventario/atributos',
  '/inventario/reponer': 'inventario/reponer',   // 3.87: existencia mínima y orden de compra sugerida
  '/bancos': 'bancos/cuentas', '/bancos/conciliaciones': 'bancos/conciliaciones', '/bancos/conciliaciones/:id': 'bancos/conciliacion',
  '/rrhh/empleados': 'rrhh/empleados', '/rrhh/empleados/nuevo': 'rrhh/empleado-form', '/rrhh/empleados/:id': 'rrhh/empleado-form', '/rrhh/planilla': 'rrhh/planilla',
  '/rrhh/vacaciones': 'rrhh/vacaciones', '/rrhh/liquidaciones': 'rrhh/liquidaciones', '/rrhh/marcas': 'rrhh/marcas', '/rrhh/parametros': 'rrhh/parametros', '/rrhh/aguinaldo': 'rrhh/aguinaldo',
  '/fisitaap/pagina': 'fisitaap/pagina', '/fisitaap/catalogo': 'fisitaap/catalogo', '/fisitaap/pedidos': 'pedidos/bandeja', '/fisitaap/clientes': 'fisitaap/clientes',
  '/fisitaap/asistente': 'fisitaap/asistente', '/fisitaap/configuracion': 'fisitaap/configuracion',
  '/pedidos/bandeja': 'pedidos/bandeja', '/pedidos/negocio': 'fisitaap/pagina',   // rutas viejas (3.47 a 3.56): siguen abriendo
  '/promociones/cupones': 'promociones/cupones', '/promociones/fidelizacion': 'promociones/fidelizacion', '/promociones/tarjetas': 'promociones/tarjetas',
  '/entregas': 'entregas/entregas', '/entregas/zonas': 'entregas/zonas', '/entregas/motorizados': 'entregas/motorizados', '/entregas/liquidaciones': 'entregas/liquidaciones',
  '/medica/agenda': 'medica/recepcion', '/medica/clinica': 'medica/clinica',
  '/medica/ordenes': 'medica/ordenes', '/medica/gestion': 'medica/gestion',
  '/tike/tablero': 'tike/tablero', '/tike/tickets': 'tike/tickets', '/tike/tickets/:id': 'tike/ticket', '/tike/configuracion': 'tike/configuracion',
  '/tike/mio': 'tike/mio', '/tike/contratos': 'tike/contratos', '/tike/equipos': 'tike/equipos', '/tike/equipos/:id': 'tike/equipos', '/tike/reportes': 'tike/reportes', '/tike/documentacion': 'tike/documentacion',
  '/rrhh/ausencias': 'rrhh/ausencias', '/rrhh/conceptos': 'rrhh/conceptos', '/rrhh/informes': 'rrhh/informes', '/rrhh/horas-extra': 'rrhh/horas-extra', '/rrhh/horarios': 'rrhh/horarios',
  '/rrhh/acciones': 'rrhh/acciones',   // 4.21: acciones de personal
  '/rrhh/pronto': 'rrhh/pronto', '/rrhh/pronto/:clave': 'rrhh/pronto',   // 4.42: «Lo que viene» (índice y tarjeta; la lista vive en menu.js, RRHH_PRONTO)
  '/pos/caja': 'pos/caja', '/pos/cierres': 'pos/cierres', '/pos/ventas': 'pos/ventas', '/pos/servicio': 'pos/servicio', '/pos/configuracion': 'pos/configuracion', '/pos/pantalla': 'pos/pantalla', '/pos/cocina': 'pos/cocina', '/pos/reportes': 'pos/reportes', '/pos/inventario': 'pos/inventario',
  '/contabilidad/catalogo': 'contabilidad/catalogo', '/contabilidad/asientos': 'contabilidad/asientos', '/contabilidad/asientos/nuevo': 'contabilidad/asiento-form', '/contabilidad/asientos/:id': 'contabilidad/asiento-form',
  '/contabilidad/saldos-iniciales': 'contabilidad/saldos-iniciales', '/contabilidad/activos': 'contabilidad/activos', '/contabilidad/activos/nuevo': 'contabilidad/activo-form', '/contabilidad/activos/:id': 'contabilidad/activo-form',
  '/contabilidad/libro-diario': 'contabilidad/libro-diario', '/contabilidad/centros-costo': 'contabilidad/centros-costo', '/contabilidad/presupuesto': 'contabilidad/presupuesto', '/contabilidad/diferencial': 'contabilidad/diferencial',
  '/reportes': 'reportes/hub', '/reportes/ejecutivo': 'reportes/ejecutivo', '/reportes/modulos': 'reportes/modulos', '/reportes/:cat': 'reportes/categoria', '/reportes/:cat/:rep': 'reportes/reporte',
  '/tareas': 'tareas',
  '/hotel/recepcion': 'hotel/recepcion', '/hotel/reservaciones': 'hotel/reservaciones', '/hotel/reservaciones/nueva': 'hotel/reserva-form', '/hotel/reservaciones/:id': 'hotel/reserva-form',
  '/hotel/calendario': 'hotel/calendario', '/hotel/limpieza': 'hotel/limpieza',
  '/hotel/depositos': 'hotel/depositos', '/hotel/espera': 'hotel/espera', '/hotel/cotizaciones': 'hotel/cotizaciones', '/hotel/servicios': 'hotel/servicios', '/hotel/eventos': 'hotel/eventos', '/hotel/folios': 'hotel/folios', '/hotel/grupos': 'hotel/grupos', '/hotel/cierre': 'hotel/cierre', '/hotel/agencias': 'hotel/agencias', '/hotel/historico': 'hotel/historico',
  '/hotel/ama-de-llaves/lavanderia': 'hotel/lavanderia', '/hotel/mantenimiento/preventivo': 'hotel/preventivo',
  '/hotel/seguridad': 'hotel/seguridad', '/hotel/seguridad/bitacora': 'hotel/seguridad', '/hotel/seguridad/visitantes': 'hotel/seguridad', '/hotel/seguridad/incidentes': 'hotel/seguridad', '/hotel/seguridad/objetos': 'hotel/seguridad',
  '/hotel/ama-de-llaves/tablero': 'hotel/limpieza', '/hotel/ama-de-llaves/incidencias': 'hotel/incidencias', '/hotel/ama-de-llaves/tipos': 'hotel/tipos-problema',
  '/hotel/mantenimiento/incidencias': 'hotel/incidencias', '/hotel/mantenimiento/habitaciones': 'hotel/fuera-servicio', '/hotel/mantenimiento/tipos': 'hotel/tipos-problema', '/hotel/huespedes': 'hotel/huespedes', '/hotel/huespedes/:id': 'hotel/huespedes', '/hotel/reportes': 'hotel/reportes', '/hotel/configuracion': 'hotel/configuracion',
  '/sinc/pisados': 'sinc/pisados',   // 4.32: «Cambios que no quedaron» (solo para leer)
  '/configuracion': 'configuracion/hub', '/configuracion/:seccion': 'configuracion/seccion',
};

function match(path) {
  for (const [pat, mod] of Object.entries(ROUTES)) {
    const pp = pat.split('/'), xp = path.split('/');
    if (pp.length !== xp.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pp.length; i++) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodificarRuta(xp[i]);   // 4.5: route() ya decodificó la ruta; un parámetro con «%» suelto ya no revienta
      else if (pp[i] !== xp[i]) { ok = false; break; }
    }
    if (ok) return { mod, params };
  }
  return null;
}

// 4.8: después de entrar, el programa entero se descarga DE A UN ARCHIVO en segundo plano (queda guardado por el service worker).
// Así, la primera vez que se abre una pantalla no se le pide al hosting una ráfaga de archivos a la vez: en el cPanel compartido,
// 8 o 10 juntos hacen esperar 5 a 6 segundos a algunos (medido en producción el 8/11). Una vez por huella del programa y por
// navegador; se detiene sin conexión o si la pestaña se cierra; nunca compite con lo que el usuario está pidiendo (pausa entre archivos).
// Etapa 1: en el programa local, una sola franja con la conexión y el plazo de Hacienda; se actualiza cada minuto.
let _avisoLocal = null;
function vigilarAvisoLocal() {
  if (_avisoLocal) return;
  const pedir = async releer => {
    if (!sesion.activa || !sesion.empresa_id || !sesion.empresaInfo?.es_local) { store.avisoLocal = null; return; }
    try { store.avisoLocal = await api('/api/sinc/local/aviso'); } catch { /* el servidor local no responde: se reintenta */ }
    if (releer) await releerBanderas();
  };
  pedir(false); _avisoLocal = setInterval(() => pedir(true), 60000);
  try { document.addEventListener('visibilitychange', () => { if (!document.hidden) releerBanderas(); }); } catch { /* sin documento: solo el minuto */ }
}
// Validación 4.32: en el programa, las banderas de la empresa abierta se vuelven a leer cada minuto (el mismo temporizador del aviso, que solo
// pregunta en el programa) y al volver a la pestaña: el programa las cambia después de abrir la página (el día de la actualización, o al elegir
// en la página web quién atiende los pedidos). Solo si alguna cambió se ajustan la franja y la estación. En la página web no hace nada.
const BANDERAS_PROGRAMA = ['pedidos_programa', 'comandas_programa', 'datos_v2', 'sinc_pantallas'];
const banderasDe = i => BANDERAS_PROGRAMA.map(k => !!(i && i[k])).join();
let _releyendo = false;
async function releerBanderas() {
  if (_releyendo || !sesion.activa || !sesion.empresa_id || !sesion.empresaInfo?.es_local) return;
  _releyendo = true;
  try { const antes = banderasDe(sesion.empresaInfo); await sesion.refrescarEmpresas(); if (banderasDe(sesion.empresaInfo) !== antes) vigilarFranja(); }
  catch { /* sin respuesta: se intenta otra vez al minuto */ }
  finally { _releyendo = false; }
}

// 4.32 (B7): la franja de arriba (solo con la bandera datos_v2 del programa) y la estación de comandas desde cualquier pantalla (solo con
// pedidos_programa). Sin la bandera no hay consulta, ni temporizador, ni texto: todo queda como en la 4.31. Un 404 o un fallo de red la esconde.
const FRANJA_MS = 30000;
// 4.32: la franja de la sincronización con datos_v2 o con sinc_pantallas (esta también en pausa y en la página web) y solo para quien configura la empresa
export const conFranjaSinc = info => !!(info && (info.datos_v2 || info.sinc_pantallas) && sesion.puede('configurar'));
// Validación 4.32: la estación del programa corre con pedidos_programa o, con un interruptor apagado, mientras queden comandas pendientes de
// pedidos que ya atiende esta computadora (comandas_programa): «los ya asignados se terminan donde están»
export const conEstacionPrograma = info => !!(info && (info.pedidos_programa || info.comandas_programa));
let _franja = null, _estacionEid = null, _comandasPrev = 0;
export function textoEsperando(cambios, ventas) {
  const c = Math.max(0, Math.floor(+cambios || 0)), v = Math.max(0, Math.floor(+ventas || 0));
  if (!c && !v) return '';
  const pc = c === 1 ? '1 cambio' : c + ' cambios', pv = v === 1 ? '1 venta' : v + ' ventas';
  return (c && v ? pc + ' y ' + pv : (c ? pc : pv)) + ' esperando a la página web';
}
export const TEXTO_PAUSA_FRANJA = 'Este programa no puede enviar sus cambios a la página web por ahora. Los guarda y los envía solos cuando se pueda.';
export function textoNoQuedaron(n) {
  const k = Math.max(0, Math.floor(+n || 0));
  if (!k) return '';
  return k === 1 ? 'Hay 1 cambio que no quedó: ' : 'Hay ' + k + ' cambios que no quedaron: ';
}
export function textoComandas(n) {
  const k = Math.max(0, Math.floor(+n || 0));
  if (!k) return '';
  return k === 1 ? 'Hay 1 comanda de pedidos sin imprimir: abra la Caja.' : 'Hay ' + k + ' comandas de pedidos sin imprimir: abra la Caja.';
}
const enCajaOCocina = () => /^\/pos\/(caja|cocina)(\/|$)/.test(decodificarRuta((location.hash.slice(1) || '').split('?')[0]));
function sonarFranja() {
  try { const ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.frequency.value = 660; g.gain.value = 0.2; o.start(); o.stop(ac.currentTime + 0.35); } catch { /* sin sonido */ }
}
async function ajustarEstacion(forzarParar = false) {
  const eid = sesion.empresa_id, info = sesion.empresaInfo, quiere = !forzarParar && !!(sesion.activa && eid && conEstacionPrograma(info));
  if (quiere) {
    if (_estacionEid === eid) return;
    _estacionEid = eid;                                       // antes de esperar: dos llamadas seguidas no la inician dos veces
    try {
      const m = await import('./pages/pos/_estacion.js');
      if (m && typeof m.iniciarDesdeApp === 'function') { if (_estacionEid === eid && sesion.empresa_id === eid && sesion.activa) m.iniciarDesdeApp(); }
      else if (_estacionEid === eid) _estacionEid = null;     // versión vieja en caché: no hay estación que iniciar
    } catch { if (_estacionEid === eid) _estacionEid = null; }
  } else if (_estacionEid !== null) {
    _estacionEid = null;
    try { const m = await import('./pages/pos/_estacion.js'); if (m && typeof m.pararDesdeApp === 'function') m.pararDesdeApp(); } catch { /* nada */ }
  }
}
async function comandasSinImprimir() {
  let m = null; try { m = await import('./pages/pos/_estacion.js'); } catch { m = null; }
  const r = m && m.estadoEstacion && m.estadoEstacion.resumen;
  if (r && r.hora && Date.now() - r.hora < 45000) return +r.comanda_espera_s > 0 ? 0 : (+r.comandas_pendientes || 0);   // la estación ya lo pidió hace poco: no se pide dos veces; todas esperando su hora: 0
  const j = await api('/api/pedidos/resumen', { sinExpirar: true });
  return j && +j.comanda_espera_s > 0 ? 0 : (+(j && j.comandas_pendientes) || 0);
}
async function franjaTick() {
  const eid = sesion.empresa_id, info = sesion.empresaInfo;
  if (!sesion.activa || !eid || !info) { store.franja = null; return; }
  const f = { esperando: '', pausa: '', sinVer: '', comandas: '' };
  if (conFranjaSinc(info)) {
    let r = null; try { r = await api('/api/sinc/datos/franja', { sinExpirar: true }); } catch { r = null; }   // 404 o sin red: se esconde en silencio
    if (sesion.empresa_id !== eid) return;
    if (r && typeof r === 'object') {
      f.esperando = textoEsperando(r.cambios, r.ventas);
      if (r.pausa) f.pausa = TEXTO_PAUSA_FRANJA;
      f.sinVer = textoNoQuedaron(r.sin_ver);
    }
  }
  if (conEstacionPrograma(info) && !enCajaOCocina()) {
    let n = 0; try { n = await comandasSinImprimir(); } catch { n = 0; }
    if (sesion.empresa_id !== eid) return;
    f.comandas = textoComandas(n);
    if (n > _comandasPrev) sonarFranja();                      // una vez por subida, no cada 30 s
    _comandasPrev = n;
  }
  store.franja = (f.esperando || f.pausa || f.sinVer || f.comandas) ? f : null;
  ajustarEstacion();
}
function vigilarFranja() {
  ajustarEstacion();
  const info = sesion.activa && sesion.empresa_id && sesion.empresaInfo;
  if (!info || !(conFranjaSinc(info) || conEstacionPrograma(info))) { if (_franja) { clearInterval(_franja); _franja = null; } store.franja = null; return; }
  if (!_franja) _franja = setInterval(franjaTick, FRANJA_MS);
  franjaTick();
}
export function pararFranja() {
  if (_franja) { clearInterval(_franja); _franja = null; }
  store.franja = null; _comandasPrev = 0;
  ajustarEstacion(true);
}

let _precargando = false;
async function precargarPrograma() {
  if (_precargando || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  _precargando = true;
  try {
    await new Promise(r => setTimeout(r, 4000));                       // que primero termine de abrir la pantalla de entrada
    const j = await fetch('/app-archivos.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (!j || !Array.isArray(j.archivos)) return;
    let hecho = null; try { hecho = localStorage.getItem('precarga:programa'); } catch {}
    if (hecho === j.huella) return;
    for (const u of j.archivos) {
      if (!navigator.onLine) return;
      await fetch(u, { priority: 'low' }).catch(() => null);          // el service worker lo guarda (o lo da de lo ya guardado al instante)
      await new Promise(r => setTimeout(r, 40));
    }
    try { localStorage.setItem('precarga:programa', j.huella); } catch {}
  } finally { _precargando = false; }
}

const pageCache = {};
function pageComponent(mod) {
  if (!pageCache[mod]) pageCache[mod] = defineAsyncComponent({
    loader: () => import(`./pages/${mod}.js`).then(m => m.default),
    errorComponent: { template: `<div class="page"><div class="card"><h2>No se pudo cargar la página</h2><p class="muted">Revise su conexión a internet e intente de nuevo. Si el problema sigue, actualice la página completa (Ctrl+F5).</p><button class="btn" onclick="location.reload()">Reintentar</button></div></div>` },   // (R264)
  });
  return pageCache[mod];
}

// ---- sesión (usuario autenticado + empresa activa) ----
export const sesion = reactive({
  usuario: null, empresas: [], empresa_id: null, rol: null, permisos: [], listo: false,
  rrhhRequiereMfa: false,   // 4.7: el rol trae Recursos humanos pero falta la verificación en dos pasos (el menú lo muestra con candado)
  sinCaja: null,   // 3.87: rol de solo caja sin el punto de venta: el motivo que manda el servidor (tipo, plan, empresa o usuario); lo explica la pantalla SinCaja
  get activa() { return !!this.usuario; },
  get esAdmin() { return !!this.usuario?.es_superadmin; },
  get empresaInfo() { return this.empresas.find(e => e.id === this.empresa_id) || null; },
  get pruebaVencida() { return !!this.empresaInfo?.prueba_vencida && !this.esAdmin; },   // prueba gratis terminada (1.37)
  tieneModulo(m) { if (m === 'tike' && this.empresaInfo?.es_local) return false; const p = this.empresaInfo?.plan;   // 4.14: TiKe corre solo en la nube
    return !p || !Array.isArray(p.modulos) || p.modulos.includes(m); },   // planes (3.16)
  tieneFuncion(f) { const p = this.empresaInfo?.plan; return !!(p && Array.isArray(p.funciones) && p.funciones.includes(f)); },   // funciones en prueba por empresa (3.58)
  // 3.66: sucursales de la empresa activa (vacío = la empresa no las usa); la fija del usuario manda; si no, la elegida en esta computadora
  sucursales: [], sucursal_fija: null, sucursal_fija_codigo: null, sucursal_id: null,
  aplicarSucursales(r) {
    this.sucursales = r.sucursales || []; this.sucursal_fija = r.sucursal_fija || null; this.sucursal_fija_codigo = r.sucursal_fija_codigo || null;   // 4.34: '002' (Ventas de caja)
    let id = this.sucursal_fija; if (!id) { try { id = +localStorage.getItem('sucursal:' + this.empresa_id) || null; } catch { id = null; } }
    if (id && !this.sucursales.some(x => x.id === id)) id = null;
    this.sucursal_id = id; fijarSucursal(id);
  },
  get sucursalActual() { return this.sucursales.find(x => x.id === this.sucursal_id) || null; },
  get marcaSucursal() { const x = this.sucursalActual || this.sucursales.find(s => s.principal); return x?.marca_id || null; },   // 3.82
  cambiarSucursal(id) { if (this.sucursal_fija) return; try { if (id) localStorage.setItem('sucursal:' + this.empresa_id, String(id)); else localStorage.removeItem('sucursal:' + this.empresa_id); } catch {} this.sucursal_id = id || null; fijarSucursal(this.sucursal_id); toast(id ? 'Sucursal: ' + (this.sucursalActual ? this.sucursalActual.nombre : id) : 'Todas las sucursales', 'ok'); setTimeout(() => location.reload(), 400); },
  get electronica() { return this.empresaInfo?.factura_electronica !== false; },   // 3.61: apagado = comprobantes internos sin Hacienda
  get tipo() { const t = this.empresaInfo?.tipo_negocio; return TIPOS_NEGOCIO[t] ? t : 'facturacion'; },   // tipo de negocio de la empresa activa (2.5)
  // Permisos que el servidor concede al rol en la empresa activa (ver, facturar, catalogos, inventario, documentos, configurar, usuarios)
  // 3.87: con empresa elegida manda la lista del servidor también para el administrador del sistema (ya viene sin lo que el plan no
  // trae: contabilidad, rrhh, reportes, pos, tike); antes daba todo y, p. ej., intentaba guardar el catálogo contable sin Contabilidad
  puede(p) { if (this.esAdmin && !(this.empresa_id && this.permisos.length)) return true; return this.permisos.includes(p); },
  // Rol Cajero (o personalizado con solo 'pos'): entra directo a la caja y no ve el resto del sistema (solo donde hay punto de venta)
  get modoCajero() { return this.tipo !== 'facturacion' && !this.esAdmin && this.puede('pos') && this.permisos.every(p => p === 'ver' || p === 'pos'); },
  // Pantalla de entrada según el rol (3.20): quien ve reportes entra al Resumen; recepción, reservas, ama de llaves, mantenimiento
  // y seguridad entran a su tablero; el cajero a la caja
  get inicio() {
    if (!this.empresa_id) return this.esAdmin ? '/admin' : '/inicio';   // 3.87: sin empresa, el logo y «Mi espacio» llevan a la consola
    if (this.sinCaja) return '/inicio';   // 3.87: rol de solo caja sin el punto de venta: su pantalla propia (SinCaja)
    if (this.modoCajero) return '/pos/caja';
    if (this.esAdmin || this.puede('reportes') || this.puede('ver_todo')) return '/inicio';
    if (this.tipo === 'hospitalidad') {
      if (this.puede('pos') || this.puede('facturar')) return '/hotel/recepcion';
      if (this.puede('escribir') || this.puede('cobros')) return '/hotel/reservaciones';
      if (this.puede('limpieza')) return '/hotel/ama-de-llaves/tablero';
      if (this.puede('mantenimiento')) return '/hotel/mantenimiento/incidencias';
      if (this.puede('seguridad') && this.tieneModulo('hotel_completo')) return '/hotel/seguridad';   // 3.87: sin Hotel completo caía en «No incluido en su plan» sin salida
    }
    if ((this.tipo === 'comercio' || this.tipo === 'restaurante') && this.puede('pos')) return '/pos/caja';   // 3.87: también en restaurante
    // 3.87: sin resumen ni ventas que mirar, a la pantalla de su trabajo (técnico de soporte a TiKe, un rol solo de planillas a RRHH)
    if (!this.puede('facturar') && !this.puede('cobros')) { const r = ['/tike/tablero', '/rrhh/empleados'].find(x => rutaPermitidaDe(this, x)); if (r) return r; }
    if (!this.puede('facturar') && !this.puede('cobros')) {
      const medica = ['/medica/agenda', '/medica/clinica', '/medica/ordenes', '/medica/gestion'].find(x => rutaPermitidaDe(this, x));
      if (medica) return medica;
    }
    return '/inicio';
  },
  async iniciar(r) {                // respuesta de /api/auth/login|setup|empresa|mfa/verificar
    if (mock.cargado) {
      // lo pendiente sale con la sesión anterior (también lo que se cambie mientras se guarda) y se descarga ANTES de cambiar
      // el token: así nada de la empresa anterior puede salir después con la sesión nueva
      try { for (let i = 0; i < 3 && mock.pendientes; i++) await mock.guardarTodo(); } catch {}
      await mock.descargar(false);
    }
    setToken(r.token); this.usuario = r.usuario; this.empresas = r.empresas || []; this.empresa_id = r.empresa_id; this.rol = r.rol; this.permisos = r.permisos || []; this.rrhhRequiereMfa = !!r.rrhh_requiere_mfa; demo.activo = !!r.datos_ejemplo;
    fijarEmpresaTab(this.empresa_id); avisoSesion.mensaje = '';
    this.aplicarSucursales(r);   // 3.66
    this.sinCaja = r.sin_caja || null;   // 3.87: con caja apagada no se pide nada de la empresa (todo daría 403 sin_caja)
    if (this.empresa_id && !this.usuario?.debe_cambiar_password && !this.usuario?.terminos_pendientes && !this.pruebaVencida) store.cargar(true);   // sin términos aceptados todo responde 403
    if (!this.empresa_id) location.hash = this.esAdmin ? '/admin' : '/elegir-empresa';
    else if (!location.hash || location.hash === '#/' || location.hash === '#/inicio' || location.hash.startsWith('#/admin') || location.hash.startsWith('#/elegir')) location.hash = this.inicio;
    else if (!rutaPermitida((location.hash.slice(1) || '/inicio').split('?')[0])) location.hash = this.inicio;   // la ruta actual no existe para el rol de esta empresa
  },
  get mfaPendiente() { return !!this.usuario && this.usuario.mfa_obligatorio && !this.usuario.mfa_activo; },
  get rrhhConCandado() { return rrhhConCandadoDe(this); },   // 4.7: Recursos humanos con candado (menú, Inicio, Sin acceso y Mi perfil)
  // 4.7: vuelve a leer la sesión del servidor después de activar o quitar la verificación en dos pasos en Mi perfil, para que Recursos
  // humanos aparezca (o se vaya) del menú sin recargar. Si se gana el permiso, la pantalla abierta no se desmonta (los códigos de respaldo
  // siguen a la vista) y los registros de RRHH se traen ya (mock.refrescar; también lo haría la próxima pantalla). Si se pierde, se entra
  // de nuevo a la empresa (iniciar) para que esos datos no queden en la pestaña. Si otra pestaña cambió la sesión, no se toca nada aquí.
  async refrescarPermisos() {
    const tenia = this.puede('rrhh'), r = await api('/api/auth/yo');
    if (!r || !r.usuario) return null;
    if (r.empresa_id !== this.empresa_id || r.usuario.id !== this.usuario?.id) return r;
    this.usuario = r.usuario; this.rol = r.rol; this.permisos = r.permisos || []; this.rrhhRequiereMfa = !!r.rrhh_requiere_mfa;
    limpiarTablasRRHH();
    if (tenia && !this.puede('rrhh')) await this.iniciar(r);
    else if (!tenia && this.puede('rrhh') && mock.cargado) await mock.refrescar();
    return r;
  },
  // 9c (J8, J10): vuelve a pedir la sesión (la misma consulta de refrescarPermisos) para que la lista de empresas y la información de la
  // empresa abierta (empresaInfo: la franja de «revocada») queden al día sin recargar. No cambia la empresa ni la pantalla; si otra
  // pestaña cambió la sesión, no toca nada. Un 401 lo atiende quien llama (no cierra la sesión por su cuenta).
  async refrescarEmpresas() {
    let r = null;
    try { r = await api('/api/auth/yo', { sinExpirar: true }); } catch { return null; }
    if (!r || !r.usuario || r.usuario.id !== this.usuario?.id || r.empresa_id !== this.empresa_id) return null;
    if (Array.isArray(r.empresas) && JSON.stringify(r.empresas) !== JSON.stringify(this.empresas)) this.empresas = r.empresas;   // validación 4.32: igual = no se toca (se llama cada minuto en el programa)
    return r;
  },
  async cerrar(enServidor = true) {
    // Cierre voluntario: primero se guarda lo pendiente (con la sesión aún válida). Sesión vencida: no se puede guardar.
    if (enServidor && token()) { await mock.descargar(); await cerrarSesionServidor(); } else await mock.descargar(false);
    pararFranja(); setToken(''); fijarEmpresaTab(null); this.usuario = null; this.empresas = []; this.empresa_id = null; this.rol = null; this.permisos = []; this.sinCaja = null; this.rrhhRequiereMfa = false; store.empresa = null; store.clientes = []; store.productos = []; store.listo = false; location.hash = '/inicio';
  },
  async restaurar() {
    if (token()) { try { const a = await api('/api/arranque'); const r = a.yo;   /* 3.73: sesión + empresa + ítems + registros en una sola ida */ this.usuario = r.usuario; this.empresas = r.empresas; this.empresa_id = r.empresa_id; this.rol = r.rol; this.permisos = r.permisos || []; this.rrhhRequiereMfa = !!r.rrhh_requiere_mfa; demo.activo = !!r.datos_ejemplo; fijarEmpresaTab(this.empresa_id); this.aplicarSucursales(r); this.sinCaja = r.sin_caja || null; if (this.empresa_id && !this.usuario?.debe_cambiar_password && !this.usuario?.terminos_pendientes && !this.pruebaVencida) await store.cargar(true, a); } catch (e) { if (e.status === 401 || e.status === 403) setToken(''); else toast('No se pudo conectar con el servidor. Recargue la página en un momento.', 'err'); } }
    // el cajero entra directo a la caja (también al recargar la página en otra ruta); cada rol a su pantalla de entrada (3.20)
    if (this.activa && this.empresa_id && this.modoCajero && !rutaPermitida((location.hash.slice(1) || '/inicio').split('?')[0])) location.hash = '/pos/caja';
    else if (this.activa && this.empresa_id && (location.hash.slice(1) || '/inicio').split('?')[0] === '/inicio' && this.inicio !== '/inicio') location.hash = this.inicio;
    this.listo = true;
  },
  async cambiarEmpresa(id) {
    try { if (mock.cargado) await mock.guardarTodo(); await this.iniciar(await api('/api/auth/empresa', { method: 'POST', body: { empresa_id: id } })); limpiarTablasRRHH(); toast('Empresa cambiada', 'ok'); }
    catch (e) { toast(e.message, 'err'); }
  },
});
onExpirar(() => { if (sesion.activa) { toast('Su sesión expiró; inicie sesión de nuevo', 'err'); sesion.cerrar(false); } });
// Otra pestaña cambió la sesión (empresa, usuario o cierre): esta pestaña se bloquea hasta recargar, para no registrar nada
// en la empresa equivocada. El servidor además rechaza (409) cualquier petición con la empresa vieja.
try {
  window.addEventListener('storage', e => {
    if (e.key !== TOKEN_KEY || !sesion.activa) return;
    const n = datosToken(e.newValue);
    if (!n) { avisoSesion.mensaje = 'La sesión se cerró en otra pestaña.'; return; }
    if (n.uid !== sesion.usuario?.id) avisoSesion.mensaje = 'En otra pestaña se inició sesión con otro usuario.';
    else if (!sesion.empresa_id) return;                // pestaña sin empresa (panel de administración): no hay nada que proteger
    else if ((n.eid || null) !== (sesion.empresa_id || null)) {
      const emp = sesion.empresas.find(x => x.id === n.eid);
      avisoSesion.mensaje = 'En otra pestaña se cambió a ' + (emp ? 'la empresa ' + (emp.nombre_comercial || emp.nombre) : 'otra empresa') + '.';
    }
  });
} catch {}

// ---- estado global de la empresa activa ----
export const store = reactive({
  sistema: { nombre: 'FISITAAP by Brillante Agencia', eslogan: '', dominio: 'fisitaap.com', correo_ventas: 'ventas@fisitaap.com' },   // nombre del sistema en un solo lugar (3.51): /api/sistema
  empresa: null, clientes: [], productos: [], tc: null, listo: false, fallos: { clientes: false, productos: false },
  // completo=true al entrar o cambiar de empresa: guarda lo pendiente, descarta la caché y carga todo de nuevo.
  // Sin completo (después de guardar un contacto, un ítem o la empresa): solo recarga empresa, contactos e ítems; los
  // registros se refrescan al cambiar de pantalla.
  // Un contacto o ítem recién guardado se coloca en la lista sin volver a descargar toda la empresa (R263)
  poner(lista, obj) { if (!obj || !obj.id) return; const l = this[lista]; const i = l.findIndex(x => x.id === obj.id); if (i >= 0) l.splice(i, 1, { ...l[i], ...obj }); else l.push(obj); },
  quitar(lista, id, desactivar = false) { const l = this[lista]; const i = l.findIndex(x => x.id === id); if (i < 0) return; if (desactivar) l.splice(i, 1, { ...l[i], activo: false }); else l.splice(i, 1); },
  async cargar(completo = false, pre = null) {   // pre: respuesta de /api/arranque ya recibida (3.73)
    if (!token()) return;
    // Solo una carga completa (entrar, restaurar, cambiar de empresa) desmonta la pantalla y descarta la caché. Si empieza
    // otra completa mientras tanto (dos cambios de empresa seguidos), lo que llegue de esta se descarta.
    const n = completo ? (this._n = (this._n || 0) + 1) : (this._n || 0), vigente = () => n === (this._n || 0);
    // carga completa: nada de la empresa anterior queda a la vista (si falla una consulta, la lista queda vacía y la página
    // que la necesita la vuelve a pedir; antes quedaban los contactos e ítems de la otra empresa con ids que aquí son otros)
    if (completo) { this.listo = false; pararFranja(); await mock.descargar(); this.empresa = null; this.clientes = []; this.productos = []; this.tc = null; this.datosNuevos = false; pantalla.sinDatos = false; }
    if (sesion.sinCaja) { if (vigente()) this.listo = true; return; }   // 3.87: rol de solo caja sin el punto de venta: nada que pedir (antes 7 respuestas 403 y dos avisos rojos)
    // 3.73: carga completa en UNA ida (/api/arranque: empresa, clientes, ítems, registros y tipo de cambio); si no viene completa, el camino de siempre
    let a = pre && pre.empresa ? pre : null;
    if (completo && !a) { try { const x = await api('/api/arranque'); if (x && x.empresa && vigente()) a = x; } catch { a = null; } }
    const r = a ? [{ status: 'fulfilled', value: a.empresa }, { status: 'fulfilled', value: a.clientes }, { status: 'fulfilled', value: a.productos }]
      : await Promise.allSettled([api('/api/empresa'), api('/api/clientes'), api('/api/productos')]);
    if (vigente()) {
      if (r[0].status === 'fulfilled') this.empresa = r[0].value;
      if (r[1].status === 'fulfilled') this.clientes = r[1].value;
      if (r[2].status === 'fulfilled') this.productos = r[2].value;
      // listas que no cargaron: la página que las necesita vuelve a pedir la carga al abrirse (store.fallos)
      this.fallos = { clientes: r[1].status === 'rejected', productos: r[2].status === 'rejected' };
      const err = r.find(x => x.status === 'rejected');
      if (err?.reason?.detail?.codigo === 'sin_caja') sesion.sinCaja = true;   // 3.87: le apagaron la caja con la sesión abierta: su pantalla propia en lugar del aviso rojo
      else if (err && !/Seleccione una empresa/.test(err.reason?.message || '')) toast('No se pudo cargar: ' + (err.reason?.message || err.reason), 'err');
    }
    if (!vigente()) return;
    if (sesion.sinCaja) { this.listo = true; return; }
    // Registros de la empresa (cotizaciones, compras, bancos, contabilidad…): antes de mostrar cualquier página.
    // Sin completo no se tocan si ya están (la pantalla abierta conserva su base); si faltan (falló la carga), se reintentan
    // sin desmontar la pantalla (antes una página que llama a store.cargar al abrir entraba en un ciclo sin fin).
    if (completo) {
      try { await mock.cargar(a ? a.registros : null); }
      catch (e) { if (vigente()) this.avisarFallo(e); }
      if (vigente()) pantalla.sinDatos = !mock.cargado;            // la pantalla que se monte ahora no tiene los registros
    } else if (!mock.cargado) await Promise.race([this.reintentarRegistros(), new Promise(r => setTimeout(r, 4000))]);   // sin colgar el guardado
    if (!vigente()) return;
    if (completo || !this.tc) await this.tipoCambio(vigente, a ? a.tipo_cambio : null);
    if (vigente()) { this.listo = true; precargarPrograma(); vigilarAvisoLocal(); vigilarFranja(); }
  },
  // Tipo de cambio del día (BCCR + margen): alimenta la moneda USD de los documentos. Se aplica siempre en memoria; se guarda
  // solo si los registros están cargados y el rol puede configurar.
  async tipoCambio(vigente = () => true, t = null) {   // t: el que ya trajo /api/arranque (3.73)
    try { t = t || await api('/api/tipo-cambio'); if (vigente()) { this.tc = t; monedas.fijarVentaBCCR(t.venta); if (t.aplicado) monedas.actualizarUSD(t.aplicado, sesion.puede('configurar') && mock.cargado && !pantalla.sinDatos); } } catch {}
  },
  // Registros que no cargaron al entrar: se reintenta (una sola descarga a la vez). Si se logra, la pantalla se vuelve a
  // montar (recargas cambia su clave) para que no siga con la copia vacía que leyó sin datos.
  recargas: 0, datosNuevos: false, avisoLocal: null, franja: null,
  async reintentarRegistros() {
    if (mock.cargado || !token() || !sesion.empresa_id || sesion.sinCaja) return;   // 3.87: sin caja no hay registros que pedir
    const eid = sesion.empresa_id, p = mock.cargar(), g = mock.generacion;
    const vigente = () => mock.generacion === g && sesion.empresa_id === eid;   // un reintento viejo no toca otra empresa
    try {
      await p;
      if (!vigente() || !mock.cargado) return;
      if (pantalla.sinDatos) this.datosNuevos = true;                 // la pantalla abierta no tiene los datos: botón para actualizarla
      await this.tipoCambio(vigente);
    } catch (e) { if (vigente()) this.avisarFallo(e); }
  },
  actualizarPantalla() { pantalla.sinDatos = false; this.datosNuevos = false; mock.nuevaPantalla(); this.recargas++; },
  avisarFallo(e) {
    if (e?.detail?.codigo === 'sin_caja') { sesion.sinCaja = sesion.sinCaja || true; return; }   // 3.87: lo explica su pantalla (antes, un segundo aviso rojo igual al primero)
    const ahora = Date.now();
    if (this._aviso && ahora - this._aviso < 15000) return;          // un aviso cada 15 s como máximo
    this._aviso = ahora;
    toast('No se pudieron cargar los datos de la empresa: ' + e.message + '. Lo que haga no se guardará; se intentará de nuevo al cambiar de pantalla.', 'err');
  },
});

const Login = defineAsyncComponent(() => import('./pages/login.js').then(m => m.default));
// 4.25 (tanda 7): #/conectar (aprobar una computadora nueva del programa local). No es una ruta del menú sino una pantalla de nivel
// superior, como el selector de empresa: el código del enlace (#/conectar?c=XXXX-XXXX, después del #: nunca llega al servidor) se guarda
// por pestaña en sessionStorage, así sobrevive al ingreso, a los dos pasos, a la contraseña temporal, a los términos, a la recarga y a
// los cambios de dirección que hace sesion.iniciar(). La pantalla no decide permisos: los decide el servidor al consultar y aprobar.
const Conectar = defineAsyncComponent(() => import('./pages/conectar.js').then(m => m.default));
export const conexion = reactive({
  activa: false, codigo: '',
  tomar() {
    const m = (location.hash || '').match(/^#\/conectar\/?(?:\?(.*))?$/);
    if (m) {
      let c = ''; try { c = new URLSearchParams(m[1] || '').get('c') || ''; } catch { c = ''; }
      this.fijar(c);
      return;
    }
    let v = null; try { v = sessionStorage.getItem('conectar'); } catch { v = null; }
    if (v) { this.activa = true; this.codigo = v === '1' ? '' : v; }
  },
  fijar(c) {      // el código escrito o del enlace (solo letras, números y guion); vacío = marca de «se abrió #/conectar sin código»
    c = String(c || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
    this.activa = true; this.codigo = c;
    try { sessionStorage.setItem('conectar', c || '1'); } catch {}
  },
  limpiar() { this.activa = false; this.codigo = ''; try { sessionStorage.removeItem('conectar'); sessionStorage.removeItem('conectar:pase'); } catch {} },
  // 4.25 (7b, T2): después de aprobar se guarda en la pestaña SOLO el identificador del pase (nunca el número): al recargar, la pantalla
  // vuelve al seguimiento con su «Cancelar». Vacío = se borra.
  leerPase() { let v = ''; try { v = sessionStorage.getItem('conectar:pase') || ''; } catch { v = ''; } return /^[0-9]{1,12}$/.test(v) ? Number(v) : null; },
  fijarPase(id) { try { const n = parseInt(id, 10); if (n > 0) sessionStorage.setItem('conectar:pase', String(n)); else sessionStorage.removeItem('conectar:pase'); } catch {} },
});
conexion.tomar();
// Contraseña temporal asignada por el administrador: pantalla obligatoria antes de entrar (R123)
const CambiarPassword = {
  data() { return { actual: '', nueva: '', repetir: '', guardando: false }; },
  methods: {
    async guardar() {
      if (!this.actual || !this.nueva) return toast('Indique la contraseña temporal y la nueva', 'err');
      if (this.nueva !== this.repetir) return toast('La nueva contraseña y su repetición no coinciden', 'err');
      this.guardando = true;
      try { await api('/api/auth/password', { method: 'POST', body: { actual: this.actual, nueva: this.nueva } }); if (sesion.usuario) sesion.usuario.debe_cambiar_password = false; toast('Contraseña actualizada', 'ok'); await sesion.restaurar(); }
      catch (e) { toast(e.message, 'err'); }
      this.guardando = false;
    },
  },
  setup() { return { sesion }; },
  template: `
  <div class="login-wrap"><div class="login-card">
    <h1 style="font-size:20px;margin:0 0 4px">Cambie su contraseña temporal</h1>
    <p class="muted small" style="margin:0 0 18px">La contraseña que le entregó el administrador es temporal. Elija una nueva antes de continuar.</p>
    <div class="grid" style="grid-template-columns:1fr;gap:12px">
      <Field label="Contraseña temporal"><input type="password" v-model="actual" autocomplete="current-password"></Field>
      <Field label="Contraseña nueva"><input type="password" v-model="nueva" autocomplete="new-password"></Field>
      <Field label="Repita la contraseña nueva"><input type="password" v-model="repetir" autocomplete="new-password" @keyup.enter="guardar"></Field>
    </div>
    <button class="btn" style="width:100%;justify-content:center;margin-top:18px;padding:11px" @click="guardar" :disabled="guardando">{{guardando?'Guardando…':'Guardar y continuar'}}</button>
    <button class="btn ghost" style="width:100%;justify-content:center;margin-top:8px" @click="sesion.cerrar()">Cerrar sesión</button>
  </div></div>`,
};
// Prueba gratis vencida: no se carga nada de la empresa; se ofrece contacto, cambiar a otra empresa o salir (1.37)
const PruebaVencida = {
  computed: {
    fin() { const v = String(sesion.empresaInfo?.prueba_hasta || ''); return v ? v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4) : ''; },
    otras() { return sesion.empresas.filter(e => e.id !== sesion.empresa_id && !e.prueba_vencida && !e.bloqueada); },
  },
  methods: { cambiar(id) { sesion.cambiarEmpresa(id); }, salir() { sesion.cerrar(); } },
  template: `<div class="login-wrap"><div class="login-card" style="max-width:520px">
    <h1 style="font-size:20px;margin:0 0 6px">Su prueba gratis terminó</h1>
    <p class="muted" style="margin:0 0 14px">La prueba de <b>{{sesion.empresaInfo?.nombre_comercial || sesion.empresaInfo?.nombre}}</b> venció el {{fin}}. Sus datos se conservan: escríbanos para activar su plan y seguir donde quedó.</p>
    <a class="btn" style="width:100%;justify-content:center;padding:11px;background:#16a34a;border-color:#16a34a" href="https://wa.me/50662281597?text=Hola%2C%20quiero%20activar%20mi%20plan%20de%20Grupo%20Factura" target="_blank" rel="noopener">Escribir por WhatsApp (6228 1597)</a>
    <p class="small muted" style="text-align:center;margin:10px 0">o a <a :href="'mailto:' + sistemaCfg().correo_ventas">{{sistemaCfg().correo_ventas}}</a></p>
    <div v-if="otras.length" style="margin-top:12px"><div class="small muted" style="margin-bottom:6px">Entrar a otra empresa:</div>
      <button v-for="e in otras" :key="e.id" class="btn sec" style="width:100%;justify-content:center;margin-bottom:6px" @click="cambiar(e.id)">{{e.nombre_comercial || e.nombre}}</button></div>
    <button class="btn ghost" style="width:100%;justify-content:center;margin-top:8px" @click="salir">Cerrar sesión</button>
  </div></div>`,
  setup() { return { sesion }; },
};
// Primera vez de cada usuario: elige los colores de su interfaz (se cambian después en Mi perfil) (1.35)
export const SelectorPaleta = {
  props: { modelValue: String },
  emits: ['update:modelValue'],
  data() { return { PALETAS }; },
  template: `<div class="paletas"><button v-for="p in PALETAS" :key="p.id" type="button" class="paleta" :class="{on: (modelValue || 'fusion') === p.id}" @click="$emit('update:modelValue', p.id)">
    <div class="muestras"><i v-for="c in p.colores" :key="c" :style="{background: c}"></i></div><b>{{p.nombre}}</b><div class="small muted">{{p.desc}}</div></button></div>`,
};
const ElegirPaleta = {
  components: { SelectorPaleta },
  data() { return { paleta: 'fusion', guardando: false }; },
  watch: { paleta(v) { aplicarPaleta(v); } },
  methods: {
    async guardar() {
      this.guardando = true;
      try { await api('/api/auth/paleta', { method: 'POST', body: { paleta: this.paleta } }); if (sesion.usuario) sesion.usuario.paleta = this.paleta; }
      catch (e) { toast(e.message, 'err'); }
      this.guardando = false;
    },
  },
  template: `<div class="login-wrap"><div class="login-card" style="max-width:620px">
    <h1 style="font-size:20px;margin:0 0 4px">Elija el diseño de su sistema</h1>
    <p class="muted small" style="margin:0 0 16px">Toque una opción para verla aplicada. Puede cambiarla cuando quiera en Mi perfil.</p>
    <SelectorPaleta v-model="paleta"></SelectorPaleta>
    <button class="btn" style="width:100%;justify-content:center;margin-top:18px;padding:11px" @click="guardar" :disabled="guardando">{{guardando ? 'Guardando…' : 'Continuar'}}</button>
  </div></div>`,
};
// Términos del servicio y consentimiento para recibir la factura del servicio por medios electrónicos (Ley 10946)
const AceptarTerminos = {
  data() { return { acepta: false, factura: true, guardando: false }; },
  methods: {
    async aceptar() {
      if (!this.acepta) return toast('Marque que acepta los términos del servicio para continuar', 'err');
      this.guardando = true;
      try { await api('/api/auth/terminos', { method: 'POST', body: { acepta: true, consiente_factura: this.factura } }); if (sesion.usuario) sesion.usuario.terminos_pendientes = false; toast('Gracias. Bienvenido.', 'ok'); await sesion.restaurar(); }
      catch (e) { toast(e.message, 'err'); }
      this.guardando = false;
    },
  },
  setup() { return { sesion }; },
  template: `
  <div class="login-wrap"><div class="login-card" style="max-width:520px">
    <h1 style="font-size:20px;margin:0 0 4px">Términos del servicio</h1>
    <p class="muted small" style="margin:0 0 14px">Antes de continuar, lea y acepte los <a href="/terminos.html" target="_blank" rel="noopener">términos del servicio y la política de privacidad</a> de FISITAAP by Brillante Agencia (se abren en otra pestaña).</p>
    <label class="row" style="gap:10px;align-items:flex-start;margin-bottom:10px;cursor:pointer"><input type="checkbox" v-model="acepta" style="margin-top:4px"><span>He leído y acepto los términos del servicio y la política de privacidad.</span></label>
    <label class="row" style="gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" v-model="factura" style="margin-top:4px"><span class="small">Acepto recibir las facturas electrónicas del servicio por correo electrónico y enlace de consulta, en la dirección registrada de mi empresa (consentimiento según la Ley 10946; puede retirarse en cualquier momento).</span></label>
    <button class="btn" style="width:100%;justify-content:center;margin-top:18px;padding:11px" @click="aceptar" :disabled="guardando || !acepta">{{guardando?'Guardando…':'Aceptar y continuar'}}</button>
    <button class="btn ghost" style="width:100%;justify-content:center;margin-top:8px" @click="sesion.cerrar()">Cerrar sesión</button>
  </div></div>`,
};
const ElegirEmpresa = {
  template: `
  <div class="login-wrap"><div class="login-card">
    <h1 style="font-size:20px;margin:0 0 4px">{{(sesion.empresas || []).length ? 'Elija la empresa' : 'Sin empresas asignadas'}}</h1><p class="muted small" style="margin:0 0 16px">{{(sesion.empresas || []).length > 1 ? 'Su usuario tiene acceso a varias empresas.' : (sesion.empresas || []).length ? 'Toque la empresa para entrar.' : 'Su usuario ya no tiene acceso a ninguna empresa. Pida al administrador de su empresa que lo autorice de nuevo o contacte al administrador del sistema.'}}</p>
    <button v-for="e in sesion.empresas" :key="e.id" class="btn sec" style="width:100%;justify-content:space-between;margin-bottom:8px" @click="sesion.cambiarEmpresa(e.id)" :disabled="e.bloqueada"><span>{{e.nombre_comercial||e.nombre}}</span><span class="muted small">{{e.bloqueada?'Bloqueada':e.rol}}</span></button>
    <a v-if="sesion.esAdmin" class="btn" style="width:100%;justify-content:center;margin-top:8px" href="#/admin">Panel de administración</a>
    <button class="btn ghost" style="width:100%;justify-content:center;margin-top:8px" @click="sesion.cerrar()">Cerrar sesión</button>
  </div></div>`,
  setup() { return { sesion }; },
};

// 3.87: rol de solo caja (Cajero o propio con solo 'pos') donde el punto de venta no está activo: el servidor le responde 403 sin_caja en
// todo. Antes entraba a un Inicio con dos avisos rojos y un menú de pantallas que fallaban; ahora una sola pantalla dice qué pasa y qué
// hacer, sin pedir nada de la empresa. El motivo (tipo, plan, empresa, usuario) lo manda el servidor en la sesión (sin_caja).
const SinCaja = {
  computed: {
    empresa() { const e = sesion.empresaInfo; return e ? (e.nombre_comercial || e.nombre) : 'esta empresa'; },
    motivo() {
      return { tipo: 'la versión ' + (TIPOS_NEGOCIO[sesion.tipo] || '') + ' de la empresa no tiene punto de venta', plan: 'el plan de la empresa no incluye el punto de venta',
        empresa: 'el punto de venta está apagado para toda la empresa', usuario: 'el punto de venta está apagado para su usuario' }[sesion.sinCaja] || 'el punto de venta no está activo para usted';
    },
    queHacer() {
      const otro = 'Pídale al administrador de la empresa que le asigne otro rol en Configuración › Usuarios';
      return otro + ({ tipo: '.', plan: ' o que agregue el punto de venta al plan de la empresa.', empresa: ' o que vuelva a encender el punto de venta para la empresa.',
        usuario: ' o que le encienda el punto de venta a su usuario.' }[sesion.sinCaja] || ' o que active el punto de venta para usted.');
    },
    otras() { return sesion.empresas.filter(e => e.id !== sesion.empresa_id && !e.bloqueada); },
  },
  methods: { cambiar(id) { sesion.cambiarEmpresa(id); }, comprobar() { location.reload(); }, salir() { sesion.cerrar(); } },
  template: `<div class="login-wrap"><div class="login-card" style="max-width:540px">
    <h1 style="font-size:20px;margin:0 0 6px">Su rol solo usa el punto de venta</h1>
    <p class="muted" style="margin:0 0 12px">En <b>{{empresa}}</b> su usuario tiene el rol <b>{{sesion.rol || 'Cajero'}}</b> y {{motivo}}. Por eso no hay pantallas que pueda abrir en esta empresa.</p>
    <div class="alert warn" style="margin:0 0 14px"><b>Qué hacer:</b> {{queHacer}} Cuando lo haga, toque «Comprobar de nuevo».</div>
    <button class="btn" style="width:100%;justify-content:center;padding:11px" @click="comprobar">Comprobar de nuevo</button>
    <div v-if="otras.length" style="margin-top:12px"><div class="small muted" style="margin-bottom:6px">Entrar a otra empresa:</div>
      <button v-for="e in otras" :key="e.id" class="btn sec" style="width:100%;justify-content:space-between;margin-bottom:6px" @click="cambiar(e.id)"><span>{{e.nombre_comercial || e.nombre}}</span><span class="muted small">{{e.rol}}</span></button></div>
    <a class="btn ghost" style="width:100%;justify-content:center;margin-top:8px" href="#/configuracion/perfil">Mi perfil y contraseña</a>
    <button class="btn ghost" style="width:100%;justify-content:center;margin-top:8px" @click="salir">Cerrar sesión</button>
  </div></div>`,
  setup() { return { sesion }; },
};

// Pantalla obligatoria para administradores sin verificación en dos pasos: no se puede usar el sistema hasta activarla.
// 4.7: o hasta aceptar el descargo de responsabilidad, si el sistema y sus empresas lo permiten (enlace discreto «Continuar sin
// verificación en dos pasos»; la ventana vive en renuncia-mfa.js y se carga solo al abrirla). Nunca para el administrador del sistema.
const ActivarMfa = {
  components: { RenunciaMfa: defineAsyncComponent(() => import('./renuncia-mfa.js').then(m => m.default)) },
  data() { return { mfa: null, codigo: '', respaldo: null, cargando: false, renuncia: null, verRenuncia: false }; },
  computed: { ofrecerRenuncia() { const r = this.renuncia; return !!(r && r.aplica && r.permitida && !sesion.esAdmin); } },
  async created() { this.cargarRenuncia(); try { this.mfa = await api('/api/auth/mfa/activar', { method: 'POST' }); } catch (e) { toast(e.message, 'err'); } },
  methods: {
    async confirmar() {
      if (!this.codigo) return;
      this.cargando = true;
      try { const r = await api('/api/auth/mfa/confirmar', { method: 'POST', body: { codigo: this.codigo } }); this.respaldo = r.respaldo; toast('Verificación en dos pasos activada', 'ok'); }
      catch (e) { toast(e.message, 'err'); this.codigo = ''; }
      this.cargando = false;
    },
    async continuar() { sesion.iniciar(await api('/api/auth/yo')); },
    // 4.7: renuncia a la verificación: si su cuenta puede aceptarla (el servidor lo decide) y, aceptada, la sesión se vuelve a leer
    // (usuario.mfa_obligatorio ya viene en false) y entra al sistema como al terminar de activarla
    async cargarRenuncia() { try { this.renuncia = await api('/api/auth/mfa/renuncia'); } catch { this.renuncia = null; } },
    async trasRenuncia() { this.verRenuncia = false; try { await sesion.iniciar(await api('/api/auth/yo')); } catch (e) { toast(e.message, 'err'); } },
    claveCambiada() { if (sesion.usuario) sesion.usuario.debe_cambiar_password = false; },
    copiar() { navigator.clipboard?.writeText(this.respaldo.join('\n')).then(() => toast('Códigos copiados', 'ok')); },
  },
  template: `
  <div class="login-wrap"><div class="login-card" style="max-width:520px">
    <template v-if="!respaldo">
      <h1 style="font-size:20px;margin:0 0 4px">Active la verificación en dos pasos</h1>
      <p class="muted small" style="margin:0 0 14px">Su cuenta administra una empresa, por lo que la verificación en dos pasos es obligatoria. Escanee el código con Google Authenticator, Microsoft Authenticator o Authy y escriba el código de 6 dígitos.</p>
      <div class="row" style="align-items:flex-start;gap:16px" v-if="mfa">
        <img :src="mfa.qr" style="width:170px;height:170px;border:1px solid var(--line);border-radius:8px">
        <div style="flex:1"><div class="small muted">Si no puede escanear, escriba esta clave en la aplicación:</div><div class="mono" style="word-break:break-all;margin:4px 0 12px">{{mfa.secreto}}</div>
          <Field label="Código de 6 dígitos"><input v-model="codigo" inputmode="numeric" maxlength="6" class="mono" style="font-size:20px;letter-spacing:6px" @keyup.enter="confirmar"></Field>
          <button class="btn" style="margin-top:10px" @click="confirmar" :disabled="cargando">Confirmar y activar</button></div>
      </div>
      <div class="small" style="text-align:center;margin-top:16px" v-if="ofrecerRenuncia">
        <div class="muted" style="margin-bottom:4px" v-if="renuncia.desactualizada">El descargo que aceptó cambió: léalo y acéptelo de nuevo, o active la verificación.</div>
        <a class="link muted" style="cursor:pointer;text-decoration:underline" @click="verRenuncia = true">{{renuncia.desactualizada ? 'Leer y aceptar el texto nuevo' : 'Continuar sin verificación en dos pasos'}}</a>
      </div>
      <div class="small muted" style="text-align:center;margin-top:14px" v-else-if="renuncia && renuncia.aceptada && renuncia.motivo"><b>La renuncia que aceptó ya no vale.</b> {{renuncia.motivo}}</div>
      <button class="btn ghost" style="width:100%;justify-content:center;margin-top:14px" @click="sesion.cerrar()">Cerrar sesión</button>
    </template>
    <template v-else>
      <h1 style="font-size:20px;margin:0 0 4px">Guarde sus códigos de respaldo</h1>
      <p class="muted small" style="margin:0 0 12px">Si pierde el teléfono, cada uno de estos códigos le permite entrar una sola vez. Guárdelos en un lugar seguro: no se volverán a mostrar.</p>
      <div class="mono" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:12px;border:1px dashed var(--line);border-radius:8px;font-size:15px"><span v-for="c in respaldo" :key="c">{{c}}</span></div>
      <div class="row" style="gap:8px;margin-top:14px"><button class="btn sec" @click="copiar">Copiar</button><button class="btn" style="flex:1;justify-content:center" @click="continuar">Ya los guardé, continuar</button></div>
    </template>
  </div>
  <RenunciaMfa v-if="verRenuncia" :correo="sesion.usuario && sesion.usuario.correo" @cerrar="verRenuncia = false" @aceptada="trasRenuncia" @clave="claveCambiada"></RenunciaMfa></div>`,
  setup() { return { sesion }; },
};

// 4.25 (programa local): a quien viene de la página web, los dos pasos se le activan allá; aquí no se activa otro. Esta pantalla
// reemplaza a la de activar cuando usuario.dos_pasos_en_web: explica qué hacer y deja abrir la página web y volver a entrar.
const ActivarMfaWeb = {
  data() { return { paginaWeb: '' }; },
  async created() { try { const j = await api('/api/auth/estado'); this.paginaWeb = (j && j.pagina_web) || ''; } catch { this.paginaWeb = ''; } },
  methods: { salir() { sesion.cerrar(); } },
  template: `<div class="login-wrap"><div class="login-card" style="max-width:520px">
    <h1 style="font-size:20px;margin:0 0 6px">Active la verificación en dos pasos en la página web</h1>
    <p class="muted" style="margin:0 0 12px">Su cuenta necesita la verificación en dos pasos y en esta computadora no se activa: se activa en la página web, en <b>Mi perfil</b>. Después de activarla, cierre la sesión aquí y vuelva a entrar con internet; el programa le pedirá su código.</p>
    <a v-if="paginaWeb" class="btn" style="width:100%;justify-content:center;padding:11px" :href="paginaWeb + '/app/#/configuracion/perfil'" target="_blank" rel="noopener">Abrir la página web</a>
    <button class="btn ghost" style="width:100%;justify-content:center;margin-top:8px" @click="salir">Ya la activé: cerrar sesión y volver a entrar</button>
  </div></div>`,
  setup() { return { sesion }; },
};

// Nivel del menú lateral (2.7): submenús de cualquier profundidad. Clave de apertura = cadena de etiquetas («Hotel/Contabilidad/Ingresos»).
// 3.74: las rutas del módulo FISITAAP (3.47 a 3.73) abren la aplicación de FISITAAP embebida, que tiene su propio menú
const SALTOS_FISITAAP = { '/fisitaap/pagina': '/publicar', '/fisitaap/catalogo': '/productos', '/fisitaap/pedidos': '/pedidos', '/pedidos/bandeja': '/pedidos', '/pedidos/negocio': '/contenido',
  '/fisitaap/clientes': '/clientes-historial', '/fisitaap/asistente': '/resumen', '/fisitaap/configuracion': '/configuracion', '/promociones/cupones': '/cupones', '/promociones/fidelizacion': '/fidelizacion',
  '/promociones/tarjetas': '/fidelizacion', '/entregas': '/express-pendientes', '/entregas/zonas': '/delivery', '/entregas/motorizados': '/afiliados', '/entregas/liquidaciones': '/afiliados', '/fisitaap': '/resumen' };
function saltoFisitaap(limpio, qs) { const d = SALTOS_FISITAAP[limpio]; return d ? '/app/fisitaap/#' + d + (qs ? '?' + qs : '') : null; }

// 4.1: qué entrada del menú corresponde a la pantalla abierta, contando la consulta (?tipo=Cliente no es ?tipo=Proveedor):
// -1 si no corresponde; si no, más puntos cuanto más exacta (ruta más larga y más parámetros que coinciden)
function puntajeRuta(to, path, qs) {
  const [base, q] = String(to || '').split('?');
  if (!base || !(path === base || path.startsWith(base + '/'))) return -1;
  let n = 0;
  if (q) {
    if (path !== base) return -1;
    const act = new URLSearchParams(qs || '');
    for (const [k, v] of new URLSearchParams(q)) { if (act.get(k) !== v) return -1; n++; }
  }
  return base.length * 10 + n;
}

// 4.2: versión de esta pantalla. Si el servidor dice otra (o no la dice: es anterior a la 4.2), se subieron los archivos pero falta
// reiniciar la aplicación en el hosting (el número que muestra Mi perfil se lee del archivo y no prueba que el programa se reinició)
export const VERSION_APP = '4.42.2';
const REFRESCO_MS = 15000;   // 4.8: si se consultó al servidor hace menos de esto, cambiar de pantalla no vuelve a consultar
// 4.8: pantallas de dinero y cierres: siempre se montan con lo último del servidor (como antes de la 4.8), aunque se haya consultado hace poco
const RUTAS_FRESCAS = ['/pos/cierres', '/pos/ventas', '/pos/inventario', '/hotel/cierre', '/hotel/recepcion', '/hotel/folios', '/hotel/depositos', '/bancos', '/contabilidad', '/gastos', '/ventas/pagos', '/inventario/ajustes', '/inventario/traslados', '/rrhh/planilla', '/rrhh/aguinaldo', '/rrhh/liquidaciones'];
function avisoDeVersion(j) {
  if (!j || typeof j !== 'object') return '';
  const srv = j.version, arch = j.archivos;
  const reiniciar = 'Se subió la versión ' + (arch || VERSION_APP) + ', pero el servidor sigue corriendo la anterior: reinicie la aplicación en el hosting (Setup Python App › Restart). Hasta entonces pueden fallar las opciones nuevas.';
  if (srv && arch && arch !== srv && arch !== 'desconocida') return reiniciar;   // lo dice el servidor mismo: vale aunque esta pantalla sea todavía la vieja (la sirve el service worker anterior)
  if (srv && srv === VERSION_APP) return '';
  if (!srv) return reiniciar;
  return 'El sistema se actualizó a la versión ' + srv + ': recargue la página (Ctrl + F5).';
}

const MenuNivel = {
  name: 'MenuNivel',
  props: ['items', 'clave', 'nivel', 'open', 'path', 'ok', 'activo'],
  emits: ['toggle', 'ejecutar'],
  methods: {
    k(c) { return this.clave + '/' + c.label; },
    visible(c) { return this.ok(c) && (!c.children || conHijos(c)); },   // 3.87: un grupo que queda sin entradas para este rol no se pinta (como en menuVisibleDe)
    activa(to) { if (this.activo) return to === this.activo; const base = String(to || '').split('?')[0]; return !!base && (this.path === base || this.path.startsWith(base + '/')); },   // 4.1: solo la entrada exacta
    contiene(c) { return !!c.children && c.children.some(s => (s.children ? this.contiene(s) : this.activa(s.to))); },
  },
  template: `
  <template v-for="c in items.filter(visible)" :key="c.to || c.label">
    <div v-if="c.accion" class="item" :class="'n' + nivel" @click="$emit('ejecutar', c)"><span class="label">⚠ {{c.label}}</span></div>
    <a v-else-if="c.href" class="item" :class="'n' + nivel" :href="c.href"><span class="label">{{c.label}}</span></a>
    <template v-else-if="c.children">
      <div class="item grupo" :class="['n' + nivel, {active: contiene(c) && !open[k(c)]}]" @click="$emit('toggle', k(c))"><span class="label">{{c.label}}</span><span class="chev">{{open[k(c)] ? '▴' : '▾'}}</span></div>
      <div class="subn" v-show="open[k(c)]"><MenuNivel :items="c.children" :clave="k(c)" :nivel="nivel + 1" :open="open" :path="path" :activo="activo" :ok="ok" @toggle="$emit('toggle', $event)" @ejecutar="$emit('ejecutar', $event)"></MenuNivel></div>
    </template>
    <a v-else class="item" :class="['n' + nivel, {active: activa(c.to), pronto: c.soon}]" :href="'#' + c.to" :title="c.soon ? 'Próximamente: vea qué hará' : null"><span class="label">{{c.label}}</span><span v-if="c.soon" class="soon">Próximamente</span></a>
  </template>`,
};

const App = {
  data() { return { marcaAbierta: false, avisoEntorno: '', avisoVersion: '',  path: '/inicio', qs: '', params: {}, mod: null, open: {}, collapsed: false, mobileOpen: false, autoCerrar: (() => { try { return localStorage.getItem('menu:auto') !== '0'; } catch { return true; } })(), toasts, q: '', menuUsuario: false, menuSucursal: false, reporteAbierto: false, pila: [], avisosConexion: [], modoSoporte: false, paginaWebRrhh: '' }; },
  watch: { paletaUsuario(v) { if (v) aplicarPaleta(v); },
    // 4.25 (tanda 7, E-7): al entrar a una empresa (o cambiar de empresa), los avisos de computadoras nuevas para este administrador
    'store.listo'(v) { if (v) this.cargarAvisosConexion(); else this.avisosConexion = []; },
    // 4.25 (programa local): a quien la web le administra los dos pasos, la franja de Recursos humanos lo manda a la página web
    'sesion.usuario.nube_manda': { immediate: true, async handler(v) { if (!v || this.paginaWebRrhh) return; try { const j = await api('/api/auth/estado'); this.paginaWebRrhh = (j && j.pagina_web) || ''; } catch { this.paginaWebRrhh = ''; } } } },
  computed: {
    page() { return this.mod ? pageComponent(this.mod) : null; },
    // 4.28 (P-5): «Pagar ahora» lleva al pago con tarjeta de Configuración › Suscripción y planes; C4: solo a quien puede abrir esa pantalla (la misma regla del menú: rutaPermitida)
    pagoEnLinea() { const p = sesion.empresaInfo && sesion.empresaInfo.plan; return !!(p && p.pago_en_linea) && rutaPermitida('/configuracion/suscripcion'); },
    // Sin sesión → login. Admin sin MFA → activar MFA. Con sesión pero sin empresa → admin (superadmin) o selector de empresa.
    pantalla() {
      if (!sesion.listo) return 'cargando';
      if (!sesion.activa || String(this.path || '').startsWith('/restablecer')) return 'login';   // el enlace del correo abre el formulario aunque haya sesión (this.path es reactivo)
      if (sesion.mfaPendiente) return 'mfa';
      if (sesion.usuario?.dos_pasos_falta) return 'mfa';   // 4.25 (programa local): la web le exige los dos pasos y no los tiene: se activan allá (ActivarMfaWeb)
      if (sesion.usuario?.debe_cambiar_password) return 'password';   // contraseña temporal: se cambia antes de seguir (R123)
      if (sesion.usuario?.terminos_pendientes) return 'terminos';       // términos del servicio y consentimiento (Ley 10946)
      if (sesion.usuario && !sesion.usuario.paleta) return 'paleta';     // primera vez: elige sus colores (1.35)
      if (conexion.activa) return 'conectar';                            // 4.25 (tanda 7): aprobar una computadora nueva (también sin empresa elegida)
      if (sesion.empresa_id && sesion.pruebaVencida) return 'prueba';    // prueba gratis vencida (1.37)
      if (sesion.empresa_id && sesion.sinCaja && this.path !== '/configuracion/perfil') return 'sincaja';   // 3.87: rol de solo caja sin el punto de venta (Mi perfil sí abre)
      if (this.path === '/admin' && !sesion.esAdmin) { location.hash = sesion.empresa_id ? sesion.inicio : '/'; return sesion.empresa_id ? 'app' : 'elegir'; }   // solo el superadministrador (R297)
      if (!sesion.empresa_id) return sesion.esAdmin ? 'admin' : 'elegir';
      return 'app';
    },
    empresaActual() { return sesion.empresas.find(e => e.id === sesion.empresa_id); },
    horaSoporte() { const v = sesion.usuario?.soporte?.vence; return v ? new Date(v).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }) : ''; },   // 4.35: fin de la sesión de soporte
    // migas (FISITAAP by Brillante Agencia): la etiqueta del menú de la pantalla abierta, a cualquier profundidad
    // 4.1: la entrada del menú de la pantalla abierta (la más exacta, con su consulta); null si la pantalla no está en el menú
    toActivo() {
      let mejor = null, pts = -1;
      const buscar = (items) => { for (const c of items || []) { if (c.children) buscar(c.children); else if (c.to) { const s = puntajeRuta(c.to, this.path, this.qs); if (s > pts) { pts = s; mejor = c.to; } } } };
      buscar(this.menu);
      return mejor;
    },
    tituloRuta() {
      if (this.path === '/admin') return 'Administración';
      let mejor = null;
      const buscar = (items, padre) => { for (const c of items || []) { if (mejor) return; if (c.children) buscar(c.children, c.label); else if (c.to && c.to === this.toActivo) mejor = (padre && /^(Reportes|Lista)$/.test(c.label) ? padre + ' › ' : '') + c.label; } };   // «Clientes › Reportes»
      buscar(this.menu, '');
      if (mejor) return mejor;
      const seg = this.path.split('/').filter(Boolean)[0] || 'inicio';
      return seg === 'inicio' ? 'Resumen' : seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
    },
    paletaUsuario() { return sesion.usuario?.paleta || null; },
    permitida() { return !sesion.empresa_id || rutaPermitida(this.path); },
    puedeAtras() { return this.path !== '/inicio' && this.path !== (sesion.inicio || '/inicio'); },   /* 4.39: no sale en la pantalla de inicio */
    menu() { return sesion.sinCaja ? [] : menuTipo(sesion.tipo); },   // módulos y orden según el tipo de negocio (2.5); 3.87: sin caja, ninguno
    otroTipo() { return !!sesion.empresa_id && rutaDeOtroTipo(this.path); },
    sinModulo() { return sesion.empresa_id ? rutaSinModulo(this.path) : null; },   // 3.87: la tarjeta de acceso denegado da una sola causa, en el orden de rutaPermitidaDe: versión, plan, rol
  },
  methods: {
    async route() {
      // Antes de mostrar la pantalla se traen los registros que otros cambiaron (máx. 4 s; lo que llegue tarde se descarta: nunca se
      // cambia nada por debajo de una pantalla ya abierta, porque al guardar su copia borraría lo que guardaron otros).
      // 4.8: si el último refresco completo fue hace menos de 15 s, la pantalla se abre de una vez (los clics seguidos ya no esperan
      // al servidor), salvo las pantallas de dinero y cierres (RUTAS_FRESCAS), que siempre se montan con lo último; las descargas van
      // en paralelo. El refresco de la navegación anterior se cancela aquí, y si alguna pantalla dejó un refresco corriendo, se espera
      // (máx. 4 s) antes de montar, para que nada escriba debajo de la pantalla nueva.
      // Si mientras tanto el usuario fue a otra pantalla, esta navegación se abandona.
      conexion.tomar();                                    // 4.25 (tanda 7): #/conectar abre la pantalla de aprobación (nivel superior)
      const nav = this._nav = (this._nav || 0) + 1;
      if (this._ctrlNav) this._ctrlNav.cancelado = true;
      if (!mock.cargado && sesion.empresa_id && store.listo && token()) {
        // la carga de los registros falló al entrar: se reintenta (máx. 4 s de espera; si llega después, la pantalla se
        // vuelve a montar con los datos)
        await Promise.race([store.reintentarRegistros(), new Promise(r => setTimeout(r, 4000))]);
        if (nav !== this._nav) return;
      }
      const rutaPedida = decodificarRuta((location.hash.slice(1) || '/inicio').split('?')[0]);
      const fresca = RUTAS_FRESCAS.some(r => rutaPedida === r || rutaPedida.startsWith(r + '/'));
      if (mock.cargado) {
        const toca = fresca || Date.now() - (this._refresco || 0) > REFRESCO_MS;
        const ctrl = toca ? (this._ctrlNav = { cancelado: false }) : null;
        let okPropio = false;
        const propio = toca ? mock.refrescar(undefined, ctrl).then(r => { okPropio = Array.isArray(r); }, () => {}) : null;
        if (toca || mock.refrescando()) {
          await Promise.race([Promise.all([propio, mock.esperarRefrescos()]), new Promise(r => setTimeout(r, 4000))]);
          if (ctrl) ctrl.cancelado = true;
          if (nav !== this._nav) return;
          if (toca) this._refresco = okPropio ? Date.now() : 0;   // sin red, error o más de 4 s: el próximo clic vuelve a consultar
        }
      }
      const h = location.hash.slice(1) || '/inicio';
      const [p, qs] = h.split('?');
      const limpio = decodificarRuta(p).replace(/\/$/, '') || '/inicio';   // 4.5: sin codificación antes de evaluar permisos (permitida, sinModulo, otroTipo) y de buscar la pantalla
      if (sesion.activa && sesion.listo && sesion.esAdmin && !sesion.empresa_id && !SIN_EMPRESA.has(limpio)) { location.hash = '/admin'; return; }   // 3.87: sin empresa no hay pantallas de negocio
      if (limpio === '/inicio' && sesion.activa && sesion.empresa_id && sesion.inicio !== '/inicio') { location.hash = sesion.inicio; return; }   // entrada por rol (3.20)
      const salto = saltoFisitaap(limpio, qs);   // 3.74: las pantallas de FISITAAP viven en su propia aplicación
      if (salto) { location.replace(salto); return; }
      const m = match(limpio);
      // La pantalla que queda montada: si no hay registros, sus guardados se rechazan aunque lleguen después. Si es la misma
      // pantalla (solo cambió la consulta) y se había montado sin datos que ahora sí están, se vuelve a montar con ellos.
      const sinDatos = !!(sesion.empresa_id && !mock.cargado);
      if (limpio !== this.path) mock.nuevaPantalla();   // 4.8: se monta otra pantalla: ningún refresco anterior escribe ya debajo de ella
      if (limpio === this.path && pantalla.sinDatos && !sinDatos) { mock.nuevaPantalla(); store.recargas++; }
      pantalla.sinDatos = sinDatos; store.datosNuevos = false;
      this.path = limpio; this.qs = qs || ''; this.params = { ...(m?.params || {}), ...Object.fromEntries(new URLSearchParams(qs || '')) };
      this.mod = m ? m.mod : null;
      this.abrirGrupo(limpio);
      this.mobileOpen = false; this.menuUsuario = false;
      this.navegado = true;
      window.scrollTo(0, 0);
    },
    // Abre la rama del menú que contiene la ruta (cualquier profundidad). Si la ruta está en varias ramas (Calendario está en Recepción y en
    // Reservaciones) y una de ellas ya está abierta, se respeta; si no, se abre la primera. Las claves son la cadena de etiquetas.
    abrirGrupo(limpio) {
      const ramas = [];
      const buscar = (items, cadena) => { for (const c of items) { const k = cadena.length ? cadena[cadena.length - 1] + '/' + c.label : c.label; if (c.children) buscar(c.children, [...cadena, k]); else if (c.to && this.isActive(c.to, limpio)) ramas.push(cadena); } };
      buscar(this.menu, []);
      if (!ramas.length) return;
      const rama = ramas.find(r => r.every(k => this.open[k])) || ramas[0];
      // acordeón (3.70): solo queda abierta la sección de la ruta (con sus subniveles); las demás se cierran para que el menú no crezca
      const raiz = rama[0];
      const nuevo = Object.fromEntries(Object.entries(this.open).filter(([k, v]) => v && (k === raiz || k.startsWith(raiz + '/'))));
      for (const k of rama) nuevo[k] = true;
      this.open = nuevo;
    },
    diasPara(f) { return f ? Math.ceil((new Date(f + 'T23:59:59') - new Date()) / 86400000) : null; },   // días hasta una fecha AAAA-MM-DD (3.17)
    fechaPlan(f) { const v = String(f || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4) : String(f || ''); },   /* 4.28 (C8): DD/MM/AAAA, como la franja de pago pendiente */
    isActive(to, path) { const p = path || this.path, base = String(to || '').split('?')[0]; if (!base) return false; if (p === this.path && this.toActivo) return to === this.toActivo;   /* 4.1: la entrada exacta */ return p === base || p.startsWith(base + '/'); },
    // Acordeón: al abrir un grupo se cierran los demás (no hay submenús anidados; si los hubiera, conservarían su jerarquía)
    menuOk(it) { return menuOk(it); },     // las reglas viven arriba, como funciones del módulo (FISITAAP by Brillante Agencia)
    conCandado(it) { return candadoDe(sesion, it); },   // 4.7: Recursos humanos sin la verificación en dos pasos: una entrada con candado a Mi perfil
    conHijos(it) { return conHijos(it); },
    hijoOk(c) { return hijoOk(c); },
    toggleSub(clave) {
      if (!clave.includes('/')) { this.open = this.open[clave] ? {} : { [clave]: true }; return; }   // sección principal: acordeón (3.70), las demás se cierran
      this.open = { ...this.open, [clave]: !this.open[clave] };                                      // submenú (2.4): abre o cierra sin cerrar el grupo
    },             // entradas de un grupo ya permitido   // Vendedor no ve gastos, bancos, contabilidad ni reportes; RRHH solo con su permiso
    contiene(it) { return !!it.children && it.children.some(c => (c.children ? this.contiene(c) : this.isActive(c.to))); },
    toggleGrupo(label) { if (this.collapsed) { this.collapsed = false; this.open = { [label]: true }; return; } const v = !this.open[label]; this.open = v ? { [label]: true } : {}; },   // recogido: tocar una sección lo abre (3.70)
    fijarAutoCerrar(v) { this.autoCerrar = v; try { localStorage.setItem('menu:auto', v ? '1' : '0'); } catch { /* sin almacenamiento */ } if (!v) this.collapsed = false; },
    ejecutar(c) { if (c.accion === 'reporte') { this.reporteAbierto = true; this.mobileOpen = false; } },   // «Reportar problema» del hotel (2.4): cuadro global, sin cambiar de pantalla
    go(to) { location.hash = to; },
    /* 4.39: «Atrás» arriba a la izquierda en todas las pantallas. pila = las pantallas que se han abierto en esta sesión de la página: si hay una anterior se vuelve
       con el historial del navegador (sirve igual en el programa de escritorio); si no, o si el cajero no puede abrirla, va al inicio. */
    marcarPaso() { const h = location.hash || '#/inicio', p = this.pila; if (p.length >= 2 && p[p.length - 2] === h) p.pop(); else if (p[p.length - 1] !== h) p.push(h); if (p.length > 60) p.shift(); },
    atras() {
      const ant = this.pila.length > 1 ? this.pila[this.pila.length - 2] : '';
      const ruta = decodificarRuta(String(ant).replace(/^#/, '').split('?')[0]) || '/inicio';
      if (ant && history.length > 1 && (!sesion.modoCajero || rutaPermitida(ruta))) { history.back(); return; }
      this.go(sesion.modoCajero ? '/pos/caja' : (sesion.inicio || '/inicio'));
    },
    // 4.25 (tanda 7, E-7): «Se conectó la computadora X, aprobada por Y: ¿la reconoce?» con «Sí» y «Revocar», hasta que conteste. Solo en
    // la web, para quien administra la empresa (la ruta pide «configurar»); no depende del correo.
    async cargarAvisosConexion() {
      const eid = sesion.empresa_id;
      if (!eid || sesion.esAdmin || sesion.sinCaja || sesion.empresaInfo?.es_local || !sesion.puede('configurar')) { this.avisosConexion = []; return; }
      try { const r = await api('/api/sinc/conexion/avisos'); if (eid === sesion.empresa_id) this.avisosConexion = (r && Array.isArray(r.avisos)) ? r.avisos : []; }
      catch { this.avisosConexion = []; }
    },
    async responderAviso(a, respuesta) {
      if (respuesta === 'revocar' && !confirm('¿Revocar la computadora «' + a.nombre + '»? Deja de recibir los datos de la empresa. Si usted no la reconoce, después cambie la clave de Hacienda y genere una llave criptográfica nueva: la anterior también se entregó.')) return;
      try {
        await api('/api/sinc/conexion/avisos/' + a.id, { method: 'POST', body: { respuesta } });
        this.avisosConexion = this.avisosConexion.filter(x => x.id !== a.id);
        toast(respuesta === 'si' ? 'Listo: la computadora queda reconocida' : 'Computadora revocada. Cambie la clave de Hacienda y genere una llave criptográfica nueva.', 'ok');
      } catch (e) { toast(e.message, 'err'); }
    },
    icono(it) { return it.icono || ICONO_MENU[it.label] || 'box'; },
    // 4.35: «Volver a mi cuenta» desde «Entrar como» (soporte). Lo pendiente sale antes con la sesión de soporte; después el servidor la
    // cierra y devuelve la sesión del administrador (su token nunca se guarda en este navegador). Si ya no está abierta, a entrar de nuevo.
    async volverCuenta() {
      try { if (mock.cargado) await mock.guardarTodo(); } catch {}
      let r = null;
      try { r = await api('/api/auth/volver', { method: 'POST' }); } catch (e) { if (e.status !== 401) { toast(e.message, 'err'); return; } }
      if (r && r.volvio && r.token) { await sesion.iniciar(r); toast('Volvió a su cuenta', 'ok'); return; }
      toast((r && r.mensaje) || 'La sesión de soporte ya terminó: entre de nuevo con su cuenta.', 'err');
      await sesion.cerrar(false);
    },
    iniciales() { const n = sesion.usuario?.nombre || sesion.usuario?.correo || 'U'; return n.split(/[\s@]/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join(''); },
  },
  async created() {
    this.pila = [location.hash || '#/inicio']; this.route(); window.addEventListener('hashchange', () => { this.marcarPaso(); this.route(); });
    window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') { const b = this.$refs.buscar; if (b) { e.preventDefault(); b.focus(); } } });   // Ctrl + K: buscador, como en el prototipo
    // instalación de pruebas (labs): franja visible y título marcado para no confundirla con producción
    fetch('/api/auth/estado').then(r => r.json()).then(j => { this.avisoVersion = avisoDeVersion(j); this.modoSoporte = !!(j && j.local && j.local.admin_local);   /* 4.25 (tanda 7, E-13): FE_LOCAL_ADMIN=1 en el programa */ if (j && j.aviso_entorno) { this.avisoEntorno = j.aviso_entorno; document.title = '[' + j.aviso_entorno.split(/[\s·]/)[0] + '] ' + document.title; } }).catch(() => {});
    await sesion.restaurar();
    iniciarAvisos(sesion);                                // pedidos en línea nuevos: sonido y notificación si el dispositivo lo tiene activo (3.58)
    if (sesion.empresa_id) this.abrirGrupo(this.path);   // el menú depende del tipo de negocio, que se conoce al restaurar la sesión (2.5)
    if (sesion.activa && !sesion.empresa_id && !(sesion.esAdmin ? SIN_EMPRESA.has(this.path) : this.path === '/admin')) location.hash = sesion.esAdmin ? '/admin' : '/elegir-empresa';
  },
  template: `
  <!-- 4.35: «Entrar como» (soporte, solo en la página web): franja arriba en todas las pantallas (sobre la barra de arriba; el menú y las ventanas la tapan mientras están abiertos) -->
  <div v-if="sesion.usuario?.soporte" role="status" :title="'Sesión de soporte: termina a las ' + horaSoporte + '. Lo que haga queda en la auditoría de la empresa a nombre de ' + sesion.usuario.correo + ', por soporte ' + sesion.usuario.soporte.correo + '.'" style="position:sticky;top:0;z-index:30;height:32px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 10px;background:#6d28d9;color:#fff;font-size:12px;font-weight:600;white-space:nowrap"><span style="overflow:hidden;text-overflow:ellipsis;min-width:0">Está usando FISITAAP como {{sesion.usuario.correo}}{{sesion.rol ? ' (' + sesion.rol + ')' : ''}} · soporte: {{sesion.usuario.soporte.correo}} ·</span><button type="button" @click="volverCuenta" style="flex:none;border:1px solid #fff;background:#fff;color:#6d28d9;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:700;cursor:pointer">Volver a mi cuenta</button></div>
  <div v-if="avisoEntorno" style="position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#b45309;color:#fff;text-align:center;font-size:12px;font-weight:600;padding:3px 8px;pointer-events:none;letter-spacing:.3px">{{avisoEntorno}}</div>
  <div v-if="modoSoporte" :style="{position:'fixed',left:0,right:0,bottom:avisoEntorno ? '20px' : 0,zIndex:9999,background:'#b91c1c',color:'#fff',textAlign:'center',fontSize:'12px',fontWeight:600,padding:'3px 8px',pointerEvents:'none'}" title="FE_LOCAL_ADMIN=1">Modo soporte: este programa acepta las cuentas creadas en esta computadora y la creación de un administrador. Si soporte no se lo pidió, avise de inmediato.</div>
  <div v-if="pantalla==='cargando'" class="login-wrap"><div class="login-card" style="text-align:center"><div class="muted">Cargando…</div></div></div>
  <Login v-else-if="pantalla==='login'"></Login>
  <ActivarMfaWeb v-else-if="pantalla==='mfa' && sesion.usuario?.dos_pasos_en_web"></ActivarMfaWeb>
  <ActivarMfa v-else-if="pantalla==='mfa'"></ActivarMfa>
  <CambiarPassword v-else-if="pantalla==='password'"></CambiarPassword>
  <AceptarTerminos v-else-if="pantalla==='terminos'"></AceptarTerminos>
  <ElegirPaleta v-else-if="pantalla==='paleta'"></ElegirPaleta>
  <Conectar v-else-if="pantalla==='conectar'"></Conectar>
  <PruebaVencida v-else-if="pantalla==='prueba'"></PruebaVencida>
  <SinCaja v-else-if="pantalla==='sincaja'"></SinCaja>
  <ElegirEmpresa v-else-if="pantalla==='elegir'"></ElegirEmpresa>
  <div v-else class="app">
    <div class="fondo-menu" v-if="mobileOpen" @click="mobileOpen=false"></div>
    <aside class="sidebar" :class="{open: mobileOpen}" v-if="sesion.empresa_id">
      <div class="brand"><span class="erp-brand"><img src="/fisitaap/assets/fisitapp-logo.webp" alt="FISITAAP"><span class="erp-by">by Brillante Agencia</span></span><button class="cerrar" type="button" @click="mobileOpen=false" aria-label="Cerrar menú">×</button></div>
      <div class="sidebar-empresa" v-if="empresaActual"><span class="avatar" style="width:30px;height:30px;border-radius:8px;background:var(--navy-soft);color:var(--navy);display:grid;place-items:center;font-size:10px;font-weight:650;flex:none">{{(empresaActual.nombre_comercial||empresaActual.nombre||'E').slice(0,2).toUpperCase()}}</span><div style="min-width:0"><b>{{empresaActual.nombre_comercial||empresaActual.nombre}}</b><small>{{sesion.sucursalActual ? sesion.sucursalActual.nombre : 'Mi espacio'}}</small></div></div>
      <nav>
        <a v-if="sesion.esAdmin" class="item" :class="{active:isActive('/admin')}" href="#/admin"><span class="ico"><Icono n="shield"></Icono></span><span class="label">Administración</span></a>
        <template v-for="it in menu.filter(menuOk).map(conCandado)" :key="it.label">
          <a v-if="it.accion" class="item accion-menu" @click="ejecutar(it)"><span class="ico"><Icono :n="icono(it)"></Icono></span><span class="label">{{it.label}}</span></a>
          <a v-else-if="it.href && !it.children" class="item" :href="it.href"><span class="ico"><img v-if="it.img" :src="it.img" alt="" class="ico-img"><Icono v-else :n="icono(it)"></Icono></span><span class="label">{{it.label}}</span></a>
          <a v-else-if="!it.children" class="item" :class="{active:isActive(it.to)}" :href="'#'+it.to" :title="it.aviso || null"><span class="ico"><Icono :n="icono(it)"></Icono></span><span class="label">{{it.label}}<span v-if="it.candado" style="margin-left:6px" aria-label="Pide la verificación en dos pasos">🔒</span></span><span v-if="it.soon" class="soon">Próximamente</span></a>
          <template v-else>
            <div class="item seccion" :class="{active: contiene(it) && !open[it.label]}" @click="toggleGrupo(it.label)"><span class="label">{{it.label}}</span><span v-if="it.soon" class="soon">Próximamente</span><span class="chev">{{open[it.label]?'−':'+'}}</span></div>
            <div class="sub" v-show="open[it.label]"><MenuNivel :items="it.children" :clave="it.label" :nivel="2" :open="open" :path="path" :activo="toActivo" :ok="hijoOk" @toggle="toggleSub" @ejecutar="ejecutar"></MenuNivel></div>
          </template>
        </template>
      </nav>
      <div class="nav-foot"><div class="menu-status"><i class="dot"></i>{{sesion.usuario?.nombre || sesion.usuario?.correo}}</div><button type="button" @click="go('/configuracion/perfil')">Mi perfil y diseño de la interfaz</button><button type="button" @click="sesion.cerrar()">Cerrar sesión</button></div>
    </aside>
    <div class="content">
      <header class="topbar" :style="sesion.usuario?.soporte ? 'top:32px' : null">
        <button class="burger" v-if="sesion.empresa_id" @click="mobileOpen=!mobileOpen" aria-label="Abrir menú"><Icono n="menu"></Icono></button>
        <a class="brand" :href="'#' + (sesion.inicio || '/inicio')"><span class="erp-brand"><img src="/fisitaap/assets/fisitapp-logo.webp" alt="FISITAAP"><span class="erp-by">by Brillante Agencia</span></span><span class="brand-separator" v-if="empresaActual"></span><span v-if="empresaActual" style="min-width:0"><strong>{{empresaActual.nombre_comercial||empresaActual.nombre}}</strong><small>{{sesion.sucursalActual ? sesion.sucursalActual.nombre : (store.sistema.nombre || 'FISITAAP by Brillante Agencia')}}</small></span></a>
        <div class="search" v-if="sesion.empresa_id && !sesion.modoCajero && !sesion.sinCaja"><span class="ico"><Icono n="search"></Icono></span><input ref="buscar" placeholder="Buscar contactos…" title="Busca por nombre o identificación en Contactos (Ctrl + K)" v-model="q" @keyup.enter="q.trim() && go('/contactos?q='+encodeURIComponent(q.trim()))"><span class="keycap">Ctrl K</span></div>
        <div class="spacer"></div>
        <button class="btn icon ghost" v-if="sesion.empresa_id && sesion.tieneModulo('rrhh') && !sesion.sinCaja" @click="marcaAbierta=true" title="Marcar entrada o salida (asistencia)" aria-label="Marcar asistencia" style="margin-right:6px;font-size:18px">⏱</button>
        <div class="company" v-if="empresaActual" @click="menuUsuario=!menuUsuario"><span v-if="sesion.empresaInfo?.es_demo" class="badge warn" title="Datos de ejemplo: no se envía nada a Hacienda">Demo</span><span v-else-if="sesion.empresaInfo?.prueba_hasta" class="badge info" :title="'Prueba gratis hasta el ' + sesion.empresaInfo.prueba_hasta.split('-').reverse().join('/')">Prueba</span><span>{{empresaActual.nombre_comercial||empresaActual.nombre}}</span><span class="muted">▾</span></div>
        <div class="company" v-if="empresaActual && sesion.sucursales.length" @click="sesion.sucursal_fija ? null : (menuSucursal=!menuSucursal)" :title="sesion.sucursal_fija ? 'Su usuario está amarrado a esta sucursal' : 'Cambiar de sucursal'" style="position:relative">
          <span class="muted">🏬</span><span>{{sesion.sucursalActual ? sesion.sucursalActual.nombre : 'Todas las sucursales'}}</span><span class="muted" v-if="!sesion.sucursal_fija">▾</span>
          <div class="usermenu" v-if="menuSucursal" @click.stop>
            <div class="sec">Sucursal</div>
            <button class="it" :disabled="!sesion.sucursal_id" @click="menuSucursal=false; sesion.cambiarSucursal(null)">{{!sesion.sucursal_id ? '✓ ' : ''}}Todas (consolidado)</button>
            <button v-for="x in sesion.sucursales" :key="x.id" class="it" :disabled="x.id===sesion.sucursal_id" @click="menuSucursal=false; sesion.cambiarSucursal(x.id)">{{x.id===sesion.sucursal_id ? '✓ ' : ''}}{{x.nombre}} <span class="muted mono">{{String(x.codigo).padStart(3, '0')}}</span></button>
          </div>
        </div>
        <div style="position:relative">
          <div class="avatar" style="cursor:pointer" @click="menuUsuario=!menuUsuario" :title="sesion.usuario?.correo">{{iniciales()}}</div>
          <div class="usermenu" v-if="menuUsuario">
            <div class="sec">{{sesion.usuario?.nombre}} · {{sesion.usuario?.correo}}</div>
            <a class="it" href="#/configuracion/perfil" @click="menuUsuario=false">Mi perfil, contraseña y verificación en dos pasos</a>
            <a class="it" v-if="store.sistema.soporte_url" :href="store.sistema.soporte_url + '?correo=' + encodeURIComponent(sesion.usuario?.correo || '') + '&empresa=' + encodeURIComponent(empresaActual?.nombre_comercial || empresaActual?.nombre || '')" target="_blank" rel="noopener" @click="menuUsuario=false">Ayuda y soporte</a>

            <a class="it" v-if="sesion.esAdmin" href="#/admin" @click="menuUsuario=false">★ Administración de cuentas</a>
            <template v-if="sesion.empresas.length>1 || sesion.esAdmin">
              <div class="sec">Cambiar de empresa</div>
              <button v-for="e in sesion.empresas" :key="e.id" class="it" :disabled="e.id===sesion.empresa_id" @click="sesion.cambiarEmpresa(e.id)">{{e.id===sesion.empresa_id?'✓ ':''}}{{e.nombre_comercial||e.nombre}}<span class="muted small" v-if="e.bloqueada"> · bloqueada</span></button>
            </template>
            <div class="sec"></div>
            <button class="it" @click="sesion.cerrar()">Cerrar sesión</button>
          </div>
        </div>
      </header>
      <div class="alert err" v-if="avisoVersion && (sesion.esAdmin || sesion.puede('configurar'))" style="margin:8px 16px 0">{{avisoVersion}}</div>
      <div class="alert info" style="margin:12px 24px 0" v-if="store.franja && store.franja.esperando">{{store.franja.esperando}}</div>
      <div class="alert warn" style="margin:12px 24px 0" v-if="store.franja && store.franja.pausa">{{store.franja.pausa}}</div>
      <div class="alert warn" style="margin:12px 24px 0" v-if="store.franja && store.franja.sinVer"><b>{{store.franja.sinVer}}</b><a href="#/sinc/pisados">véalos.</a></div>
      <div class="alert warn" style="margin:12px 24px 0" v-if="store.franja && store.franja.comandas"><b>{{store.franja.comandas}}</b></div>
      <div class="alert warn" style="margin:12px 24px 0;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap" v-for="a in avisosConexion" :key="'conexion' + a.id"><span><b>Computadora nueva.</b> {{a.texto}}</span><span class="row" style="gap:6px"><button class="btn sm" @click="responderAviso(a, 'si')">Sí</button><button class="btn sm danger" @click="responderAviso(a, 'revocar')">Revocar</button></span></div>
      <div class="breadcrumb"><div class="hstack"><button type="button" class="atras-btn" v-if="puedeAtras" title="Volver a la pantalla anterior" aria-label="Volver a la pantalla anterior" @click="atras">← Atrás</button><button type="button" @click="go(sesion.inicio || '/inicio')">Mi espacio</button><span>/</span><span class="current">{{tituloRuta}}</span></div><div class="hstack"><span class="design-label">{{store.sistema.nombre || 'FISITAAP by Brillante Agencia'}}</span><span class="demo-tag" v-if="sesion.empresaInfo?.es_demo"><i class="dot"></i>Datos de ejemplo</span></div></div>
      <div class="alert info" style="margin:12px 24px 0" v-if="sesion.empresaInfo?.plan?.vence && !sesion.empresaInfo.plan.vencido && !sesion.empresaInfo.plan.prueba && diasPara(sesion.empresaInfo.plan.vence) <= 7 && diasPara(sesion.empresaInfo.plan.vence) > 0"><b>Su plan vence el {{fechaPlan(sesion.empresaInfo.plan.vence)}}.</b> Renueve antes para seguir emitiendo y guardando sin interrupción: {{sistemaCfg().correo_ventas}}.</div>
      <div class="alert warn" style="margin:12px 24px 0;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap" v-if="sesion.empresaInfo?.plan?.estado_pago === 'en_gracia' && sesion.empresaInfo.plan.aviso_pago && path !== '/inicio'"><span><b>{{sesion.empresaInfo.plan.aviso_pago}}</b><template v-if="!pagoEnLinea"> Para ponerse al día escríbanos a {{sistemaCfg().correo_ventas}}.</template></span><a v-if="pagoEnLinea" class="btn sm" href="#/configuracion/suscripcion">Pagar ahora</a></div>
      <div class="alert warn" style="margin:12px 24px 0" v-if="sesion.empresaInfo?.plan?.vencido"><b>Su plan venció el {{fechaPlan(sesion.empresaInfo.plan.vence)}}.</b> Puede consultar y exportar; para seguir emitiendo y guardando, renueve su plan: escríbanos a {{sistemaCfg().correo_ventas}}.<template v-if="pagoEnLinea"> Tiene un pago pendiente de su plan: <a class="btn sm" href="#/configuracion/suscripcion">Pagar ahora</a></template></div>
      <div class="alert warn" style="margin:12px 24px 0" v-if="sesion.empresaInfo?.instalacion"><b>Esta instalación fue revocada en la nube.</b>
        <template v-if="sesion.empresaInfo.instalacion.eliminada"> Sus datos en esta computadora se borraron; queda el respaldo en la carpeta de respaldos.</template>
        <template v-else-if="sesion.empresaInfo.instalacion.bloqueada_en"> Esta computadora está bloqueada: no emite ni sincroniza. Sus datos se borrarán el {{new Date(sesion.empresaInfo.instalacion.elimina_el).toLocaleString('es-CR')}} salvo que un administrador la vincule de nuevo.</template>
        <template v-else> Sigue trabajando hasta el {{new Date(sesion.empresaInfo.instalacion.bloquea_el).toLocaleString('es-CR')}}; después se bloqueará y a los 30 días borrará sus datos, salvo que se vincule de nuevo.</template>
        Para seguir, un administrador la conecta de nuevo en <a href="#/configuracion/instalacion-local">Configuración › Instalación local</a> («Conectar con mi cuenta»).</div>
      <div class="alert info" style="margin:12px 24px 0" v-if="sesion.empresaInfo?.sin_acceso_nube && !sesion.empresaInfo?.instalacion"><b>Sin acceso a la nube.</b>
        Desde el {{new Date(sesion.empresaInfo.sin_acceso_nube.desde).toLocaleString('es-CR')}} la nube no deja sincronizar a esta computadora. Esta computadora sigue trabajando con sus datos y vuelve a intentar sola; lo pendiente sube cuando la nube le dé acceso. No se bloquea ni se borra nada.
        <a href="#/configuracion/instalacion-local" style="margin-left:8px" v-if="sesion.puede('configurar')">Ver el detalle</a></div>
      <div :class="['alert', store.avisoLocal.nivel === 'info' ? 'info' : 'warn']" style="margin:12px 24px 0" v-if="store.avisoLocal && store.avisoLocal.nivel"><b>{{store.avisoLocal.titulo}}</b> {{store.avisoLocal.texto}}</div>
      <div class="alert warn" style="margin:12px 24px 0" v-if="sesion.usuario?.sin_nube"><b>Entró sin internet:</b> no se pudo confirmar su usuario con la página web. Los cambios de usuarios y contraseñas hechos allá llegan cuando vuelva la conexión.</div>
      <div class="alert warn" style="margin:12px 24px 0" v-if="store.avisoLocal?.usuarios_atrasados"><b>Los usuarios de esta computadora no se están actualizando.</b> Hace más de 10 minutos que no llegan de la página web los cambios de usuarios, bloqueos y contraseñas, aunque hay internet. <a href="#/configuracion/instalacion-local" style="margin-left:8px" v-if="sesion.puede('configurar')">Ver el detalle</a></div>
      <div class="alert warn" style="margin:12px 24px 0" v-if="sesion.usuario?.debe_cambiar_password">Su contraseña fue asignada por el administrador: <a href="#/configuracion/perfil">cámbiela ahora</a>.</div>
      <div class="alert warn" style="margin:12px 24px 0" v-if="sesion.rrhhConCandado && path === '/inicio'"><b>{{AVISO_RRHH_MFA}}.</b> Su rol incluye Recursos humanos (salarios, cuentas bancarias y cédulas del personal): esa sección aparece en el menú en cuanto active la verificación. <a v-if="!sesion.usuario?.nube_manda" :href="'#' + RUTA_RRHH_MFA">Activarla en Mi perfil</a><span v-else>Se activa en la página web, en Mi perfil<template v-if="paginaWebRrhh">: <a :href="paginaWebRrhh + '/app/#/configuracion/perfil'" target="_blank" rel="noopener">abrir la página web</a></template>.</span></div>
      <main>
        <div class="alert warn" style="margin:12px 24px 0;display:flex;gap:12px;align-items:center;justify-content:space-between" v-if="store.datosNuevos">
          <span>Los datos de la empresa ya cargaron. Actualice esta pantalla para trabajar con ellos (lo que no se haya guardado se descarta).</span>
          <button class="btn" @click="store.actualizarPantalla()">Actualizar pantalla</button>
        </div>
        <div v-if="page && !permitida" class="page"><div class="card"><h2>{{otroTipo ? 'No disponible en su versión' : sinModulo ? 'No incluido en su plan' : 'Sin acceso'}}</h2><p class="muted" v-if="otroTipo">Esta sección no forma parte de la versión <b>{{TIPOS_NEGOCIO[sesion.tipo]}}</b> que tiene su empresa. Si la necesita, escríbanos para cambiar su versión.</p><p class="muted" v-else-if="sinModulo">«{{NOMBRES_MODULO[sinModulo] || sinModulo}}» no está incluido en el plan de su empresa. Escríbanos a {{sistemaCfg().correo_ventas}} para activarlo.</p><p class="muted" v-else-if="sesion.rrhhConCandado && path.startsWith('/rrhh')">{{AVISO_RRHH_MFA}}: su rol sí incluye Recursos humanos, pero por ser datos sensibles (salarios, cuentas bancarias y cédulas) se pide además la verificación en dos pasos. <a v-if="!sesion.usuario?.nube_manda" :href="'#' + RUTA_RRHH_MFA">Activarla en Mi perfil</a><span v-else>Se activa en la página web, en Mi perfil<template v-if="paginaWebRrhh">: <a :href="paginaWebRrhh + '/app/#/configuracion/perfil'" target="_blank" rel="noopener">abrir la página web</a></template>.</span></p><p class="muted" v-else>Su rol no tiene acceso a esta sección. Si la necesita, pídale al administrador de la empresa que le cambie el rol en Configuración › Usuarios.</p><a class="btn sec" :href="'#' + sesion.inicio">Ir al inicio</a></div></div>
        <component :is="page" v-else-if="page && (store.listo || !sesion.empresa_id)" :key="path + ':' + store.recargas" :params="params"></component>
        <div v-else-if="page" class="page"><div class="card muted">Cargando datos de la empresa…</div></div>
        <div v-else class="page"><div class="card"><h2>Página no encontrada</h2><a href="#/inicio">Ir al inicio</a></div></div>
      </main>
    </div>
    <ReporteProblema v-if="reporteAbierto" @close="reporteAbierto=false"></ReporteProblema>
    <MarcaRapida v-if="marcaAbierta" @close="marcaAbierta=false"></MarcaRapida>
    <div v-if="aviso.mensaje && sesion.activa" class="overlay" style="z-index:1000">
      <div class="modal" style="max-width:480px"><div class="m-head"><h3>Esta pestaña quedó desactualizada</h3></div>
        <div class="m-body"><p>{{aviso.mensaje}}</p><p class="small muted">Para no registrar nada en la empresa o con el usuario equivocado, esta pestaña se bloqueó. Al recargar toma la sesión actual. Lo que ya guardó no se pierde.</p></div>
        <div class="m-foot"><button class="btn" @click="window.location.reload()">Recargar esta pestaña</button></div></div>
    </div>
  </div>
  <div class="toasts"><div v-for="t in toasts.list" :key="t.id" class="toast" :class="t.kind">{{t.text}}</div></div>`,
  components: { Login, ElegirEmpresa, ActivarMfa, ActivarMfaWeb, CambiarPassword, AceptarTerminos, ElegirPaleta, PruebaVencida, SinCaja, Conectar, ReporteProblema: defineAsyncComponent(() => import('./pages/hotel/_reporte.js').then(m => m.default)), MarcaRapida: defineAsyncComponent(() => import('./pages/rrhh/marca-rapida.js').then(m => m.default)) },
  setup() { return { MENU, TIPOS_NEGOCIO, NOMBRES_MODULO, ICONO_MENU, store, sesion, window, aviso: avisoSesion, AVISO_RRHH_MFA, RUTA_RRHH_MFA }; },
};

const app = createApp(App);
for (const [name, comp] of Object.entries(C)) app.component(name, comp);
app.component('MenuNivel', MenuNivel);
app.component('Icono', Icono);
app.config.globalProperties.$store = store;
app.config.globalProperties.sistemaCfg = () => store.sistema;   // nombre, dominio y correo de ventas del sistema en cualquier plantilla (3.77)
app.config.globalProperties.puede = p => sesion.puede(p);   // en cualquier plantilla: v-if="puede('facturar')" oculta lo que el servidor rechazaría
app.config.globalProperties.fecha = fecha;          // fechas en hora de Costa Rica en cualquier plantilla
app.config.globalProperties.fechaHora = fechaHora;
app.mount('#app');
// nombre del sistema (3.51): título de la pestaña y marca cuando no hay empresa; si el servidor no responde queda el nombre de siempre
fetch('/api/sistema').then(r => (r.ok ? r.json() : null)).then(j => { if (j && j.nombre) { store.sistema = j; document.title = j.nombre; } }).catch(() => {});
