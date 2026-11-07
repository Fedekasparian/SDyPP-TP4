// Hit #5 - Chroma key básico.
//   iChannel1 = video con fondo verde (primer plano, p. ej. el video de Britney)
//   iChannel0 = webcam (lo que aparece donde había verde)
//
// Umbral interactivo: ShaderToy no admite uniforms propios, así que se usa la
// posición horizontal del mouse (arrastrar sobre el canvas): borde izq. = 0.0,
// borde der. = 1.0. Sin interacción (iMouse.x == 0) se usa DEFAULT_THRESHOLD.

#define DEFAULT_THRESHOLD 0.6

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;

    // 1. Color del chroma (verde puro) en un vec4.
    vec4 chroma = vec4(0.0, 1.0, 0.0, 1.0);

    // 2. Umbral del chroma en un float.
    float threshold = iMouse.x > 0.0 ? iMouse.x / iResolution.x : DEFAULT_THRESHOLD;

    vec4 fg = texture(iChannel1, uv);   // video con fondo verde
    vec4 bg = texture(iChannel0, uv);   // webcam

    // 3. Distancia euclídea (pitagórica) en N = 3 dimensiones (R, G, B):
    //    d = sqrt((r1-r2)^2 + (g1-g2)^2 + (b1-b2)^2)
    vec3  diff = fg.rgb - chroma.rgb;
    float d    = sqrt(dot(diff, diff));  // equivalente a distance(fg.rgb, chroma.rgb)

    // 4. Si el píxel está "cerca" del verde es fondo: se reemplaza por la webcam.
    fragColor = (d < threshold) ? bg : fg;
}
