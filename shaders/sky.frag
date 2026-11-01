varying vec2 vUv;
uniform float uTime;

float hash2D(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2D(i), hash2D(i + vec2(1.0, 0.0)), f.x),
               mix(hash2D(i + vec2(0.0, 1.0)), hash2D(i + vec2(1.0, 1.0)), f.x), f.y);
}

// 1. ADD A 4TH OCTAVE TO FBM
// This adds high-frequency micro-details to the edges of the paint
float fbm(vec2 p) {
    float f = 0.0;
    f += 0.5000 * noise2D(p); p *= 2.02;
    f += 0.2500 * noise2D(p); p *= 2.03;
    f += 0.1250 * noise2D(p); p *= 2.01;
    f += 0.0625 * noise2D(p); // <-- New crisp detail layer
    return f;
}

// 2. INCREASE FREQUENCY & BRISTLE DENSITY
float paintStrokes(vec2 uv) {
    // Increase UV multiplier from 3.5 to 6.0 to make the strokes smaller and more numerous
    vec2 warpedUv = uv * 6.0; 
    warpedUv.x += sin(warpedUv.y * 1.5) * 0.3; 
    
    vec2 scale = vec2(3.0, 0.65); 
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8); 
    
    // Sharpen the contrast of the base brush using smoothstep
    float baseBrush = fbm((warpedUv * rot) * scale);
    baseBrush = smoothstep(0.1, 0.9, baseBrush); 
    
    // Increase bristle frequency from 180.0 to 400.0 for a sharp canvas texture
    // Increase amplitude slightly from 0.12 to 0.18
    float bristles = noise2D(uv * 400.0 + baseBrush * 15.0) * 0.18; 
    
    return clamp(baseBrush + bristles, 0.0, 1.0);
}
void main() {
    vec2 center = vUv - vec2(0.5);
    float dist = length(center);
    float vignette = smoothstep(0.05, 0.75, dist);

    vec2 motion = vec2(0.0, uTime * 0.005);
    float strokeTexture = paintStrokes(vUv + motion);

    vec3 cornerNavy  = vec3(0.008, 0.078, 0.180); 
    vec3 coreBlue    = vec3(0.039, 0.603, 0.827); 
    vec3 midBlue     = vec3(0.043, 0.478, 0.658); 
    vec3 highlights  = vec3(0.031, 0.364, 0.611); 

    vec3 baseSky = mix(coreBlue, midBlue, vignette);
    vec3 finalGradient = mix(baseSky, cornerNavy, pow(vignette, 2.2));
    vec3 paintColorShift = mix(highlights * 0.8, baseSky * 1.35, strokeTexture);
    
    vec3 compositePaint = mix(finalGradient, paintColorShift, 0.32);

    gl_FragColor = vec4(compositePaint, 1.0);
}