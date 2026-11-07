# Hit #2: "Pintar con matemáticas" (Inigo Quilez)

Video: <https://www.youtube.com/watch?v=0ifChJ0nJfM>

## Resumen

Inigo Quilez (co-creador de ShaderToy) construye en vivo un **paisaje completo** (cielo, montañas o terreno, árboles, luz, sombras, niebla) **sin modelos 3D ni imágenes**: solo con una función que, dada la coordenada de un píxel, devuelve su color. Lo hace por capas, de lo simple a lo complejo:

1. **Coordenadas y cielo:** normaliza la coordenada del píxel y pinta un degradé con funciones simples (`mix`, `smoothstep`).
2. **Formas con funciones de distancia (SDF):** cada objeto es una función matemática que dice a qué distancia está un punto de su superficie (esferas, elipsoides, planos). Las combina con min/max y uniones suaves.
3. **Terreno con ruido:** suma ruido de varias frecuencias (*fbm*: fractal Brownian motion) para generar montañas y relieve "natural" sin dibujarlo a mano.
4. **Raymarching:** desde la cámara lanza un rayo por píxel y avanza por la escena usando las SDF hasta chocar con una superficie.
5. **Iluminación:** con la normal de la superficie calcula la luz difusa del sol, la luz del cielo y la luz rebotada, más **sombras** (otro rayo hacia el sol) y oclusión ambiental.
6. **Atmósfera y acabado:** niebla según la distancia, corrección de color y gamma, y detalles como variación de color con ruido.

## Conclusiones

- **Todo es una función por píxel:** el paisaje es `color = f(x, y, t)`. Cada píxel se calcula **sin depender de los demás**, y eso es justamente lo que hace posible ejecutarlo en paralelo en miles de núcleos de la GPU (problema *embarrassingly parallel*).
- **Las matemáticas "básicas" alcanzan:** trigonometría, interpolación, vectores, distancias y ruido producen imágenes de calidad casi fotográfica. La complejidad visual sale de **componer** funciones simples.
- **Pensar en GPU es distinto:** no se "dibuja" un objeto recorriéndolo, sino que cada píxel se pregunta qué ve. Es un cambio de paradigma respecto del código secuencial con bucles anidados.
- **Costo:** cada píxel puede evaluar cientos de pasos de raymarching y ruido. En CPU, con 3 `for` anidados, no correría en tiempo real; en GPU sí. Es la motivación de toda la unidad.

## Decisiones
- Resumen corto, como pide el enunciado. La lista de técnicas sirve como "glosario" para entender los shaders de ShaderToy y conecta con el puente a CUDA (cálculos independientes en paralelo).
