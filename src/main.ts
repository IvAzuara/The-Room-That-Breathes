import './style.css'

// --- SHADERS ---

const vertexShaderSource = `
attribute vec4 a_position;
void main() {
    gl_Position = a_position;
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_cameraPos;

#define MAX_STEPS 80
#define MAX_DIST 40.0
#define SURF_DIST 0.005

// --- UTILS ---

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// PS1 Bayer 4x4 Dithering Matrix
float bayer4x4(vec2 pos) {
    int x = int(mod(pos.x, 4.0));
    int y = int(mod(pos.y, 4.0));
    int index = x + y * 4;
    
    if (index == 0) return 0.0;
    if (index == 1) return 8.0/16.0;
    if (index == 2) return 2.0/16.0;
    if (index == 3) return 10.0/16.0;
    if (index == 4) return 12.0/16.0;
    if (index == 5) return 4.0/16.0;
    if (index == 6) return 14.0/16.0;
    if (index == 7) return 6.0/16.0;
    if (index == 8) return 3.0/16.0;
    if (index == 9) return 11.0/16.0;
    if (index == 10) return 1.0/16.0;
    if (index == 11) return 9.0/16.0;
    if (index == 12) return 15.0/16.0;
    if (index == 13) return 7.0/16.0;
    if (index == 14) return 13.0/16.0;
    if (index == 15) return 5.0/16.0;
    return 0.0;
}

// --- SCENE ---

float getDist(vec3 p) {
    // Real human breathing rhythm: ~0.25hz (4s per cycle)
    float breathCycle = u_time * 0.25; 

    // Asymmetric Inhale/Exhale (fast inhale, slow exhale)
    float inhale = smoothstep(0.0, 0.4, fract(breathCycle));
    float exhale = smoothstep(0.4, 1.0, fract(breathCycle));
    float lung = inhale - exhale; 

    // Walls expand inwards during inhalation
    float expand = lung * 0.06;

    float leftWall  = p.x + 2.0 - expand;
    float rightWall = 2.0 - p.x - expand;
    float floorPlane = p.y + 1.5 - expand * 0.3;
    float ceilPlane  = 1.8 - p.y - expand * 0.5; // Ceiling lowers more
    
    float d = min(min(leftWall, rightWall), min(floorPlane, ceilPlane));

    float zRepeat = 6.0;
    float qz = mod(p.z, zRepeat) - 0.5 * zRepeat;
    float doors = sdBox(vec3(abs(p.x) - 2.0, p.y + 0.2, qz), vec3(0.4, 1.3, 1.0));
    float lights = sdBox(vec3(p.x, p.y - 1.7, qz), vec3(0.6, 0.05, 1.2));

    return min(d, lights) - smoothstep(0.0, 0.1, -doors) * 0.15;
}

vec3 getNormal(vec3 p) {
    float d = getDist(p);
    vec2 e = vec2(0.015, 0);
    vec3 n = d - vec3(getDist(p-e.xyy), getDist(p-e.yxy), getDist(p-e.yyx));
    return normalize(n);
}

vec3 renderScene(vec2 uv) {
    vec3 ro = u_cameraPos;
    vec3 rd = normalize(vec3(uv, 1.2));

    float breathCycle = u_time * 0.25;
    float inhale = smoothstep(0.0, 0.4, fract(breathCycle));
    float exhale = smoothstep(0.4, 1.0, fract(breathCycle));
    float lung = inhale - exhale;

    // Vertex Wobble (PS1 jitter) - Snap ray origin and direction
    float snapRes = 80.0;
    ro = floor(ro * snapRes) / snapRes;
    rd = normalize(floor(rd * snapRes) / snapRes);

    float roll = sin(u_time * 1.5) * 0.025;
    float pitch = cos(u_time * 3.0) * 0.015;
    mat3 rotX = mat3(1, 0, 0, 0, cos(pitch), -sin(pitch), 0, sin(pitch), cos(pitch));
    mat3 rotZ = mat3(cos(roll), -sin(roll), 0, sin(roll), cos(roll), 0, 0, 0, 1);
    rd = rotX * rotZ * rd;

    float dO = 0.0;
    for(int i=0; i<80; i++) {
        vec3 p = ro + rd * dO;
        float dS = getDist(p);
        dO += dS;
        if(dO > MAX_DIST || abs(dS) < SURF_DIST) break;
    }

    vec3 col = vec3(0.005, 0.005, 0.01); 

    if(dO < MAX_DIST) {
        vec3 p = ro + rd * dO;
        vec3 n = getNormal(p);
        
        // Affine Texture Warping - distort with depth
        vec2 texUV = (abs(n.x) > 0.5) ? p.zy : p.xy;
        if(abs(n.y) > 0.5) texUV = p.xz;
        texUV = floor(texUV * 8.0 + dO * 0.5) / 8.0; 
        
        float dirt = fbm(texUV * 6.0 + 5.0);
        float rust = smoothstep(0.4, 0.9, fbm(texUV * 4.0 + u_time * 0.01));
        
        vec3 baseCol = vec3(0.38, 0.4, 0.35); 
        if(p.y < -1.45) baseCol = mix(vec3(0.12, 0.12, 0.15), vec3(0.25, 0.25, 0.28), step(0.05, fract(p.x * 2.0)) * step(0.05, fract(p.z * 1.0)));
        else if (p.y > 1.7) baseCol = vec3(0.15, 0.15, 0.12);
        
        baseCol = mix(baseCol, vec3(0.1, 0.08, 0.05), dirt * 0.6); 
        baseCol = mix(baseCol, vec3(0.25, 0.1, 0.05), rust * 0.5); 

        // Organic Veins Pattern
        float veinPattern = fbm(texUV * 3.0 + lung * 0.1);
        float vein = smoothstep(0.55, 0.6, veinPattern); 
        vec3 veinCol = vec3(0.15, 0.03, 0.03); // Deep organic red
        float veinVisibility = smoothstep(8.0, 2.0, dO); 
        baseCol = mix(baseCol, veinCol, vein * veinVisibility * 0.6);

        // Veins pulse and swell during inhalation
        float veinPulse = smoothstep(0.5, 0.58, veinPattern + lung * 0.05);
        baseCol = mix(baseCol, veinCol * 1.5, veinPulse * veinVisibility * max(0.0, lung) * 0.4);
        
        float lightZ = mod(p.z, 6.0);
        float lightDist = length(vec3(p.x, p.y - 1.7, lightZ - 3.0));
        float flicker = mix(0.5, 1.0, step(0.3, sin(u_time * 4.0) * 0.5 + 0.5 + noise(vec2(u_time * 0.5)) * 0.5));
        
        // Light pulses with breathing (dimming when inhaling)
        float breathLight = 1.0 - max(0.0, lung) * 0.3;
        float overhead = (2.0 / (1.0 + lightDist * 2.5)) * flicker * breathLight;
        float flashlight = max(dot(n, normalize(ro - p)), 0.0) / (1.0 + dO * 0.1 + dO * dO * 0.04);
        
        col = baseCol * (flashlight * 1.5 + overhead * 2.5 + 0.02);

        // Fog thickens during exhalation
        float fogDensity = 0.08 + exhale * 0.04;
        col = mix(col, vec3(0.0, 0.0, 0.01), 1.0 - exp(-dO * fogDensity));
    }
    return col;
}

void main() {
    // Curved CRT Screen
    vec2 crtUV = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
    crtUV += crtUV * dot(crtUV, crtUV) * 0.07;
    vec2 screenUV = (crtUV + 1.0) * 0.5;

    vec2 lowRes = vec2(320.0, 240.0);
    vec2 pixelPos = floor(screenUV * lowRes);
    vec2 uv = (pixelPos / lowRes) * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;

    vec2 jitter = (vec2(hash(pixelPos + u_time), hash(pixelPos + u_time + 1.234)) - 0.5) * 0.5 / lowRes;
    
    float bleed = 0.0015;
    vec3 col;
    col.r = renderScene(uv + jitter + vec2(bleed, 0.0)).r;
    col.g = renderScene(uv + jitter).g;
    col.b = renderScene(uv + jitter - vec2(bleed, 0.0)).b;

    // ── NUEVO: Phosphor Blur (simula que cada píxel CRT sangra) ──
    // Tomamos muestras de píxeles vecinos en espacio de pantalla real
    vec2 pixelSize = 1.0 / u_resolution.xy;
    vec3 colN  = renderScene(uv + vec2(0.0,  pixelSize.y * 2.0));
    vec3 colS  = renderScene(uv + vec2(0.0, -pixelSize.y * 2.0));
    vec3 colE  = renderScene(uv + vec2( pixelSize.x * 2.0, 0.0));
    vec3 colW  = renderScene(uv + vec2(-pixelSize.x * 2.0, 0.0));
    
    // Blur horizontal más fuerte que vertical (así funciona un CRT real)
    col = col * 0.5 + (colE + colW) * 0.18 + (colN + colS) * 0.07;

    // Bayer dithering DESPUÉS del blur (así no se ve la cuadrícula)
    float threshold = bayer4x4(pixelPos);
    vec3 ditheredCol = floor(col * 15.0 + threshold) / 15.0;
    col = mix(col, ditheredCol, 0.6); // 0.6 en lugar de 1.0 = más suave

    // Color depth — sube a 31 para menos posterización visible
    col = floor(col * 31.0) / 31.0;

    // ── NUEVO: Phosphor Mask (la triada RGB de un CRT) ──
    // Cada columna de píxeles reales es R, G, o B
    float maskX = mod(gl_FragCoord.x, 3.0);
    vec3 mask = vec3(
        smoothstep(0.0, 0.5, 1.0 - abs(maskX - 0.0)),
        smoothstep(0.0, 0.5, 1.0 - abs(maskX - 1.0)),
        smoothstep(0.0, 0.5, 1.0 - abs(maskX - 2.0))
    );
    // Mezcla suave — si pones 0.3 se nota pero no destruye la imagen
    col *= mix(vec3(1.0), mask * 1.5, 0.25);

    // Phosphor tint verde
    col = mix(col, col * vec3(0.9, 1.0, 0.85), 0.3);

    // ── NUEVO: Scanlines suavizadas con seno en lugar de step ──
    float scan = 1.0 - sin(gl_FragCoord.y * 3.14159) * 0.15;
    col *= scan;

    // Grain mínimo
    float grain = (hash(uv + u_time) - 0.5) * 0.025;
    col += grain;

    // Vignette
    float vignette = smoothstep(1.8, 0.6, length(crtUV));
    col *= vignette;

    gl_FragColor = vec4(col, 1.0);
}
`;;

