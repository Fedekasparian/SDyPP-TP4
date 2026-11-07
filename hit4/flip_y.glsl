// Hit #4 - FLIP-Y (cabeza abajo): se invierte la coordenada V.
// El píxel de arriba (v = 1) lee de abajo (v = 0) y viceversa.
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    fragColor = texture(iChannel0, vec2(uv.x, 1.0 - uv.y));
}
