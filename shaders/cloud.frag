uniform vec3 uSunDirection;
uniform float uTime;
uniform sampler2D uNoiseTexture;

varying vec2 vUv;
varying float vNoiseVal;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
    // Apply a contrast curve to make valleys and peaks pop sharply
    float c = smoothstep(0.1, 0.9, vNoiseVal);

    // Valleys are light/bright, Peaks are deep, dark storm tones
    vec3 peakColor  = vec3(0.85, 0.92, 1.00); 
    vec3 valleyColor  = vec3(0.2, 0.16, 0.22); 

    vec3 cloudColor = mix(valleyColor, peakColor, c);

    // Directional sun lighting matching the scene
    float ndotl = max(dot(vNormal, normalize(uSunDirection)), 0.0);
    cloudColor *= (0.6 + 0.4 * ndotl);

    // --- FRESNEL EFFECT ---
    // Calculate view direction from the fragment world position to the camera
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    
    // Fresnel rim intensity: higher power = tighter rim glow on glancing angles
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
    
    // Add a glowing silver-blue rim color to the peaks/edges
    vec3 fresnelColor = vec3(0.70, 0.85, 1.00);
    cloudColor += fresnelColor * fresnel * 0.6;
    // ----------------------

    // Distance fog blending smoothly into the horizon
    float dist = length(cameraPosition - vWorldPosition);
    float fogFactor = exp(-pow(dist * 0.00035, 2.0));
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    
    vec3 fogColor = vec3(0.043, 0.478, 0.658); 
    vec3 finalColor = mix(fogColor, cloudColor, fogFactor);

    // Smooth edge alpha fade to eliminate rectangular plane borders
    float edgeAlpha = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x) *
                      smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);

    gl_FragColor = vec4(finalColor, fogFactor * edgeAlpha);
}