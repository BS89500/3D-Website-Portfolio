uniform float uTime;
uniform sampler2D uNoiseTexture;

varying vec2 vUv;
varying float vNoiseVal;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
    vUv = uv;
    
    // Smoothed frequency scale and fluid time multipliers to eliminate choppy stepping
    vec2 st = vUv * 6.5 + vec2(uTime * 0.02, uTime * 0.01);
    float noiseVal = texture2D(uNoiseTexture, st).r;
    vNoiseVal = noiseVal; // Pass to fragment shader for coloring
    
    vec3 pos = position;
    // Displace vertices up and down based on the noise texture value
    pos.y += (noiseVal - 0.5) * 120.0;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormal = normalMatrix * normal;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}