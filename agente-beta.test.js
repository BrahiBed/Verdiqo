const test = require("node:test");
const assert = require("node:assert/strict");
const { db, manejar } = require("./agente-beta");

function peticion(method, url, body, headers = {}) {
  const respuestas = [];
  const req = { method, url, headers: { host: "localhost", ...headers }, on(evento, callback) { if (evento === "data" && body) callback(JSON.stringify(body)); if (evento === "end") callback(); } };
  const res = { status: 0, datos: "", writeHead(status) { this.status = status; }, end(datos) { this.datos = datos || ""; respuestas.push(this); } };
  return manejar(req, res).then(() => ({ status: res.status, body: JSON.parse(res.datos) }));
}

test("agente beta conecta necesidad, proveedor, venta y metricas", async () => {
  db.usuarios.length = 0; db.proveedores.length = 0; db.productos.length = 0; db.pedidos.length = 0; db.eventos.length = 0; db.conversaciones.length = 0;
  const proveedor = await peticion("POST", "/api/proveedores", { nombre: "Aqua Circular", email: "beta@aqua.test", password: "proveedor123", descripcion: "Soluciones circulares para reducir residuos domesticos." });
  const proveedorAuth = { authorization: `Bearer ${proveedor.body.token}` };
  assert.equal(proveedor.body.estado, "pendiente_revision");
  const bloqueado = await peticion("GET", `/api/proveedores/${proveedor.body.id}/productos`, undefined, proveedorAuth);
  assert.equal(bloqueado.status, 403);
  db.proveedores.find((actual) => actual.id === proveedor.body.id).estado = "activo";
  const usuario = await peticion("POST", "/api/usuarios", { nombre: "Ana", email: "ana@test.local", password: "segura123" });
  const sesion = await peticion("POST", "/api/sesiones", { email: "ANA@TEST.LOCAL", password: "segura123" });
  assert.equal(sesion.status, 200);
  assert.equal(sesion.body.id, usuario.body.id);
  db.productos.push({ id: "botella-1", nombre: "Botella reciclada", proveedorId: proveedor.body.id, categoria: "reutilizable", precio: 14, stock: 5, co2: 0.8 });
  const necesidad = await peticion("POST", "/api/necesidades", { texto: "Quiero evitar botellas desechables" });
  assert.equal(necesidad.body.soluciones.length, 1);
  const chatbot = await peticion("POST", "/api/chatbot", { mensaje: "¿Cuánto stock queda?" });
  assert.match(chatbot.body.respuesta, /disponibilidad/i);
  const auth = { authorization: `Bearer ${sesion.body.token}` };
  const pedido = await peticion("POST", "/api/pedidos", { usuarioId: usuario.body.id, necesidad: necesidad.body.texto, envio: { nombre: "Ana", direccion: "Calle Verde 1", ciudad: "Madrid", codigoPostal: "28001" }, items: [{ productoId: "botella-1", cantidad: 2 }] }, auth);
  assert.equal(pedido.status, 201);
  assert.equal(pedido.body.usuarioId, usuario.body.id);
  assert.equal(pedido.body.puntosGanados, 20);
  assert.equal(pedido.body.envio.ciudad, "Madrid");
  assert.equal(pedido.body.pago, "simulado");
  assert.equal(db.usuarios[0].puntos, 20);
  assert.equal(db.productos[0].stock, 3);
  const productosProveedor = await peticion("GET", `/api/proveedores/${proveedor.body.id}/productos`, undefined, proveedorAuth);
  assert.equal(productosProveedor.body.length, 1);
  const resumenProveedor = await peticion("GET", `/api/proveedores/${proveedor.body.id}/resumen`, undefined, proveedorAuth);
  assert.equal(resumenProveedor.body.productos, 1);
  assert.equal(resumenProveedor.body.pedidos, 1);
  const estado = await peticion("POST", `/api/proveedores/${proveedor.body.id}/pedidos/${pedido.body.id}/estado`, { estado: "preparando" }, proveedorAuth);
  assert.equal(estado.body.estado, "preparando");
  const historial = await peticion("GET", `/api/pedidos?usuarioId=${usuario.body.id}`, undefined, auth);
  assert.equal(historial.body.length, 1);
  const dashboard = await peticion("GET", "/api/dashboard");
  assert.deepEqual({ pedidos: dashboard.body.pedidos, unidades: dashboard.body.unidades, proveedores: dashboard.body.proveedores, co2Evitado: dashboard.body.co2Evitado, conversaciones: dashboard.body.conversaciones }, { pedidos: 1, unidades: 2, proveedores: 1, co2Evitado: 1.6, conversaciones: 1 });
});

test("rechaza compras sin usuario registrado", async () => {
  db.usuarios.length = 0; db.productos.length = 0; db.pedidos.length = 0;
  db.productos.push({ id: "producto-1", nombre: "Producto", proveedorId: "proveedor-1", precio: 10, stock: 1, co2: 1 });
  const pedido = await peticion("POST", "/api/pedidos", { usuarioId: "inexistente", items: [{ productoId: "producto-1", cantidad: 1 }] });
  assert.equal(pedido.status, 400);
  assert.match(pedido.body.error, /usuario/i);
});
