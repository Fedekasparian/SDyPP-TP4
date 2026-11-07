# Fase 1 — Análisis del enunciado y decisiones por Hit

> TP4 · Programación Paralela (Shaders) · Entrega: viernes 06/11/2026 23:59

## Requisitos transversales

| Requisito del enunciado | Cómo lo cumplimos |
|---|---|
| Uso de herramientas de IA en el ciclo de desarrollo | Sección "Herramientas de IA" en el informe (Claude Code: planificación, diagramas, harness WebGL, revisión de GLSL). |
| Informe detallado (respuestas, capturas, diagramas, conclusiones) | `README.md` raíz = informe; se exporta a `docs/informe.pdf` para el campus. |
| Repo público, una carpeta + `README.md` por Hit (instrucciones, capturas, decisiones) | `hit1/` … `hit6/`, cada uno con `README.md` y `capturas/`. |
| No commitear `.env` / secrets, `.gitignore` apropiado | `.gitignore` con `.env*`, claves, `node_modules`, artefactos del SO/IDE. |
| Zero static keys / OIDC | Deploy a GitHub Pages con `actions/deploy-pages` (token OIDC efímero, `id-token: write`). No se usa ningún cloud provider con claves. |
| gitleaks en CI, el pipeline debe fallar | Job `gitleaks` como primer paso; el deploy depende de él (`needs`). |

## Decisiones generales

1. **Una sola fuente por shader**: cada `.glsl` está escrito con la firma de ShaderToy (`mainImage`) y sirve tal cual en shadertoy.com y en nuestro harness.
2. **Harness WebGL propio** (`web/`): emula los uniforms de ShaderToy para reproducir los Hits sin depender de la web, y se publica en GitHub Pages.
3. **Parámetros interactivos sin uniforms propios**: ShaderToy no admite uniforms personalizados, así que el umbral del chroma (Hit 5) se controla con `iMouse.x` (posición horizontal del mouse ∈ [0,1]). En el harness, un slider escribe ese mismo `iMouse`. Mismo código en los dos entornos.
4. **Media con copyright**: los videos de ejemplo (Britney, Van Damme) solo se usan dentro de ShaderToy; se versiona únicamente la demo corta grabada del Hit 5. El harness no commitea videos: cada `iChannel` se elige en runtime (webcam, archivo local o imagen de prueba generada).
5. **Diagramas en Mermaid**, versionados junto al código (`docs/arquitectura.md`).

## Decisiones por Hit

### Hit #1 — Teoría de shaders (corto y conciso)
- **Tipos de shaders** (Wikipedia): 2D → pixel/fragment; 3D → vertex, geometry, tessellation, mesh/task; ray tracing; compute. Foco en el pixel shader.
- **Pipeline** (WebGL Fundamentals): relacionar vertex shader ↔ posición en clip space y fragment shader ↔ color por píxel.
- **División 3D / 2D**:
  - 3D: (1) Vertex Shader, (2) Shape Assembly, (3) Rasterization (frontera 3D→2D).
  - 2D: (4) Fragment/Pixel Shader, (5) Tests & Blending, (6) Framebuffer Output.
- **Post-processing**: se aplica sobre la imagen ya renderizada (después del framebuffer), típicamente con otra pasada de fragment shader sobre un quad a pantalla completa que lee la imagen como textura. Eso es justamente lo que hacemos en los Hits 3–6.
- **Entradas de ShaderToy**: tabla tipo / nombre / descripción (`iResolution`, `iTime`, `iTimeDelta`, `iFrameRate`, `iFrame`, `iChannelTime[4]`, `iChannelResolution[4]`, `iMouse`, `iChannel0..3`, `iDate`, `iSampleRate`).
- **Salidas** (`/howto`): `fragColor` (`vec4`, image shader); `vec2 mainSound` (sound shader); `mainVR` (salida VR, `fragColor` con `fragRayOri`/`fragRayDir` como entradas).
- **"Hello world" explicado**: `uv` (coordenada normalizada), UV vs XY (independencia de la resolución), animación por `iTime`, `vec3` resultante por operaciones escalar-vector componente a componente, constructores de `vec4`, swizzling (`xyx`) y conjuntos `xyzw` / `rgba` / `stpq`.
- Entregable: `hit1/README.md` + `hit1/hello_world.glsl` comentado línea por línea.

### Hit #2 — Video de Inigo Quilez (corto y conciso)
- Resumen: paisaje construido con funciones (SDFs, ruido y fbm para el terreno, raymarching, iluminación y sombras, niebla, corrección de color), todo evaluado por píxel.
- Conclusión: cada píxel es un cálculo independiente → el problema es *embarrassingly parallel* y es justo lo que la GPU acelera.
- Entregable: `hit2/README.md`.

### Hit #3 — Passthrough `iChannel0 → fragColor`
- Shader del enunciado, sin cambios. `iChannel0` = webcam.
- Entregable: `hit3/passthrough.glsl`, capturas en ShaderToy y en el harness.

### Hit #4 — FLIP-Y y FLIP-X
- FLIP-Y: `texture(iChannel0, vec2(uv.x, 1.0 - uv.y))`.
- FLIP-X (espejo): `texture(iChannel0, vec2(1.0 - uv.x, uv.y))`.
- Ampliar "potencial de UV": independencia de resolución, transformaciones geométricas como aritmética sobre coordenadas (flip, zoom, tiling con `fract`, rotación, distorsión/ondas).
- Entregable: `hit4/flip_y.glsl`, `hit4/flip_x.glsl` (+ opcional `flip_xy.glsl`), capturas.

### Hit #5 — Chroma key
- `iChannel1` = video con fondo verde; `iChannel0` = webcam.
- Pasos del enunciado:
  1. `vec4 chroma = vec4(0.0, 1.0, 0.0, 1.0);`
  2. `float threshold` (por defecto 0.6, ajustado tras medir el verde real del video; con mouse, `iMouse.x / iResolution.x`).
  3. `float d = distance(fg.rgb, chroma.rgb);` = √(Δr² + Δg² + Δb²).
  4. `fragColor = d < threshold ? bg : fg;`
- Experimentos: umbrales 0.02 / 0.13 / 0.3 / 0.5 / 0.7 / 0.9 con capturas y análisis (umbral bajo deja halo verde; umbral alto se "come" al sujeto).
- Opcional: sacar el color chroma de un píxel del fondo del video en vez de usar verde puro.
- Entregable: `hit5/chroma.glsl`, tabla de umbrales, capturas (el baile es opcional).

### Hit #6 — Escala de grises
- Luminancia según Wikipedia (Grayscale): `Y = 0.2126 R + 0.7152 G + 0.0722 B` (Rec. 709, sobre valores lineales). Se compara con Rec. 601 (`0.299, 0.587, 0.114`) y con el promedio simple.
- Se aplica sobre la salida del chroma (Hit 5), documentando el diff respecto del Hit 5.
- Entregable: `hit6/grayscale.glsl` (+ `chroma_grayscale.glsl`), capturas comparativas.

### Extra — Puente Shaders → CUDA
- Tabla `mainImage ↔ __global__ kernel`, `fragCoord ↔ threadIdx+blockIdx`, `iChannel ↔ device memory`, `fragColor ↔ output array`, aplicada a nuestro chroma key (pseudocódigo CUDA del mismo filtro).
- Va en una sección del informe raíz.
