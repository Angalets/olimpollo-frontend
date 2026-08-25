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
                notas: item.notas || ''
            };
        }
        agrupados[key].cantidad += item.cantidad || 1;
    });
    return Object.values(agrupados);
}

// Envía el pedido (crea uno nuevo, o actualiza uno existente si se pasa pedidoIdParaEditar).
// Lanza un Error con el mensaje real del backend si la petición falla.
async function enviarPedido(apiBase, token, payload, pedidoIdParaEditar) {
    const url = pedidoIdParaEditar ? `${apiBase}/pedidos/${pedidoIdParaEditar}` : `${apiBase}/pedidos`;
    const method = pedidoIdParaEditar ? 'PUT' : 'POST';

    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error al guardar el pedido.');
    return data;
}
