import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';

// ==================== Scene & Renderer Setup ====================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Game data recording (disabled)
// const room = new WebsimSocket();

// Camera position
camera.position.set(50, 50, 50);
camera.lookAt(32, 0, 32);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ==================== Environment Setup ====================
// Grid setup
const gridSize = 64;
const gridDivisions = 32; // 한 칸 크기를 2로 키움
const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x009900, 0x009900);
scene.add(gridHelper);

// Ground
const groundHeight = 4;  // 원하는 두께
const groundGeometry = new THREE.BoxGeometry(gridSize, groundHeight, gridSize);
const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.set(0, (-groundHeight / 2) - 0.05, 0);  // 상단 면이 y=0보다 약간 위에 위치하도록
scene.add(ground);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
// add top light
const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
topLight.position.set(0, 1, 0);
scene.add(topLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true });
const highlightMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 2), highlightMaterial);
highlightMesh.visible = false;
scene.add(highlightMesh);

// Add new global array for citizen reactions
const citizenReactions = [
    "Oh my Gosh!",
    "Save us!",
    "We're doomed!",
    "Help!",
    "No way!",
    "This is bad!",
    "Run!",
    "We're under attack!",
    "Protect us!",
    "Please help!",
    "So scary!",
    "Why me?",
    "I can't believe this!",
    "Is this the end?",
    "We're not safe!",
    "Where's the army?",
    "What do we do?",
    "It's everywhere!",
    "We're surrounded!",
    "Somebody do something!"
];

// ==================== Game State & Variables ====================
let currentStage = 1;
let launchers = [];
let STAGES = 10; // Fixed to 10
let WAVETIME = 20; // Fixed to 20
let COOLDOWNTIME = 5; // Fixed to 5
let CITY_HEALTH_TARGET = 70; // Default value
let isSimulationStarted = false;
let cityRotationSpeed = 0.003;
let DIFFICULTY = 'NORMAL'; // Default difficulty

const difficultySettings = {
    EASY: {
        range: 40,
        missileSpeedMultiplier: 0.5,
        maxMissiles: 10,
        enableTypeC: false,
        enableTypeB: true
    },
    NORMAL: {
        range: 36,
        missileSpeedMultiplier: 0.6,
        maxMissiles: 15,
        enableTypeC: true,
        enableTypeB: true
    },
    HARD: {
        range: 32,
        missileSpeedMultiplier: 0.9,
        maxMissiles: 20,
        enableTypeC: true,
        enableTypeB: true
    }
};

// Add game statistics
let interceptedCount = 0;
let groundHitsCount = 0;
let money = 150; // Initial balance
let isGameActive = false;
let isCooldown = false;
let gameTimer = 10;
let cooldownTimer = 5;
let cityGroup;

// Game performance settings
const PERFORMANCE = {
    particleLimit: 200,
    trailLength: 80,
    effectsQuality: 'high'
};

// Visual Effects Quality Settings
let effectsQuality = 'HIGH'; // HIGH, MEDIUM, LOW

// Visual effects management
let activeEffects = [];

// Enhanced particle system for explosions and effects
class ParticleSystem {
    constructor(position, options = {}) {
        this.particles = [];
        this.position = position.clone();
        this.options = {
            count: options.count || 20,
            color: options.color || 0xffaa00,
            size: options.size || { min: 0.1, max: 0.3 },
            speed: options.speed || { min: 0.1, max: 0.3 },
            lifetime: options.lifetime || { min: 30, max: 60 },
            gravity: options.gravity !== undefined ? options.gravity : true,
            fadeOut: options.fadeOut !== undefined ? options.fadeOut : true,
            spread: options.spread || 1.0,
            shape: options.shape || 'sphere' // 'sphere', 'cone', 'disk'
        };

        this.createParticles();
    }

    createParticles() {
        const geometry = new THREE.SphereGeometry(1, 4, 4);

        for (let i = 0; i < this.options.count; i++) {
            // Randomize size
            const size = this.options.size.min + Math.random() * (this.options.size.max - this.options.size.min);

            // Create material with random color variation
            const hue = Math.random() * 0.1 - 0.05; // Small hue variation
            const color = new THREE.Color(this.options.color);
            color.offsetHSL(hue, 0, Math.random() * 0.2);

            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 1.0
            });

            // Create mesh
            const particle = new THREE.Mesh(geometry, material);
            particle.scale.set(size, size, size);

            // Set initial position
            particle.position.copy(this.position);

            // Set velocity based on shape
            let velocity = new THREE.Vector3();

            if (this.options.shape === 'sphere') {
                // Random direction in sphere
                velocity.set(
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1
                ).normalize();
            } else if (this.options.shape === 'cone') {
                // Cone shape (upward with spread)
                velocity.set(
                    (Math.random() * 2 - 1) * this.options.spread,
                    1 + Math.random(),
                    (Math.random() * 2 - 1) * this.options.spread
                ).normalize();
            } else if (this.options.shape === 'disk') {
                // Flat disk (horizontal plane)
                velocity.set(
                    Math.random() * 2 - 1,
                    0,
                    Math.random() * 2 - 1
                ).normalize();
            }

            // Apply random speed
            const speed = this.options.speed.min + Math.random() * (this.options.speed.max - this.options.speed.min);
            velocity.multiplyScalar(speed);

            // Set lifetime
            const lifetime = this.options.lifetime.min + Math.random() * (this.options.lifetime.max - this.options.lifetime.min);

            // Add to particles array
            this.particles.push({
                mesh: particle,
                velocity: velocity,
                lifetime: lifetime,
                maxLifetime: lifetime
            });

            // Add to scene
            scene.add(particle);
        }
    }

    update() {
        let particlesRemaining = false;

        this.particles.forEach((particle, index) => {
            if (particle.lifetime <= 0) {
                // Remove from scene if lifetime is over
                scene.remove(particle.mesh);
                return;
            }

            particlesRemaining = true;

            // Update position
            particle.mesh.position.add(particle.velocity);

            // Apply gravity if enabled
            if (this.options.gravity) {
                particle.velocity.y -= 0.01;
            }

            // Fade out if enabled
            if (this.options.fadeOut) {
                particle.mesh.material.opacity = particle.lifetime / particle.maxLifetime;
            }

            // Decrease lifetime
            particle.lifetime--;
        });

        // Filter out dead particles
        this.particles = this.particles.filter(p => p.lifetime > 0);

        return particlesRemaining;
    }

    destroy() {
        this.particles.forEach(particle => {
            scene.remove(particle.mesh);
        });
        this.particles = [];
    }
}

// Stage timer
let SystemCardsCreated = false;
let rangeCircles = [];

// Add counters for building categories
let highBuildingCount = 0;
let midBuildingCount = 0;
let lowBuildingCount = 0;

// helper to create circle mesh
function createRangeCircle(radius) {
    // Use current difficulty's detect range if no radius specified
    if (!radius) {
        radius = difficultySettings[DIFFICULTY].range || 16;
    }

    const geometry = new THREE.CircleGeometry(radius - 0.1, 64);
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3,
        depthWrite: false    // <- prevents Z-fighting
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01; // <- slightly above ground
    return mesh;
}

// show/hide range circles
function toggleRangeCircles(show) {
    rangeCircles.forEach(circle => {
        circle.visible = show;
    });
}

// ==================== Game Mechanics ====================
let enemyMissiles = [];
let defenseMissiles = [];
let nextEnemySpawn = 0;
const spawnInterval = 2000;

// Modified spawnEnemyMissile function
function spawnEnemyMissile() {
    if (!isGameActive || isCooldown) return;
    if (Date.now() <= nextEnemySpawn) return;

    const currentDifficulty = difficultySettings[DIFFICULTY];
    const maxMissiles = currentDifficulty.maxMissiles;
    if (enemyMissiles.length >= maxMissiles) return;

    const missileCount = Math.min(
        Math.min(3 + currentStage, 8),
        maxMissiles - enemyMissiles.length
    );

    const stage = Math.min(Math.max(currentStage, 1), 10);
    const typeAFreq = 90 - ((stage - 1) * (40 / 9));
    const typeBFreq = 7 + ((stage - 1) * (23 / 9));
    const typeCFreq = 3 + ((stage - 1) * (17 / 9));

    const totalFreq = typeAFreq + typeBFreq + (currentDifficulty.enableTypeC ? typeCFreq : 0);
    const normA = (typeAFreq / totalFreq) * 100;
    const normB = (typeBFreq / totalFreq) * 100;
    const normC = (typeCFreq / totalFreq) * 100;

    for (let i = 0; i < missileCount; i++) {
        const rand = Math.random() * 100;
        let missileType = 'A';

        if (rand < normA) {
            missileType = 'A';
        } else if (rand < normA + normB) {
            missileType = 'B';
        } else if (currentDifficulty.enableTypeC && rand < normA + normB + normC) {
            missileType = 'C';
        }

        enemyMissiles.push(new EnemyMissile(missileType));
    }

    nextEnemySpawn = Date.now() + spawnInterval / currentStage;
}

// ==================== Game Classes ====================
// Building class
class Building extends THREE.Mesh {
    constructor(geometry, material, height) {
        super(geometry, material);
        this.maxHealth = height * 10; // ← 높이에 비례
        this.health = this.maxHealth;
        // Calculate gradient color based on height
        const normalizedHeight = Math.min(height / 30, 1); // Normalize height (max 30)
        const hue = 0.22 - normalizedHeight * 0.18; // Green (0.33) to Purple (0.83)
        const color = new THREE.Color().setHSL(hue, 0.7, 0.4 + normalizedHeight * 0.2);

        this.material = new THREE.MeshLambertMaterial({ color });
        this.originalColor = color.clone();
        this.sparks = [];
        this.sparkTimer = 0;
        const boxGeometry = geometry.parameters;
        this.volume = boxGeometry.width * boxGeometry.height * boxGeometry.depth;
    }

