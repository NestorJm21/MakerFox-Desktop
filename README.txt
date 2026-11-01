MAKERFOX DESKTOP - WINDOWS
==========================

QUE INCLUYE
- Calculadora de costos para impresion 3D.
- Catalogo local con codigos por categoria.
- Fotografias y archivos 3D asociados.
- Biblioteca de modelos 3D.
- Respaldo y restauracion JSON.
- Configuracion editable de costos base.

REQUISITOS PARA CREAR EL INSTALADOR
1. Windows 10/11 de 64 bits.
2. Conexion a internet durante la primera compilacion.
3. Node.js LTS: https://nodejs.org/

COMO CREAR EL INSTALADOR
1. Extrae MakerFox_Windows.zip en una carpeta, por ejemplo Documentos.
2. Instala Node.js LTS si no lo tienes.
3. Abre la carpeta extraida.
4. Haz doble clic en build-windows.bat.
5. Espera a que termine. La primera vez puede tardar varios minutos.
6. Abre la carpeta dist.
7. Ejecuta MakerFox Setup 1.0.0.exe.
8. Sigue el asistente y deja marcada la creacion del acceso directo.

PARA PROBAR SIN INSTALAR
Abre una terminal en esta carpeta y ejecuta:
  npm install
  npm start

DATOS Y PRIVACIDAD
MakerFox guarda datos en IndexedDB del perfil local de la aplicacion.
No se envia informacion a un servidor.
No borres los datos de la aplicacion desde Windows ni uses limpiadores sin
tener primero un respaldo JSON reciente.
Usa Respaldo > Descargar respaldo completo para guardar productos, fotos,
modelos y configuracion. Conserva una copia en otra unidad o USB.

NOTAS
- Esta es una primera version de trabajo.
- La aplicacion no sincroniza automaticamente con otros equipos.
- No incluye visor ni reparador de archivos STL/3MF; conserva y descarga
  los archivos originales.
- Revisa todos los calculos y valida los precios antes de vender.
- Antes de una restauracion, crea un respaldo del estado actual.
