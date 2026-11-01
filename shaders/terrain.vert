uniform float uTime;
uniform float uScrollProgress;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vElevation;

const float GRAVITY = 9.81;
const float PI = 3.14159265359;

// Deterministic hash for pseudo-random spectral distribution
float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

void main() {
    vec3 p = position;

    // --- GLOBAL WAVE SCALE ---
    // Increase this number to pack more waves into the scene (e.g., 2.0, 3.0, 4.0)
    float waveScale = 1.0; 
    
    // Scale the sampling coordinates
    vec2 coord = p.xz * waveScale;
    
    // Keep scroll speed visually consistent with the new scale
    coord.y -= uScrollProgress * 30.0 * waveScale; 

    float windAngle = 0.45; 
    
    float height = 0.0;
    vec2 displacement = vec2(0.0);
    vec2 slope = vec2(0.0);

    const int NUM_WAVES = 32;
    for (int i = 0; i < NUM_WAVES; i++) {
        float fi = float(i);
        
        float angleSpread = (hash(fi * 12.34) - 0.5) * 2.2;
        float theta = windAngle + angleSpread;
        vec2 d = vec2(cos(theta), sin(theta));

        float t = fi / float(NUM_WAVES - 1);
        float k = mix(0.18, 3.8, t * t); 

        float omega = sqrt(GRAVITY * k);

        float dirWeight = pow(max(0.0, cos(angleSpread)), 2.0);
        
        // Calculate original amplitude, then divide it by waveScale 
        // to maintain the exact same realistic slopes and prevent mesh tearing
        float amp = ((0.09 / pow(k, 1.35)) * (0.3 + 0.7 * dirWeight)) / waveScale;

        float randomPhase = hash(fi * 56.78) * 2.0 * PI;
        float phase = dot(d * k, coord) - omega * uTime * 1.1 + randomPhase;

        float s = sin(phase);
        float c = cos(phase);

        height += amp * c;

        float chopFactor = 0.35;
        displacement -= d * (amp * chopFactor) * s;

        slope -= d * (k * amp * waveScale) * s; // Adjust slope calculation for the scaled coordinates
    }

    p.x += displacement.x;
    p.z += displacement.y;
    p.y += height;

    vNormal = normalize(vec3(-slope.x, 1.0, -slope.y));
    
    vec4 worldPos = modelMatrix * vec4(p, 1.0);
    vWorldPosition = worldPos.xyz;
    vElevation = height;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}