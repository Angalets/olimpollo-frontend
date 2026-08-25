// pos-common.js
// Lógica de negocio compartida entre pedidos.html (POS diario) y pos_festival.html (POS de eventos).
// El diseño del carrito, del ticket impreso y del menú se queda en cada página: solo vive aquí
// lo que de verdad es idéntico entre ambas — armar los items del pedido y enviarlo al backend.

// Convierte el carrito en el arreglo de items que espera POST/PUT /api/pedidos, agrupando
// líneas idénticas (mismo producto + mismos modificadores + misma nota) y sumando su cantidad.
// Funciona tanto si el carrito ya trae `cantidad` por línea (pedidos.html) como si cada tap
// agrega una línea nueva de cantidad implícita 1 (pos_festival.html).
function buildPedidoItems(carrito) {
    const agrupados = {};
    carrito.forEach(item => {
        const key = `${item.id}-${item.mods || ''}-${item.notas || ''}`;
        if (!agrupados[key]) {
            agrupados[key] = {
                menu_producto_id: item.id,
                nombre_producto_completo: item.nombre + (item.mods ? ` (${item.mods})` : ''),
                cantidad: 0,
                precio_unitario: item.precio,
                notas: item.notas || '',
                detalle_componentes: item.detalleComponentes ? JSON.stringify(item.detalleComponentes) : null
            };
        }
        agrupados[key].cantidad += item.cantidad || 1;
    });
    return Object.values(agrupados);
}

// Genera un id de un solo uso para identificar UN intento de cobro, sin importar cuántas veces
// se reintente por debajo. Así, si el internet se corta justo después de que el pedido ya se
// guardó pero antes de que la respuesta llegue, un reintento con el mismo id no crea un pedido
// duplicado: el backend lo reconoce y regresa el que ya existe.
function generarRequestId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'r-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

// Reintenta una petición cuando falla por falta de conexión (no reintenta respuestas de error del
// servidor como 400/401/409 — esas ya son una respuesta real, no un problema de red). Pensado para
// cortes de luz/internet de unos minutos: reintenta con espera creciente hasta por ~3 minutos.
async function fetchConReintento(url, options, { maxMs = 180000, onReintento } = {}) {
    const inicio = Date.now();
    let intento = 0;
    while (true) {
        try {
            return await fetch(url, options);
        } catch (err) {
            intento++;
            const transcurrido = Date.now() - inicio;
            if (transcurrido >= maxMs) {
                throw new Error('Seguimos sin conexión. En cuanto vuelva el internet, presiona el botón otra vez — es seguro, no se va a duplicar.');
            }
            if (onReintento) onReintento(intento, transcurrido);
            const espera = Math.min(1000 * 2 ** Math.min(intento - 1, 4), 10000);
            await new Promise(r => setTimeout(r, espera));
        }
    }
}

// Muestra/oculta un banner fijo arriba de la pantalla para avisar que se está reintentando por
// falta de conexión. Se inyecta por JS para no depender del CSS de cada página que lo use.
function mostrarEstadoConexion(mensaje) {
    let el = document.getElementById('banner-conexion');
    if (!el) {
        el = document.createElement('div');
        el.id = 'banner-conexion';
        el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#e67e22;color:white;text-align:center;padding:10px;font-family:sans-serif;font-weight:bold;font-size:14px;';
        document.body.appendChild(el);
    }
    el.textContent = mensaje;
}
function ocultarEstadoConexion() {
    const el = document.getElementById('banner-conexion');
    if (el) el.remove();
}

// Envía el pedido (crea uno nuevo, o actualiza uno existente si se pasa pedidoIdParaEditar).
// Lanza un Error con el mensaje real del backend si la petición falla. requestId solo aplica a
// pedidos nuevos (las ediciones son un PUT que reemplaza el pedido completo, así que repetirlo
// no duplica nada). onReintento(intento, msTranscurridos) se llama en cada reintento por falta
// de conexión, para que la pantalla pueda avisarle al cajero.
async function enviarPedido(apiBase, token, payload, pedidoIdParaEditar, requestId, onReintento) {
    const url = pedidoIdParaEditar ? `${apiBase}/pedidos/${pedidoIdParaEditar}` : `${apiBase}/pedidos`;
    const method = pedidoIdParaEditar ? 'PUT' : 'POST';
    const body = (!pedidoIdParaEditar && requestId) ? { ...payload, request_id: requestId } : payload;

    const res = await fetchConReintento(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
    }, { onReintento });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error al guardar el pedido.');
    return data;
}