    // Modify Building's damage method to show floating text
    damage(amount) {
        this.health = Math.max(0, this.health - amount);
        const ratio = this.health / this.maxHealth;
        this.material.color.setRGB(
            this.originalColor.r * ratio,
            this.originalColor.g * ratio,
            this.originalColor.b * ratio
        );

        // Show citizen reaction when damaged
        if (this.health < this.maxHealth && Math.random() < 0.25) {
            const reaction = citizenReactions[Math.floor(Math.random() * citizenReactions.length)];
            showFloatingText(this.position, reaction);
        }

        if (this.health <= 0) {
            this.collapse();
            return true;
        }
        return false;
    }

    collapse() {
        const duration = 1.5; // Animation duration in seconds

        // Animate the building sinking into the ground and fading out
        gsap.to(this.position, {
            y: -this.geometry.parameters.height / 2,
            duration: duration,
            ease: "power4.in"
        });

        gsap.to(this.material, {
            opacity: 0,
            duration: duration,
            onComplete: () => {
                this.sparks.forEach(spark => scene.remove(spark));
                scene.getObjectByProperty('type', 'Group').remove(this);
                destroyedBuildingCount++;
                destroyedTotalHeight += this.geometry.parameters.height;
            }
        });
    }

    update(delta) {
        // Update fire
        this.sparks.forEach((spark, index) => {
            spark.scale.x += 0.02;
            spark.scale.y += 0.02;
            spark.scale.z += 0.02;
            spark.material.opacity -= 0.02;
            if (spark.material.opacity <= 0) {
                scene.remove(spark);
                this.sparks.splice(index, 1);
            }
        });

        // Create new fire particles based on damage
        const damageRatio = 1 - (this.health / this.maxHealth);
        if (damageRatio > 0.2 && Math.random() < damageRatio * 0.05) { // Reduced frequency
            const fireParticle = new THREE.Mesh(
                new THREE.SphereGeometry(0.2, 4, 4),
                new THREE.MeshBasicMaterial({
                    color: Math.random() > 0.5 ? 0xffd700 : 0xffa500, // Gold or Orange
                    transparent: true,
                    opacity: 0.8
                })
            );

            const buildingBox = new THREE.Box3().setFromObject(this);
            fireParticle.position.set(
                this.position.x + (Math.random() - 0.5) * buildingBox.getSize(new THREE.Vector3()).x,
                this.position.y + (Math.random() - 0.5) * buildingBox.getSize(new THREE.Vector3()).y,
                this.position.z + (Math.random() - 0.5) * buildingBox.getSize(new THREE.Vector3()).z
            );

            this.sparks.push(fireParticle);
            scene.add(fireParticle);
        }
    }
}

// Optimized and modified missile defense logic
// Optimized and corrected missile defense logic
// Modified MissileLauncher class
class MissileFactory {
    constructor(position) {
        this.position = position;
        this.health = 200; // Add health
        this.maxHealth = 200;
        this.missiles = 0; // Current stock
        this.maxMissiles = 12; // Max stock for factory
        this.productionRate = 1000; // 1/3 of 1500 = 4500
        this.lastProductionTime = Date.now();
        this.lastDeliveredLauncherIndex = 0;
        this.isDistributing = false; // 중복실행 방지

        // Create mesh (same size as launcher for now)
        const geometry = new THREE.BoxGeometry(2, 2, 2); // Factory size
        this.mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ color: 0x22ffaa }));
        this.mesh.position.copy(position);
        scene.add(this.mesh);

        // Add text for missile count
        this.countText = document.createElement('div');
        this.countText.style.position = 'absolute';
        this.countText.style.color = 'white';
        this.countText.style.fontFamily = 'Arial';
        document.body.appendChild(this.countText);
    }

    update() {
        const now = Date.now();
        if (this.missiles < this.maxMissiles && now - this.lastProductionTime > this.productionRate) {
            this.missiles++;
            this.lastProductionTime = now;
        }

        // Update missile count text position
        const vector = this.position.clone();
        vector.project(camera);
        this.countText.style.left = (vector.x + 1) * window.innerWidth / 2 + 'px';
        this.countText.style.top = (-vector.y + 1) * window.innerHeight / 2 + 'px';
        this.countText.textContent = ''; // <- 빈 문자열로 설정하여 Factory: 12 제거

        // New distribution logic - only distribute if not already distributing
        if (this.missiles > 0 && !this.isDistributing && launchers.length > 0) {
            // Find launchers that need missiles, starting from the last delivered index
            let launcherToDeliver = null;
            for (let i = 0; i < launchers.length; i++) {
                const currentIndex = (this.lastDeliveredLauncherIndex + 1 + i) % launchers.length; // Start from next launcher
                const launcher = launchers[currentIndex];

                if (launcher.missiles < launcher.maxMissiles) {
                    launcherToDeliver = launcher;
                    this.lastDeliveredLauncherIndex = currentIndex; // Update for next cycle
                    break;
                }
            }

            if (launcherToDeliver) {
                this.isDistributing = true;

                const success = this.deliverMissile(launcherToDeliver);
                if (!success) {
                    this.isDistributing = false; // 💡 실패 시 다시 false
                }
            }
        }
    }

    deliverMissile(launcher) {
        if (this.missiles <= 0 || launcher.missiles >= launcher.maxMissiles) return false;

        // Check if player has enough money for delivery
        const deliveryCost = 3;
        if (money < deliveryCost) {
            showMessage(`Not enough money for missile delivery! Need $${deliveryCost}`, 3000);
            this.isDistributing = false; // 
            return false;
        }

        money -= deliveryCost;
        document.getElementById('money').textContent = money;
        updatePurchaseButtonStates();
        showFloatingTextAt(this.position, '-3', '#ff3333');

        this.missiles--; // Decrement count immediately

        // Visual feedback: missile transfer
        const missileTransfer = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 4, 4),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
        );
        missileTransfer.position.copy(this.position);
        scene.add(missileTransfer);

        // Calculate path for grid highlighting
        const path = this.getGridPath(this.position, launcher.position);
        let pathIndex = 0;

        const animateMissileTransfer = () => {
            if (pathIndex < path.length) {
                const targetPosition = path[pathIndex];
                highlightGridCell(targetPosition); // Highlight the current grid cell

                gsap.to(missileTransfer.position, {
                    x: targetPosition.x,
                    y: targetPosition.y + 1, // Lift missile slightly above ground
                    z: targetPosition.z,
                    duration: 0.1, // Move quickly between grid cells
                    ease: "none",
                    onComplete: () => {
                        pathIndex++;
                        animateMissileTransfer();
                    }
                });
            } else {
                // Missile reached launcher
                scene.remove(missileTransfer);
                launcher.missiles = Math.min(launcher.missiles + 1, launcher.maxMissiles); // Ensure we don't exceed max
                this.isDistributing = false; // Reset flag after delivery
            }
        };
        animateMissileTransfer();
        return true;
    }


    getGridPath(start, end) {
        const path = [];
        const current = start.clone();
        const target = end.clone();

        const dx = Math.abs(target.x - current.x);
        const dz = Math.abs(target.z - current.z);
        const sx = (current.x < target.x) ? 2 : -2;
        const sz = (current.z < target.z) ? 2 : -2;
        let err = dx - dz;

        while (Math.abs(current.x - target.x) > 1 || Math.abs(current.z - target.z) > 1) {
            path.push(current.clone());
            const e2 = 2 * err;
            if (e2 > -dz) {
                err -= dz;
                current.x += sx;
            }
            if (e2 < dx) {
                err += dx;
                current.z += sz;
            }
        }
        path.push(target.clone()); // Add the final destination
        return path;
    }

    damage(amount) {
        this.health = Math.max(0, this.health - amount);
        const ratio = this.health / this.maxHealth;

        // Check if mesh and children exist before accessing
        if (this.mesh && this.mesh.children) {
            this.mesh.children.forEach(child => {
                if (child && child.material) {
                    child.material.color.setRGB(0.2 * ratio, 0.2 * ratio, 1 * ratio);
                }
            });
        }

        if (this.health <= 0) {
            this.destroy();
            return true;
        }
        return false;
    }

    destroy() {
        // Remove from scene only if exists
        if (this.mesh) {
            scene.remove(this.mesh);
        }

        // Remove text if exists
        if (this.countText && this.countText.parentNode) {
            document.body.removeChild(this.countText);
        }

        // Remove indicators
        if (this.stockIndicators) {
            this.stockIndicators.forEach(indicator => {
                if (indicator) {
                    scene.remove(indicator);
                }
            });
        }

        const index = factories.indexOf(this);
        if (index > -1) {
            factories.splice(index, 1);
        }
    }
}

function highlightGridCell(position) {
    const highlight = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.1, 2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 })
    );
    highlight.position.set(position.x, 0.05, position.z);
    scene.add(highlight);

    gsap.to(highlight.material, {
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
            scene.remove(highlight);
        }
    });
}

