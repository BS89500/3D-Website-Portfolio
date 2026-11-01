varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vElevation;

void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 L = normalize(vec3(-0.6, 0.45, -0.65));
    vec3 H = normalize(L + V);

    vec3 deepUpwellingColor = vec3(0.02, 0.07, 0.18);
    vec3 bodyScatterColor   = vec3(0.06, 0.16, 0.34);
    vec3 skyReflectColor    = vec3(0.24, 0.38, 0.58);

    float NdotL = max(dot(N, L), 0.0);
    float wrapDiffuse = max(0.0, (dot(N, L) + 0.4) / 1.4);

    float NdotV = max(dot(N, V), 0.0);
    float F0 = 0.02; 
    float fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotV, 4.0);

    vec3 waterBody = mix(deepUpwellingColor, bodyScatterColor, wrapDiffuse);
    vec3 color = mix(waterBody, skyReflectColor, clamp(fresnel * 1.35, 0.0, 1.0));

    float spec = pow(max(dot(N, H), 0.0), 35.0) * 0.18;
    color += vec3(0.45, 0.60, 0.80) * spec;

    // --- ATMOSPHERIC VOLUMETRIC FOG ---
    // Measure physical distance from the camera lens to the water pixel
    float dist = length(cameraPosition - vWorldPosition);
    
    // Adjust density to control how quickly the fog thickens (tuned for your 800-unit plane)
    float fogDensity = 0.0035; 
    
    // Exp2 Fog Curve: Creates a natural, exponential transition rather than a linear fade
    float fogFactor = exp(-pow(dist * fogDensity, 2.0));
    fogFactor = clamp(fogFactor, 0.0, 1.0);

    // Fog color matched perfectly to your background sky's 'midBlue'
    vec3 fogColor = vec3(0.043, 0.478, 0.658); 
    
    // Blend the water color into the fog color based on distance
    vec3 finalColor = mix(fogColor, color, fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
}