// --- AUDIO ENGINE ---

class AudioEngine {
    private ctx: AudioContext | null = null;
    private drone1: OscillatorNode | null = null;
    private noiseBuffer: AudioBuffer | null = null;

    async init() {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Frecuencia de respiración: 0.25hz = 4 segundos por ciclo
        const breathRate = 0.25;

        // Create Noise Buffer
        const bufferSize = 2 * this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        // --- INHALACIÓN: ruido filtrado que sube ---
        const inhaleNode = this.ctx.createBufferSource();
        inhaleNode.buffer = this.noiseBuffer;
        inhaleNode.loop = true;

        const inhaleFilter = this.ctx.createBiquadFilter();
        inhaleFilter.type = 'bandpass';
        inhaleFilter.frequency.value = 800;
        inhaleFilter.Q.value = 0.8;

        const inhaleGain = this.ctx.createGain();
        inhaleGain.gain.value = 0.0;

        inhaleNode.connect(inhaleFilter);
        inhaleFilter.connect(inhaleGain);
        inhaleGain.connect(this.ctx.destination);
        inhaleNode.start();

        // --- EXHALACIÓN: más grave, más larga ---
        const exhaleFilter = this.ctx.createBiquadFilter();
        exhaleFilter.type = 'bandpass';
        exhaleFilter.frequency.value = 300;
        exhaleFilter.Q.value = 1.2;

        const exhaleGain = this.ctx.createGain();
        exhaleGain.gain.value = 0.0;

        const exhaleSource = this.ctx.createBufferSource();
        exhaleSource.buffer = this.noiseBuffer;
        exhaleSource.loop = true;
        exhaleSource.connect(exhaleFilter);
        exhaleFilter.connect(exhaleGain);
        exhaleGain.connect(this.ctx.destination);
        exhaleSource.start();

        // --- Drone grave que pulsa ---
        this.drone1 = this.ctx.createOscillator();
        this.drone1.frequency.value = 55;
        this.drone1.type = 'sawtooth';
        const droneGain = this.ctx.createGain();
        droneGain.gain.value = 0.04;
        this.drone1.connect(droneGain);
        droneGain.connect(this.ctx.destination);
        this.drone1.start();

        // --- Ciclo de respiración manual con setTargetAtTime ---
        const breathCycle = () => {
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            const cycleLen = 1.0 / breathRate; // 4 segundos
            const inDur  = cycleLen * 0.4;     // 1.6s inhala
            const outDur = cycleLen * 0.6;     // 2.4s exhala

            // Inhala
            inhaleGain.gain.setTargetAtTime(0.06, now, inDur * 0.3);
            exhaleGain.gain.setTargetAtTime(0.0,  now, inDur * 0.2);
            droneGain.gain.setTargetAtTime(0.02, now, inDur * 0.3);

            // Exhala
            inhaleGain.gain.setTargetAtTime(0.0,  now + inDur, outDur * 0.2);
            exhaleGain.gain.setTargetAtTime(0.07, now + inDur, outDur * 0.3);
            droneGain.gain.setTargetAtTime(0.06, now + inDur, outDur * 0.4);

            setTimeout(breathCycle, cycleLen * 1000);
        };

        breathCycle();
    }

