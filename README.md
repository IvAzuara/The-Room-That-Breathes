# 👁️ The Room That Breathes

> A generative and procedural audiovisual experience designed to evoke the nostalgia of retro horror and "liminal spaces." A lucid dream simulator where everything —sound, texture, and geometry— is born entirely from code.

[![Live Demo](https://img.shields.io/badge/Live-Demo-8822dd?style=for-the-badge&logo=github)](https://ivazuara.github.io/The-Room-That-Breathes)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

---

## 🖼️ Preview

> ![Project Preview](./src/assets/image.png)
---

## ✨ Features (Zero-Asset Policy)

- 🧠 **Raymarching Engine** — Infinite geometry and organic deformations calculated through SDFs (Signed Distance Functions).
- 🎮 **Authentic PS1 Aesthetic** — Retro hardware simulation: Vertex Wobble (jitter), Affine Texture Warping, and fixed internal resolution.
- 🫁 **Biological Breathing** — Asymmetric breathing cycle (inhale/exhale) that affects geometry, fog, and light intensity.
- 🕸️ **Latent Veins** — Procedural vein textures that swell and pulse rhythmically beneath the walls.
- 💭 **The Dreamer Engine** — Combinatorial generator of cryptic phrases with thousands of possible variations.
- 🔊 **Procedural Audio** — Synthesis of human breathing, atmospheric industrial drones, and heavy footsteps synchronized with camera movement.

---

## 🛠️ Tech Stack

| Category        | Technology                          |
|-----------------|-------------------------------------|
| Environment     | [Vite](https://vitejs.dev) + TypeScript |
| Visuals         | WebGL (Fragment Shaders / Raymarching) |
| Audio           | Web Audio API (Subtractive Synthesis) |
| Post-processing | Bayer Dithering 4x4 + CRT Distortion |
| Deployment      | GitHub Pages                        |

---

## 🚀 Running Locally

### Requirements

- Node.js `>= 18`
- npm `>= 9`

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/IvAzuara/The-Room-That-Breathes.git
cd "The Room That Breathes"

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📂 Project Structure

```
The-Room-That-Breathes/
├── src/
│   ├── main.ts            # Main Engine: WebGL, Audio Engine, and Dreamer Logic
│   ├── style.css          # UI, glitch animations, and CSS post-processing
│   └── assets/            # Static placeholders (not used in core rendering)
├── index.html             # Canvas and interface overlays
├── shader_content.txt     # Backup of GLSL Raymarching code
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

---

## 📜 License

This project is a personal technical exploration of procedural synthesis. Feel free to explore the code and use it as a basis for your own digital nightmares. 🖤

---

<p align="center">
  Made with 🫁 and WebGL — <a href="https://ivazuara.github.io/The-Room-That-Breathes">ivazuara.github.io/The-Room-That-Breathes</a>
</p>
