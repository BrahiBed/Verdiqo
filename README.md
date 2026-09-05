# Verdiqo

Prototipo beta de una plataforma que conecta necesidades con soluciones sostenibles.

## Estructura

- `index.html`, `productos.html`, `carrito.html`, `impacto.html`, `fidelizacion.html`: paginas de la app.
- `estilos.css`, `script.js`: interfaz y logica del cliente.
- `agente-beta.js`: API local del agente beta.
- `agente-beta.test.js`: prueba automatizada.
- `verdiqo-logo.png`: identidad visual.
- `beta-data.json`: persistencia local de la beta.

## Comandos

```bash
npm start
npm test
```

La interfaz puede servirse desde `index.html`. La API beta usa el puerto `3000` y pagos simulados.

En `carrito.html`, el checkout permite registrar una cuenta o iniciar sesión con email y contraseña. Las contraseñas se almacenan como hash, la API entrega sesiones temporales mediante token y protege pedidos e historial. El usuario y el token se conservan en `localStorage` durante esta beta.

El checkout también solicita datos de envío, muestra una confirmación y permite consultar el historial de pedidos del usuario.

El área de proveedores está separada dentro de `api.html`, conservando el centro de operaciones existente. Al enviar el registro aparece una ventana de confirmación y la solicitud queda en estado `pendiente_revision`, con un proceso beta de verificación en tres pasos: identidad, actividad del negocio y catálogo responsable. Hasta ser aceptado, el proveedor no puede publicar productos ni gestionar pedidos.

La sección unificada de cuenta está en `cuenta.html`: reúne acceso de compradores y proveedores. El carrito continúa guardándose en `localStorage` y no se borra al iniciar o cerrar sesión.

El checkout ya permite seleccionar el método de pago. El pago de prueba funciona en la beta; la opción de tarjeta queda bloqueada hasta configurar `STRIPE_SECRET_KEY`. No se almacenan datos de tarjetas en Verdiqo.
