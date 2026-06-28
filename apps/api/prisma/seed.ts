import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Contraseña de desarrollo para los 3 usuarios seed; cambiar en producción.
const DEV_PASSWORD = 'vibrarq123';

// venta = costo × markup del estudio (~50%), redondeada al millar — igual a mk() en Detalle de Obra.dc.html
const mk = (c: number) => (c ? Math.round((c * 1.5) / 1000) * 1000 : 0);

type CatalogRow = [codigo: string, desc: string, unidad: string, costo: number, mat: number, ventaOverride?: number];
type Rubro = { code: string; nombre: string; rows: CatalogRow[] };

// Catálogo CIFRAS completo — portado de seed() en designs/Detalle de Obra.dc.html
const CATALOGO: Rubro[] = [
  { code: '00', nombre: 'Honorarios Profesionales', rows: [
    ['00.01', 'Tareas de Proyecto / Dirección o Conducción Técnica', 'gl', 0, 0, 2400000],
  ]},
  { code: '01', nombre: 'Preliminares de Obra', rows: [
    ['01.01', 'Cartel de obra', 'u', 35000, .6],
    ['01.02', 'Cerco de obra', 'm', 9500, .55],
    ['01.03', 'Limpieza inicial del terreno; retiros grales.', 'gl', 62000, .15],
    ['01.04', 'Nivelación y replanteo de obra', 'gl', 84000, .2],
    ['01.05', 'Obrador, construcciones provisorias', 'gl', 145000, .5],
    ['01.06', 'Contenedor, volquete 5m³ (alquiler)', 'u', 42000, .9],
    ['01.07', 'Demolición de contrapisos y otros solados', 'm²', 6800, .1],
    ['01.08', 'Demolición estructuras de hormigón armado', 'm³', 38000, .1],
    ['01.09', 'Demolición mamposterías ladrillos comunes', 'm³', 18500, .1],
    ['01.10', 'Demolición mamposterías ladrillos huecos', 'm³', 14200, .1],
    ['01.11', 'Picado de revoques', 'm²', 3200, .05],
    ['01.12', 'Retiro de pisos/revestimientos', 'm²', 4100, .1],
  ]},
  { code: '02', nombre: 'Movimiento de Tierra', rows: [
    ['02.01', 'Desmonte; terraplenamientos y rellenos a máquina', 'm³', 6200, .2],
    ['02.02', 'Desmonte; terraplenamientos y rellenos manual', 'm³', 11500, .1],
    ['02.03', 'Excavación a máquina para subsuelo', 'm³', 7400, .2],
    ['02.04', 'Excavación manual para bases de columnas', 'm³', 9200, .1],
    ['02.05', 'Excavación manual para zapata de muros', 'm³', 8600, .1],
  ]},
  { code: '03', nombre: 'Estructuras', rows: [
    ['03.00', 'Bases H°A° H21/50kg', 'm³', 148000, .62],
    ['03.01', 'Columnas H°A° H21/90kg', 'm³', 166000, .6],
    ['03.02', 'Encadenado H°A° H21/65kg', 'm³', 158000, .6],
    ['03.03', 'Escalera H°A° H21/65kg', 'm³', 172000, .6],
    ['03.04', 'Losa H°A° con viguetas y ladrillón cerámico 12cm', 'm²', 38000, .64],
    ['03.05', 'Losa H°A° con viguetas y ladrillón poliestireno 12cm', 'm²', 40000, .64],
    ['03.06', 'Losa H°A° maciza H21/60kg', 'm²', 42000, .64],
    ['03.07', 'Tabiques H°A° H21/70kg', 'm³', 160000, .6],
    ['03.08', 'Tanques H°A° H21/120kg', 'm³', 195000, .6],
    ['03.09', 'Vigas H°A° H21/120kg', 'm³', 178000, .6],
    ['03.10', 'Zapata corrida muros H° cascotes', 'm³', 88000, .6],
    ['03.11', 'Zapata corrida muros H°A°', 'm³', 152000, .62],
    ['03.12', 'Hierros redondos', 'kg', 2800, .75],
    ['03.13', 'Perfiles ángulo', 'kg', 3100, .75],
    ['03.14', 'Perfiles normales', 'kg', 3300, .75],
  ]},
  { code: '04', nombre: 'Mamposterías y Tabiquerías', rows: [
    ['04.01', 'Bloques hcca 10×25×50cm', 'm²', 13500, .6],
    ['04.02', 'Bloques hcca 15×25×50cm', 'm²', 15800, .6],
    ['04.03', 'Bloques hcca 20×25×50cm', 'm²', 18200, .6],
    ['04.04', 'Bloques hormigón 10×20×40cm', 'm²', 11200, .6],
    ['04.05', 'Bloques hormigón 20×20×40cm', 'm²', 14800, .6],
    ['04.06', 'Ladrillos cerámicos decorativos 12×18×25cm', 'm²', 21500, .6],
    ['04.07', 'Ladrillos cerámicos huecos 08×18×33cm', 'm²', 13800, .6],
    ['04.08', 'Ladrillos cerámicos huecos 12×18×33cm', 'm²', 16500, .6],
    ['04.09', 'Ladrillos cerámicos huecos 18×18×33cm', 'm²', 19800, .6],
    ['04.10', 'Ladrillos comunes a la vista en elevación', 'm²', 24500, .55],
    ['04.11', 'Ladrillos comunes en cimientos', 'm²', 17200, .55],
    ['04.12', 'Ladrillos comunes en elevación', 'm²', 19500, .55],
    ['04.13', 'Placa cementícia doble 12,5cm exterior, con aislación', 'm²', 22500, .58],
    ['04.14', 'Placa de yeso doble 12,5cm, con aislación', 'm²', 19000, .58],
    ['04.15', 'Placa de yeso resistente a la humedad 9,5cm', 'm²', 14500, .58],
    ['04.16', 'Placa de yeso simple 8,5cm medio tabique interior', 'm²', 11800, .58],
    ['04.17', 'Placa de yeso simple 9,5cm interior, con aislación', 'm²', 14200, .58],
    ['04.18', 'Placa de yeso simple 9,5cm interior, sin aislación', 'm²', 12500, .58],
  ]},
  { code: '05', nombre: 'Aislaciones', rows: [
    ['05.01', 'Aislante acústico lana en rollo tipo Acustiver', 'm²', 7800, .7],
    ['05.02', 'Aislante acústico panel fonoabsorbente tipo Fonac', 'm²', 12500, .7],
    ['05.03', 'Cementícia doble horizontal en muros', 'm²', 5200, .5],
    ['05.04', 'Cementícia doble vertical en muros', 'm²', 5600, .5],
    ['05.05', 'Cementícia vertical con tabique panderete para subsuelo', 'm²', 9800, .5],
    ['05.06', 'Lana de vidrio con cara aluminio 50mm', 'm²', 6400, .75],
    ['05.07', 'Membrana espuma polietileno 10mm bajo techo', 'm²', 4200, .7],
    ['05.08', 'Pintura asfáltica sobre paramentos', 'm²', 2800, .55],
    ['05.09', 'Pintura impermeabilizante sobre paramentos', 'm²', 3400, .55],
  ]},
  { code: '06', nombre: 'Cubierta', rows: [
    ['06.01', 'Chapas H°G° N°25 color sobre estructura madera', 'm²', 24500, .6],
    ['06.02', 'Chapas H°G° N°25 color sobre estructura metálica', 'm²', 26800, .6],
    ['06.03', 'Chapas H°G° N°25 color sobre estructura mixta', 'm²', 25600, .6],
    ['06.04', 'Chapas H°G° N°25 sobre estructura madera', 'm²', 21500, .6],
    ['06.05', 'Chapas H°G° N°25 sobre estructura metálica', 'm²', 23800, .6],
    ['06.06', 'Chapas H°G° N°25 sobre estructura mixta', 'm²', 22600, .6],
    ['06.07', 'Plana completa terminación azotea verde', 'm²', 32000, .6],
    ['06.08', 'Plana completa terminación baldosa cerámica', 'm²', 21000, .6],
    ['06.09', 'Plana completa terminación doblado ladrillos comunes', 'm²', 18500, .55],
    ['06.10', 'Plana completa terminación membrana asfáltica c/aluminio', 'm²', 14500, .6],
    ['06.11', 'Plana completa terminación membrana geotextil', 'm²', 13200, .6],
    ['06.12', 'Tejas francesas esmaltadas color sobre losa c/aisl.', 'm²', 34500, .65],
    ['06.13', 'Tejas francesas esmaltadas color, est. madera sin cepillar c/aisl.', 'm²', 36800, .65],
    ['06.14', 'Tejas francesas esmaltadas color, est. madera vista c/aisl.', 'm²', 41000, .65],
    ['06.15', 'Tejas francesas esmaltadas sobre losa c/aisl.', 'm²', 32500, .65],
    ['06.16', 'Tejas francesas esmaltadas, est. madera sin cepillar c/aisl.', 'm²', 34800, .65],
    ['06.17', 'Tejas francesas esmaltadas, est. madera vista c/aisl.', 'm²', 39000, .65],
    ['06.18', 'Tejas francesas natural sobre losa c/aisl.', 'm²', 29500, .65],
    ['06.19', 'Tejas francesas natural, est. madera sin cepillar c/aisl.', 'm²', 31800, .65],
    ['06.20', 'Tejas francesas natural, est. madera vista c/aisl.', 'm²', 36000, .65],
  ]},
  { code: '07', nombre: 'Revoques', rows: [
    ['07.01', 'Azotado impermeable', 'm²', 3800, .45],
    ['07.02', 'Azotado impermeable en muro doble', 'm²', 5200, .45],
    ['07.03', 'Exterior a la cal común completo', 'm²', 9600, .45],
    ['07.04', 'Exterior completo, terminación material de frente', 'm²', 12800, .45],
    ['07.05', 'Fino a la cal', 'm²', 4600, .45],
    ['07.06', 'Fino/Estucado yeso', 'm²', 5400, .45],
    ['07.07', 'Grueso común', 'm²', 5800, .45],
    ['07.08', 'Impermeable de cemento', 'm²', 4200, .45],
    ['07.09', 'Interior a la cal común completo', 'm²', 8200, .45],
    ['07.10', 'Interior azotado y grueso b/revestimientos', 'm²', 6400, .45],
    ['07.11', 'Premezclado fino exterior (manual)', 'm²', 7200, .5],
    ['07.12', 'Premezclado fino interior (manual)', 'm²', 6800, .5],
    ['07.13', 'Premezclado grueso y fino interior (manual)', 'm²', 9400, .5],
    ['07.14', 'Premezclado grueso y fino interior (proyectable)', 'm²', 8600, .5],
    ['07.15', 'Premezclado impermeable, grueso y fino exterior (manual)', 'm²', 11200, .5],
    ['07.16', 'Premezclado impermeable, grueso y fino exterior (proyectable)', 'm²', 10400, .5],
    ['07.17', 'Toma de juntas de ladrillos vistos', 'm²', 4800, .4],
  ]},
  { code: '08', nombre: 'Contrapisos', rows: [
    ['08.01', 'Hormigón alivianado c/poliestireno expandido e=06cm', 'm²', 8200, .55],
    ['08.02', 'Hormigón alivianado c/poliestireno expandido e=08cm', 'm²', 9400, .55],
    ['08.03', 'Hormigón alivianado c/poliestireno expandido e=20cm, rellenos', 'm²', 16500, .55],
    ['08.04', 'Hormigón alivianado elaborado H8 e=6cm', 'm²', 8800, .55],
    ['08.05', 'Hormigón alivianado elaborado H8 e=8cm, banquinas', 'm²', 10200, .55],
    ['08.06', 'Hormigón armado e=12cm terminación a la llana', 'm²', 14500, .6],
    ['08.07', 'Hormigón de cascotes e=08cm', 'm²', 7600, .5],
    ['08.08', 'Hormigón de cascotes e=10cm', 'm²', 8400, .5],
    ['08.09', 'Hormigón de cascotes e=12cm', 'm²', 9200, .5],
    ['08.10', 'Mortero elaborado RDC e=6cm', 'm²', 6800, .55],
  ]},
  { code: '09', nombre: 'Cielorrasos', rows: [
    ['09.01', 'Hormigón visto (terminaciones)', 'm²', 5200, .4],
    ['09.02', 'Madera machimbrada suspendido con estructura madera', 'm²', 28500, .65],
    ['09.03', 'Mortero a la cal aplicado bajo losa', 'm²', 7400, .45],
    ['09.04', 'Placa de yeso común junta tomada, con aislación', 'm²', 16800, .55],
    ['09.05', 'Placa de yeso común junta tomada, sin aislación', 'm²', 14200, .55],
    ['09.06', 'Placa de yeso común para cajones, taparrollos', 'ml', 9800, .55],
    ['09.07', 'Placa de yeso resistente a la humedad junta tomada', 'm²', 17500, .55],
    ['09.08', 'Placa vinílica texturada desmontable, sin aislación', 'm²', 13500, .6],
    ['09.09', 'Yeso aplicado bajo losa', 'm²', 6200, .45],
    ['09.10', 'Yeso armado, con estructura madera', 'm²', 11800, .5],
  ]},
  { code: '10', nombre: 'Revestimientos', rows: [
    ['10.01', 'Cemento alisado', 'm²', 9800, .5],
    ['10.02', 'Cerámicos esmaltados', 'm²', 18500, .65],
    ['10.03', 'Granito reconstituido en escalones e:2,5cm', 'ml', 32000, .7],
    ['10.04', 'Mesada de granito natural e=2,5cm (gris mara)', 'ml', 68000, .75],
    ['10.05', 'Mesada de piedra natural e=2,5cm (travertino)', 'ml', 82000, .75],
    ['10.06', 'Plástico texturado', 'm²', 7200, .55],
    ['10.07', 'Porcellanato canto rectificado', 'm²', 28500, .68],
    ['10.08', 'Porcellanato sin rectificar', 'm²', 22500, .68],
    ['10.09', 'Tejuelas refractarias', 'm²', 24500, .65],
  ]},
  { code: '11', nombre: 'Pisos', rows: [
    ['11.01', 'Alfombra alto tránsito 8mm', 'm²', 16500, .7],
    ['11.02', 'Carpeta cemento bajo pisos', 'm²', 5800, .5],
    ['11.03', 'Cemento alisado', 'm²', 11500, .5],
    ['11.04', 'Cemento term. a la llana mecánica, incl. H° e=4cm', 'm²', 14800, .55],
    ['11.05', 'Cemento term. texturado/raspinado, incl. H° e=4cm', 'm²', 13200, .55],
    ['11.06', 'Cerámicas esmaltadas', 'm²', 19500, .65],
    ['11.07', 'Cerámicas rojas', 'm²', 14500, .6],
    ['11.08', 'Losetas de H° 40×60cm', 'm²', 16800, .6],
    ['11.09', 'Losetas graníticas 40×40cm', 'm²', 21500, .65],
    ['11.10', 'Madera flotante simil algarrobo e=8mm', 'm²', 24500, .7],
    ['11.11', 'Madera parquet algarrobo e=19mm', 'm²', 48000, .72],
    ['11.12', 'Madera semidura tipo deck', 'm²', 38500, .7],
    ['11.13', 'Mosaicos graníticos 30×30cm', 'm²', 22500, .65],
    ['11.14', 'Pavimento con adoquín intertrabado e=8cm', 'm²', 18500, .6],
    ['11.15', 'Porcellanato pulido', 'm²', 32000, .68],
    ['11.16', 'Porcellanato sin pulir', 'm²', 26500, .68],
  ]},
  { code: '12', nombre: 'Zócalos', rows: [
    ['12.01', 'Cemento alisado h=10cm', 'ml', 3200, .45],
    ['12.02', 'Cerámico esmaltado', 'ml', 4800, .6],
    ['12.03', 'Cerámico gres', 'ml', 5400, .6],
    ['12.04', 'Madera', 'ml', 7200, .65],
    ['12.05', 'Mosaico granítico 10×30cm', 'ml', 6200, .6],
    ['12.06', 'Perfil metálico', 'ml', 5800, .65],
    ['12.07', 'Porcellanato pulido', 'ml', 7800, .65],
  ]},
  { code: '13', nombre: 'Carpinterías', rows: [
    ['13.01', 'Puerta ingreso madera maciza', 'u', 285000, .8],
    ['13.02', 'Puerta interior madera placa ench. madera', 'u', 98000, .8],
    ['13.03', 'Puerta interior madera placa ench. mdf', 'u', 78000, .8],
    ['13.04', 'Rejas de hierro', 'm²', 42000, .75],
    ['13.05', 'Ventana / Puerta ventana aluminio', 'm²', 88000, .8],
    ['13.06', 'Ventana / Puerta ventana aluminio con postigos', 'm²', 118000, .8],
    ['13.07', 'Ventana / Puerta ventana chapa doblada con celosía', 'm²', 96000, .78],
    ['13.08', 'Ventana / Puerta ventana madera', 'm²', 105000, .8],
    ['13.09', 'Ventana / Puerta ventana madera con postigos', 'm²', 135000, .8],
    ['13.10', 'Ventana / Ventiluz chapa doblada', 'm²', 64000, .78],
  ]},
  { code: '14', nombre: 'Vidriería', rows: [
    ['14.01', 'Cristal templado 10mm', 'm²', 78000, .85],
    ['14.02', 'Espejo cristal 6mm', 'm²', 38000, .85],
    ['14.03', 'Vidrio doble hermético DVH 24mm', 'm²', 68000, .85],
    ['14.04', 'Vidrio laminado seguridad 3+3mm color', 'm²', 42000, .85],
    ['14.05', 'Vidrio laminado seguridad 3+3mm incoloro', 'm²', 38000, .85],
    ['14.06', 'Vidrio laminado seguridad 4+4mm color', 'm²', 48000, .85],
    ['14.07', 'Vidrio laminado seguridad 4+4mm incoloro', 'm²', 44000, .85],
    ['14.08', 'Vidrio tipo inglés 3mm color', 'm²', 28000, .85],
    ['14.09', 'Vidrio tipo inglés 3mm incoloro', 'm²', 24000, .85],
    ['14.10', 'Vidrio transparente 3mm', 'm²', 18500, .85],
    ['14.11', 'Vidrio transparente 4mm', 'm²', 21500, .85],
  ]},
  { code: '15', nombre: 'Pinturas', rows: [
    ['15.01', 'Acrílica transparente en muros exteriores', 'm²', 3800, .45],
    ['15.02', 'Barniz p/carpintería madera', 'm²', 4600, .45],
    ['15.03', 'Esmalte sintético p/carpintería metálica', 'm²', 5200, .45],
    ['15.04', 'Látex en muros exteriores', 'm²', 4200, .4],
    ['15.05', 'Látex en muros interiores', 'm²', 3600, .4],
    ['15.06', 'Látex para cielorraso', 'm²', 3400, .4],
  ]},
  { code: '16', nombre: 'Instalación Eléctrica', rows: [
    ['16.01', 'Artefacto de iluminación', 'u', 22000, .65],
    ['16.02', 'Boca de electricidad', 'u', 18000, .55],
    ['16.03', 'Boca de telefonía', 'u', 14500, .55],
    ['16.04', 'Boca de televisión', 'u', 15500, .55],
    ['16.05', 'Tablero de electricidad', 'u', 222000, .6],
    ['16.06', 'Toma de electricidad', 'u', 16200, .55],
  ]},
  { code: '17', nombre: 'Instalación Sanitaria / Incendio', rows: [
    ['17.01', 'Accesorios baño loza blanca (9 piezas)', 'jgo', 84000, .7],
    ['17.02', 'Bañera metálica enlozada blanca c/grifería', 'u', 245000, .75],
    ['17.03', 'Bidet loza blanca c/grifería', 'u', 128000, .7],
    ['17.04', 'Inodoro pedestal loza blanca incl. D.I. y asiento', 'u', 146000, .7],
    ['17.05', 'Lavatorio loza blanca c/grifería', 'u', 112000, .7],
    ['17.06', 'Pileta cocina bacha acero inoxidable c/grifería', 'u', 131000, .7],
    ['17.07', 'Pileta lavar loza blanca c/grifería', 'u', 88000, .7],
    ['17.08', 'Boca incendio', 'u', 95000, .6],
    ['17.09', 'Bomba centrífuga 1/2 HP', 'u', 128000, .75],
    ['17.10', 'Canilla de servicio Ø13mm c/pico manguera', 'u', 12500, .6],
    ['17.11', 'Canilla de servicio Ø13mm en nicho ac. inox.', 'u', 28500, .6],
    ['17.12', 'Cañería PP TF Ø13mm', 'm', 4250, .55],
    ['17.13', 'Cañería PP TF Ø19mm', 'm', 5200, .55],
    ['17.14', 'Cañería PP TF Ø25mm', 'm', 6400, .55],
    ['17.15', 'Cañería PP TF Ø38mm', 'm', 8800, .55],
    ['17.16', 'Cañería PP TF Ø50mm', 'm', 11500, .55],
    ['17.17', 'Llave de paso Ø13mm', 'u', 14500, .6],
    ['17.18', 'Llave de paso Ø19mm', 'u', 16800, .6],
    ['17.19', 'Llave de paso Ø25mm', 'u', 19500, .6],
    ['17.20', 'Llave de paso Ø38mm', 'u', 24500, .6],
    ['17.21', 'Llave de paso Ø50mm', 'u', 29500, .6],
    ['17.22', 'Tanque de agua polietileno tricapa 1100ls', 'u', 128000, .8],
    ['17.23', 'Tanque de agua polietileno tricapa 2750ls', 'u', 215000, .8],
    ['17.24', 'Boca de acceso PVC', 'u', 18500, .55],
    ['17.25', 'Boca de desagüe abierta PVC', 'u', 16200, .55],
    ['17.26', 'Cámara inspección H°A° 60×60cm', 'u', 68000, .55],
    ['17.27', 'Cañería PVC 3,2 Ø040mm', 'm', 3800, .55],
    ['17.28', 'Cañería PVC 3,2 Ø050mm', 'm', 4400, .55],
    ['17.29', 'Cañería PVC 3,2 Ø060mm', 'm', 5200, .55],
    ['17.30', 'Cañería PVC 3,2 Ø110mm', 'm', 7800, .55],
    ['17.31', 'Embudo PVC', 'u', 9500, .55],
    ['17.32', 'Pileta patio abierta PVC', 'u', 14500, .55],
  ]},
  { code: '18', nombre: 'Instalación Gas', rows: [
    ['18.01', 'Calefactor GN 2000cal', 'u', 98000, .7],
    ['18.02', 'Calefactor GN 3000cal', 'u', 128000, .7],
    ['18.03', 'Calefón GN 12ls', 'u', 145000, .72],
    ['18.04', 'Calefón GN 14ls', 'u', 168000, .72],
    ['18.05', 'Cocina GN 4H, H y P', 'u', 215000, .75],
    ['18.06', 'Termotanque GN 060ls', 'u', 198000, .72],
    ['18.07', 'Termotanque GN 110ls', 'u', 268000, .72],
    ['18.08', 'Cañería EPOXI Ø013mm', 'm', 6800, .6],
    ['18.09', 'Cañería EPOXI Ø019mm', 'm', 8200, .6],
    ['18.10', 'Cañería EPOXI Ø025mm', 'm', 9800, .6],
    ['18.11', 'Cañería EPOXI Ø050mm', 'm', 14500, .6],
    ['18.12', 'Llave de paso Ø13mm', 'u', 16500, .6],
    ['18.13', 'Llave de paso Ø19mm', 'u', 19800, .6],
  ]},
  { code: '19', nombre: 'Equipamiento', rows: [
    ['19.01', 'Amob. fijo: bajo mesada y alacena (incl. mesada granito)', 'ml', 185000, .78],
    ['19.02', 'Amob. fijo: bajo mesada y alacena (no incl. mesada)', 'ml', 142000, .78],
    ['19.03', 'Amob. fijo: puertas de placares', 'm²', 68000, .78],
    ['19.04', 'Amob. fijo: puertas e interiores de placares', 'm²', 98000, .78],
    ['19.05', 'Matafuegos ABC 05kg', 'u', 38000, .85],
    ['19.06', 'Matafuegos ABC 10kg', 'u', 58000, .85],
  ]},
  { code: '20', nombre: 'Varios', rows: [
    ['20.01', 'Ayuda de gremio', 'gl', 185000, .3],
    ['20.02', 'Conductos ventilación, incl. sombrerete y reja', 'u', 42000, .6],
    ['20.03', 'Limpieza periódica y final de obra', 'gl', 145000, .15],
    ['20.04', 'Parquización (césped)', 'm²', 4800, .5],
  ]},
];

