uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uBoxMin;
uniform vec3 uBoxMax;
uniform float uTime;

varying vec3 vWorldPosition;

// 3D Hash and Noise
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

// FBM to build the cauliflower cloud shapes
float fbm(vec3 p) {
    float f = 0.0;
    float amp = 0.5;
    for(int i = 0; i < 4; i++) {
        f += amp * noise(p);
        p *= 2.02;
        amp *= 0.5;
    }
    return f;
}

// Single, correctly scaled density function for the 800-unit bounding box
float sampleDensity(vec3 p) {
    // 1. INCREASED the multiplier from 0.006 to 0.025 to make the clouds 4x smaller
    vec3 noisePos = p * 0.05 + vec3(uTime * 0.05, 0.0, uTime * 0.02);
    float baseNoise = fbm(noisePos);
    
    float heightFraction = (p.y - uBoxMin.y) / (uBoxMax.y - uBoxMin.y);
    float verticalMask = smoothstep(0.0, 0.2, heightFraction) * smoothstep(1.0, 0.7, heightFraction);
    
    // 2. INCREASED the subtraction threshold from 0.25 to 0.35 to carve out smaller, separated cloud clumps
    // 3. INCREASED the multiplier to 4.0 to keep the smaller clumps thick and opaque
    float density = max(0.0, baseNoise - 0.35) * 4.0;
    
    return density * verticalMask;
}
// Slab Method for Ray-AABB Intersection
vec2 hitAABB(vec3 ro, vec3 rd, vec3 boxMin, vec3 boxMax) {
    vec3 tMin = (boxMin - ro) / rd;
    vec3 tMax = (boxMax - ro) / rd;
    vec3 t1 = min(tMin, tMax);
    vec3 t2 = max(tMin, tMax);
    float tNear = max(max(t1.x, t1.y), t1.z);
    float tFar = min(min(t2.x, t2.y), t2.z);
    return vec2(tNear, tFar);
}

// Henyey-Greenstein phase function for forward scattering (silver lining)
float phaseHG(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
}

void main() {
    vec3 rayOrigin = cameraPosition;
    vec3 rayDir = normalize(vWorldPosition - cameraPosition);
    
    vec2 bounds = hitAABB(rayOrigin, rayDir, uBoxMin, uBoxMax);
    if (bounds.x > bounds.y || bounds.y < 0.0) discard;
    
    float t = max(0.0, bounds.x);
    float tEnd = bounds.y;
    
    float stepSize = 4.0;
    vec3 lightDir = normalize(uSunDirection);
    float cosTheta = dot(rayDir, lightDir);
    float phase = phaseHG(cosTheta, 0.6) + 0.3; 
    
    float transmittance = 1.0;
    vec3 scatteredLight = vec3(0.0);
    
    for (int i = 0; i < 60; i++) {
        if (t > tEnd || transmittance < 0.01) break;
        
        vec3 p = rayOrigin + rayDir * t;
        float density = sampleDensity(p);
        
        if (density > 0.0) {
            float shadowTransmittance = 1.0;
            float lightStep = 8.0;
            vec3 lp = p;
            for(int j = 0; j < 4; j++) {
                lp += lightDir * lightStep;
                float ld = sampleDensity(lp);
                shadowTransmittance *= exp(-ld * lightStep * 0.4); 
            }
            
            float energy = shadowTransmittance * (1.0 - exp(-density * 2.0));
            vec3 luminance = uSunColor * energy * phase * 3.0 + uSkyColor * 0.7;
            
            scatteredLight += luminance * density * transmittance * stepSize;
            transmittance *= exp(-density * stepSize * 1.0); 
        }
        t += stepSize;
    }
    
    if (transmittance >= 0.99) discard;
    
    vec3 finalCloudColor = scatteredLight * 1.2;

    // --- ATMOSPHERIC VOLUMETRIC FOG ---
    // bounds.x represents the distance from the camera to where the ray hit the cloud volume
    float distToCloud = max(0.0, bounds.x);
    float fogDensity = 0.0025; // Slightly lower density so clouds remain visible further out
    float fogFactor = exp(-pow(distToCloud * fogDensity, 2.0));
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    
    vec3 fogColor = vec3(0.043, 0.478, 0.658); // Same matched sky midBlue
    
    // Fade the cloud's brightness/color into the atmospheric fog
    finalCloudColor = mix(fogColor, finalCloudColor, fogFactor);
    
    // Optional: Fade the cloud's opacity as it reaches extreme distances
    float alpha = (1.0 - transmittance) * fogFactor;

    gl_FragColor = vec4(finalCloudColor, alpha);
}