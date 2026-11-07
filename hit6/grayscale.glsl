// Hit #6 - Escala de grises por luminancia (https://en.wikipedia.org/wiki/Grayscale).
//
// Y = 0.2126 R + 0.7152 G + 0.0722 B   (coeficientes Rec. 709 / sRGB, sobre valores LINEALES)
//
// Los valores de la textura vienen en sRGB (con gamma), así que se:
//   1. linealizan (sRGB -> lineal),
//   2. calcula la luminancia Y con los pesos de Rec. 709,
//   3. vuelve a codificar Y en sRGB para mostrarlo.
// MODE (en el editor): 0 = Rec.709 lineal (Wikipedia), 1 = Rec.601 (luma, sin linealizar), 2 = promedio simple.

#define MODE 0

float srgbToLinear(float c) {
    return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
}
float linearToSrgb(float c) {
    return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

vec3 toGray(vec3 rgb) {
#if MODE == 0
    vec3  lin = vec3(srgbToLinear(rgb.r), srgbToLinear(rgb.g), srgbToLinear(rgb.b));
    float Y   = dot(lin, vec3(0.2126, 0.7152, 0.0722));
    return vec3(linearToSrgb(Y));
#elif MODE == 1
    return vec3(dot(rgb, vec3(0.299, 0.587, 0.114)));
#else
    return vec3((rgb.r + rgb.g + rgb.b) / 3.0);
#endif
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv  = fragCoord.xy / iResolution.xy;
    vec4 src = texture(iChannel0, uv);
    fragColor = vec4(toGray(src.rgb), 1.0);
}
