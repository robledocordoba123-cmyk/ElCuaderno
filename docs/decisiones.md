# Decisiones de diseño

Cada decisión tiene lo que se escogió, qué otras opciones había y qué se paga por ella. Sirve para entender el código y para no volver a discutir lo ya decidido sin una razón nueva.

### D-01 · El dinero en pesos enteros (`integer`)
- **Se escogió:** guardar todo en pesos enteros, sin decimales, validado con Zod (`int()`).
- **Alternativas:** `numeric(12,2)` o `float`.
- **Por qué:** en Colombia los precios no llevan centavos, y con `float` aparecen errores de redondeo (0,1 + 0,2 ≠ 0,3).
- **Costo:** si algún día se vendiera en otra moneda con centavos, habría que migrar a centésimas.

### D-02 · La base de datos decide si hay stock
- **Se escogió:** `UPDATE productos SET stock = stock − n WHERE id = ? AND stock >= n` dentro de la transacción de la venta, más un `CHECK (stock >= 0)`.
- **Alternativas:** leer el stock, comparar en el código y luego escribir; o bloquear la fila con `FOR UPDATE`.
- **Por qué:** leer y luego escribir permite que dos cajeros vendan la misma última unidad. El `UPDATE` condicional es atómico, no espera bloqueos y una prueba de 5 ventas simultáneas lo demuestra.
- **Costo:** el mensaje de error necesita una consulta extra para decir cuántas quedan.

### D-03 · La deuda se calcula, no se guarda
- **Se escogió:** deuda = fiados no anulados − abonos, con subconsultas SQL cada vez que se pide.
- **Alternativas:** una columna `deuda` en `clientes` que se actualiza con cada venta y abono.
- **Por qué:** una columna calculada a mano se desincroniza con el primer error (una anulación, un reintento). Una tienda tiene cientos de movimientos, no millones: el cálculo es instantáneo.
- **Costo:** si hubiera millones de filas, convendría una vista materializada.

### D-04 · Bloquear al cliente al fiar o abonar
- **Se escogió:** `SELECT ... FOR UPDATE` sobre el cliente antes de validar el cupo.
- **Alternativas:** validar sin bloquear.
- **Por qué:** dos fiados al mismo tiempo podrían ver la misma deuda vieja y pasarse juntos del cupo. Con el bloqueo, el segundo espera al primero.
- **Costo:** dos ventas fiadas al mismo vecino en el mismo instante se atienden una tras otra (es lo correcto).

### D-05 · Anular en vez de borrar
- **Se escogió:** la venta equivocada se marca anulada, con fecha, quién y motivo. Las unidades vuelven al inventario. Solo se anulan ventas de hoy y no se anula un fiado que el vecino ya abonó.
- **Alternativas:** borrar la venta, o editarla.
- **Por qué:** borrar deja la caja de ese día sin explicación. Limitarlo a hoy evita cambiar cierres pasados, y bloquear el fiado abonado evita dejar al vecino con saldo a favor.
- **Costo:** corregir una venta de ayer exige registrarla de nuevo con el monto bueno.

### D-06 · Sesión en cookie httpOnly a través del mismo dominio
- **Se escogió:** el JWT viaja en una cookie `HttpOnly; Secure; SameSite=Strict; Path=/api`. La web llama a `/api` en su dominio y Vercel la reenvía a Render.
- **Alternativas:** guardar el token en `localStorage` y mandarlo en `Authorization`; o una cookie entre dominios con `SameSite=None`.
- **Por qué:** en `localStorage`, cualquier script inyectado se lleva el token. Una cookie entre dominios exige CORS con credenciales y abre la puerta al CSRF. Con el mismo dominio, la cookie es estricta.
- **Costo:** depende de la reescritura de Vercel; en local la imita el proxy de Vite.

### D-07 · Versión de sesión revisada en cada petición
- **Se escogió:** `usuarios.version_sesion`, que va dentro del JWT (`v`) y que la guarda compara en cada petición. Sube al desactivar, al poner clave temporal o al cambiar la propia clave.
- **Alternativas:** JWT puro sin consulta, esperando a que venza (8 h); o una lista negra de tokens.
- **Por qué:** un cajero que se fue no puede seguir vendiendo 8 horas. Una consulta por llave primaria cuesta menos de un milisegundo y no hay que guardar tokens.
- **Costo:** la API ya no es 100 % "sin estado": cada petición toca la base. Es aceptable porque casi todas ya lo hacían.

### D-08 · Límites de intentos por correo, no por IP
- **Se escogió:** 5 fallos de login por correo en 15 minutos; 20 registros de tiendas por hora para toda la API.
- **Alternativas:** límite por IP.
- **Por qué:** todas las peticiones llegan a Render desde el proxy de Vercel, así que por IP todos los usuarios serían "la misma persona".
- **Costo:** los contadores viven en memoria. Con varias instancias de la API, tendrían que ir a la base o a Redis.

