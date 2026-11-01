MAKERFOX DESKTOP 1.1.0
======================

NOVEDADES
- Catálogo: tabla compacta de precios x2, x2.5, x3, x3.5, x4 y x5.
- Precio personalizado por producto con ganancia calculada.
- Muestra gramos por unidad y tiempo si el cálculo fue de una unidad.
- Calculadora en modalidad una unidad o lote de varias unidades.
- Pedidos: cliente, teléfono, descripción, fecha, prioridad, productos, cantidades, precio personalizado, anticipo, saldo y estado de pago.
- Estados de pedido: pendiente, en proceso, listo y entregado.
- Historial de entregados; no se borran al marcar como entregados.
- Respaldo completo ahora incluye pedidos.
- Conserva el mismo appId y la base IndexedDB MakerFoxDesktop; migra la base para añadir pedidos.

ACTUALIZACION
1. Abre MakerFox anterior y crea un respaldo completo.
2. Cierra MakerFox.
3. Extrae este ZIP en una carpeta nueva.
4. Ejecuta build-windows.bat.
5. En dist ejecuta MakerFox Setup 1.1.0.exe.
6. Instala sobre la versión anterior en la misma ubicación. No desinstales la anterior ni borres datos.

REQUISITOS
Windows 10/11 64-bit, Node.js LTS y conexión a internet para compilar.

NOTAS IMPORTANTES
- En modalidad lote se captura gramos y costos del lote; el tiempo se deja sin estimar.
- En modalidad lote el tiempo de máquina/electricidad/desgaste no se calcula porque no se proporcionó duración. Incluye cualquier costo de impresión que quieras recuperar en "Insumos extra del lote" o espera a una versión con duración opcional del lote.
- Para pedidos con más de una unidad o más de un producto no se muestra un tiempo estimado, por la variación de distribución y tiempos.
- El actualizador tiene una pestaña informativa, pero la descarga automática no se activa hasta configurar un servidor/repositorio de publicación.
- El respaldo JSON guarda productos, archivos adjuntos, modelos, pedidos y configuración. Conserva una copia externa.
- Los archivos se mantienen en almacenamiento local del perfil de MakerFox.


ACTUALIZACIONES AUTOMATICAS - VERSION 1.1.1
- Las actualizaciones se consultan desde GitHub Releases.
- La version descargada se instala al cerrar y volver a abrir MakerFox.
- Para publicar una nueva version, aumenta version en package.json y utiliza publish-windows.bat.
- No guardes GH_TOKEN en archivos del proyecto ni lo subas al repositorio.
- La primera instalacion de 1.1.1 debe hacerse manualmente; las versiones anteriores 1.1.0 no incluyen el componente de actualizacion.