class MissileLauncher {
    constructor(position) {
        this.position = position.clone();
        this.position.y = 0; // Ensure launcher sits on the ground
        this.health = 100; // Add health
        this.maxHealth = 100;
        this.missiles = 6;              // ← changed to 6
        this.maxMissiles = 6;         // ← changed to 6
        this.lastRecharge = Date.now();

        // Set range based on current difficulty
        const ranges = {
            EASY: 40,
            NORMAL: 36,
            HARD: 32
        };
        this.range = ranges[DIFFICULTY] || 32;

        // === NEW LAUNCHER MODEL ===
        // 1. Base plate
        const baseGeometry = new THREE.BoxGeometry(2.4, 0.3, 2.4);
        const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.15;

        // 2. Launch-tube group
        const tubeGroup = new THREE.Group();

        const tubeWidth = 0.3;
        const tubeHeight = 2.0;
        const tubeDepth = 0.3;
        const spacing = 0.5; // space between tubes
        const rows = 2, cols = 3;

        this.tubes = []; // Store tube meshes to update colors later

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tubeGeo = new THREE.BoxGeometry(tubeWidth, tubeHeight, tubeDepth);
                const tubeMat = new THREE.MeshPhongMaterial({ color: 0x666666 }); // default gray
                const tube = new THREE.Mesh(tubeGeo, tubeMat);

                // center offset so grid is centered on base
                const offsetX = (c - (cols - 1) / 2) * spacing;
                const offsetZ = (r - (rows - 1) / 2) * spacing;
                tube.position.set(offsetX, tubeHeight / 2, offsetZ);
                this.tubes.push(tube);
                tubeGroup.add(tube);
            }
        }

        this.mesh = new THREE.Group();
        this.mesh.add(base);
        this.mesh.add(tubeGroup);
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
        // === END NEW MODEL ===

        // missile stock indicators
        this.stockIndicators = [];
        for (let i = 0; i < this.maxMissiles; i++) {
            const indicator = new THREE.Mesh(
                new THREE.SphereGeometry(0.2, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0x00ffff })
            );
            indicator.position.copy(this.position);
            indicator.position.y = 2.5;
            indicator.position.x += (i - 2.5) * 0.5; // Adjusted for 6 missiles
            this.stockIndicators.push(indicator);
            scene.add(indicator);
        }

        // text label
        this.countText = document.createElement('div');
        this.countText.style.position = 'absolute';
        this.countText.style.color = 'white';
        this.countText.style.fontFamily = 'Arial';
        document.body.appendChild(this.countText);

        // NEW: cache for factory distance
        this.factoryDistances = new Map();

        // range circle - use current difficulty range
        this.rangeCircle = createRangeCircle(this.range);
        this.rangeCircle.position.copy(this.position);
        this.rangeCircle.visible = false; // <- initially hidden
        scene.add(this.rangeCircle);
        rangeCircles.push(this.rangeCircle);
    }

    update() {
        // Update missile count text
        const vector = this.position.clone();
        vector.project(camera);
        this.countText.style.left = (vector.x + 1) * window.innerWidth / 2 + 'px';
        this.countText.style.top = (-vector.y + 1) * window.innerHeight / 2 + 'px';
        this.countText.textContent = this.missiles.toString();

        // Update tube colors based on missile count
        this.tubes.forEach((tube, index) => {
            if (index < this.missiles) {
                tube.material.color.set(0x0077ff); // blue (loaded)
            } else {
                tube.material.color.set(0x666666); // gray (empty)
            }
        });

        // Hide stock indicators since tubes now show status
        this.stockIndicators.forEach(indicator => indicator.visible = false);
    }

    updateRangeCircle() {
        const ranges = {
            EASY: 40,
            NORMAL: 36,
            HARD: 32
        };
        const newRange = ranges[DIFFICULTY] || 32;
        this.range = newRange;

        // remove old circle
        if (this.rangeCircle) {
            scene.remove(this.rangeCircle);
            const idx = rangeCircles.indexOf(this.rangeCircle);
            if (idx > -1) rangeCircles.splice(idx, 1);
        }

        // create new circle with the correct radius
        this.rangeCircle = createRangeCircle(newRange);
        this.rangeCircle.position.copy(this.position);
        this.rangeCircle.visible = false;
        scene.add(this.rangeCircle);
        rangeCircles.push(this.rangeCircle);
    }

    fireMissile(target) {
        if (this.missiles <= 0) return null;

        // Check if any defense missile is already targeting this enemy
        for (let defenseMissile of defenseMissiles) {
            if (defenseMissile.targetEnemy === target) {
                return null; // Skip if target is already being pursued
            }
        }

        this.missiles--;
        const missile = new DefenseMissile(this.position.clone(), target.position);
        missile.targetEnemy = target;

        // Create launch visual effect
        if (PERFORMANCE.effectsQuality !== 'low') {
            const launchEffect = new ParticleSystem(this.position.clone(), {
                count: PERFORMANCE.effectsQuality === 'high' ? 15 : 8,
                color: 0x00ffff,
                size: { min: 0.1, max: 0.2 },
                speed: { min: 0.05, max: 0.2 },
                lifetime: { min: 20, max: 30 },
                shape: 'cone',
                spread: 0.3
            });
            activeEffects.push(launchEffect);
        }

        // 발사 직후 재고가 4개 이하일 때만 미사일 요청
        if (this.missiles < this.maxMissiles) {
            this.requestMissileFromFactory();
        }

        return missile;
    }

    requestMissileFromFactory() {
        // Skip if already at max capacity
        if (this.missiles >= this.maxMissiles) return;

        // 1) Build a list of eligible factories (have missiles & not busy)
        const eligible = factories.filter(f => f.missiles > 0 && !f.isDistributing);
        if (eligible.length === 0) return;

        // 2) Sort by distance (ascending)
        eligible.sort((a, b) => {
            const distA = a.position.distanceTo(this.position);
            const distB = b.position.distanceTo(this.position);
            return distA - distB;
        });

        // 3) Use the closest one
        const closestFactory = eligible[0];
        closestFactory.deliverMissile(this);
    }

    updateFactoryDistances() {
        factories.forEach(factory => {
            if (!this.factoryDistances.has(factory)) {
                const distance = this.position.distanceTo(factory.position);
                this.factoryDistances.set(factory, distance);
            }
        });
    }

    damage(amount) {
        this.health = Math.max(0, this.health - amount);
        const ratio = this.health / this.maxHealth;
        this.mesh.children.forEach(child => {
            if (child && child.material) {
                child.material.color.setRGB(0.2 * ratio, 0.2 * ratio, 1 * ratio); // Darken color
            }
        });

        if (this.health <= 0) {
            this.destroy();
            return true;
        }
        return false;
    }

    destroy() {
        // Remove from scene only if exists
        if (this.mesh) {
            scene.remove(this.mesh);
        }

        // Remove text if exists
        if (this.countText && this.countText.parentNode) {
            document.body.removeChild(this.countText);
        }

        // Remove indicators
        if (this.stockIndicators) {
            this.stockIndicators.forEach(indicator => {
                if (indicator) {
                    scene.remove(indicator);
                }
            });
        }

        // Remove range circle
        if (this.rangeCircle) {
            scene.remove(this.rangeCircle);
            const idx = rangeCircles.indexOf(this.rangeCircle);
            if (idx > -1) rangeCircles.splice(idx, 1);
            this.rangeCircle = null;
        }

        const index = launchers.indexOf(this);
        if (index > -1) {
            launchers.splice(index, 1);
        }
    }
}

// Modified DefenseMissile class
class DefenseMissile {
    constructor(start, target) {
        this.position = start.clone();
        this.initialPosition = start.clone();
        this.target = target;
        this.minAltitude = 1; // 최소 고도 설정 (예: 1 유닛)

        // Calculate horizontal distance for dynamic scaling
        this.horizontalDistance = new THREE.Vector2(start.x, start.z).distanceTo(new THREE.Vector2(target.x, target.z));

        // Dynamically adjust missile speed based on horizontal distance
        this.speed = 0.25 + (this.horizontalDistance * 0.005); // Base speed + small increment per distance
        this.speed = Math.min(this.speed, 1.0); // Cap maximum speed

        this.launchPhase = 'arc';
        this.arcProgress = 0;
        this.arcStartPoint = this.initialPosition.clone();

        // Dynamically adjust arc duration based on horizontal distance
        this.arcDuration = Math.max(30, this.horizontalDistance * 2); // Ensure a minimum duration

        // Calculate the point where vertical launch ends (P0 for Bezier)
        const p0Arc = this.initialPosition.clone();

        // Calculate the horizontal midpoint between p0Arc and target
        const horizontalMidpoint = new THREE.Vector3(
            (p0Arc.x + this.target.x) / 2,
            0, // Y will be set later
            (p0Arc.z + this.target.z) / 2
        );

        // Calculate a vector perpendicular to the horizontal direction from p0Arc to target
        const horizontalDir = new THREE.Vector3(this.target.x, 0, this.target.z).sub(new THREE.Vector3(p0Arc.x, 0, p0Arc.z)).normalize();
        const perpendicularDir = new THREE.Vector3(-horizontalDir.z, 0, horizontalDir.x);

        // Offset the control point horizontally to create the arc
        const arcOffset = this.horizontalDistance * 0.3; // Adjust this multiplier for wider/narrower arcs
        this.controlPoint = horizontalMidpoint.add(perpendicularDir.multiplyScalar(arcOffset));

        // Set the Y component of the control point to be significantly higher than both start and target
        this.controlPoint.y = Math.max(p0Arc.y, this.target.y) + (this.horizontalDistance * 0.8); // Scale height by distance

        // Create missile mesh
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 6, 6),
            new THREE.LineBasicMaterial({ color: 0x00ffff })
        );
        this.mesh.position.copy(start);
        scene.add(this.mesh);
        // Trail
        this.trail = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 1
            })
        );
        scene.add(this.trail);
        this.trailPoints = [];
    }

    update() {
        if (this.launchPhase === 'arc') {
            this.arcProgress++;
            const t = this.arcProgress / this.arcDuration;

            // Quadratic Bezier curve interpolation
            // P(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
            const p0 = this.arcStartPoint; // Use the exact position where the arc phase began
            const p1 = this.controlPoint;
            const p2 = this.target;

            this.position.x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
            this.position.y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
            this.position.z = (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * p1.z + t * t * p2.z;

            if (this.arcProgress >= this.arcDuration) {
                this.launchPhase = 'chase';
            }
        } else if (this.launchPhase === 'chase') {
            const direction = this.target.clone().sub(this.position).normalize();
            this.position.add(direction.multiplyScalar(this.speed));
        }

        this.mesh.position.copy(this.position);

        // Check for ground collision, target reach, or minimum altitude
        if (this.position.y <= this.minAltitude || this.position.distanceTo(this.target) < 1) {
            this.cleanup();
            return true;
        }

        // Update trail
        this.trailPoints.push(this.position.clone());
        if (this.trailPoints.length > 300) {
            this.trailPoints.shift();
        }

        const geometry = this.trail.geometry;
        geometry.setFromPoints(this.trailPoints);

        // 건물과 충돌 감지
        const buildings = scene.getObjectByProperty('type', 'Group').children;
        for (const building of buildings) {
            if (!(building instanceof Building)) continue;

            const box = new THREE.Box3().setFromObject(building);
            if (box.containsPoint(this.position)) {
                this.explode();
                return true;
            }
        }

        return false;
    }

    explode() {
        const explosionRadius = 5;
        const buildings = scene.getObjectByProperty('type', 'Group').children;
        buildings.forEach(building => {
            if (building instanceof Building) {
                const distance = building.position.distanceTo(this.position);
                const height = building.geometry.parameters.height || building.scale.y;

                const box = new THREE.Box3().setFromObject(building);
                if (box.containsPoint(this.position)) {
                    const damage = 10;
                    if (building.damage(damage)) {
                        destroyedCityVolume += building.volume;
                    }
                }
            }
        });

        const allTargets = [...launchers, ...factories];
        allTargets.forEach(target => {
            const distance = target.position.distanceTo(this.position);
            if (distance < explosionRadius) {
                const damage = (1 - distance / explosionRadius) * 50;
                target.damage(damage);

            }
        });

        groundHitsCount++;
        document.getElementById('groundHits').textContent = groundHitsCount;

        // 방어 미사일 폭발 효과 (청색 계열)
        if (PERFORMANCE.effectsQuality !== 'low') {
            // 주 폭발 효과
            const explosionEffect = new ParticleSystem(this.position.clone(), {
                count: PERFORMANCE.effectsQuality === 'high' ? 25 : 12,
                color: 0x00ffff, // 청록색
                size: { min: 0.1, max: 0.3 },
                speed: { min: 0.2, max: 0.4 },
                lifetime: { min: 30, max: 50 },
                shape: 'sphere'
            });
            activeEffects.push(explosionEffect);

            // 전자기 펄스 효과 (원형으로 퍼지는)
            const empEffect = new ParticleSystem(this.position.clone(), {
                count: PERFORMANCE.effectsQuality === 'high' ? 15 : 8,
                color: 0x00ffff,
                size: { min: 0.05, max: 0.15 },
                speed: { min: 0.3, max: 0.5 },
                lifetime: { min: 15, max: 25 },
                shape: 'disk',
                gravity: false,
                fadeOut: true
            });
            activeEffects.push(empEffect);

            // 빛 효과 (중앙에 밝은 플래시)
            const flash = new THREE.PointLight(0x00ffff, 2, 10);
            flash.position.copy(this.position);
            scene.add(flash);

            gsap.to(flash, {
                intensity: 0,
                duration: 0.5,
                ease: "power2.out",
                onComplete: () => scene.remove(flash)
            });
        } else {
            // 저사양 모드에서는 간단한 파티클만 표시
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.4, 6, 6),
                new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true })
            );
            particle.position.copy(this.position);
            scene.add(particle);

            gsap.to(particle.scale, {
                x: 2,
                y: 2,
                z: 2,
                duration: 0.4,
                ease: "power2.out"
            });

            gsap.to(particle.material, {
                opacity: 0,
                duration: 0.4,
                ease: "power2.out",
                onComplete: () => scene.remove(particle)
            });
        }


        this.cleanup();
    }


    cleanup() {
        scene.remove(this.mesh);
        scene.remove(this.trail);
    }
}