// Cantidades de la obra demo "Casa García" (180 m², 2 plantas) para el presupuesto original
// code -> [cantidad, avance%, dias]
const DEM: Record<string, [number, number, number]> = {
  '00.01': [1, 60, 0],
  '01.01': [1, 100, 1], '01.02': [42, 100, 2], '01.03': [1, 100, 2], '01.04': [1, 100, 2],
  '02.01': [120, 100, 2], '02.04': [24, 100, 3], '02.05': [18, 100, 2],
  '03.00': [9, 90, 4], '03.01': [6, 75, 6], '03.02': [4, 70, 3], '03.06': [95, 45, 8], '03.09': [5, 55, 5], '03.11': [12, 85, 3],
  '04.08': [210, 25, 12], '04.14': [60, 0, 5], '04.18': [40, 10, 4],
  '05.06': [95, 0, 2],
  '06.06': [110, 0, 6],
  '07.03': [160, 0, 6], '07.09': [340, 0, 10], '07.10': [180, 0, 5],
  '08.04': [180, 0, 4],
  '09.04': [120, 0, 5],
  '10.02': [48, 0, 4], '10.04': [6, 0, 2], '10.07': [35, 0, 3],
  '11.02': [180, 0, 3], '11.06': [120, 0, 6], '11.15': [60, 0, 4],
  '12.07': [85, 0, 2],
  '13.01': [1, 0, 1], '13.02': [8, 0, 3], '13.05': [28, 0, 5],
  '14.03': [18, 0, 2],
  '15.04': [160, 0, 4], '15.05': [420, 0, 8], '15.06': [180, 0, 4],
  '16.01': [24, 0, 4], '16.02': [48, 0, 8], '16.05': [1, 0, 1], '16.06': [32, 0, 3],
  '17.04': [2, 0, 1], '17.05': [2, 0, 1], '17.06': [1, 0, 1], '17.12': [60, 0, 4], '17.13': [40, 0, 3], '17.22': [1, 0, 1],
  '18.04': [1, 0, 1], '18.05': [1, 0, 1], '18.08': [35, 0, 3],
  '19.01': [6, 0, 4], '19.03': [12, 0, 3],
  '20.01': [1, 30, 0], '20.03': [1, 15, 0],
};