### D-09 · Bitácora inmutable y sin llaves foráneas
- **Se escogió:** un interceptor anota cada cambio que salió bien. Un trigger de PostgreSQL impide `UPDATE` y `DELETE`, y la tabla guarda el nombre del usuario en lugar de depender de él.
- **Alternativas:** registrar desde cada servicio; permitir editar.
- **Por qué:** la dueña necesita confiar en que nadie borró rastro. Si fuera editable, no serviría como control.
- **Costo:** la recarga de la demo necesita una excepción explícita (`set_config` dentro de su transacción) para vaciarla.

### D-10 · De los vecinos, la bitácora solo guarda el número (Ley 1581)
- **Se escogió:** "Creó un cliente · Cliente #12", nunca el nombre. Sin autorización del vecino no se guarda el cliente, y la supresión borra nombre y teléfono pero conserva las compras sin datos personales.
- **Alternativas:** guardar el nombre para que la bitácora sea más legible.
- **Por qué:** si un vecino pide borrar sus datos, una tabla inmutable no puede quedarse con su nombre.
- **Costo:** para saber quién es el cliente #12 hay que abrir Fiados.

### D-11 · Precio y costo del momento en cada detalle
- **Se escogió:** el detalle guarda precio unitario, costo unitario, subtotal y costo total al vender. Caja y reportes suman esas columnas.
- **Alternativas:** calcular con el precio actual del producto.
- **Por qué:** si mañana sube el arroz, las ventas y la ganancia de ayer no pueden cambiar.
- **Costo:** algunas columnas repetidas por cada línea de venta.

### D-12 · Venta a granel: precio por kilo, stock en gramos, redondeo a $50
- **Se escogió:** el producto "por peso" guarda precio y costo por kilo y el stock en gramos enteros. El subtotal se redondea a los $50 más cercanos y la misma función (`subtotalLinea`) la usan la web y la API.
- **Alternativas:** decimales de kilo; un producto por cada presentación (¼ lb, ½ lb).
- **Por qué:** así funcionan las básculas de las tiendas, los gramos enteros evitan decimales, y no circulan monedas de menos de $50. Un producto no puede cambiar de "por unidad" a "por peso", porque su historial quedaría mezclado.
- **Costo:** el cobro puede diferir unos pesos del cálculo exacto (siempre al múltiplo de 50 más cercano).

### D-13 · Costo promedio ponderado en cada llegada
- **Se escogió:** al llegar mercancía, costo nuevo = (stock × costo actual + llegada × costo de compra) ÷ stock total.
- **Alternativas:** dejar el último costo; costeo FIFO por lotes.
- **Por qué:** refleja lo que de verdad pagó la tienda sin llevar lotes, que una tienda de barrio no maneja.
- **Costo:** no sirve para trazar lotes ni vencimientos.

### D-14 · "Hoy" en hora de Colombia, calculado en la base
- **Se escogió:** los días se calculan con `America/Bogota` en las consultas, y la zona entra con `sql.raw` después de validarla con una expresión regular.
- **Alternativas:** días en UTC; calcular en JavaScript.
- **Por qué:** en UTC, una venta a las 8 p. m. caería en el día siguiente. Pasar la zona como parámetro hacía que el `GROUP BY` no coincidiera con el `SELECT` y la consulta fallaba.
- **Costo:** hay que mantener la validación de la zona para que `sql.raw` sea seguro.

### D-15 · Un cajero no se borra: se desactiva
- **Se escogió:** `usuarios.activo` y un máximo de 10 cajeros activos; las cuentas de la demo no se pueden tocar.
- **Alternativas:** borrar al usuario.
- **Por qué:** sus ventas, abonos y la bitácora lo nombran. Borrarlo rompería el historial o las llaves foráneas.
- **Costo:** su correo queda ocupado; para volver, se reactiva la misma cuenta.

### D-16 · Pruebas contra PostgreSQL real, de punta a punta con Playwright
- **Se escogió:** Jest + Supertest contra una base de pruebas real, y Playwright contra la app compilada, con axe para la accesibilidad.
- **Alternativas:** simular la base (mocks) y probar solo unidades.
- **Por qué:** lo importante de este sistema vive en la base (bloqueos, `CHECK`, el trigger, las zonas horarias), y un mock no lo prueba. Playwright y axe encontraron problemas que las pruebas de la API no podían ver (contraste, botones sin nombre en el celular).
- **Costo:** el CI necesita un PostgreSQL de servicio y tarda unos minutos más.

### D-17 · La demo se siembra en cada arranque
- **Se escogió:** `migrar → sembrar → arrancar` en Render. La tienda de demo se reconoce por el correo de su dueña, y de paso se borran las tiendas de prueba de más de 7 días.
- **Alternativas:** sembrar una sola vez; una tarea programada aparte.
- **Por qué:** cualquiera puede anular ventas o cambiar precios en la demo, y en el siguiente arranque vuelve a quedar limpia. Reconocerla por el nombre era peligroso: alguien podía registrar otra tienda llamada igual.
- **Costo:** en la demo pública los datos de prueba no duran. Está avisado en el registro.