    playFootstep() {
        if (!this.ctx || !this.noiseBuffer) return;
        const t = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.2);
        
        oscGain.gain.setValueAtTime(0.4, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        
        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);

        const crunchGain = this.ctx.createGain();
        const crunchFilter = this.ctx.createBiquadFilter();
        crunchFilter.type = 'bandpass';
        crunchFilter.frequency.value = 400;
        crunchFilter.Q.value = 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        
        crunchGain.gain.setValueAtTime(0.1, t);
        crunchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        
        noise.connect(crunchFilter);
        crunchFilter.connect(crunchGain);
        crunchGain.connect(this.ctx.destination);
        noise.start(t);
        noise.stop(t + 0.25);

        const dragGain = this.ctx.createGain();
        const dragFilter = this.ctx.createBiquadFilter();
        dragFilter.type = 'lowpass';
        dragFilter.frequency.value = 150;

        const dragNoise = this.ctx.createBufferSource();
        dragNoise.buffer = this.noiseBuffer;
        
        dragGain.gain.setValueAtTime(0, t + 0.05);
        dragGain.gain.linearRampToValueAtTime(0.05, t + 0.15);
        dragGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        
        dragNoise.connect(dragFilter);
        dragFilter.connect(dragGain);
        dragGain.connect(this.ctx.destination);
        dragNoise.start(t + 0.05);
        dragNoise.stop(t + 0.45);
    }
}

