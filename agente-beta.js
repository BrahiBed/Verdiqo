const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const DB_FILE = path.join(__dirname, "beta-data.json");
const initialData = { usuarios: [], proveedores: [], productos: [{ id: "botella-reciclada", nombre: "Botella reciclada", proveedorId: "aqua-circular", categoria: "reutilizable", precio: 14, stock: 5, co2: 0.8 }], pedidos: [], eventos: [], conversaciones: [], sesiones: [] };

function cargarDatos() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

const db = cargarDatos();
if (!Array.isArray(db.sesiones)) db.sesiones = [];
const COMISION_VERDIQO = 0.08;
const DURACION_SESION = 1000 * 60 * 60 * 24;
const PAGO_REAL_CONFIGURADO = Boolean(process.env.STRIPE_SECRET_KEY);
const id = (prefijo) => `${prefijo}_${crypto.randomUUID()}`;
const responder = (res, status, data) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" }); res.end(JSON.stringify(data)); };
const guardar = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const leerBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", (trozo) => { body += trozo; });
  req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("JSON invalido")); } });
});

function registrarEvento(tipo, datos) {
  db.eventos.push({ id: id("evt"), tipo, datos, fecha: new Date().toISOString() });
}

function usuarioPublico(usuario) {
  const { passwordHash, passwordSalt, ...datos } = usuario;
  return datos;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function crearCredenciales(password) {
  const passwordSalt = crypto.randomBytes(16).toString("hex");
  return { passwordSalt, passwordHash: crypto.scryptSync(password, passwordSalt, 64).toString("hex") };
}

function validarPassword(password, cuenta) {
  if (!cuenta.passwordHash || !cuenta.passwordSalt) return false;
  const hash = crypto.scryptSync(password, cuenta.passwordSalt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(cuenta.passwordHash));
}

function crearSesion(usuario) {
  const token = crypto.randomBytes(32).toString("hex");
  db.sesiones = db.sesiones.filter((sesion) => sesion.expira > Date.now());
  db.sesiones.push({ id: id("ses"), tipo: "usuario", usuarioId: usuario.id, tokenHash: hashToken(token), expira: Date.now() + DURACION_SESION });
  return token;
}

function autenticar(req) {
  const cabecera = String(req.headers.authorization || "");
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";
  const sesion = db.sesiones.find((actual) => actual.tipo === "usuario" && actual.tokenHash === hashToken(token) && actual.expira > Date.now());
  return sesion ? db.usuarios.find((usuario) => usuario.id === sesion.usuarioId) : null;
}

function crearSesionProveedor(proveedor) {
  const token = crypto.randomBytes(32).toString("hex");
  db.sesiones = db.sesiones.filter((sesion) => sesion.expira > Date.now());
  db.sesiones.push({ id: id("ses"), tipo: "proveedor", proveedorId: proveedor.id, tokenHash: hashToken(token), expira: Date.now() + DURACION_SESION });
  return token;
}

function autenticarProveedor(req, proveedorId) {
  const cabecera = String(req.headers.authorization || "");
  const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";
  const sesion = db.sesiones.find((actual) => actual.tipo === "proveedor" && actual.proveedorId === proveedorId && actual.tokenHash === hashToken(token) && actual.expira > Date.now());
  return sesion ? db.proveedores.find((proveedor) => proveedor.id === sesion.proveedorId) : null;
}

function proveedorPublico(proveedor) {
  const { passwordHash, passwordSalt, ...datos } = proveedor;
  return datos;
}

function responderSesion(res, status, usuario, token) {
  return responder(res, status, { ...usuarioPublico(usuario), token });
}

function servirArchivo(res, pathname) {
  const tipos = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
  const solicitado = pathname === "/" ? "/index.html" : pathname;
  const raiz = path.resolve(__dirname);
  const archivo = path.resolve(raiz, `.${solicitado}`);
  if (!archivo.startsWith(raiz) || !fs.existsSync(archivo) || !fs.statSync(archivo).isFile()) return false;
  const tipo = tipos[path.extname(archivo).toLowerCase()];
  if (!tipo) return false;
  res.writeHead(200, { "Content-Type": tipo });
  res.end(fs.readFileSync(archivo));
  return true;
}

function chatbot(mensaje) {
  const texto = mensaje.toLowerCase();
  if (texto.includes("stock")) return "Puedes consultar la disponibilidad actual en la ficha de cada producto.";
  if (texto.includes("impacto") || texto.includes("co2")) return "Calculamos el CO2 evitado de cada solucion y lo acumulamos por pedido.";
  if (texto.includes("proveedor")) return "Verdiqo conecta tu necesidad con proveedores que ofrecen soluciones responsables.";
  if (texto.includes("puntos") || texto.includes("fidel")) return "Cada unidad comprada suma puntos para desbloquear beneficios.";
  return "Puedo ayudarte con productos, stock, proveedores, impacto ambiental y fidelizacion.";
}

async function manejar(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const partes = url.pathname.split("/").filter(Boolean);
  try {
    if (req.method === "OPTIONS") return responder(res, 204, {});
    if (req.method === "GET" && url.pathname === "/api/salud") return responder(res, 200, { ok: true, servicio: "agente-beta", persistencia: "json-local", modoPago: "simulado" });
    if (req.method === "GET" && url.pathname === "/api/productos") return responder(res, 200, db.productos);
    if (req.method === "POST" && url.pathname === "/api/catalogo/sincronizar") {
      const body = await leerBody(req); const productos = Array.isArray(body.productos) ? body.productos : [];
      productos.forEach((entrada) => {
        const producto = db.productos.find((actual) => actual.id === entrada.id || actual.nombre === entrada.nombre);
        const datos = { id: entrada.id, nombre: entrada.nombre, proveedorId: entrada.proveedorId || entrada.proveedor, categoria: entrada.categoria, precio: Number(entrada.precio), stock: Number(entrada.stock), co2: Number(entrada.co2) };
        if (producto) Object.assign(producto, datos);
        else db.productos.push(datos);
      });
      guardar(); return responder(res, 200, { sincronizados: productos.length, productos: db.productos });
    }
    if (req.method === "POST" && url.pathname === "/api/usuarios") {
      const body = await leerBody(req); const nombre = String(body.nombre || "").trim(); const email = String(body.email || "").trim().toLowerCase(); const password = String(body.password || "");
      if (nombre.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) return responder(res, 400, { error: "Nombre y email validos son obligatorios" });
      if (password.length < 8) return responder(res, 400, { error: "La contrasena debe tener al menos 8 caracteres" });
      const existente = db.usuarios.find((actual) => actual.email === email);
      if (existente) return responder(res, 409, { error: "Ya existe una cuenta con ese email" });
      const usuario = { id: id("usr"), nombre, email, ...crearCredenciales(password), puntos: 0 };
      db.usuarios.push(usuario); const token = crearSesion(usuario); guardar(); return responderSesion(res, 201, usuario, token);
    }
    if (req.method === "POST" && url.pathname === "/api/sesiones") {
      const body = await leerBody(req); const email = String(body.email || "").trim().toLowerCase(); const password = String(body.password || "");
      const usuario = db.usuarios.find((actual) => actual.email === email);
      if (!usuario || !usuario.passwordHash || password.length === 0) return responder(res, 401, { error: "Email o contrasena incorrectos" });
      if (!validarPassword(password, usuario)) return responder(res, 401, { error: "Email o contrasena incorrectos" });
      const token = crearSesion(usuario); guardar(); return responderSesion(res, 200, usuario, token);
    }
    if (req.method === "POST" && url.pathname === "/api/proveedores") {
      const body = await leerBody(req); const nombre = String(body.nombre || "").trim(); const email = String(body.email || "").trim().toLowerCase(); const password = String(body.password || ""); const descripcion = String(body.descripcion || "").trim(); const sitioWeb = String(body.sitioWeb || "").trim();
      if (nombre.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return responder(res, 400, { error: "Nombre, email y contrasena valida son obligatorios" });
      if (descripcion.length < 20) return responder(res, 400, { error: "Describe tu negocio con al menos 20 caracteres" });
      if (db.proveedores.some((proveedor) => proveedor.email === email)) return responder(res, 409, { error: "Ya existe un proveedor con ese email" });
      const proveedor = { id: id("prv"), nombre, email, descripcion, sitioWeb, ...crearCredenciales(password), estado: "pendiente_revision", verificacion: { identidad: "pendiente", negocio: "pendiente", catalogo: "pendiente", enviadoEn: new Date().toISOString() } };
      db.proveedores.push(proveedor); const token = crearSesionProveedor(proveedor); guardar(); return responder(res, 201, { ...proveedorPublico(proveedor), token });
    }
    if (req.method === "POST" && url.pathname === "/api/proveedores/sesiones") {
      const body = await leerBody(req); const email = String(body.email || "").trim().toLowerCase(); const password = String(body.password || "");
      const proveedor = db.proveedores.find((actual) => actual.email === email);
      if (!proveedor || !validarPassword(password, proveedor)) return responder(res, 401, { error: "Email o contrasena incorrectos" });
      const token = crearSesionProveedor(proveedor); guardar(); return responder(res, 200, { ...proveedorPublico(proveedor), token });
    }
    if (req.method === "GET" && partes[0] === "api" && partes[1] === "proveedores" && partes[2] && partes[3] === "resumen") {
      const proveedor = autenticarProveedor(req, partes[2]);
      if (!proveedor) return responder(res, 401, { error: "Sesion de proveedor no valida" });
      if (proveedor.estado !== "activo") return responder(res, 403, { error: "Tu cuenta sigue en proceso de aceptacion", estado: proveedor.estado, verificacion: proveedor.verificacion });
      const productos = db.productos.filter((producto) => producto.proveedorId === proveedor.id);
      const pedidos = db.pedidos.filter((pedido) => pedido.proveedorIds.includes(proveedor.id));
      return responder(res, 200, { proveedor: proveedorPublico(proveedor), productos: productos.length, unidadesDisponibles: productos.reduce((total, producto) => total + producto.stock, 0), pedidos: pedidos.length, pedidosPendientes: pedidos.filter((pedido) => !["entregado", "cancelado"].includes(pedido.estado)).length, ingresos: Number(pedidos.reduce((total, pedido) => total + pedido.total, 0).toFixed(2)), co2Aportado: Number(pedidos.reduce((total, pedido) => total + pedido.co2Evitado, 0).toFixed(2)) });
    }
    if (partes[0] === "api" && partes[1] === "proveedores" && partes[2] && partes[3] === "productos") {
      const proveedorId = partes[2]; const proveedor = autenticarProveedor(req, proveedorId);
      if (!proveedor) return responder(res, 401, { error: "Sesion de proveedor no valida" });
      if (proveedor.estado !== "activo") return responder(res, 403, { error: "Tu cuenta sigue en proceso de aceptacion", estado: proveedor.estado, verificacion: proveedor.verificacion });
      if (req.method === "GET" && partes.length === 4) return responder(res, 200, db.productos.filter((producto) => producto.proveedorId === proveedorId));
      if ((req.method === "POST" || req.method === "PATCH") && partes.length === 4) {
        const body = await leerBody(req); const nombre = String(body.nombre || "").trim(); const precio = Number(body.precio); const stock = Number(body.stock); const co2 = Number(body.co2 || 0);
        if (!nombre || !Number.isFinite(precio) || precio <= 0 || !Number.isInteger(stock) || stock < 0 || !Number.isFinite(co2) || co2 < 0) return responder(res, 400, { error: "Datos de producto invalidos" });
        const producto = { id: id("prd"), nombre, proveedorId, categoria: String(body.categoria || "general"), precio, stock, co2 };
        db.productos.push(producto); guardar(); return responder(res, 201, producto);
      }
      if (req.method === "PATCH" && partes.length === 5) {
        const producto = db.productos.find((actual) => actual.id === partes[4] && actual.proveedorId === proveedorId);
        if (!producto) return responder(res, 404, { error: "Producto no encontrado" });
        const body = await leerBody(req); const precio = body.precio === undefined ? producto.precio : Number(body.precio); const stock = body.stock === undefined ? producto.stock : Number(body.stock);
        if (!Number.isFinite(precio) || precio <= 0 || !Number.isInteger(stock) || stock < 0) return responder(res, 400, { error: "Precio o stock invalidos" });
        if (body.nombre !== undefined) producto.nombre = String(body.nombre).trim();
        if (body.categoria !== undefined) producto.categoria = String(body.categoria).trim() || producto.categoria;
        producto.precio = precio; producto.stock = stock; guardar(); return responder(res, 200, producto);
      }
    }
    if (partes[0] === "api" && partes[1] === "proveedores" && partes[2] && partes[3] === "pedidos" && req.method === "GET") {
      const proveedor = autenticarProveedor(req, partes[2]);
      if (!proveedor) return responder(res, 401, { error: "Sesion de proveedor no valida" });
      if (proveedor.estado !== "activo") return responder(res, 403, { error: "Tu cuenta sigue en proceso de aceptacion", estado: proveedor.estado, verificacion: proveedor.verificacion });
      return responder(res, 200, db.pedidos.filter((pedido) => pedido.proveedorIds.includes(partes[2])));
    }
    if (partes[0] === "api" && partes[1] === "proveedores" && partes[2] && partes[3] === "pedidos" && partes[5] === "estado" && req.method === "POST") {
      const proveedor = autenticarProveedor(req, partes[2]);
      if (!proveedor) return responder(res, 401, { error: "Sesion de proveedor no valida" });
      if (proveedor.estado !== "activo") return responder(res, 403, { error: "Tu cuenta sigue en proceso de aceptacion", estado: proveedor.estado, verificacion: proveedor.verificacion });
      const pedido = db.pedidos.find((actual) => actual.id === partes[4] && actual.proveedorIds.includes(partes[2]));
      if (!pedido) return responder(res, 404, { error: "Pedido no encontrado" });
      const body = await leerBody(req); const estados = ["confirmado", "preparando", "enviado", "entregado", "cancelado"];
      if (!estados.includes(body.estado)) return responder(res, 400, { error: "Estado de pedido invalido" });
      pedido.estado = body.estado; guardar(); return responder(res, 200, pedido);
    }
    if (req.method === "POST" && url.pathname === "/api/necesidades") {
      const body = await leerBody(req); const texto = String(body.texto || "");
      const categoria = /residuo|compost|cocina/i.test(texto) ? "hogar" : /plastico|botella|desechable/i.test(texto) ? "reutilizable" : "general";
      registrarEvento("necesidad_detectada", { texto, categoria }); guardar(); return responder(res, 200, { texto, categoria, soluciones: db.productos.filter((producto) => producto.categoria === categoria) });
    }
    if (req.method === "POST" && url.pathname === "/api/chatbot") {
      const body = await leerBody(req); const respuesta = chatbot(String(body.mensaje || ""));
      db.conversaciones.push({ id: id("chat"), mensaje: body.mensaje, respuesta, fecha: new Date().toISOString() }); guardar(); return responder(res, 200, { respuesta });
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard") {
      const unidades = db.pedidos.reduce((total, pedido) => total + pedido.unidades, 0);
      const co2 = db.pedidos.reduce((total, pedido) => total + pedido.co2Evitado, 0);
      const ingresos = db.pedidos.reduce((total, pedido) => total + pedido.total, 0);
      const comision = db.pedidos.reduce((total, pedido) => total + (pedido.comisionVerdiqo || 0), 0);
      return responder(res, 200, { pedidos: db.pedidos.length, unidades, proveedores: db.proveedores.length, usuarios: db.usuarios.length, ingresos: Number(ingresos.toFixed(2)), comisionVerdiqo: Number(comision.toFixed(2)), co2Evitado: Number(co2.toFixed(2)), eventos: db.eventos.length, conversaciones: db.conversaciones.length });
    }
    if (req.method === "GET" && url.pathname === "/api/pedidos") {
      const usuarioId = url.searchParams.get("usuarioId");
      const usuario = autenticar(req);
      if (!usuario || usuario.id !== usuarioId) return responder(res, 401, { error: "Sesion no valida" });
      return responder(res, 200, db.pedidos.filter((pedido) => pedido.usuarioId === usuarioId));
    }
    if (req.method === "POST" && url.pathname === "/api/pedidos") {
      const body = await leerBody(req); const items = Array.isArray(body.items) ? body.items : [];
      const usuario = db.usuarios.find((actual) => actual.id === body.usuarioId);
      if (!usuario) return responder(res, 400, { error: "Debes registrar un usuario antes de comprar" });
      if (autenticar(req)?.id !== usuario.id) return responder(res, 401, { error: "Sesion no valida" });
      if (!items.length || items.some((item) => !Number.isInteger(item.cantidad) || item.cantidad < 1)) return responder(res, 400, { error: "El pedido debe incluir cantidades validas" });
      const envio = body.envio || {};
      if ([envio.nombre, envio.direccion, envio.ciudad, envio.codigoPostal].some((valor) => String(valor || "").trim().length < 2)) return responder(res, 400, { error: "Los datos de envio son obligatorios" });
      const metodoPago = body.metodoPago === "tarjeta" ? "tarjeta" : "simulado";
      if (metodoPago === "tarjeta" && !PAGO_REAL_CONFIGURADO) return responder(res, 503, { error: "Los pagos con tarjeta todavía no están configurados", codigo: "PAGO_REAL_NO_CONFIGURADO" });
      let total = 0; let unidades = 0; let co2Evitado = 0;
      for (const item of items) {
        const producto = db.productos.find((actual) => actual.id === item.productoId);
        if (!producto || producto.stock < item.cantidad) return responder(res, 409, { error: "Stock insuficiente", productoId: item.productoId });
        producto.stock -= item.cantidad; total += producto.precio * item.cantidad; unidades += item.cantidad; co2Evitado += producto.co2 * item.cantidad;
      }
      usuario.puntos += unidades * 10;
      const pedido = { id: id("ord"), usuarioId: usuario.id, proveedorIds: [...new Set(items.map((item) => db.productos.find((producto) => producto.id === item.productoId)?.proveedorId))], envio: { nombre: String(envio.nombre).trim(), direccion: String(envio.direccion).trim(), ciudad: String(envio.ciudad).trim(), codigoPostal: String(envio.codigoPostal).trim() }, total, unidades, co2Evitado, puntosGanados: unidades * 10, comisionVerdiqo: Number((total * COMISION_VERDIQO).toFixed(2)), estado: "confirmado", metodoPago, pago: metodoPago === "tarjeta" ? "pagado" : "simulado", fecha: new Date().toISOString() };
      db.pedidos.push(pedido); registrarEvento("venta_atribuida", { pedidoId: pedido.id, necesidad: body.necesidad || "no especificada" }); guardar(); return responder(res, 201, pedido);
    }
    if (req.method === "GET" && !url.pathname.startsWith("/api/") && servirArchivo(res, url.pathname)) return;
    responder(res, 404, { error: "Ruta no encontrada" });
  } catch (error) { responder(res, 400, { error: error.message }); }
}

function iniciar() {
  const servidor = http.createServer(manejar);
  servidor.listen(PORT, () => console.log(`Agente beta API: http://localhost:${PORT}`));
  return servidor;
}

if (require.main === module) iniciar();
module.exports = { db, manejar, iniciar };
