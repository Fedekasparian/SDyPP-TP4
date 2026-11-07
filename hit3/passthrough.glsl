// Hit #3 - Passthrough: copia cada píxel de iChannel0 (webcam) a la salida.
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord.xy / iResolution.xy);   // píxel -> UV [0,1]
    fragColor = texture(iChannel0, uv);          // muestrear la textura en esa UV
}
