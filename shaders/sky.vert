varying vec2 vUv;

void main() {
    vUv = uv;
    // Bypasses the 3D camera entirely and pins the geometry to the 2D screen
    // z = 1.0 pushes it to the absolute back of the render view
    gl_Position = vec4(position.xy, 1.0, 1.0);
}