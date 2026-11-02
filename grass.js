import * as THREE from 'three';

export class GrassManager {
    constructor() {
        this.uniforms = null;
    }

    createInstancedGrass(grassMesh, scene) {
        const geometry = grassMesh.geometry.clone().toNonIndexed();
        geometry.applyMatrix4(grassMesh.matrixWorld);

        const positionAttr = geometry.attributes.position;
        const grassCount = 90000; 
        
        const bladeGeo = new THREE.PlaneGeometry(0.08, 0.4, 1, 4);
        bladeGeo.translate(0, 0.2, 0);

        const bladePos = bladeGeo.attributes.position;
        for (let i = 0; i < bladePos.count; i++) {
            const x = bladePos.getX(i);
            const y = bladePos.getY(i); 
            const hPercent = y / 0.4;
            const widthFactor = 1.0 - Math.pow(hPercent, 3);
            bladePos.setX(i, x * widthFactor);
        }
        bladeGeo.computeVertexNormals();

        const grassMaterial = new THREE.MeshStandardMaterial({
            color: 0x578a6e,
            roughness: 0.8,
            side: THREE.DoubleSide
        });

        grassMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = { value: 0 };
            shader.uniforms.uMouse = { value: new THREE.Vector3(0, 0, 0) };
            this.uniforms = shader.uniforms;

            // Vertex Shader: Variables
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform float uTime;
                uniform vec3 uMouse;
                attribute vec3 aTerrainNormal;
                varying vec3 vTerrainNormal;
                varying float vHeight;
                `
            );

            // Vertex Shader: Physics & Normals
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                vTerrainNormal = normalMatrix * aTerrainNormal; 
                vHeight = max(0.0, transformed.y);
                
                float wind = sin(uTime * 3.0 + (position.x + instanceMatrix[3][0]) * 2.5) * 0.12 * vHeight;
                transformed.x += wind;

                vec4 instanceWorldPos = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                float dist = distance(instanceWorldPos.xz, uMouse.xz);
                float radius = 2.5;
                if (dist < radius) {
                    float push = (1.0 - (dist / radius)) * 0.6 * vHeight;
                    vec2 dir = normalize(instanceWorldPos.xz - uMouse.xz);
                    transformed.x += dir.x * push;
                    transformed.z += dir.y * push;
                }
                `
            );

            // Fragment Shader: Variables
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `
                #include <common>
                varying vec3 vTerrainNormal;
                varying float vHeight;
                `
            );

            // Fragment Shader: AO Root Shadow & Dithering
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                
                float aoMask = smoothstep(0.0, 0.4, vHeight);
                aoMask = pow(aoMask, 1.2);
                
                float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
                aoMask += (noise - 0.5) * 0.06; 
                aoMask = clamp(aoMask, 0.0, 1.0);
                
                diffuseColor.rgb *= mix(0.2, 1.0, aoMask); 
                `
            );

            // Fragment Shader: Lighting Override
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <normal_fragment_begin>',
                `
                #include <normal_fragment_begin>
                normal = normalize(vTerrainNormal); 
                `
            );
        };

        const instancedGrass = new THREE.InstancedMesh(bladeGeo, grassMaterial, grassCount);

        const triangles = [];
        let totalArea = 0;

        const vA = new THREE.Vector3();
        const vB = new THREE.Vector3();
        const vC = new THREE.Vector3();
        const normal = new THREE.Vector3();
        const tri = new THREE.Triangle(); 

        for (let i = 0; i < positionAttr.count; i += 3) {
            vA.fromBufferAttribute(positionAttr, i);
            vB.fromBufferAttribute(positionAttr, i + 1);
            vC.fromBufferAttribute(positionAttr, i + 2);

            tri.set(vA, vB, vC);
            tri.getNormal(normal);

            if (normal.y > 0.5) { 
                const area = tri.getArea();
                if (area > 0) {
                    triangles.push({ a: vA.clone(), b: vB.clone(), c: vC.clone(), normal: normal.clone(), area });
                    totalArea += area;
                }
            }
        }

        const dummy = new THREE.Object3D();
        const upVector = new THREE.Vector3(0, 1, 0);
        const terrainNormalsArray = new Float32Array(grassCount * 3);

        for (let i = 0; i < grassCount; i++) {
            let targetArea = Math.random() * totalArea;
            let accumulatedArea = 0;
            let selectedTri = triangles[0];

            for (let t = 0; t < triangles.length; t++) {
                accumulatedArea += triangles[t].area;
                if (accumulatedArea >= targetArea) {
                    selectedTri = triangles[t];
                    break;
                }
            }

            let r1 = Math.random();
            let r2 = Math.random();
            let sqrtR1 = Math.sqrt(r1);
            let su = 1 - sqrtR1;
            let sv = sqrtR1 * (1 - r2);
            let sw = sqrtR1 * r2;

            let posX = su * selectedTri.a.x + sv * selectedTri.b.x + sw * selectedTri.c.x;
            let posY = su * selectedTri.a.y + sv * selectedTri.b.y + sw * selectedTri.c.y;
            let posZ = su * selectedTri.a.z + sv * selectedTri.b.z + sw * selectedTri.c.z;

            dummy.position.set(posX, posY, posZ);
            dummy.quaternion.setFromUnitVectors(upVector, selectedTri.normal);
            dummy.rotateY(Math.random() * Math.PI * 2);
            
            const scale = 0.5 + Math.random() * 0.6;
            dummy.scale.set(scale, scale + Math.random() * 0.3, scale);
            dummy.updateMatrix();

            instancedGrass.setMatrixAt(i, dummy.matrix);

            terrainNormalsArray[i * 3 + 0] = selectedTri.normal.x;
            terrainNormalsArray[i * 3 + 1] = selectedTri.normal.y;
            terrainNormalsArray[i * 3 + 2] = selectedTri.normal.z;
        }

        bladeGeo.setAttribute('aTerrainNormal', new THREE.InstancedBufferAttribute(terrainNormalsArray, 3));
        instancedGrass.instanceMatrix.needsUpdate = true;
        scene.add(instancedGrass);
    }

    updateTime(time) {
        if (this.uniforms) {
            this.uniforms.uTime.value = time;
        }
    }

    updateMouse(targetVector) {
        if (this.uniforms && targetVector) {
            this.uniforms.uMouse.value.copy(targetVector);
        }
    }
}