// Modified EnemyMissile class to support multiple types
class EnemyMissile {
    constructor(type = 'A') {
        this.type = type;
        this.gravity = new THREE.Vector3(0, -0.001, 0);

        const currentDifficulty = difficultySettings[DIFFICULTY];
        const speedMultiplier = currentDifficulty.missileSpeedMultiplier;

        switch (type) {
            case 'A':
                this.baseSpeed = (0.0001 + (currentStage * 0.00002)) * speedMultiplier; // 기본 속도
                this.color = 0xff8800; // 주황
                this.explosionRadius = 3;
                this.damageAmount = 20;
                break;
            case 'B':
                this.baseSpeed = (0.00015 + (currentStage * 0.00002)) * speedMultiplier; // A보다 빠름
                this.color = 0xff0000; // 빨강
                this.explosionRadius = 4.5;
                this.damageAmount = 25;
                break;
            case 'C':
                this.baseSpeed = (0.00027 + (currentStage * 0.00002)) * speedMultiplier; // 가장 빠름
                this.color = 0xB04DFD; // 보라
                this.explosionRadius = 6;
                this.damageAmount = 40;
                break;
        }

        const angle = Math.random() * Math.PI * 2;
        const radius = gridSize * 2;
        this.position = new THREE.Vector3(
            Math.cos(angle) * radius,
            50 + Math.random() * 10,
            Math.sin(angle) * radius
        );

        const cityTargetRange = 60;
        const halfSize = cityTargetRange / 2;
        this.target = new THREE.Vector3(
            ((Math.random() + Math.random()) / 2) * cityTargetRange - halfSize,
            0,
            ((Math.random() + Math.random()) / 2) * cityTargetRange - halfSize
        );

        // --- 여기서 미사일 속도 계산 로직을 수정합니다. ---
        // baseSpeed에 따라 미사일의 비행 시간을 다르게 설정합니다.
        // baseSpeed가 빠를수록 비행 시간이 짧아집니다.
        this.flightTime = 5000 / (this.baseSpeed * 100000); // 팩터를 조절하여 적절한 비행 시간을 만드세요.
        // (빠른 미사일은 짧은 flightTime을 가짐)

        const horizontalDistanceToTarget = new THREE.Vector3(this.target.x, 0, this.target.z).distanceTo(new THREE.Vector3(this.position.x, 0, this.position.z));

        // 계산된 flightTime에 따라 수평 속도를 결정합니다.
        const horizontalVelocityMagnitude = horizontalDistanceToTarget / this.flightTime;
        const horizontalDirection = new THREE.Vector3(this.target.x - this.position.x, 0, this.target.z - this.position.z).normalize();

        this.velocity = horizontalDirection.multiplyScalar(horizontalVelocityMagnitude);

        // 중력 고려하여 초기 수직 속도(V0y)를 계산합니다.
        // V0y = (목표 높이 - 현재 높이 - 0.5 * 중력.y * flightTime^2) / flightTime
        this.velocity.y = (this.target.y - this.position.y - 0.5 * this.gravity.y * this.flightTime * this.flightTime) / this.flightTime;

        // 메쉬 생성
        const geometry = new THREE.SphereGeometry(0.4, 4, 4);
        this.mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ color: this.color }));

        // 궤적
        this.trail = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: this.color, transparent: true, opacity: 0.4 })
        );
        scene.add(this.trail);
        this.trailPoints = [];
        this.maxTrailLength = 40;

        // 초기 위치 설정
        this.mesh.position.copy(this.position);
    }

    update() {
        // 중력 적용
        this.velocity.add(this.gravity.clone());
        // this.baseSpeed는 이미 this.velocity에 반영되었으므로, update에서는 velocity를 그대로 적용합니다.
        this.position.add(this.velocity.clone());
        this.mesh.position.copy(this.position);

        this.trailPoints.push(this.position.clone());
        if (this.trailPoints.length > 120) this.trailPoints.shift();
        this.trail.geometry.setFromPoints(this.trailPoints);

        // 건물과 충돌
        const buildings = scene.getObjectByProperty('type', 'Group').children;
        for (const building of buildings) {
            if (!(building instanceof Building)) continue;

            const box = new THREE.Box3().setFromObject(building);
            if (box.containsPoint(this.position)) {
                this.explode();
                return true;
            }
        }

        if (this.position.y <= 0) {
            this.explode();
            return true;
        }
        return false;
    }

    explode() {
        const buildings = scene.getObjectByProperty('type', 'Group').children;

        // 폭발 지점 (미사일의 현재 위치)
        const explosionPoint = this.position.clone();
        const explosionRadius = this.explosionRadius;
        const damageAmount = this.damageAmount;

        buildings.forEach(building => {
            if (building instanceof Building) {
                // 건물 중심점과 폭발 지점 사이의 거리 계산
                const distanceToBuilding = building.position.distanceTo(explosionPoint);

                // 거리가 폭발 반경 이내인 경우 데미지 적용
                if (distanceToBuilding < explosionRadius) {
                    // 거리에 따라 데미지 감소 (선택 사항)
                    const normalizedDistance = distanceToBuilding / explosionRadius;
                    const damage = damageAmount * (1 - normalizedDistance);
                    if (building.damage(damage)) {
                        destroyedCityVolume += building.volume;
                    }
                } else {
                    // 직접 충돌했을 경우 (기존 로직 유지)
                    const box = new THREE.Box3().setFromObject(building);
                    if (box.containsPoint(explosionPoint)) {
                        if (building.damage(damageAmount)) {
                            destroyedCityVolume += building.volume;
                        }
                    }
                }
            }
        });

        // Damage launchers and factories (기존 코드 유지)
        const allTargets = [...launchers, ...factories];
        allTargets.forEach(target => {
            const distance = target.position.distanceTo(this.position);
            if (distance < this.explosionRadius) {
                const damage = (1 - distance / this.explosionRadius) * this.damageAmount;
                target.damage(damage);
            }
        });

        groundHitsCount++;
        document.getElementById('groundHits').textContent = groundHitsCount;

        // 향상된 폭발 효과
        if (PERFORMANCE.effectsQuality !== 'low') {
            // 주 폭발 효과
            const explosionEffect = new ParticleSystem(this.position.clone(), {
                count: PERFORMANCE.effectsQuality === 'high' ? 30 : 15,
                color: this.color,
                size: { min: 0.2, max: 0.5 },
                speed: { min: 0.2, max: 0.5 },
                lifetime: { min: 40, max: 60 },
                shape: 'sphere'
            });
            activeEffects.push(explosionEffect);

            // 충격파 효과 (원형으로 퍼지는)
            const shockwaveEffect = new ParticleSystem(this.position.clone(), {
                count: PERFORMANCE.effectsQuality === 'high' ? 20 : 10,
                color: 0xffffff,
                size: { min: 0.1, max: 0.3 },
                speed: { min: 0.3, max: 0.6 },
                lifetime: { min: 20, max: 30 },
                shape: 'disk',
                gravity: false
            });
            activeEffects.push(shockwaveEffect);

            // 연기 효과 (위로 올라가는)
            if (PERFORMANCE.effectsQuality === 'high') {
                const smokeEffect = new ParticleSystem(this.position.clone(), {
                    count: 15,
                    color: 0x444444,
                    size: { min: 0.3, max: 0.7 },
                    speed: { min: 0.05, max: 0.1 },
                    lifetime: { min: 80, max: 120 },
                    shape: 'cone',
                    spread: 0.5,
                    gravity: false
                });
                activeEffects.push(smokeEffect);
            }
        } else {
            // 저사양 모드에서는 간단한 파티클만 표시
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.5, 6, 6),
                new THREE.MeshBasicMaterial({ color: this.color, transparent: true })
            );
            particle.position.copy(this.position);
            scene.add(particle);

            gsap.to(particle.scale, {
                x: 3,
                y: 3,
                z: 3,
                duration: 0.5,
                ease: "power2.out"
            });

            gsap.to(particle.material, {
                opacity: 0,
                duration: 0.5,
                ease: "power2.out",
                onComplete: () => scene.remove(particle)
            });
        }
    }

        this.cleanup();
    }

