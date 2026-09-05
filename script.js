const productos = [
  { nombre: "Bolsa reutilizable", proveedor: "Verdiqo Basics", necesidad: "Reducir bolsas de un solo uso", solucion: "Bolsa de algodon reciclado", categoria: "reutilizable", precio: 8.5, stock: 10, co2: 0.5, icono: "👜" },
  { nombre: "Botella reciclada", proveedor: "Aqua Circular", necesidad: "Evitar botellas desechables", solucion: "Botella de acero recuperado", categoria: "reutilizable", precio: 14, stock: 5, co2: 0.8, icono: "💧" },
  { nombre: "Camiseta organica", proveedor: "Raiz Textil", necesidad: "Vestir con menor impacto", solucion: "Prenda de algodon certificado", categoria: "textil", precio: 24, stock: 8, co2: 1.2, icono: "👕" },
  { nombre: "Detergente biodegradable", proveedor: "Casa Clara", necesidad: "Limpiar sin contaminar el agua", solucion: "Formula de origen vegetal", categoria: "hogar", precio: 11.5, stock: 12, co2: 0.7, icono: "🫧" },
  { nombre: "Kit de compostaje", proveedor: "Ciclo Vivo", necesidad: "Aprovechar residuos organicos", solucion: "Compostaje domestico sencillo", categoria: "hogar", precio: 29, stock: 6, co2: 2.4, icono: "🌱" },
  { nombre: "Shampoo solido", proveedor: "Botanica", necesidad: "Cuidar el cabello sin plastico", solucion: "Shampoo concentrado sin envase", categoria: "cuidado", precio: 10, stock: 9, co2: 0.6, icono: "🧼" },
  { nombre: "Cepillo de bambu", proveedor: "Raiz Natural", necesidad: "Reemplazar plasticos cotidianos", solucion: "Mango compostable de bambu", categoria: "cuidado", precio: 6.5, stock: 15, co2: 0.3, icono: "🪥" },
  { nombre: "Black Hole Pack 25L", proveedor: "Patagonia", necesidad: "Transportar tus cosas con mayor durabilidad", solucion: "Mochila resistente con materiales reciclados", categoria: "reutilizable", precio: 149, stock: 4, co2: 3.2, icono: "🎒", fuente: "https://www.patagonia.com/product/black-hole-pack-25-liters/49298.html" },
  { nombre: "Papel higienico de bambu", proveedor: "Who Gives A Crap", necesidad: "Reducir la presion sobre los bosques", solucion: "Papel elaborado con bambu", categoria: "hogar", precio: 38, stock: 7, co2: 1.8, icono: "🌿", fuente: "https://us.whogivesacrap.org/products/premium-100-bamboo-toilet-paper-double-length-rolls" },
  { nombre: "Compostador domestico Lomi", proveedor: "Lomi", necesidad: "Aprovechar residuos organicos en casa", solucion: "Compostaje domestico asistido", categoria: "hogar", precio: 499, stock: 2, co2: 8.5, icono: "♻️", fuente: "https://lomi.com/pages/about-us" }
];

const inventarioGuardado = JSON.parse(localStorage.getItem("verdiqo-inventario") || "{}");
productos.forEach((producto) => {
  if (typeof inventarioGuardado[producto.nombre] === "number") producto.stock = inventarioGuardado[producto.nombre];
});

const carrito = JSON.parse(localStorage.getItem("verdiqo-carrito") || "[]");
const metricas = JSON.parse(localStorage.getItem("verdiqo-metricas") || '{"compras":0,"co2Evitado":0}');
let usuarioActual = JSON.parse(localStorage.getItem("verdiqo-usuario") || "null");
let tokenSesion = localStorage.getItem("verdiqo-token") || "";
const API_BASE = "https://verdiqo-api.onrender.com";
let apiConectada = false;

