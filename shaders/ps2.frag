uniform sampler2D tDiffuse;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
    vec2 uv = vUv;

    // Optional: Subtle pixelation / low-res scaling
     vec2 coord = floor(uv * (uResolution * 0.5)) / (uResolution * 0.5);
    
    vec4 texel = texture2D(tDiffuse, uv);

    // 1. Color Quantization (Reduce color depth for that crunchy PS2 retro feel)
    // Adjust the float multiplier (e.g., 16.0 or 32.0) to control color banding severity
    vec3 color = floor(texel.rgb * 16.0) / 16.0;

    // 2. Scanlines effect
    float scanline = sin(uv.y * uResolution.y * 1.5) * 0.04;
    color -= scanline;

    // 3. Slight vignette / darkening at the edges
    vec2 center = uv - 0.5;
    float vignette = 1.0 - dot(center, center) * 0.6;
    color *= vignette;

    gl_FragColor = vec4(color, texel.a);
}