cleanup() {
    scene.remove(this.mesh);
    scene.remove(this.trail);
}
}

// Add new function to show floating text
function showFloatingText(position, text) {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.position = 'fixed';
    div.style.color = 'white';
    div.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    div.style.padding = '6px 10px';
    div.style.borderRadius = '6px';
    div.style.fontFamily = 'Arial, sans-serif';
    div.style.fontSize = '11px';
    div.style.fontWeight = 'bold';
    div.style.pointerEvents = 'none';
    div.style.zIndex = '1002';
    div.style.textShadow = 'none';
    document.body.appendChild(div);

    // Convert 3D position to screen coordinates with slight Y offset
    const vector = position.clone();
    vector.y += 2; // Slightly above the building
    vector.project(camera);
    const x = (vector.x + 1) * window.innerWidth / 2;
    const y = (-vector.y + 1) * window.innerHeight / 2;

    div.style.left = x + 'px';
    div.style.top = y + 'px';
    div.style.transform = 'translate(-50%, -50%)';

    // Animate (only fade out, no movement)
    gsap.to(div, {
        opacity: 0,
        duration: 1.5,
        delay: 1,
        ease: "power4.in",
        onComplete: () => {
            document.body.removeChild(div);
        }
    });
}

// ==================== Event Handlers ====================
// Click handling
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Find the factory placement restriction check and update it
window.addEventListener('click', (event) => {
    if (!highlightMesh.visible) return;

    const position = highlightMesh.position.clone();
    position.y = 1;

    const gridSize = 64;
    const halfSize = gridSize / 2;
    const outerRing = 2;

    const gridX = Math.floor(position.x);
    const gridZ = Math.floor(position.z);

    // Check if position is occupied by existing launcher or factory
    const isPositionOccupied = [...launchers, ...factories].some(obj =>
        Math.floor(obj.position.x) === gridX && Math.floor(obj.position.z) === gridZ
    );

    if (isPositionOccupied) {
        showMessage('Cannot build here - position already occupied!', 3000);
        return;
    }

    if (isPlacingLauncher) {
        if (money >= 100) {
            money -= 100;
            document.getElementById('money').textContent = money;
            updatePurchaseButtonStates(); // Update button states after money changes
            launchers.push(new MissileLauncher(position));
            isPlacingLauncher = false;
        } else {
            showMessage('Not enough money to deploy a Launcher! ($100 needed)', 3000);
            isPlacingLauncher = false; // Reset placement mode
        }
    } else if (isPlacingFactory) {
        // Check if position is on outermost edge cells
        const isOnEdge = (
            Math.abs(gridX) >= halfSize - 1 ||
            Math.abs(gridZ) >= halfSize - 1
        );

        if (!isOnEdge) {
            showMessage('Factories can only be placed on the outermost edge cells!', 3000);
            isPlacingFactory = false;
        } else if (money >= 100) {
            money -= 100;
            document.getElementById('money').textContent = money;
            updatePurchaseButtonStates(); // Update button states after money changes
            factories.push(new MissileFactory(position));
            isPlacingFactory = false;
        } else {
            showMessage('Not enough money to deploy a Factory! ($100 needed)', 3000);
            isPlacingFactory = false; // Reset placement mode
        }
    }

    highlightMesh.visible = false;
    toggleRangeCircles(false); // Hide ranges after placement
    document.getElementById('placementMessage').style.display = 'none';
});

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // ----- 런처/팩토리 배치 중일 때 -----
    if (isPlacingLauncher || isPlacingFactory) {
        if (raycaster.intersectObject(ground).length > 0) {
            const point = raycaster.intersectObject(ground)[0].point;
            const gridX = Math.floor(point.x / 2) * 2 + 1;
            const gridZ = Math.floor(point.z / 2) * 2 + 1;

            highlightMesh.visible = true;

            if (isPlacingFactory) {
                const halfSize = gridSize / 2;
                const isOnEdge = (
                    Math.abs(gridX) >= halfSize - 1 ||
                    Math.abs(gridZ) >= halfSize - 1
                );

                if (!isOnEdge) {
                    highlightMesh.material.color.set(0xff0000); // Red
                } else {
                    highlightMesh.material.color.set(0x00ff00); // Green
                }
            } else {
                highlightMesh.material.color.set(0x00ff00); // Green
            }

            highlightMesh.position.set(gridX, 0.1, gridZ);
            toggleRangeCircles(isPlacingLauncher); // Show only if placing launcher
        } else {
            highlightMesh.visible = false;
            toggleRangeCircles(false);
        }
    }

    // ----- 배치 모드가 아닐 때: 런처에 마우스 오버시 범위 표시 -----
    if (!isPlacingLauncher && !isPlacingFactory) {
        const launcherMeshes = launchers.map(l => l.mesh);
        const intersectsLaunchers = raycaster.intersectObjects(launcherMeshes, true);
        if (intersectsLaunchers.length > 0) {
            toggleRangeCircles(true);
        } else {
            toggleRangeCircles(false);
        }
    }
});

// Range값 클릭 이벤트
document.addEventListener('DOMContentLoaded', () => {
    const rangeSpan = document.getElementById('rangeValue');
    rangeSpan.style.cursor = 'pointer';
    rangeSpan.addEventListener('click', () => {
        // Simply toggle range circles visibility as a simple debug feature
        rangeCircles.forEach(circle => {
            circle.visible = !circle.visible;
        });
    });
});

// ==================== Game Loop & Core Functions ====================
// Animation loop