function productoId(nombre) {
  return nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function cabecerasAutenticadas() {
  return tokenSesion ? { Authorization: `Bearer ${tokenSesion}` } : {};
}

async function sincronizarCatalogoAPI() {
  try {
    const respuesta = await fetch(`${API_BASE}/api/catalogo/sincronizar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productos: productos.map((producto) => ({ ...producto, id: productoId(producto.nombre) })) }) });
    if (!respuesta.ok) throw new Error("API no disponible");
    apiConectada = true;
    document.body.classList.add("api-activa");
    const estadoAPI = document.getElementById("api-status");
    if (estadoAPI) estadoAPI.textContent = "API conectada";
  } catch {
    apiConectada = false;
    const estadoAPI = document.getElementById("api-status");
    if (estadoAPI) estadoAPI.textContent = "Modo local";
  }
}

function buscarProducto(nombre) {
  return productos.find((producto) => producto.nombre === nombre);
}

async function asegurarUsuarioAPI() {
  if (!apiConectada || !usuarioActual || !usuarioActual.id.startsWith("local_")) return;
  throw new Error("Inicia sesión con una cuenta de la API antes de comprar");
}

function renderCatalogo(filtro = "todos", busqueda = "") {
  const catalogo = document.getElementById("catalogo");
  if (!catalogo) return;
  const encontrados = productos.filter((producto) => {
    const coincideCategoria = filtro === "todos" || producto.categoria === filtro;
    const coincideBusqueda = producto.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return coincideCategoria && coincideBusqueda;
  });
  catalogo.innerHTML = encontrados.length ? encontrados.map((producto) => `
    <article class="producto">
      <div>
        <div class="producto-icono" aria-hidden="true">${producto.icono}</div>
        <p class="producto-proveedor">Proveedor: ${producto.proveedor}</p>
        <h3>${producto.nombre}</h3>
        <p class="producto-necesidad">Necesidad: ${producto.necesidad}</p>
        <p class="producto-meta">Solución: ${producto.solucion} · evita ${producto.co2.toFixed(1)} kg de CO2</p>
        ${producto.fuente ? `<a class="producto-fuente" href="${producto.fuente}" target="_blank" rel="noopener">Ver proveedor ↗</a>` : ""}
      </div>
      <div class="producto-final">
        <div><span class="precio">$${producto.precio.toFixed(2)}</span><span class="stock">${producto.stock - cantidadEnCarrito(producto.nombre)} disponibles</span></div>
        <button class="boton boton-comprar" data-producto="${producto.nombre}" ${producto.stock - cantidadEnCarrito(producto.nombre) <= 0 ? "disabled" : ""}>Anadir al carrito</button>
      </div>
    </article>
  `).join("") : '<p class="catalogo-vacio">No encontramos productos con esa búsqueda.</p>';
}

function cantidadEnCarrito(nombre) {
  const linea = carrito.find((item) => item.nombre === nombre);
  return linea ? linea.cantidad : 0;
}

function anadirAlCarrito(nombre) {
  const producto = buscarProducto(nombre);
  const linea = carrito.find((item) => item.nombre === nombre);
  const cantidadActual = linea ? linea.cantidad : 0;
  if (cantidadActual >= producto.stock) return;
  if (linea) linea.cantidad += 1;
  else carrito.push({ nombre, cantidad: 1 });
  guardarEstado();
  renderCarrito();
  renderCatalogo();
  renderImpacto();
}

function eliminarDelCarrito(nombre) {
  const indice = carrito.findIndex((item) => item.nombre === nombre);
  if (indice !== -1) carrito.splice(indice, 1);
  guardarEstado();
  renderCarrito();
  renderImpacto();
}

function cambiarCantidad(nombre, cambio) {
  const linea = carrito.find((item) => item.nombre === nombre);
  const producto = buscarProducto(nombre);
  if (!linea || !producto) return;
  const nuevaCantidad = linea.cantidad + cambio;
  if (nuevaCantidad <= 0) {
    eliminarDelCarrito(nombre);
    return;
  }
  if (nuevaCantidad > producto.stock) return;
  linea.cantidad = nuevaCantidad;
  guardarEstado();
  renderCarrito();
  renderCatalogo();
  renderImpacto();
}

function actualizarMetricas() {
  const co2 = document.getElementById("co2-total");
  if (co2) {
    co2.textContent = `${metricas.co2Evitado.toFixed(2)} kg`;
    document.getElementById("productos-total").textContent = metricas.compras;
    document.getElementById("material-total").textContent = `${metricas.compras * 2} kg`;
    document.getElementById("barra-material").style.width = `${Math.min(metricas.compras * 12, 100)}%`;
    document.getElementById("barra-productos").style.width = `${Math.min(metricas.compras * 10, 100)}%`;
  }
  const compras = document.getElementById("metrica-compras");
  if (compras) {
    compras.textContent = metricas.pedidos || 0;
    document.getElementById("metrica-unidades").textContent = metricas.compras;
    document.getElementById("metrica-proveedores").textContent = new Set(metricas.proveedores || []).size;
  }
  actualizarFidelizacion();
}

function actualizarFidelizacion() {
  if (!document.getElementById("nivel-cliente")) return;
  const puntos = metricas.compras * 10;
  const niveles = [
    { nombre: "Semilla", minimo: 0, siguiente: 100, siguienteNombre: "Brote", recompensa: "10% de descuento al alcanzar el nivel Brote." },
    { nombre: "Brote", minimo: 100, siguiente: 250, siguienteNombre: "Raiz", recompensa: "Envio gratuito en tu proxima compra." },
    { nombre: "Raiz", minimo: 250, siguiente: 500, siguienteNombre: "Bosque", recompensa: "15% de descuento y una donacion a reforestacion." },
    { nombre: "Bosque", minimo: 500, siguiente: 500, siguienteNombre: "Nivel maximo", recompensa: "Gracias por ser parte del cambio." }
  ];
  const nivel = niveles.find((item) => puntos < item.siguiente) || niveles[niveles.length - 1];
  const avance = nivel.siguiente === nivel.minimo ? 100 : ((puntos - nivel.minimo) / (nivel.siguiente - nivel.minimo)) * 100;
  document.getElementById("nivel-cliente").textContent = nivel.nombre;
  document.getElementById("puntos-cliente").textContent = `${puntos} puntos`;
  document.getElementById("proximo-nivel").textContent = nivel.nombre === "Bosque" ? "Nivel maximo" : `${nivel.siguiente - puntos} para ${nivel.siguienteNombre}`;
  document.getElementById("barra-fidelizacion").style.width = `${Math.max(0, Math.min(avance, 100))}%`;
  document.getElementById("recompensa-cliente").textContent = `Recompensa: ${nivel.recompensa}`;
  document.getElementById("mensaje-nivel").textContent = puntos ? "Cada compra te acerca a nuevos beneficios." : "Haz tu primera compra para comenzar.";
}

async function confirmarCompra() {
  if (!carrito.length) return;
  if (!usuarioActual) {
    mostrarUsuarioMensaje("Registra tus datos antes de confirmar la compra.", true);
    document.getElementById("usuario-nombre")?.focus();
    return;
  }
  const envioForm = document.getElementById("envio-form");
  if (envioForm && !envioForm.reportValidity()) return;
  const envio = envioForm ? Object.fromEntries(new FormData(envioForm).entries()) : {};
  const metodoPago = document.getElementById("metodo-pago")?.value || "simulado";
  const items = carrito.map((item) => ({ productoId: productoId(item.nombre), cantidad: item.cantidad }));
  if (apiConectada) {
    try {
      await asegurarUsuarioAPI();
      const respuesta = await fetch(`${API_BASE}/api/pedidos`, { method: "POST", headers: { "Content-Type": "application/json", ...cabecerasAutenticadas() }, body: JSON.stringify({ usuarioId: usuarioActual.id, items, envio, metodoPago, necesidad: "solucion conectada desde el carrito" }) });
      const datosRespuesta = await respuesta.json();
      if (!respuesta.ok) throw new Error(datosRespuesta.error || "No se pudo confirmar el pedido");
      const pedido = datosRespuesta;
      usuarioActual.puntos = (usuarioActual.puntos || 0) + pedido.puntosGanados;
      localStorage.setItem("verdiqo-usuario", JSON.stringify(usuarioActual));
      metricas.pedidos = (metricas.pedidos || 0) + 1;
      metricas.compras += pedido.unidades;
      metricas.co2Evitado += pedido.co2Evitado;
      metricas.comisionVerdiqo = (metricas.comisionVerdiqo || 0) + pedido.comisionVerdiqo;
      carrito.length = 0;
      guardarEstado(); renderCarrito(); renderCatalogo(); renderImpacto(); actualizarMetricas();
      mostrarConfirmacion(pedido);
      cargarHistorialPedidos();
      return;
    } catch (error) {
      mostrarUsuarioMensaje(error.message || "No se pudo confirmar el pedido.", true);
      return;
    }
  }
  carrito.forEach((item) => {
    const producto = buscarProducto(item.nombre);
    producto.stock -= item.cantidad;
    metricas.compras += item.cantidad;
    metricas.co2Evitado += producto.co2 * item.cantidad;
  });
  metricas.pedidos = (metricas.pedidos || 0) + 1;
  metricas.proveedores = [...new Set([...(metricas.proveedores || []), ...carrito.map((item) => buscarProducto(item.nombre).proveedor)])];
  carrito.length = 0;
  guardarEstado();
  renderCatalogo();
  renderCarrito();
  renderImpacto();
  mostrarConfirmacion({ id: "local", total: items.reduce((suma, item) => suma + buscarProducto(item.nombre).precio * item.cantidad, 0), puntosGanados: items.reduce((suma, item) => suma + item.cantidad * 10, 0), envio });
}

function mostrarConfirmacion(pedido) {
  const panel = document.getElementById("pedido-confirmado");
  if (!panel) return;
  panel.hidden = false;
  panel.innerHTML = `<strong>Pedido confirmado</strong><span>Referencia: ${pedido.id}</span><span>Total: $${Number(pedido.total).toFixed(2)} · +${pedido.puntosGanados} puntos</span><span>Envío a ${pedido.envio.ciudad}, ${pedido.envio.codigoPostal}</span>`;
}

async function cargarHistorialPedidos() {
  const panel = document.getElementById("historial-pedidos");
  const lista = document.getElementById("lista-pedidos");
  if (!panel || !lista || !usuarioActual || !apiConectada) return;
  try {
    const respuesta = await fetch(`${API_BASE}/api/pedidos?usuarioId=${encodeURIComponent(usuarioActual.id)}`, { headers: cabecerasAutenticadas() });
    if (!respuesta.ok) return;
    const pedidos = await respuesta.json();
    panel.hidden = false;
    lista.innerHTML = pedidos.length ? pedidos.slice().reverse().map((pedido) => `<article class="pedido-historico"><strong>${pedido.id}</strong><span>${new Date(pedido.fecha).toLocaleDateString("es-ES")} · ${pedido.unidades} unidades · $${pedido.total.toFixed(2)}</span><small>${pedido.estado} · Envío a ${pedido.envio.ciudad}</small></article>`).join("") : "<p>Aún no tienes pedidos anteriores.</p>";
  } catch { panel.hidden = true; }
}

function mostrarUsuarioMensaje(mensaje, error = false) {
  const panel = document.getElementById("usuario-mensaje");
  if (panel) { panel.textContent = mensaje; panel.classList.toggle("mensaje-error", error); }
}

async function registrarUsuario(evento) {
  evento.preventDefault();
  const nombre = document.getElementById("usuario-nombre").value.trim();
  const email = document.getElementById("usuario-email").value.trim();
  try {
    let usuario;
    if (apiConectada) {
      const password = document.getElementById("usuario-password").value;
      const respuesta = await fetch(`${API_BASE}/api/usuarios`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, email, password }) });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.error || "No se pudo registrar la cuenta");
      usuario = datos;
      tokenSesion = datos.token || "";
      localStorage.setItem("verdiqo-token", tokenSesion);
    } else {
      usuario = { id: `local_${Date.now()}`, nombre, email, puntos: 0 };
    }
    usuarioActual = usuario;
    localStorage.setItem("verdiqo-usuario", JSON.stringify(usuarioActual));
    mostrarUsuarioMensaje(`Cuenta lista para ${usuarioActual.nombre}. Puntos acumulados: ${usuarioActual.puntos}.`);
    document.getElementById("usuario-form").hidden = true;
    renderCarrito();
  } catch (error) {
    mostrarUsuarioMensaje(error.message, true);
  }
}

async function iniciarSesion(evento) {
  evento.preventDefault();
  if (!apiConectada) {
    mostrarUsuarioMensaje("La API debe estar conectada para iniciar sesión.", true);
    return;
  }
  try {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const respuesta = await fetch(`${API_BASE}/api/sesiones`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.error || "No se pudo iniciar sesión");
    usuarioActual = datos;
    tokenSesion = datos.token || "";
    localStorage.setItem("verdiqo-usuario", JSON.stringify(usuarioActual));
    localStorage.setItem("verdiqo-token", tokenSesion);
    mostrarUsuarioMensaje(`Sesión iniciada: ${usuarioActual.nombre}. Puntos acumulados: ${usuarioActual.puntos || 0}.`);
    document.getElementById("usuario-form").hidden = true;
    document.getElementById("login-form").hidden = true;
    document.getElementById("cerrar-sesion").hidden = false;
  } catch (error) {
    mostrarUsuarioMensaje(error.message, true);
  }
}

function cerrarSesion() {
  usuarioActual = null;
  tokenSesion = "";
  localStorage.removeItem("verdiqo-usuario");
  localStorage.removeItem("verdiqo-token");
  document.getElementById("usuario-form").hidden = false;
  document.getElementById("login-form").hidden = false;
  document.getElementById("cerrar-sesion").hidden = true;
  mostrarUsuarioMensaje("Registra tu nombre y email para asociar la compra a tu cuenta y acumular puntos.");
}

function guardarEstado() {
  localStorage.setItem("verdiqo-carrito", JSON.stringify(carrito));
  localStorage.setItem("verdiqo-metricas", JSON.stringify(metricas));
  localStorage.setItem("verdiqo-inventario", JSON.stringify(Object.fromEntries(productos.map((producto) => [producto.nombre, producto.stock]))));
}

function renderCarrito() {
  const totalProductos = carrito.reduce((total, item) => total + item.cantidad, 0);
  const contador = document.getElementById("contador-carrito");
  const contenido = document.getElementById("carrito-contenido");
  if (contador) contador.textContent = totalProductos;
  if (!contenido) return;
  document.getElementById("carrito-total").textContent = `${totalProductos} producto${totalProductos === 1 ? "" : "s"}`;
  document.getElementById("confirmar-compra").hidden = totalProductos === 0;
  const checkout = document.getElementById("checkout-usuario");
  if (checkout) checkout.hidden = totalProductos === 0;
  if (!carrito.length) {
    contenido.innerHTML = '<p class="carrito-vacio">Todavia no has elegido productos. Tu seleccion aparecera aqui.</p>';
    document.getElementById("resumen-carrito").innerHTML = "";
    document.getElementById("recomendaciones").innerHTML = "";
    return;
  }
  contenido.innerHTML = carrito.map((item) => {
    const producto = buscarProducto(item.nombre);
    return `<div class="carrito-linea"><p><strong>${item.nombre}</strong><br><small>${producto.proveedor} · $${(producto.precio * item.cantidad).toFixed(2)}</small></p><div class="cantidad-control"><button class="cantidad-boton" data-cantidad="${item.nombre}" data-cambio="-1" aria-label="Disminuir cantidad">−</button><strong>${item.cantidad}</strong><button class="cantidad-boton" data-cantidad="${item.nombre}" data-cambio="1" aria-label="Aumentar cantidad" ${item.cantidad >= producto.stock ? "disabled" : ""}>+</button><button class="boton-eliminar" data-eliminar="${item.nombre}">Quitar</button></div></div>`;
  }).join("");
  const total = carrito.reduce((suma, item) => suma + buscarProducto(item.nombre).precio * item.cantidad, 0);
  document.getElementById("resumen-carrito").innerHTML = `<span>Total estimado</span><strong>$${total.toFixed(2)} · ${calcularImpactoCarrito().toFixed(2)} kg CO2 evitados</strong>`;
  renderRecomendaciones();
}

function calcularImpactoCarrito() {
  return carrito.reduce((total, item) => total + buscarProducto(item.nombre).co2 * item.cantidad, 0);
}

function renderRecomendaciones() {
  const panel = document.getElementById("recomendaciones");
  if (!panel) return;
  const categorias = new Set(carrito.map((item) => buscarProducto(item.nombre).categoria));
  const sugeridos = productos.filter((producto) => !carrito.some((item) => item.nombre === producto.nombre) && (categorias.has(producto.categoria) || producto.stock > 0)).slice(0, 3);
  panel.innerHTML = sugeridos.length ? `<h3>Soluciones relacionadas</h3><div class="recomendaciones-grid">${sugeridos.map((producto) => `<article class="recomendacion"><p><strong>${producto.nombre}</strong></p><small>${producto.proveedor} · $${producto.precio.toFixed(2)}</small><button class="boton boton-mini" data-producto="${producto.nombre}">Añadir</button></article>`).join("")}</div>` : "";
}

function renderImpacto() {
  if (!document.getElementById("co2-total")) return;
  const totalProductos = carrito.reduce((total, item) => total + item.cantidad, 0);
  const totalCo2 = carrito.reduce((total, item) => total + buscarProducto(item.nombre).co2 * item.cantidad, 0);
  document.getElementById("co2-total").textContent = `${(metricas.co2Evitado + totalCo2).toFixed(2)} kg`;
  document.getElementById("material-total").textContent = `${(metricas.compras + totalProductos) * 2} kg`;
  document.getElementById("productos-total").textContent = metricas.compras + totalProductos;
  document.getElementById("barra-material").style.width = `${Math.min((metricas.compras + totalProductos) * 12, 100)}%`;
  document.getElementById("barra-productos").style.width = `${Math.min((metricas.compras + totalProductos) * 10, 100)}%`;
}

function actualizarAccesoEmpresa() {
  const encabezado = document.querySelector("header");
  const proveedor = JSON.parse(localStorage.getItem("verdiqo-proveedor") || "null");
  if (!encabezado || !proveedor || proveedor.estado !== "activo" || encabezado.querySelector(".empresa-link")) return;
  const enlace = document.createElement("a");
  enlace.className = "empresa-link";
  enlace.href = "proveedor-panel.html";
  enlace.textContent = "Mi empresa";
  encabezado.insertBefore(enlace, encabezado.querySelector(".cuenta-link") || encabezado.querySelector(".carrito-link"));
}

document.addEventListener("DOMContentLoaded", () => {
  const encabezado = document.querySelector("header");
  const actualizarEncabezado = () => encabezado?.classList.toggle("encabezado-desplazado", window.scrollY > 12);
  window.addEventListener("scroll", actualizarEncabezado, { passive: true });
  actualizarEncabezado();
  actualizarAccesoEmpresa();
  const menu = document.getElementById("menu-lateral");
  const fondoMenu = document.querySelector(".menu-fondo");
  const botonMenu = document.querySelector(".menu-toggle");
  const cerrarMenu = () => {
    if (!menu) return;
    menu.classList.remove("abierto");
    fondoMenu.classList.remove("visible");
    menu.setAttribute("aria-hidden", "true");
    botonMenu.setAttribute("aria-expanded", "false");
  };
  if (menu && botonMenu) {
    botonMenu.addEventListener("click", () => {
      menu.classList.add("abierto");
      fondoMenu.classList.add("visible");
      menu.setAttribute("aria-hidden", "false");
      botonMenu.setAttribute("aria-expanded", "true");
    });
    menu.querySelector(".menu-cerrar").addEventListener("click", cerrarMenu);
    fondoMenu.addEventListener("click", cerrarMenu);
    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") cerrarMenu();
    });
  }
  if (document.getElementById("catalogo")) renderCatalogo();
  renderCarrito();
  renderImpacto();

  const catalogo = document.getElementById("catalogo");
  if (catalogo) catalogo.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-producto]");
    if (boton) anadirAlCarrito(boton.dataset.producto);
  });
  const buscador = document.getElementById("buscar-producto");
  const filtros = document.querySelectorAll("[data-filtro]");
  let filtroActual = "todos";
  if (buscador) buscador.addEventListener("input", () => renderCatalogo(filtroActual, buscador.value));
  filtros.forEach((filtro) => filtro.addEventListener("click", () => {
    filtroActual = filtro.dataset.filtro;
    filtros.forEach((boton) => boton.classList.toggle("activo", boton === filtro));
    renderCatalogo(filtroActual, buscador ? buscador.value : "");
  }));
  const contenidoCarrito = document.getElementById("carrito-contenido");
  if (contenidoCarrito) contenidoCarrito.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-eliminar]");
    const control = evento.target.closest("[data-cantidad]");
    if (boton) eliminarDelCarrito(boton.dataset.eliminar);
    if (control) cambiarCantidad(control.dataset.cantidad, Number(control.dataset.cambio));
  });
  const recomendaciones = document.getElementById("recomendaciones");
  if (recomendaciones) recomendaciones.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-producto]");
    if (boton) anadirAlCarrito(boton.dataset.producto);
  });
  const confirmar = document.getElementById("confirmar-compra");
  if (confirmar) confirmar.addEventListener("click", confirmarCompra);
  const usuarioForm = document.getElementById("usuario-form");
  if (usuarioForm) usuarioForm.addEventListener("submit", registrarUsuario);
  const loginForm = document.getElementById("login-form");
  if (loginForm) loginForm.addEventListener("submit", iniciarSesion);
  const botonCerrarSesion = document.getElementById("cerrar-sesion");
  if (botonCerrarSesion) botonCerrarSesion.addEventListener("click", cerrarSesion);
  if (usuarioActual) {
    mostrarUsuarioMensaje(`Cuenta activa: ${usuarioActual.nombre}. Puntos acumulados: ${usuarioActual.puntos || 0}.`);
    usuarioForm.hidden = true;
    loginForm.hidden = true;
    botonCerrarSesion.hidden = false;
  }
  actualizarMetricas();
  sincronizarCatalogoAPI().then(cargarHistorialPedidos);
});
