# Fases 2 y 3 — Arquitectura, infraestructura y flujos

## 1. Arquitectura lógica

El TP tiene tres piezas: los **shaders GLSL** (una sola fuente por Hit), los **entornos de ejecución** (ShaderToy y nuestro harness WebGL) y la **documentación**. Los dos entornos ejecutan el mismo `mainImage`, así que el resultado es idéntico.

```mermaid
flowchart LR
    subgraph SRC["Repositorio (fuente única)"]
        G1["hit3/passthrough.glsl"]
        G2["hit4/flip_*.glsl"]
        G3["hit5/chroma.glsl"]
        G4["hit6/grayscale.glsl"]
    end

    subgraph ST["ShaderToy (shadertoy.com)"]
        STE["Editor + uniforms iTime, iResolution, iMouse"]
        STC["iChannel0 = webcam<br/>iChannel1 = video Britney"]
    end

    subgraph WH["Harness WebGL (web/)"]
        LOADER["Loader: fetch .glsl<br/>+ wrapper GLSL ES 3.00"]
        UNIF["Uniforms emulados<br/>iResolution, iTime, iFrame, iMouse"]
        CH["Gestor de canales<br/>webcam / archivo / imagen de prueba"]
        UI["UI: selector de Hit,<br/>slider de umbral, fuente por canal"]
    end

    GPU["GPU del cliente<br/>fragment shader por píxel"]

    SRC -- "copiar y pegar" --> STE
    SRC -- "fetch HTTP" --> LOADER
    UI --> UNIF
    UI --> CH
    STE --> GPU
    STC --> GPU
    LOADER --> GPU
    UNIF --> GPU
    CH -- "texImage2D por frame" --> GPU
```

### Componentes del harness

| Componente | Responsabilidad |
|---|---|
| `index.html` | Canvas WebGL2, selector de Hit, selector de fuente por canal, slider de umbral, botón de captura PNG. |
| `main.js` → **Loader** | Hace `fetch` del `.glsl` del Hit elegido y lo envuelve con el prólogo de uniforms y el `main()` que llama a `mainImage(outColor, gl_FragCoord.xy)`. Compila y muestra errores en pantalla. |
| `main.js` → **Renderer** | Quad a pantalla completa (2 triángulos), loop con `requestAnimationFrame`, actualiza los uniforms en cada frame. |
| `main.js` → **Canales** | `iChannel0..1` como `sampler2D`. Fuentes: `getUserMedia` (webcam), `<input type=file>` (video o imagen local) o imagen de prueba generada en un canvas. Activa `UNPACK_FLIP_Y_WEBGL` para coincidir con el `vflip` por defecto de ShaderToy. |

### Wrapper que se antepone a cada `.glsl`

```glsl
#version 300 es
precision highp float;
uniform vec3  iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int   iFrame;
uniform vec4  iMouse;
uniform vec3  iChannelResolution[4];
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
out vec4 outColor;
// <contenido del .glsl con mainImage(...)>
void main() { mainImage(outColor, gl_FragCoord.xy); }
```

## 2. Infraestructura

No hay backend, todo corre en el navegador. La única infraestructura es GitHub: el repo, Actions (CI/CD) y Pages (hosting estático). No hay claves estáticas: el deploy a Pages se autentica con un token OIDC efímero que emite GitHub Actions.

```mermaid
flowchart LR
    DEV["Dev local<br/>VS Code + Claude Code<br/>python -m http.server"]
    subgraph GH["GitHub"]
        REPO["Repo público<br/>SDyPP-TP4"]
        subgraph ACT["GitHub Actions - ci.yml"]
            J1["Job gitleaks<br/>escaneo de todo el historial"]
            J2["Job build<br/>arma _site con web/ y hit*/*.glsl"]
            J3["Job deploy<br/>actions/deploy-pages<br/>OIDC id-token"]
        end
        PAGES["GitHub Pages<br/>sitio estático HTTPS"]
    end
    USER["Navegador del usuario<br/>WebGL2 + webcam"]
    STOY["shadertoy.com"]

    DEV -- "git push" --> REPO
    REPO -- "push / PR" --> J1
    J1 -- "ok" --> J2
    J2 -- "artifact" --> J3
    J3 --> PAGES
    PAGES -- "HTTPS (requerido por getUserMedia)" --> USER
    DEV -. "pegar .glsl" .-> STOY
```