let previousTime = performance.now();
function animate(currentTime) {
    const delta = (currentTime - previousTime) / 1000;
    previousTime = currentTime;

    if (isGameActive) {
        updateTimer(delta);       // ⏱️ 타이머 갱신

        // Update factories
        factories.forEach(factory => {
            factory.update();
        });

        // Update launchers
        cityGroup.children.forEach(building => {
            if (building instanceof Building) {
                building.update(delta);
            }
        });
        launchers.forEach(launcher => {
            launcher.update();

            // Check for enemies in range
            for (let enemy of enemyMissiles) {
                if (enemy.position.distanceTo(launcher.position) < launcher.range && launcher.missiles > 0) {
                    const missile = launcher.fireMissile(enemy);
                    if (missile) {
                        defenseMissiles.push(missile);
                        break;
                    }
                }
            }
        });

        // Update missiles
        defenseMissiles.forEach(missile => missile.update());

        // Update enemy missiles
        enemyMissiles = enemyMissiles.filter(missile => {
            const hit = missile.update();
            if (hit) {
                createExplosion(missile.position);
                missile.cleanup();
                return false;
            }
            return true;
        });

        // Spawn enemies ✅ 게임 시작 이후에만 실행
        if (isGameActive && !isCooldown && gameTimer > 5) {
            spawnEnemyMissile();
        }

        // Check collisions ✅ 게임 중 1회만
        checkCollisions();
    }

    // Calculate city health based on stored initial building data
    const remainingHeight = Math.max(0, initialTotalHeight - destroyedTotalHeight);
    cityHealthPercentage = (initialTotalHeight > 0) ? Math.max(0, (remainingHeight / initialTotalHeight) * 100) : 0;
    const remainingScore = Math.max(0, Math.round(remainingHeight)); // Ensure non-negative
    const totalScore = Math.max(0, Math.round(initialTotalHeight)); // Ensure non-negative
    document.getElementById('cityHealth').textContent = `${remainingScore} (${cityHealthPercentage.toFixed(2)}%)`;

    // Update buildings count
    const remainingBuildings = initialBuildingCount - destroyedBuildingCount;
    document.getElementById('buildingsCount').textContent = remainingBuildings;

    // Update visual effects
    activeEffects = activeEffects.filter(effect => {
        const active = effect.update();
        if (!active) {
            effect.destroy();
        }
        return active;
    });

    // Limit active effects for performance
    if (activeEffects.length > PERFORMANCE.particleLimit) {
        const toRemove = activeEffects.splice(0, activeEffects.length - PERFORMANCE.particleLimit);
        toRemove.forEach(effect => effect.destroy());
    }

    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// Add missing updateTimer function
function updateTimer(delta) {
    if (isCooldown) {
        cooldownTimer -= delta;
        document.getElementById('cooldownTime').textContent = Math.ceil(cooldownTimer);
        if (cooldownTimer <= 0) {
            isCooldown = false;
            gameTimer = WAVETIME;
            currentStage++;
            document.getElementById('stage').textContent = currentStage;
            document.getElementById('timeDisplay').textContent = `${gameTimer}s`;
            money += 100;
            document.getElementById('money').textContent = money;
            updatePurchaseButtonStates();
            document.getElementById('cooldown').style.display = 'none';
        }
    } else {
        gameTimer -= delta;
        document.getElementById('timeDisplay').textContent = `${Math.ceil(gameTimer)}s`;

        // Update city health tooltip
        const remainingHeight = Math.max(0, initialTotalHeight - destroyedTotalHeight);
        cityHealthPercentage = (initialTotalHeight > 0) ? Math.max(0, (remainingHeight / initialTotalHeight) * 100) : 0;

        // Update launcher stats panel
        document.getElementById('interceptedRange').textContent = interceptedCount;
        document.getElementById('missedRange').textContent = groundHitsCount;

        const cityHealthElement = document.getElementById('cityHealthRange');
        cityHealthElement.textContent = `${cityHealthPercentage.toFixed(1)}%`;
        cityHealthElement.setAttribute('data-tooltip', `${Math.round(remainingHeight)}/${Math.round(initialTotalHeight)}`);

        if (cityHealthPercentage <= 0) {
            endGame();
            return;
        }

        if (gameTimer <= 0 && enemyMissiles.length === 0) {
            if (currentStage >= STAGES) {
                endGame();
                return;
            }

            isCooldown = true;
            cooldownTimer = COOLDOWNTIME;
            document.getElementById('cooldown').style.display = 'block';
        }

        const remainingBuildings = initialBuildingCount - destroyedBuildingCount;
        document.getElementById('buildingsCount').textContent = `${remainingBuildings}/${initialBuildingCount}`;

        const currentHigh = Math.max(0, highBuildingCount - Math.floor(destroyedBuildingCount * (highBuildingCount / initialBuildingCount)));
        const currentMid = Math.max(0, midBuildingCount - Math.floor(destroyedBuildingCount * (midBuildingCount / initialBuildingCount)));
        const currentLow = Math.max(0, lowBuildingCount - Math.floor(destroyedBuildingCount * (lowBuildingCount / initialBuildingCount)));

        document.getElementById('highBuildings').textContent = `${currentHigh}/${highBuildingCount}`;
        document.getElementById('midBuildings').textContent = `${currentMid}/${midBuildingCount}`;
        document.getElementById('lowBuildings').textContent = `${currentLow}/${lowBuildingCount}`;
    }
}

// Modified checkCollisions function
function checkCollisions() {
    for (let i = enemyMissiles.length - 1; i >= 0; i--) {
        const enemy = enemyMissiles[i];

        for (let j = defenseMissiles.length - 1; j >= 0; j--) {
            const defense = defenseMissiles[j];

            if (enemy.position.distanceTo(defense.position) < 1) {
                createExplosion(enemy.position);
                playInterceptionSound();// Play beep on interception
                showFloatingTextAt(enemy.position, '+5', '#33ff33');
                enemy.cleanup();
                scene.remove(defense.mesh);
                scene.remove(defense.trail);
                enemyMissiles.splice(i, 1);
                defenseMissiles.splice(j, 1);
                interceptedCount++;
                money += 5; // Earn $5 per interception
                document.getElementById('intercepted').textContent = interceptedCount;
                document.getElementById('money').textContent = money; // Update money display
                updatePurchaseButtonStates(); // Update button states after money changes
                break;
            }
        }
    }
}

function showFloatingTextAt(worldPosition, text, color = '#ffffff') {
    const label = document.createElement('div');
    label.textContent = text;
    label.style.position = 'absolute';
    label.style.color = color;
    label.style.fontFamily = 'Arial';
    label.style.fontSize = '18px';
    label.style.fontWeight = 'bold';
    label.style.pointerEvents = 'none';
    label.style.zIndex = '1003';
    label.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    document.body.appendChild(label);

    const vector = worldPosition.clone();
    vector.y += 2;
    vector.project(camera);
    const x = (vector.x + 1) * window.innerWidth / 2;
    const y = (-vector.y + 1) * window.innerHeight / 2;
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    label.style.transform = 'translate(-50%, -50%)';

    gsap.to(label, {
        y: -40,
        opacity: 0,
        duration: 1.2,
        delay: 0.2,
        ease: "power1.out",
        onComplete: () => document.body.removeChild(label)
    });
}

// ==================== Audio Utility ====================
// ==================== Audio Utility ====================

let boomSoundBuffer = null;
let explosionSoundBuffer = null;
let launchSoundBuffer = null;

// Generic function to load audio buffer
function loadSound(url, callback) {
    if (!audioCtx) return;
    fetch(url)
        .then(res => res.arrayBuffer())
        .then(buf => audioCtx.decodeAudioData(buf))
        .then(decoded => callback(decoded))
        .catch(e => console.error(`Error loading sound from ${url}:`, e));
}

// Load specific sounds
function loadBoomSound() {
    loadSound('small-explosion-103931.mp3', buffer => boomSoundBuffer = buffer);
}

function loadExplosionSound() {
    loadSound('medium-explosion-40472.mp3', buffer => explosionSoundBuffer = buffer);
}

function loadLaunchSound() {
    loadSound('launching-missile-313226.mp3', buffer => launchSoundBuffer = buffer);
}

// 이 함수는 더 이상 사용하지 않습니다.
function playSound(buffer, volume = 1.0) {
    return; // 사운드 기능 제거됨
    const gainNode = audioCtx.createGain();

    gainNode.gain.value = volume; // 0.0 (무음) ～ 1.0 (기본 최대 볼륨)

    source.buffer = buffer;
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    source.start(0);
}

// Sound triggers
function playBoomSound() {
    playSound(boomSoundBuffer, 0.2);
}

function playExplosionSound() {
    playSound(explosionSoundBuffer, 0.2);
}

function playInterceptionSound() {
    playBoomSound();
}

function createExplosion(position, type = 'normal') {
    // 폭발 효과 생성 함수
    if (PERFORMANCE.effectsQuality === 'low') return;

    let options = {};

    switch (type) {
        case 'large':
            options = {
                count: PERFORMANCE.effectsQuality === 'high' ? 40 : 20,
                color: 0xff5500,
                size: { min: 0.3, max: 0.7 },
                speed: { min: 0.3, max: 0.6 },
                lifetime: { min: 50, max: 80 }
            };
            break;
        case 'emp':
            options = {
                count: PERFORMANCE.effectsQuality === 'high' ? 30 : 15,
                color: 0x00ffff,
                size: { min: 0.1, max: 0.3 },
                speed: { min: 0.2, max: 0.5 },
                lifetime: { min: 30, max: 50 },
                shape: 'disk'
            };
            break;
        default: // normal
            options = {
                count: PERFORMANCE.effectsQuality === 'high' ? 25 : 12,
                color: 0xff8800,
                size: { min: 0.2, max: 0.4 },
                speed: { min: 0.2, max: 0.4 },
                lifetime: { min: 40, max: 60 }
            };
    }

    const explosionEffect = new ParticleSystem(position, options);
    activeEffects.push(explosionEffect);
}

function playLaunchSound() {
    playSound(launchSoundBuffer, 0.3);
}

// Explosion effect creation and animation
function createExplosion(position) {
    const explosion = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 16),
        new THREE.LineBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 1
        })
    );
    explosion.position.copy(position);
    scene.add(explosion);

    // === NEW: particle burst ===
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xff8800 })
        );
        particle.position.copy(position);

        // random direction & speed
        const dir = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 1.5 + 0.5,
            (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(Math.random() * 2 + 1.5);

        gsap.to(particle.position, {
            x: position.x + dir.x,
            y: Math.max(position.y + dir.y, 0.2),
            z: position.z + dir.z,
            duration: 0.4,
            ease: "power2.out"
        });
        gsap.to(particle.material, {
            opacity: 0,
            duration: 0.6,
            ease: "power2.out",
            onComplete: () => scene.remove(particle)
        });
        scene.add(particle);
    }

    gsap.to(explosion.scale, {
        x: 3,
        y: 3,
        z: 3,
        duration: 0.5,
        ease: "power2.out"
    });

    gsap.to(explosion.material, {
        opacity: 0,
        duration: 0.5,
        ease: "power2.out",
        onComplete: () => {
            scene.remove(explosion);
        }
    });
}

function endGame() {
    isGameActive = false;
    const endScreen = document.getElementById('endGameScreen');
    const titleElement = document.getElementById('endGameTitle');
    const finalCityHealth = Math.max(cityHealthPercentage, 0).toFixed(1);

    document.getElementById('finalIntercepted').textContent = interceptedCount;
    document.getElementById('finalGroundHits').textContent = groundHitsCount;
    document.getElementById('finalCityHealth').textContent = `${finalCityHealth}%`;

    // Determine game outcome
    const gameCleared = currentStage >= STAGES;
    const gameFailed = !gameCleared;

    // Show custom message based on stage and city health
    if (gameCleared) {
        titleElement.textContent = 'Mission Completed';
    } else {
        titleElement.textContent = 'Mission Fail..';
    }

    // Record game data to database
    recordGameData(gameCleared, finalCityHealth);

    endScreen.style.display = 'flex';
    setTimeout(() => endScreen.classList.add('visible'), 50); // Fade-in
}

// New function to record game data
async function recordGameData(cleared, finalCityHealth) {
    try {
        await room.collection('gameRecord').create({
            outcome: cleared ? 'cleared' : 'failed',
            stageReached: currentStage,
            interceptedCount: interceptedCount,
            groundHits: groundHitsCount,
            finalCityHealth: parseFloat(finalCityHealth),
            difficulty: DIFFICULTY,
            totalWaves: STAGES,
            waveTime: WAVETIME,
            cooldownTime: COOLDOWNTIME,
            finalMoney: money,
            playDuration: Date.now() - gameStartTime // Track how long the game lasted
        });
    } catch (error) {
        console.error('Failed to record game data:', error);
    }
}