// --- DREAMER TEXT ENGINE (Combinatorial Generator) ---

const poolA = ["The walls", "The shadows", "Every corner", "The ceiling", "This hallway", "The silence", "Your memory", "The air", "The lights", "The floor"];
const poolB = ["will always", "can never", "refuses to", "starts to", "seems to", "continues to", "wants to", "is trying to", "slowly", "barely"];
const poolC = ["remember.", "breathe.", "watch.", "listen.", "wait.", "forget.", "decay.", "falter.", "stare.", "whisper."];

const specialPhrases = [
    "You have been here before.",
    "Don't wake up yet.",
    "The ceiling is closer than yesterday.",
    "Breathing in... Breathing out...",
    "ERROR: MEMORY_LEAK_IN_DREAM"
];

function generateDreamPhrase(): string {
    // 20% chance of a special/rare phrase
    if (Math.random() < 0.2) {
        return specialPhrases[Math.floor(Math.random() * specialPhrases.length)];
    }
    
    // Combinatorial generation (1,000 possibilities)
    const a = poolA[Math.floor(Math.random() * poolA.length)];
    const b = poolB[Math.floor(Math.random() * poolB.length)];
    const c = poolC[Math.floor(Math.random() * poolC.length)];
    
    return `${a} ${b} ${c}`;
}

function initDreamer() {
    const textEl = document.getElementById('dreamer-text');
    if (!textEl) return;

    const showText = () => {
        textEl.innerText = generateDreamPhrase();
        textEl.style.opacity = '1';
        textEl.classList.add('flicker');

        setTimeout(() => {
            textEl.style.opacity = '0';
            textEl.classList.remove('flicker');
            // Random delay between 8 and 18 seconds
            setTimeout(showText, 8000 + Math.random() * 10000);
        }, 4000);
    };

    setTimeout(showText, 5000);
}

// --- MAIN APP ---

async function main() {
    const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl');
    const startBtn = document.getElementById('start-btn');
    const uiOverlay = document.getElementById('ui-overlay');
    const audio = new AudioEngine();

    if (!gl) {
        alert("WebGL not supported");
        return;
    }

    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    };

    const program = gl.createProgram()!;
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)!);
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)!);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positionAttribute = gl.getAttribLocation(program, "a_position");
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttribute);
    gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);

    const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const cameraPosLoc = gl.getUniformLocation(program, "u_cameraPos");

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl!.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    let startTime = 0;
    let lastBob = 0;
    function render(time: number) {
        if (startTime === 0) startTime = time;
        const elapsed = (time - startTime) * 0.001;

        gl!.uniform2f(resolutionLoc, canvas.width, canvas.height);
        gl!.uniform1f(timeLoc, elapsed);
        
        const speed = 1.2;
        const currentBob = Math.cos(elapsed * 4.0);
        
        // Trigger footstep sound when head reaches the bottom of the bob (currentBob passes 0)
        if (Math.sign(currentBob) !== Math.sign(lastBob)) {
            audio.playFootstep();
        }
        lastBob = currentBob;

        const camX = Math.sin(elapsed * 2.0) * 0.04;
        const camY = Math.abs(currentBob) * 0.08;
        const camZ = elapsed * speed; 
        
        gl!.uniform3f(cameraPosLoc, camX, camY, camZ);

        gl!.drawArrays(gl!.TRIANGLES, 0, 6);
        requestAnimationFrame(render);
    }

    startBtn?.addEventListener('click', async () => {
        try {
            await audio.init();
            uiOverlay?.style.setProperty('display', 'none');
            initDreamer();
            requestAnimationFrame(render);
        } catch (e) {
            console.error("Error initializing audio or starting render:", e);
        }
    });
}

main();