// Ítems puntuales de los presupuestos adicionales — AI(code,cantidad,avance,dias)
type AdicionalItem = { code: string; cantidad: number; avance: number; dias: number };
const adicionales: { numero: string; nombre: string; detalle: string; estado: 'ENVIADO' | 'PROCESO' | 'APROBADO'; fecha: string; items: AdicionalItem[] }[] = [
  {
    numero: 'A-001', nombre: 'Adicional · Quincho y parrilla', detalle: 'Ampliación de 28 m² con quincho cubierto y asador',
    estado: 'APROBADO', fecha: '2026-05-14',
    items: [
      { code: '02.04', cantidad: 6, avance: 100, dias: 2 },
      { code: '03.01', cantidad: 2, avance: 80, dias: 3 },
      { code: '03.09', cantidad: 1.5, avance: 70, dias: 2 },
      { code: '04.08', cantidad: 42, avance: 40, dias: 4 },
      { code: '06.06', cantidad: 32, avance: 0, dias: 4 },
      { code: '10.09', cantidad: 1, avance: 0, dias: 3 },
    ],
  },
  {
    numero: 'A-002', nombre: 'Adicional · Pileta y deck', detalle: 'Piscina de hormigón 7×3,5 m con solárium de deck',
    estado: 'PROCESO', fecha: '2026-06-08',
    items: [
      { code: '02.03', cantidad: 38, avance: 0, dias: 3 },
      { code: '03.07', cantidad: 9, avance: 0, dias: 6 },
      { code: '05.08', cantidad: 95, avance: 0, dias: 2 },
      { code: '11.12', cantidad: 34, avance: 0, dias: 4 },
    ],
  },
  {
    numero: 'A-003', nombre: 'Adicional · Aberturas premium', detalle: 'Upgrade a DVH y carpintería de aluminio línea pesada',
    estado: 'ENVIADO', fecha: '2026-06-20',
    items: [
      { code: '13.05', cantidad: 24, avance: 0, dias: 3 },
      { code: '14.03', cantidad: 24, avance: 0, dias: 2 },
    ],
  },
];

