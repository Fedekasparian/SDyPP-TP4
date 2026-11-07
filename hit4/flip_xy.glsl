// Hit #4 - FLIP-X + FLIP-Y: ambas a la vez equivalen a rotar 180 grados.
// Con vectores se escribe en una sola operación: 1.0 - uv.
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    fragColor = texture(iChannel0, 1.0 - uv);
}
