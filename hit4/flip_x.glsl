// Hit #4 - FLIP-X (espejo): se invierte la coordenada U.
// El píxel de la izquierda (u = 0) lee de la derecha (u = 1) y viceversa.
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    fragColor = texture(iChannel0, vec2(1.0 - uv.x, uv.y));
}