function findCatalog(code: string) {
  const rubroCode = code.split('.')[0];
  const rubro = CATALOGO.find((r) => r.code === rubroCode)!;
  const row = rubro.rows.find((r) => r[0] === code)!;
  return { rubro, row };
}

async function main() {
  // ── Limpieza (idempotente para re-correr el seed) ──
  // Tablas dependientes de Obra/Usuario creadas en runtime (Planner, Agenda, Finanzas, etc.)
  await prisma.ordenCompraItem.deleteMany();
  await prisma.ordenCompra.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.certificadoItem.deleteMany();
  await prisma.certificado.deleteMany();
  await prisma.post.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comentario.deleteMany();
  await prisma.feedPost.deleteMany();
  await prisma.evento.deleteMany();
  await prisma.aviso.deleteMany();
  await prisma.cuentaCobrar.deleteMany();
  await prisma.cuentaPagar.deleteMany();
  await prisma.movimientoCaja.deleteMany();
  await prisma.ambiente.deleteMany();
  await prisma.moodboardItem.deleteMany();
  await prisma.archivoDrive.deleteMany();
  await prisma.carpetaDrive.deleteMany();
  await prisma.cotizacionLead.deleteMany();
  await prisma.item.deleteMany();
  await prisma.etapa.deleteMany();
  await prisma.presupuesto.deleteMany();
  await prisma.obra.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.catalogoCifrasItem.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.integracion.deleteMany();
  await prisma.fuenteCostoConfig.deleteMany();

  // ── Configuración: integraciones y fuentes de costo ──
  await prisma.integracion.createMany({
    data: [
      { proveedor: 'google-drive', conectado: false },
      { proveedor: 'instagram', conectado: false },
      { proveedor: 'email', conectado: true },
    ],
  });
  await prisma.fuenteCostoConfig.createMany({
    data: [
      { fuente: 'CIFRAS', activa: true, lastSync: new Date() },
      { fuente: 'CAPSF', activa: false },
      { fuente: 'PROPIA', activa: false },
    ],
  });

  // ── Proveedores demo ──
  await prisma.proveedor.createMany({
    data: [
      { nombre: 'Corralón San Martín', contacto: 'ventas@corralonsm.com.ar' },
      { nombre: 'Aberturas del Litoral', contacto: 'pedidos@aberturaslitoral.com.ar' },
      { nombre: 'Hierros Rosario S.A.', contacto: 'comercial@hierrosrosario.com.ar' },
    ],
  });

  // ── Catálogo CIFRAS (referencia, 21 rubros / ~200 ítems) ──
  for (const rubro of CATALOGO) {
    for (const [codigo, desc, unidad, costo, mat] of rubro.rows) {
      await prisma.catalogoCifrasItem.create({
        data: {
          codigo,
          rubro: rubro.code,
          nombreRubro: rubro.nombre,
          desc,
          unidad,
          costoRef: costo,
          ratioMaterial: mat,
          fuente: 'CIFRAS',
        },
      });
    }
  }

  // ── Usuarios ──
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const evelin = await prisma.usuario.create({
    data: { email: 'evelin@vibrarq.com', passwordHash, nombre: 'Evelin García', role: 'SOCIO' },
  });
  const manuel = await prisma.usuario.create({
    data: { email: 'manuel@vibrarq.com', passwordHash, nombre: 'Manuel García Martí', role: 'SOCIO' },
  });
  const paula = await prisma.usuario.create({
    data: { email: 'paula@vibrarq.com', passwordHash, nombre: 'Paula', role: 'COMMUNITY_MANAGER' },
  });

  // ── Posts demo del Planner de Redes ──
  await prisma.post.createMany({
    data: [
      { fecha: new Date('2026-06-03'), tipo: 'Reel', plataforma: 'INSTAGRAM', estado: 'PUBLICADO', asignadoId: paula.id, metricaAlcance: 12400, metricaEngagement: 1800 },
      { fecha: new Date('2026-06-06'), tipo: 'Carrusel', plataforma: 'INSTAGRAM', estado: 'PUBLICADO', asignadoId: paula.id, metricaAlcance: 8100, metricaEngagement: 940 },
      { fecha: new Date('2026-06-10'), tipo: 'Story', plataforma: 'INSTAGRAM', estado: 'PUBLICADO', asignadoId: evelin.id, metricaAlcance: 5600, metricaEngagement: 610 },
      { fecha: new Date('2026-06-13'), tipo: 'Post', plataforma: 'INSTAGRAM', estado: 'PUBLICADO', asignadoId: paula.id, metricaAlcance: 6900, metricaEngagement: 720 },
      { fecha: new Date('2026-06-17'), tipo: 'Reel', plataforma: 'TIKTOK', estado: 'PROGRAMADO', asignadoId: paula.id, prioridad: 'alta', notas: 'Música trending + subtítulos.' },
      { fecha: new Date('2026-06-19'), tipo: 'Carrusel', plataforma: 'INSTAGRAM', estado: 'DISENO', asignadoId: paula.id, prioridad: 'alta' },
      { fecha: new Date('2026-06-20'), tipo: 'Story', plataforma: 'INSTAGRAM', estado: 'IDEA', asignadoId: evelin.id },
      { fecha: new Date('2026-06-24'), tipo: 'Reel', plataforma: 'INSTAGRAM', estado: 'IDEA', asignadoId: manuel.id },
      { fecha: new Date('2026-06-27'), tipo: 'Post', plataforma: 'INSTAGRAM', estado: 'APROBACION', asignadoId: evelin.id },
      { fecha: new Date('2026-06-30'), tipo: 'Carrusel', plataforma: 'INSTAGRAM', estado: 'IDEA', asignadoId: paula.id },
    ],
  });

  // ── Cliente + Obra demo "Casa García" ──
  const cliente = await prisma.cliente.create({
    data: { nombre: 'Familia García', email: 'familia.garcia@example.com' },
  });
  await prisma.usuario.create({
    data: { email: 'cliente.garcia@example.com', passwordHash, nombre: 'Familia García', role: 'CLIENTE', clienteId: cliente.id },
  });
  const obra = await prisma.obra.create({
    data: { clienteId: cliente.id, nombre: 'Casa García', ubicacion: 'Rosario, Santa Fe', tipo: 'Vivienda unifamiliar', m2: 180, plantas: 2 },
  });

  // ── Ambientes (antes/después) ──
  await prisma.ambiente.createMany({
    data: [
      { obraId: obra.id, nombre: 'Living comedor', nota: 'Integración con el exterior', terminado: true },
      { obraId: obra.id, nombre: 'Cocina', nota: 'Isla y mobiliario a medida', terminado: true },
      { obraId: obra.id, nombre: 'Baño principal', nota: 'Revestimiento porcellanato', terminado: false },
      { obraId: obra.id, nombre: 'Dormitorio principal', nota: 'Placard y vestidor', terminado: false },
      { obraId: obra.id, nombre: 'Fachada', nota: 'Hormigón visto y madera', terminado: true },
      { obraId: obra.id, nombre: 'Patio / fondo', nota: 'Parquización y deck', terminado: false },
    ],
  });

  // ── Moodboard ──
  await prisma.moodboardItem.createMany({
    data: [
      { obraId: obra.id, tipo: 'paleta-material', label: 'Hormigón visto', hex: '#9b958a' },
      { obraId: obra.id, tipo: 'paleta-material', label: 'Roble natural', hex: '#b08855' },
      { obraId: obra.id, tipo: 'paleta-material', label: 'Negro mate', hex: '#2b2b28' },
      { obraId: obra.id, tipo: 'paleta-material', label: 'Travertino', hex: '#ddd2bb' },
      { obraId: obra.id, tipo: 'paleta-color', label: 'Verde profundo', hex: '#44503d' },
      { obraId: obra.id, tipo: 'paleta-color', label: 'Blanco cal', hex: '#f1ece1' },
      { obraId: obra.id, tipo: 'concepto', label: 'Casa de hormigón visto con calidez de madera, abierta al patio.' },
    ],
  });

  // ── Planos (Drive) ──
  const carpetaArq = await prisma.carpetaDrive.create({ data: { obraId: obra.id, nombre: 'Arquitectura' } });
  await prisma.archivoDrive.createMany({
    data: [
      { carpetaId: carpetaArq.id, nombre: 'Planta general - PB', extension: 'pdf', version: 4, autor: 'Evelin G.' },
      { carpetaId: carpetaArq.id, nombre: 'Cortes y vistas', extension: 'pdf', version: 3, autor: 'Evelin G.' },
    ],
  });
  const carpetaEst = await prisma.carpetaDrive.create({ data: { obraId: obra.id, nombre: 'Estructura' } });
  await prisma.archivoDrive.create({
    data: { carpetaId: carpetaEst.id, nombre: 'Plano de fundaciones', extension: 'dwg', version: 2, autor: 'Ing. Rossi' },
  });

  // ── Presupuesto original (P-001) — catálogo completo, cantidades de DEM ──
  await prisma.presupuesto.create({
    data: {
      obraId: obra.id,
      tipo: 'ORIGINAL',
      numero: 'P-001',
      nombre: 'Presupuesto original',
      detalle: 'Vivienda 180 m², 2 plantas · obra nueva',
      estado: 'APROBADO',
      fecha: new Date('2026-03-02'),
      etapas: {
        create: CATALOGO.map((rubro) => ({
          code: rubro.code,
          nombre: rubro.nombre,
          items: {
            create: rubro.rows.map(([codigo, desc, unidad, costo, mat, ventaOv]) => {
              const [cantidad, avance, dias] = DEM[codigo] ?? [0, 0, 0];
              return {
                codigoCifras: codigo,
                desc,
                unidad,
                cantidad,
                costoProveedor: costo,
                precioVenta: ventaOv ?? mk(costo),
                dias,
                avance,
                ratioMaterial: mat,
              };
            }),
          },
        })),
      },
    },
  });

  // ── Presupuestos adicionales (A-001, A-002, A-003) ──
  for (const ad of adicionales) {
    const porRubro = new Map<string, AdicionalItem[]>();
    for (const it of ad.items) {
      const rubroCode = it.code.split('.')[0];
      if (!porRubro.has(rubroCode)) porRubro.set(rubroCode, []);
      porRubro.get(rubroCode)!.push(it);
    }
    await prisma.presupuesto.create({
      data: {
        obraId: obra.id,
        tipo: 'ADICIONAL',
        numero: ad.numero,
        nombre: ad.nombre,
        detalle: ad.detalle,
        estado: ad.estado,
        fecha: new Date(ad.fecha),
        etapas: {
          create: Array.from(porRubro.entries()).map(([rubroCode, items]) => {
            const rubroNombre = CATALOGO.find((r) => r.code === rubroCode)!.nombre;
            return {
              code: rubroCode,
              nombre: rubroNombre,
              items: {
                create: items.map((it) => {
                  const { row } = findCatalog(it.code);
                  const [, desc, unidad, costo, mat] = row;
                  return {
                    codigoCifras: it.code,
                    desc,
                    unidad,
                    cantidad: it.cantidad,
                    costoProveedor: costo,
                    precioVenta: mk(costo),
                    dias: it.dias,
                    avance: it.avance,
                    ratioMaterial: mat,
                  };
                }),
              },
            };
          }),
        },
      },
    });
  }

  console.log('Seed completo: catálogo CIFRAS + obra demo "Casa García" (1 original + 3 adicionales).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