| Elemento | Detalle |
|---|---|
| Triggers | `push` a cualquier rama y `pull_request` → gitleaks. El deploy corre solo en `push` a `main`. |
| Permisos del workflow | `contents: read`, `pages: write`, `id-token: write` (mínimo privilegio). |
| Secrets | Ninguno propio. Solo el `GITHUB_TOKEN` automático para gitleaks-action. |
| Hosting | GitHub Pages, que sirve por HTTPS (la webcam solo funciona en contexto seguro o en `localhost`). |

## 3. Flujos

### 3.1 CI/CD: push → gitleaks → deploy

```mermaid
sequenceDiagram
    autonumber
    actor Dev
    participant Repo as GitHub Repo
    participant GL as Job gitleaks
    participant B as Job build
    participant D as Job deploy (OIDC)
    participant P as GitHub Pages

    Dev->>Repo: git push
    Repo->>GL: dispara workflow (fetch-depth 0)
    alt secret detectado
        GL-->>Repo: exit 1, pipeline FALLA
        Repo-->>Dev: check rojo, se revoca y rota el secret
    else sin hallazgos
        GL-->>B: ok
        B->>B: copiar web/ + hit*/*.glsl a _site
        B-->>D: upload-pages-artifact
        alt rama main
            D->>D: solicitar token OIDC (id-token: write)
            D->>P: deploy-pages
            P-->>Dev: URL publicada
        else otra rama / PR
            D-->>Repo: deploy omitido
        end
    end
```

### 3.2 Render por frame en el harness

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant UI as UI (index.html)
    participant JS as main.js
    participant GL as WebGL2 (CPU-side)
    participant GPU as GPU (fragment shader x W*H)

    U->>UI: elige Hit y fuentes de canal
    UI->>JS: hitChanged / channelChanged
    JS->>JS: fetch hitN/*.glsl + wrapper
    JS->>GL: compileShader / linkProgram
    alt error de compilación
        GL-->>UI: mostrar log de error
    end
    loop requestAnimationFrame (~60 fps)
        JS->>GL: uniforms iTime, iFrame, iResolution, iMouse (slider)
        JS->>GL: texImage2D(video webcam / archivo) en iChannel0..1
        JS->>GL: drawArrays(TRIANGLES, 0, 6)
        GL->>GPU: rasterizar quad, 1 invocación de mainImage por píxel, en paralelo
        GPU-->>U: frame en el canvas
    end
```

### 3.3 Chroma key por píxel (Hit 5) + escala de grises (Hit 6)

```mermaid
flowchart TD
    A["fragCoord"] --> B["uv = fragCoord / iResolution.xy"]
    B --> C["fg = texture(iChannel1, uv)<br/>video con fondo verde"]
    B --> D["bg = texture(iChannel0, uv)<br/>webcam"]
    C --> E["d = distance(fg.rgb, chroma.rgb)<br/>raíz de Δr² + Δg² + Δb²"]
    T["threshold<br/>iMouse.x / iResolution.x o 0.6 por defecto"] --> F
    E --> F{"d menor que threshold?"}
    F -- "sí: es fondo verde" --> G["color = bg"]
    F -- "no: es el sujeto" --> H["color = fg"]
    G --> I["Hit 6 (opcional): Y = 0.2126R + 0.7152G + 0.0722B"]
    H --> I
    I --> J["fragColor = vec4(color, 1.0)"]
```

### 3.4 Pipeline de renderizado GPU: división 3D / 2D (Hit 1)

```mermaid
flowchart LR
    subgraph P3D["Procesamiento 3D"]
        S1["1. Vertex Shader"] --> S2["2. Shape Assembly"] --> S3["3. Rasterization<br/>(3D a 2D)"]
    end
    subgraph P2D["Procesamiento 2D"]
        S4["4. Fragment / Pixel Shader<br/>FOCO DEL TP"] --> S5["5. Tests & Blending"] --> S6["6. Framebuffer Output"]
    end
    S3 --> S4
    S6 --> PP["Post-processing<br/>nueva pasada de fragment shader<br/>sobre la imagen como textura"]
```

En el harness el paso 1 es trivial (4 vértices de un quad). Todo el trabajo ocurre en el paso 4, que es donde viven nuestros `.glsl`.

### 3.5 Puente Shaders → CUDA

```mermaid
flowchart LR
    subgraph SH["Shader (este TP)"]
        a1["mainImage()"]
        a2["fragCoord"]
        a3["iChannel0/1"]
        a4["fragColor"]
    end
    subgraph CU["CUDA (TP Integrador)"]
        b1["__global__ kernel()"]
        b2["blockIdx * blockDim + threadIdx"]
        b3["device memory (cudaMemcpy)"]
        b4["output array en memoria global"]
    end
    a1 <--> b1
    a2 <--> b2
    a3 <--> b3
    a4 <--> b4
```