function restartGame() {
    // Reset game state variables
    currentStage = 1;
    interceptedCount = 0;
    groundHitsCount = 0;
    money = 150; // Initial balance
    isGameActive = false;
    isCooldown = false;
    gameTimer = WAVETIME;
    cooldownTimer = COOLDOWNTIME;
    CITY_HEALTH_TARGET = 70; // Default value since difficulty selection removed

    // Reset UI
    document.getElementById('stage').textContent = `1(${WAVETIME}s)`;
    document.getElementById('intercepted').textContent = '0';
    document.getElementById('groundHits').textContent = '0';
    document.getElementById('money').textContent = money;
    document.getElementById('cooldown').style.display = 'none';

    // Clear all existing objects
    enemyMissiles.forEach(m => m.cleanup());
    defenseMissiles.forEach(m => m.cleanup());

    // Use while loops to safely destroy and remove from arrays
    while (launchers.length > 0) {
        launchers[0].destroy();
    }
    while (factories.length > 0) {
        factories[0].destroy();
    }

    // Reset arrays
    enemyMissiles = [];
    defenseMissiles = [];
    launchers = [];
    factories = [];
    rangeCircles = [];

    // Reset city
    if (cityGroup) {
        // Explicitly remove any lingering spark effects from the old city
        cityGroup.children.forEach(building => {
            if (building instanceof Building && building.sparks.length > 0) {
                building.sparks.forEach(spark => scene.remove(spark));
                building.sparks = []; // Clear the array
            }
        });
        scene.remove(cityGroup);
    }

    // Reset building category counters
    highBuildingCount = 0;
    midBuildingCount = 0;
    lowBuildingCount = 0;

    // Reset counters before regenerating the city
    initialBuildingCount = 0;
    initialTotalHeight = 0;
    destroyedBuildingCount = 0;
    destroyedTotalHeight = 0;
    cityGroup = generateCity();
    scene.add(cityGroup);

    // Add a default factory for the new game
    const initialFactoryPosition = new THREE.Vector3(31, 1, 31); // bottom-right corner
    factories.push(new MissileFactory(initialFactoryPosition));

    // Hide end game screen
    const endScreen = document.getElementById('endGameScreen');
    endScreen.classList.remove('visible');
    setTimeout(() => {
        endScreen.style.display = 'none';
    }, 500); // Wait for fade out transition

    // Show settings menu and hide game UI
    document.getElementById('settingsMenu').style.display = 'block';
    document.getElementById('startButton').style.display = 'block';
    document.getElementById('leaderboardButton').style.display = 'block';
    document.getElementById('gameStatsUI').style.display = 'none';
    document.getElementById('restartButton').style.display = 'none';

    // Reset purchase buttons
    isPlacingFactory = false;
    isPlacingLauncher = false;
    document.getElementById('placementMessage').style.display = 'none';
    if (highlightMesh) highlightMesh.visible = false;
    setupPurchaseButtons();
    updatePurchaseButtonStates();

    // Reset camera to default position
    camera.position.set(50, 50, 50);
    camera.lookAt(32, 0, 32);
    controls.target.set(0, 0, 0);
    controls.update();
}

// Add restart button event listener
document.getElementById('restartButtonEndGame').addEventListener('click', restartGame);

// Add leaderboard functionality
document.getElementById('leaderboardButton').addEventListener('click', openLeaderboard);
document.getElementById('closeLeaderboard').addEventListener('click', closeLeaderboard);

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        switchTab(tab);
    });
});

