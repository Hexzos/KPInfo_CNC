## KPInfo CNC v1.0 (Legacy / MVP Intranet)

Sistema Web de Registro de Producción CNC desarrollado como **MVP inicial**, orientado a ejecución **local o en red interna (intranet)**, sin dependencias de frameworks.

Este repositorio corresponde a la **versión 1.0 (legacy)** del proyecto KPInfo CNC.  
Representa la primera iteración funcional del sistema, previa a la incorporación de una arquitectura web multiusuario y controles de seguridad avanzados.

---

### Alcance de esta versión
- Registro de pedidos de producción CNC.
- Registro y gestión básica de anomalías.
- Exportación de datos en formato CSV.
- Backend en Python (servidor HTTP propio).
- Base de datos SQLite.
- Frontend en HTML / CSS / JavaScript puro.

---

### Limitaciones conocidas
Esta versión **NO incluye**:
- Capa 2 de administración.
- CRUD de usuarios.
- Inicio de sesión seguro (RBAC).
- Sistema de recuperación/cambio de contraseña.
- Controles de rate-limit o mitigación de abuso.
- Soporte para despliegue web público o cloud.

Estas funcionalidades fueron incorporadas posteriormente en la **versión 2.0**, desarrollada en un repositorio independiente.

---

### Estado del proyecto
- **Estado:** Congelado / Legacy  
- **Uso recomendado:** Referencia académica y técnica del MVP inicial.  
- **Mantenimiento:** No se planifican nuevas funcionalidades sobre esta versión.

---

## Ejecución en entorno local

1. Abrir una terminal en la carpeta raíz del proyecto:
   ```bash
   KPInfo_CNC/
   
2. Ejecutar:
   ```bash
   python -m server.server
   ```
3. Abrir en navegador:
   - http://127.0.0.1:8000/
   - API: http://127.0.0.1:8000/api/catalogos
>>>>>>> 6e5f244 (MVP KPInfo CNC)
