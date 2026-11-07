// Hit #1 - "Hello world" de ShaderToy, comentado.
// mainImage se ejecuta UNA VEZ POR PÍXEL, todas las invocaciones en paralelo en la GPU.
//   out vec4 fragColor : color resultante de este píxel (RGBA, cada canal en [0,1])
//   in  vec2 fragCoord : coordenada del píxel en pantalla, en píxeles (centro: +0.5)
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Coordenadas normalizadas (UV): de [0,ancho]x[0,alto] a [0,1]x[0,1].
    // División componente a componente: vec2 / vec2.
    vec2 uv = fragCoord / iResolution.xy;

    // Color que varía en el tiempo.
    //  - uv.xyx  -> swizzle: vec3(uv.x, uv.y, uv.x)
    //  - iTime + vec3  -> el float se suma a cada componente => vec3
    //  - vec3(0,2,4)   -> desfase de 0, 2 y 4 rad para R, G y B (por eso el arco iris)
    //  - cos(vec3)     -> se aplica componente a componente, da [-1,1]
    //  - 0.5 + 0.5*... -> remapea de [-1,1] a [0,1], el rango válido de color
    vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4));

    // Salida: constructor vec4(vec3, float) -> (r, g, b, alfa = 1.0 opaco)
    fragColor = vec4(col, 1.0);
}
