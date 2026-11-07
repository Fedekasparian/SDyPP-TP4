// Hit #6 - Chroma key del Hit #5 + escala de grises sobre el resultado.
// Cambios respecto de hit5/chroma.glsl:
//   (+) funciones srgbToLinear / linearToSrgb / toGray (luminancia Rec. 709)
//   (~) la salida pasa por toGray() en lugar de escribirse directo
// IMPORTANTE: el chroma se decide sobre el color ORIGINAL; si se pasara a gris antes,
// el verde dejaría de distinguirse de otros colores con la misma luminancia.

#define DEFAULT_THRESHOLD 0.6

float srgbToLinear(float c) {
    return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
}
float linearToSrgb(float c) {
    return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}
vec3 toGray(vec3 rgb) {
    vec3  lin = vec3(srgbToLinear(rgb.r), srgbToLinear(rgb.g), srgbToLinear(rgb.b));
    float Y   = dot(lin, vec3(0.2126, 0.7152, 0.0722));
    return vec3(linearToSrgb(Y));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2  uv        = fragCoord.xy / iResolution.xy;
    vec4  chroma    = vec4(0.0, 1.0, 0.0, 1.0);
    float threshold = iMouse.x > 0.0 ? iMouse.x / iResolution.x : DEFAULT_THRESHOLD;

    vec4 fg = texture(iChannel1, uv);
    vec4 bg = texture(iChannel0, uv);

    float d   = distance(fg.rgb, chroma.rgb);
    vec4  col = (d < threshold) ? bg : fg;

    fragColor = vec4(toGray(col.rgb), 1.0);
}