function openLeaderboard() {
    const modal = document.getElementById('leaderboardModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('visible'), 10);
    loadLeaderboardData();
}

function closeLeaderboard() {
    const modal = document.getElementById('leaderboardModal');
    modal.classList.remove('visible');
    setTimeout(() => modal.style.display = 'none', 300);
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

async function loadLeaderboardData() {
    try {
        // Load all game records
        const records = await room.collection('gameRecord').getList();

        // Separate cleared and failed missions
        const clearedMissions = records.filter(r => r.outcome === 'cleared')
            .sort((a, b) => b.finalCityHealth - a.finalCityHealth || b.interceptedCount - a.interceptedCount);

        const failedMissions = records.filter(r => r.outcome === 'failed')
            .sort((a, b) => b.stageReached - a.stageReached || b.finalCityHealth - a.finalCityHealth);

        // Display cleared missions
        displayRecords('clearedRecords', clearedMissions, 'cleared');

        // Display failed missions
        displayRecords('failedRecords', failedMissions, 'failed');

        // Display statistics
        displayStatistics(records);

    } catch (error) {
        console.error('Failed to load leaderboard data:', error);
        document.getElementById('clearedRecords').innerHTML = '<div style="text-align: center; color: #ff0000;">Failed to load data</div>';
        document.getElementById('failedRecords').innerHTML = '<div style="text-align: center; color: #ff0000;">Failed to load data</div>';
        document.getElementById('gameStats').innerHTML = '<div style="text-align: center; color: #ff0000;">Failed to load data</div>';
    }
}

function displayRecords(containerId, records, type) {
    const container = document.getElementById(containerId);

    if (records.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #aaa;">No records yet</div>';
        return;
    }

    const recordsHtml = records.slice(0, 20).map((record, index) => {
        const date = new Date(record.created_at).toLocaleDateString();
        const time = new Date(record.created_at).toLocaleTimeString();

        const total = record.interceptedCount + record.groundHits;
        const interceptionRate = total > 0 ? ((record.interceptedCount / total) * 100).toFixed(1) : 0;

        return `
            <div class="record-item">
                <div class="record-rank">#${index + 1}</div>
                <div class="record-info">
                    <div class="record-title">${record.username}</div>
                    <div class="record-details">${date} ${time} • ${record.difficulty}</div>
                </div>
                <div class="record-stats">
                    ${type === 'cleared' ?
                `Wave ${record.stageReached}<br>City: ${record.finalCityHealth.toFixed(1)}%` :
                `Reached Wave ${record.stageReached}<br>City: ${record.finalCityHealth.toFixed(1)}%`
            }
                </div>
                <div class="record-stats">
                    Intercepted: ${record.interceptedCount}<br>
                    Missed: ${record.groundHits}<br>
                    Rate: ${interceptionRate}%
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = recordsHtml;
}

function displayStatistics(records) {
    const container = document.getElementById('gameStats');

    if (records.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #aaa;">No statistics available</div>';
        return;
    }

    const totalGames = records.length;
    const clearedGames = records.filter(r => r.outcome === 'cleared').length;
    const clearRate = ((clearedGames / totalGames) * 100).toFixed(1);

    const avgIntercepted = (records.reduce((sum, r) => sum + r.interceptedCount, 0) / totalGames).toFixed(1);
    const avgMissed = (records.reduce((sum, r) => sum + r.groundHits, 0) / totalGames).toFixed(1);
    const avgCityHealth = (records.reduce((sum, r) => sum + r.finalCityHealth, 0) / totalGames).toFixed(1);

    // Calculate average interception rate
    const totalIntercepted = records.reduce((sum, r) => sum + r.interceptedCount, 0);
    const totalMissed = records.reduce((sum, r) => sum + r.groundHits, 0);
    const totalMissiles = totalIntercepted + totalMissed;
    const avgInterceptionRate = totalMissiles > 0 ? ((totalIntercepted / totalMissiles) * 100).toFixed(1) : 0;

    const bestRecord = records.filter(r => r.outcome === 'cleared')
        .sort((a, b) => b.finalCityHealth - a.finalCityHealth)[0];

    const difficultyStats = ['EASY', 'NORMAL', 'HARD'].map(diff => {
        const diffRecords = records.filter(r => r.difficulty === diff);
        const diffCleared = diffRecords.filter(r => r.outcome === 'cleared').length;
        return `${diff}: ${diffCleared}/${diffRecords.length}`;
    }).join('<br>');

    container.innerHTML = `
        <div class="stat-card">
            <h3>Total Games</h3>
            <div class="stat-number">${totalGames}</div>
            <div class="stat-label">Missions Attempted</div>
        </div>
        <div class="stat-card">
            <h3>Success Rate</h3>
            <div class="stat-number">${clearRate}%</div>
            <div class="stat-label">${clearedGames}/${totalGames} Cleared</div>
        </div>
        <div class="stat-card">
            <h3>Avg Interception Rate</h3>
            <div class="stat-number">${avgInterceptionRate}%</div>
            <div class="stat-label">${avgIntercepted} vs ${avgMissed}</div>
        </div>
        <div class="stat-card">
            <h3>Avg Intercepted</h3>
            <div class="stat-number">${avgIntercepted}</div>
            <div class="stat-label">Per Mission</div>
        </div>
        <div class="stat-card">
            <h3>Avg Missed</h3>
            <div class="stat-number">${avgMissed}</div>
            <div class="stat-label">Per Mission</div>
        </div>
        <div class="stat-card">
            <h3>Avg City Health</h3>
            <div class="stat-number">${avgCityHealth}%</div>
            <div class="stat-label">Final Condition</div>
        </div>
        <div class="stat-card">
            <h3>Best Performance</h3>
            <div class="stat-number">${bestRecord ? bestRecord.finalCityHealth.toFixed(1) + '%' : 'N/A'}</div>
            <div class="stat-label">${bestRecord ? `by ${bestRecord.username}` : 'No cleared missions'}</div>
        </div>
        <div class="stat-card">
            <h3>Difficulty Breakdown</h3>
            <div class="stat-number" style="font-size: 12px;">${difficultyStats}</div>
            <div class="stat-label">Cleared/Total</div>
        </div>
    `;
}

// Close modal when clicking outside
document.getElementById('leaderboardModal').addEventListener('click', (e) => {
    if (e.target.id === 'leaderboardModal') {
        closeLeaderboard();
    }
});

// ==================== Initialization ====================
let gameStartTime = 0; // Track when game started

function init() {
    cityGroup = generateCity();
    scene.add(cityGroup);

    // Initialize city health calculation variables
    initialCityVolume = 0; // Not used anymore, keep for compatibility
    destroyedCityVolume = 0; // Not used anymore, keep for compatibility

    // Place initial factory at a corner
    const initialFactoryPosition = new THREE.Vector3(31, 1, 31); // bottom-right corner
    factories.push(new MissileFactory(initialFactoryPosition));

    // Setup button event listeners for settings
    document.querySelectorAll('.setting-button').forEach(button => {
        button.addEventListener('click', () => {
            const settingType = button.dataset.settingType;
            const value = button.dataset.value;

            // Remove 'selected' from other buttons of the same type
            document.querySelectorAll(`.setting-button[data-setting-type="${settingType}"]`).forEach(btn => {
                btn.classList.remove('selected');
            });

            // Add 'selected' to the clicked button
            button.classList.add('selected');

            // Update global variables based on selection
            if (settingType === 'waves') {
                STAGES = parseInt(value);
            } else if (settingType === 'waveDuration') {
                WAVETIME = parseInt(value);
            } else if (settingType === 'cooldownTime') {
                COOLDOWNTIME = parseInt(value);
            }
        });
    });

    // Add debug click handler for Buildings text
    let debugClickCount = 0;
    const buildingsText = document.getElementById('buildingsCount');

    buildingsText.style.cursor = 'pointer';
    buildingsText.addEventListener('click', () => {
        debugClickCount++;
        if (debugClickCount === 5) {
            debugClickCount = 0;
            // Skip to final wave
            currentStage = STAGES;
            document.getElementById('stage').textContent = currentStage;
            gameTimer = 0.1; // Force immediate completion
            showMessage('Debug: Skipped to final wave!', 2000);
        }
    });

    // Setup difficulty button listeners
    document.querySelectorAll('.setting-button[data-setting-type="difficulty"]').forEach(button => {
        button.addEventListener('click', () => {
            DIFFICULTY = button.dataset.value;
            document.querySelectorAll('.setting-button[data-setting-type="difficulty"]').forEach(btn => {
                btn.classList.remove('selected');
            });
            button.classList.add('selected');
            // Update difficulty display
            document.getElementById('difficultyDisplay').textContent = DIFFICULTY;

            // Update launchers' detect range based on difficulty
            const ranges = {
                EASY: 40,
                NORMAL: 36,
                HARD: 32
            };
            const newRange = ranges[DIFFICULTY] || 32;
            launchers.forEach(launcher => {
                launcher.updateRangeCircle(); // Use the new method instead
            });
            document.getElementById('rangeValue').textContent = newRange;
        });
    });

    document.getElementById('startButton').addEventListener('click', () => {
        gameStartTime = Date.now(); // Record start time
        isGameActive = true;
        isCooldown = true;      // ✅ 쿨다운 먼저
        cooldownTimer = COOLDOWNTIME;     // ✅ 쿨다운 0초
        gameTimer = WAVETIME;         // ✅ 스테이지용 초기값, 쿨다운 끝나면 사용
        currentStage = 0;       // ✅ Stage 1부터 시작
        interceptedCount = 0;
        document.getElementById('intercepted').textContent = interceptedCount;
        document.getElementById('stage').textContent = currentStage;
        document.getElementById('startButton').style.display = 'none';
        document.getElementById('leaderboardButton').style.display = 'none';
        document.getElementById('settingsMenu').style.display = 'none'; // Hide settings menu
        document.getElementById('gameStatsUI').style.display = 'flex';
        document.getElementById('money').textContent = money; // Display initial money
        setupPurchaseButtons(); // Setup purchase buttons

        // Initialize visual effects
        updateEffectsButtons();
        // Set initial difficulty display
        document.getElementById('difficultyDisplay').textContent = DIFFICULTY;
    });

    animate();
}

// Sound Toggle
// 설정 버튼 이벤트
document.getElementById('settingsButton').addEventListener('click', () => {
    document.getElementById('settingsMenu').style.display =
        document.getElementById('settingsMenu').style.display === 'block' ? 'none' : 'block';
});

// 이 코드는 더 이상 사용하지 않습니다.

// 시각 효과 품질 버튼들에 이벤트 연결
document.querySelectorAll('#effectsButtons .setting-button').forEach(button => {
    button.addEventListener('click', () => {
        const value = button.getAttribute('data-value');
        effectsQuality = value;

        // 성능 설정 업데이트
        switch (value) {
            case 'HIGH':
                PERFORMANCE.particleLimit = 200;
                PERFORMANCE.trailLength = 80;
                PERFORMANCE.effectsQuality = 'high';
                break;
            case 'MEDIUM':
                PERFORMANCE.particleLimit = 100;
                PERFORMANCE.trailLength = 40;
                PERFORMANCE.effectsQuality = 'medium';
                break;
            case 'LOW':
                PERFORMANCE.particleLimit = 50;
                PERFORMANCE.trailLength = 20;
                PERFORMANCE.effectsQuality = 'low';
                break;
        }

        updateEffectsButtons();
    });
});

// 시각 효과 버튼 상태 업데이트
function updateEffectsButtons() {
    document.querySelectorAll('#effectsButtons .setting-button').forEach(button => {
        const value = button.getAttribute('data-value');
        button.classList.toggle('selected', value === effectsQuality);
    });
}

function setupPurchaseButtons() {
    const purchaseContainer = document.getElementById('SystemCards');
    purchaseContainer.innerHTML = '';

    // ---- Factory ----
    const factoryWrapper = document.createElement('div');
    factoryWrapper.className = 'tooltip-container';

    const factoryButton = document.createElement('button');
    factoryButton.className = 'purchase-button';
    factoryButton.textContent = 'Deploy Factory ($100)';
    factoryButton.dataset.cost = 100;
    factoryButton.dataset.type = 'factory';
    factoryButton.addEventListener('click', () => {
        if (factoryButton.disabled) {
            showMessage('Not enough money to deploy a Factory! ($100 needed)', 3000);
            return;
        }
        document.querySelectorAll('.purchase-button').forEach(btn => btn.classList.remove('selected'));
        factoryButton.classList.add('selected');
        isPlacingFactory = true;
        isPlacingLauncher = false;
        document.getElementById('placementMessage').style.display = 'block';
    });

    const factoryTooltip = document.createElement('div');
    factoryTooltip.className = 'tooltip-text';
    factoryTooltip.innerHTML = `
        <strong>Factory</strong><br>
        Can only be built on the outskirts of the city<br>
        Supplies missiles to only one launcher at a time<br>
        -$3 per missile fired
    `;

    factoryWrapper.appendChild(factoryButton);
    factoryWrapper.appendChild(factoryTooltip);

    // ---- Launcher ----
    const launcherWrapper = document.createElement('div');
    launcherWrapper.className = 'tooltip-container';

    const launcherButton = document.createElement('button');
    launcherButton.className = 'purchase-button';
    launcherButton.textContent = 'Deploy Launcher ($100)';
    launcherButton.dataset.cost = 100;
    launcherButton.dataset.type = 'launcher';
    launcherButton.addEventListener('click', () => {
        if (launcherButton.disabled) {
            showMessage('Not enough money to deploy a Launcher! ($100 needed)', 3000);
            return;
        }
        document.querySelectorAll('.purchase-button').forEach(btn => btn.classList.remove('selected'));
        launcherButton.classList.add('selected');
        isPlacingLauncher = true;
        isPlacingFactory = false;
        document.getElementById('placementMessage').style.display = 'block';
    });

    const launcherTooltip = document.createElement('div');
    launcherTooltip.className = 'tooltip-text';
    launcherTooltip.innerHTML = `
        <strong>Launcher</strong><br>
        Be careful: interceptors may damage nearby buildings<br>
        Can hold up to 6 missiles<br>
        +$5 per successful interception
    `;

    launcherWrapper.appendChild(launcherButton);
    launcherWrapper.appendChild(launcherTooltip);

    // ---- Append to container ----
    purchaseContainer.appendChild(factoryWrapper);
    purchaseContainer.appendChild(launcherWrapper);

    updatePurchaseButtonStates();
}


function showMessage(message, duration = 2000) {
    const logMessageDiv = document.getElementById('logMessage');
    logMessageDiv.textContent = message;
    logMessageDiv.style.display = 'block';

    gsap.to(logMessageDiv, {
        opacity: 1, duration: 0.2, onComplete: () => {
            gsap.to(logMessageDiv, {
                opacity: 0, duration: 0.5, delay: (duration / 1000) - 0.5, onComplete: () => {
                    logMessageDiv.style.display = 'none';
                }
            });
        }
    });
}

function updatePurchaseButtonStates() {
    const factoryButton = document.querySelector('.purchase-button[data-type="factory"]');
    const launcherButton = document.querySelector('.purchase-button[data-type="launcher"]');

    if (factoryButton) {
        const cost = parseInt(factoryButton.dataset.cost);
        const canAfford = money >= cost;
        const isDisabled = !canAfford; // No more placement check
        factoryButton.classList.toggle('disabled', isDisabled);
        factoryButton.disabled = isDisabled;
    }

    if (launcherButton) {
        const cost = parseInt(launcherButton.dataset.cost);
        const canAfford = money >= cost;
        const isDisabled = !canAfford; // No more placement check
        launcherButton.classList.toggle('disabled', isDisabled);
        launcherButton.disabled = isDisabled;
    }
}

// ==================== City Generation ====================
function generateCity() {
    const buildings = new THREE.Group();
    const buildingCount = 500;
    const groundSize = 60;
    const halfSize = groundSize / 2;

    // Reset counters
    highBuildingCount = 0;
    midBuildingCount = 0;
    lowBuildingCount = 0;

    for (let i = 0; i < buildingCount; i++) {
        const x = Math.random() * groundSize - halfSize;
        const z = Math.random() * groundSize - halfSize;

        const distanceToCenter = Math.sqrt(x * x + z * z);
        const maxDistance = Math.sqrt(halfSize * halfSize * 2);
        const centerFactor = 1 - distanceToCenter / maxDistance;

        const size = 1 + Math.random() * 1.5;
        const exp = 6;  // 6 is idle
        const minHeight = 1;
        const maxHeight = 30;
        const exponentialFactor = Math.pow(centerFactor, exp);
        const height = minHeight + exponentialFactor * (maxHeight - minHeight);

        // Adjusted thresholds: High ≥18, Mid ≥8, Low <8
        if (height >= 18) {
            highBuildingCount++;
        } else if (height >= 8) {
            midBuildingCount++;
        } else {
            lowBuildingCount++;
        }

        const building = new Building(
            new THREE.BoxGeometry(size, height, size),
            new THREE.MeshLambertMaterial({
                color: new THREE.Color(
                    0.4 + (height / maxHeight) * 0.3,
                    0.4 + (height / maxHeight) * 0.4,
                    0.4 + (height / maxHeight) * 0.5
                )
            }),
            height
        );

        building.position.set(x, height / 2, z);
        buildings.add(building);

        initialBuildingCount++;
        initialTotalHeight += height;
    }

    // Update buildings count display with total counts
    document.getElementById('buildingsCount').textContent = `${initialBuildingCount}/${initialBuildingCount}`;
    document.getElementById('highBuildings').textContent = `${highBuildingCount}/${highBuildingCount}`;
    document.getElementById('midBuildings').textContent = `${midBuildingCount}/${midBuildingCount}`;
    document.getElementById('lowBuildings').textContent = `${lowBuildingCount}/${lowBuildingCount}`;

    return buildings;
}

let destroyedCityVolume = 0;
let initialCityVolume = 0;
let cityHealthPercentage = 100; // 전역 변수로 선언 및 초기화
let initialBuildingCount = 0;
let initialTotalHeight = 0;
let destroyedBuildingCount = 0;
let destroyedTotalHeight = 0;

let isPlacingLauncher = false;
let isPlacingFactory = false;
let factories = [];

init();

// Window resize handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});