import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';

// ==================== Scene & Renderer Setup ====================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Camera position
camera.position.set(50, 50, 50);
camera.lookAt(32, 0, 32);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ==================== Environment Setup ====================
// Grid setup
const gridSize = 64;
const gridDivisions = 32;
const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x009900, 0x009900);
scene.add(gridHelper);

// Ground
const groundHeight = 4;
const groundGeometry = new THREE.BoxGeometry(gridSize, groundHeight, gridSize);
const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.set(0, (-groundHeight / 2) - 0.05, 0);
scene.add(ground);

// Enhanced Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(50, 100, 50);
scene.add(directionalLight);

// Add atmospheric lighting
const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x8B4513, 0.3);
scene.add(hemisphereLight);

// Add subtle fog for depth
scene.fog = new THREE.Fog(0x000011, 150, 300);

// ==================== Game State & Variables ====================
let currentStage = 1;
let launchers = [];
let factories = [];
let enemyMissiles = [];
let defenseMissiles = [];
let rangeVisualizer; // 방공영역 시각화 객체
let money = 250;
let isGameActive = false;
let isCooldown = false;
let gameTimer = 20;
let cooldownTimer = 5;
let cityGroup;
let interceptedCount = 0;
let groundHitsCount = 0;
let destroyedCityVolume = 0;
let initialTotalHeight = 0;
let destroyedTotalHeight = 0;
let initialBuildingCount = 0;
let destroyedBuildingCount = 0;
let cityHealthPercentage = 100;

// Economy system variables
let consecutiveInterceptions = 0;
let waveStartInterceptedCount = 0;
let waveStartGroundHitsCount = 0;
let perfectDefenseBonus = 0;

// Game settings
let DIFFICULTY = 'NORMAL';
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

// Visual effects settings
let effectsQuality = 'HIGH';
const PERFORMANCE = {
    particleLimit: 200,
    trailLength: 80,
    effectsQuality: 'high'
};

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
            const hue = Math.random() * 0.1 - 0.05;
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
                velocity.set(
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1,
                    Math.random() * 2 - 1
                ).normalize();
            } else if (this.options.shape === 'cone') {
                velocity.set(
                    (Math.random() * 2 - 1) * this.options.spread,
                    1 + Math.random(),
                    (Math.random() * 2 - 1) * this.options.spread
                ).normalize();
            } else if (this.options.shape === 'disk') {
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

// Game interaction state
let selectedItem = null;
let isPlacementMode = false;
let nextEnemySpawn = 0;
const spawnInterval = 2000;

// Mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ==================== Basic Classes ====================

class MissileFactory {
    constructor(position) {
        this.position = position.clone();
        this.health = 200;
        this.maxHealth = 200;
        this.missiles = 0;
        this.maxMissiles = 12;
        this.productionRate = 3000; // 3 seconds per missile
        this.lastProductionTime = Date.now();
        this.lastDeliveredLauncherIndex = 0;
        this.isDistributing = false;

        // Create detailed factory model
        const factoryGroup = new THREE.Group();

        // Main building
        const mainBuilding = new THREE.Mesh(
            new THREE.BoxGeometry(3, 2, 3),
            new THREE.MeshPhongMaterial({ color: 0x22ffaa })
        );
        mainBuilding.position.y = 1;
        factoryGroup.add(mainBuilding);

        // Chimney
        const chimney = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 1.5),
            new THREE.MeshPhongMaterial({ color: 0x444444 })
        );
        chimney.position.set(1, 2.25, 1);
        factoryGroup.add(chimney);

        // Storage tanks
        for (let i = 0; i < 3; i++) {
            const tank = new THREE.Mesh(
                new THREE.CylinderGeometry(0.4, 0.4, 1.2),
                new THREE.MeshPhongMaterial({ color: 0x666666 })
            );
            tank.position.set(-1 + i * 0.8, 0.6, -1.2);
            factoryGroup.add(tank);
        }

        this.mesh = factoryGroup;
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);

        // Production indicator
        this.countText = document.createElement('div');
        this.countText.style.position = 'absolute';
        this.countText.style.color = 'white';
        this.countText.style.fontFamily = 'Arial';
        this.countText.style.fontSize = '12px';
        this.countText.style.fontWeight = 'bold';
        this.countText.style.textShadow = '1px 1px 2px black';
        this.countText.style.pointerEvents = 'none';
        this.countText.style.zIndex = '1000';
        document.body.appendChild(this.countText);
    }

    update() {
        const now = Date.now();
        if (this.missiles < this.maxMissiles && now - this.lastProductionTime > this.productionRate) {
            this.missiles++;
            this.lastProductionTime = now;
            
            // Visual production effect
            if (PERFORMANCE.effectsQuality !== 'low') {
                const productionEffect = new ParticleSystem(this.position.clone(), {
                    count: 5,
                    color: 0x00ff00,
                    size: { min: 0.1, max: 0.2 },
                    speed: { min: 0.1, max: 0.2 },
                    lifetime: { min: 20, max: 30 },
                    shape: 'cone',
                    spread: 0.2
                });
                activeEffects.push(productionEffect);
            }
        }

        // Auto-distribute missiles to launchers
        if (this.missiles > 0 && !this.isDistributing && launchers.length > 0) {
            // Find launchers that need missiles
            let launcherToDeliver = null;
            for (let i = 0; i < launchers.length; i++) {
                const currentIndex = (this.lastDeliveredLauncherIndex + 1 + i) % launchers.length;
                const launcher = launchers[currentIndex];

                if (launcher.missiles < launcher.maxMissiles) {
                    launcherToDeliver = launcher;
                    this.lastDeliveredLauncherIndex = currentIndex;
                    break;
                }
            }

            if (launcherToDeliver) {
                this.isDistributing = true;
                const success = this.deliverMissile(launcherToDeliver);
                if (!success) {
                    this.isDistributing = false;
                }
            }
        }

        // Update production count text
        const vector = this.position.clone();
        vector.y += 3;
        vector.project(camera);
        this.countText.style.left = (vector.x + 1) * window.innerWidth / 2 + 'px';
        this.countText.style.top = (-vector.y + 1) * window.innerHeight / 2 + 'px';
        this.countText.textContent = `공장: ${this.missiles}`;
    }

    deliverMissile(launcher) {
        if (this.missiles <= 0 || launcher.missiles >= launcher.maxMissiles) return false;

        // Check if player has enough money for delivery
        const deliveryCost = 3;
        if (money < deliveryCost) {
            showMessage(`미사일 배송 자금이 부족합니다! $${deliveryCost} 필요`, 3000);
            this.isDistributing = false;
            return false;
        }

        money -= deliveryCost;
        document.getElementById('money').textContent = money;

        this.missiles--; // Decrement count immediately

        // Visual feedback: missile transfer
        const missileTransfer = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 8, 8),
            new THREE.MeshBasicMaterial({ 
                color: 0x00ffff,
                transparent: true,
                opacity: 0.8
            })
        );
        missileTransfer.position.copy(this.position);
        missileTransfer.position.y += 1;
        scene.add(missileTransfer);

        // Calculate path for grid highlighting
        const path = this.getGridPath(this.position, launcher.position);
        let pathIndex = 0;

        const animateMissileTransfer = () => {
            if (pathIndex < path.length) {
                const targetPosition = path[pathIndex];
                this.highlightGridCell(targetPosition);

                gsap.to(missileTransfer.position, {
                    x: targetPosition.x,
                    y: targetPosition.y + 1,
                    z: targetPosition.z,
                    duration: 0.15,
                    ease: "none",
                    onComplete: () => {
                        pathIndex++;
                        animateMissileTransfer();
                    }
                });
            } else {
                // Missile reached launcher
                scene.remove(missileTransfer);
                launcher.missiles = Math.min(launcher.missiles + 1, launcher.maxMissiles);
                this.isDistributing = false;
                
                // Show delivery success effect
                const deliveryEffect = new ParticleSystem(launcher.position.clone(), {
                    count: 8,
                    color: 0x00ff00,
                    size: { min: 0.1, max: 0.2 },
                    speed: { min: 0.1, max: 0.3 },
                    lifetime: { min: 15, max: 25 },
                    shape: 'sphere'
                });
                activeEffects.push(deliveryEffect);
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
        path.push(target.clone());
        return path;
    }

    highlightGridCell(position) {
        const highlight = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.1, 2),
            new THREE.MeshBasicMaterial({ 
                color: 0x00ff00, 
                transparent: true, 
                opacity: 0.8 
            })
        );
        highlight.position.set(position.x, 0.05, position.z);
        scene.add(highlight);

        gsap.to(highlight.material, {
            opacity: 0,
            duration: 0.5,
            onComplete: () => scene.remove(highlight)
        });
    }

    // 점수 표시 이펙트 제거됨

    damage(amount) {
        this.health = Math.max(0, this.health - amount);
        const ratio = this.health / this.maxHealth;
        
        // Darken factory when damaged
        this.mesh.children.forEach(child => {
            if (child && child.material) {
                child.material.color.setRGB(
                    child.material.color.r * ratio,
                    child.material.color.g * ratio,
                    child.material.color.b * ratio
                );
            }
        });

        if (this.health <= 0) {
            this.destroy();
            return true;
        }
        return false;
    }

    destroy() {
        scene.remove(this.mesh);
        
        if (this.countText && this.countText.parentNode) {
            document.body.removeChild(this.countText);
        }
        
        const index = factories.indexOf(this);
        if (index > -1) {
            factories.splice(index, 1);
        }
    }
}
class Building extends THREE.Mesh {
    constructor(geometry, material, height) {
        super(geometry, material);
        this.maxHealth = height * 10;
        this.health = this.maxHealth;
        this.volume = geometry.parameters.width * geometry.parameters.height * geometry.parameters.depth;
        this.sparks = [];
    }

    damage(amount) {
        this.health = Math.max(0, this.health - amount);
        const ratio = this.health / this.maxHealth;
        this.material.color.setRGB(
            this.material.color.r * ratio,
            this.material.color.g * ratio,
            this.material.color.b * ratio
        );

        if (this.health <= 0) {
            this.collapse();
            return true;
        }
        return false;
    }

    collapse() {
        const duration = 2.0;
        const height = this.geometry.parameters.height;

        // Create collapse particle effect
        if (PERFORMANCE.effectsQuality !== 'low') {
            const collapseEffect = new ParticleSystem(this.position.clone(), {
                count: PERFORMANCE.effectsQuality === 'high' ? 20 : 10,
                color: 0x8B4513,
                size: { min: 0.1, max: 0.4 },
                speed: { min: 0.1, max: 0.3 },
                lifetime: { min: 60, max: 100 },
                shape: 'sphere',
                gravity: true
            });
            activeEffects.push(collapseEffect);

            // Dust cloud
            const dustEffect = new ParticleSystem(this.position.clone(), {
                count: PERFORMANCE.effectsQuality === 'high' ? 15 : 8,
                color: 0xcccccc,
                size: { min: 0.3, max: 0.8 },
                speed: { min: 0.05, max: 0.15 },
                lifetime: { min: 80, max: 120 },
                shape: 'sphere',
                gravity: false
            });
            activeEffects.push(dustEffect);
        }

        // Animate building sinking and rotating
        gsap.to(this.position, {
            y: -height / 2,
            duration: duration,
            ease: "power4.in"
        });

        gsap.to(this.rotation, {
            x: (Math.random() - 0.5) * 0.3,
            z: (Math.random() - 0.5) * 0.3,
            duration: duration,
            ease: "power2.in"
        });

        gsap.to(this.material, {
            opacity: 0,
            duration: duration,
            onComplete: () => {
                this.sparks.forEach(spark => scene.remove(spark));
                scene.remove(this);
                destroyedBuildingCount++;
                destroyedTotalHeight += height;
                
                // Update building type counts
                if (this.buildingCategory === 'high') {
                    window.destroyedHighBuildingCount = (window.destroyedHighBuildingCount || 0) + 1;
                } else if (this.buildingCategory === 'mid') {
                    window.destroyedMidBuildingCount = (window.destroyedMidBuildingCount || 0) + 1;
                } else if (this.buildingCategory === 'low') {
                    window.destroyedLowBuildingCount = (window.destroyedLowBuildingCount || 0) + 1;
                }
                
                console.log(`건물 붕괴 완료! 유형: ${this.buildingCategory}, 높이: ${height}, 총 파괴된 높이: ${destroyedTotalHeight}/${initialTotalHeight}`);
            }
        });
    }

    update(delta) {
        // Update fire particles
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
        if (damageRatio > 0.2 && Math.random() < damageRatio * 0.05) {
            const fireParticle = new THREE.Mesh(
                new THREE.SphereGeometry(0.2, 4, 4),
                new THREE.MeshBasicMaterial({
                    color: Math.random() > 0.5 ? 0xffd700 : 0xffa500,
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

/**
 * 방공영역 시각화를 담당하는 클래스
 * 발사대의 방어 범위를 시각적으로 표현하고 중첩 영역을 강조 표시합니다.
 */
class DefenseRangeVisualizer {
  constructor() {
    // 활성화된 방공영역을 담는 맵 (발사대 ID → 시각화 객체)
    this.activeRanges = new Map();
    
    // 중첩 영역 표시를 위한 재질
    this.overlapMaterial = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.4,
      depthWrite: false
    });
    
    // 중첩 영역을 표시하는 객체들
    this.overlapObjects = [];
    
    // 방공영역 표시 설정
    this.showRangesOption = true;
    this.showOverlapsOption = true;
  }

  /**
   * 발사대의 방공영역을 시각적으로 표시합니다.
   * @param {MissileLauncher} launcher - 발사대 객체
   */
  showRange(launcher) {
    if (!this.showRangesOption) return;
    
    // 이미 표시되고 있는 경우 숨기기
    if (launcher.rangeCircle.visible) {
      this.hideRange(launcher);
      return;
    }
    
    // 방공영역 표시
    launcher.rangeCircle.visible = true;
    
    // activeRanges 맵에 추가
    this.activeRanges.set(launcher.id, launcher.rangeCircle);
    
    // 중첩 영역 계산 및 표시
    if (this.showOverlapsOption && this.activeRanges.size > 1) {
      this.calculateOverlaps();
    }
  }

  /**
   * 발사대의 방공영역 표시를 숨깁니다.
   * @param {MissileLauncher} launcher - 발사대 객체
   */
  hideRange(launcher) {
    if (launcher.rangeCircle) {
      launcher.rangeCircle.visible = false;
    }
    
    // activeRanges 맵에서 제거
    this.activeRanges.delete(launcher.id);
    
    // 중첩 영역 업데이트
    this.clearOverlaps();
    if (this.showOverlapsOption && this.activeRanges.size > 1) {
      this.calculateOverlaps();
    }
  }

  /**
   * 모든 방공영역 표시를 토글합니다.
   */
  toggleAllRanges() {
    const allVisible = launchers.every(launcher => launcher.rangeCircle.visible);
    
    launchers.forEach(launcher => {
      if (allVisible) {
        this.hideRange(launcher);
      } else {
        this.showRange(launcher);
      }
    });
    
    // 중첩 영역 업데이트
    if (!allVisible && this.showOverlapsOption && launchers.length > 1) {
      this.calculateOverlaps();
    }
  }

  /**
   * 중첩된 방공영역을 계산하고 시각화합니다.
   */
  calculateOverlaps() {
    if (!this.showOverlapsOption || this.activeRanges.size < 2) {
      return;
    }
    
    // 기존 중첩 객체 제거
    this.clearOverlaps();
    
    // 활성화된 발사대 목록 가져오기
    const activeLaunchers = launchers.filter(launcher => 
      launcher.rangeCircle.visible
    );
    
    if (activeLaunchers.length < 2) return;
    
    // 각 발사대 쌍에 대해 중첩 영역 계산
    for (let i = 0; i < activeLaunchers.length; i++) {
      for (let j = i + 1; j < activeLaunchers.length; j++) {
        const launcher1 = activeLaunchers[i];
        const launcher2 = activeLaunchers[j];
        
        // 두 발사대 사이의 거리 계산
        const distance = launcher1.position.distanceTo(launcher2.position);
        
        // 두 방공영역이 겹치는 경우
        if (distance < launcher1.range + launcher2.range) {
          // 완전 포함 관계인 경우는 처리하지 않음
          if (distance + Math.min(launcher1.range, launcher2.range) <= Math.max(launcher1.range, launcher2.range)) {
            continue;
          }
          
          // 중첩 영역 표시를 위한 원 생성
          // 실제 중첩 영역 계산은 복잡하므로 간소화된 표현 사용
          const overlapCenter = new THREE.Vector3(
            (launcher1.position.x + launcher2.position.x) / 2,
            0.02, // 지면보다 약간 위에 표시
            (launcher1.position.z + launcher2.position.z) / 2
          );
          
          // 중첩 영역의 크기는 두 원의 중첩 정도에 따라 결정
          const overlapSize = (launcher1.range + launcher2.range - distance) / 2;
          
          const overlapGeometry = new THREE.CircleGeometry(overlapSize, 32);
          const overlapMesh = new THREE.Mesh(overlapGeometry, this.overlapMaterial);
          overlapMesh.rotation.x = -Math.PI / 2; // 지면과 평행하게 배치
          overlapMesh.position.copy(overlapCenter);
          
          scene.add(overlapMesh);
          this.overlapObjects.push(overlapMesh);
        }
      }
    }
  }

  /**
   * 중첩 영역 표시를 모두 제거합니다.
   */
  clearOverlaps() {
    this.overlapObjects.forEach(obj => scene.remove(obj));
    this.overlapObjects = [];
  }

  /**
   * 모든 발사대의 방공영역을 업데이트합니다.
   */
  updateAllRanges() {
    // 모든 중첩 영역 제거
    this.clearOverlaps();
    
    // 방공영역 표시 업데이트
    this.activeRanges.clear();
    
    if (this.showRangesOption) {
      launchers.forEach(launcher => {
        if (launcher.rangeCircle.visible) {
          this.activeRanges.set(launcher.id, launcher.rangeCircle);
        }
      });
      
      // 중첩 영역 재계산
      if (this.showOverlapsOption && this.activeRanges.size > 1) {
        this.calculateOverlaps();
      }
    }
  }

  /**
   * 방공영역 표시 설정을 변경합니다.
   * @param {boolean} showRanges - 방공영역 표시 여부
   * @param {boolean} showOverlaps - 중첩 영역 표시 여부
   */
  updateSettings(showRanges, showOverlaps) {
    this.showRangesOption = showRanges;
    this.showOverlapsOption = showOverlaps;
    
    // 설정 변경에 따른 시각화 업데이트
    if (!showRanges) {
      // 모든 방공영역 숨기기
      launchers.forEach(launcher => {
        if (launcher.rangeCircle) {
          launcher.rangeCircle.visible = false;
        }
      });
      this.activeRanges.clear();
      this.clearOverlaps();
    } else {
      // 활성화되었던 방공영역 다시 표시
      this.updateAllRanges();
    }
  }
}

class MissileLauncher {
    constructor(position) {
        // 고유 ID 생성 (타임스탬프와 랜덤값 조합)
        this.id = 'launcher_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        this.position = position.clone();
        this.position.y = 0;
        this.health = 100;
        this.maxHealth = 100;
        this.missiles = 6;
        this.maxMissiles = 6;
        this.range = difficultySettings[DIFFICULTY].range;

        // === DETAILED LAUNCHER MODEL ===
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
        const spacing = 0.5;
        const rows = 2, cols = 3;

        this.tubes = []; // Store tube meshes to update colors later

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tubeGeo = new THREE.BoxGeometry(tubeWidth, tubeHeight, tubeDepth);
                const tubeMat = new THREE.MeshPhongMaterial({ color: 0x666666 });
                const tube = new THREE.Mesh(tubeGeo, tubeMat);

                // Center offset so grid is centered on base
                const offsetX = (c - (cols - 1) / 2) * spacing;
                const offsetZ = (r - (rows - 1) / 2) * spacing;
                tube.position.set(offsetX, tubeHeight / 2, offsetZ);
                this.tubes.push(tube);
                tubeGroup.add(tube);
            }
        }

        // 3. Support structure
        const supportGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.5);
        const supportMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
        const support = new THREE.Mesh(supportGeometry, supportMaterial);
        support.position.y = 0.75;

        this.mesh = new THREE.Group();
        this.mesh.add(base);
        this.mesh.add(tubeGroup);
        this.mesh.add(support);
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);

        // Missile count text
        this.countText = document.createElement('div');
        this.countText.style.position = 'absolute';
        this.countText.style.color = 'white';
        this.countText.style.fontFamily = 'Arial';
        this.countText.style.fontSize = '14px';
        this.countText.style.fontWeight = 'bold';
        this.countText.style.textShadow = '1px 1px 2px black';
        this.countText.style.pointerEvents = 'none';
        this.countText.style.zIndex = '1000';
        document.body.appendChild(this.countText);

        // Range circle
        this.rangeCircle = this.createRangeCircle();
        this.rangeCircle.position.copy(this.position);
        this.rangeCircle.visible = false;
        scene.add(this.rangeCircle);
        
        // 선택 상태 추가
        this.rangeCircle.userData = { selected: false };
    }

    createRangeCircle() {
        const geometry = new THREE.CircleGeometry(this.range - 0.1, 64);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.3,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.01;
        return mesh;
    }
    
    /**
     * 발사대의 방공영역 업데이트 (업그레이드 시 사용)
     * @param {number} newRange - 새로운 방공영역 범위
     */
    updateRange(newRange) {
        if (newRange === this.range) return;
        
        // 기존 범위와 다른 경우에만 업데이트
        this.range = newRange;
        
        // 기존 rangeCircle 제거
        const wasVisible = this.rangeCircle.visible;
        scene.remove(this.rangeCircle);
        
        // 새로운 rangeCircle 생성
        this.rangeCircle = this.createRangeCircle();
        this.rangeCircle.position.copy(this.position);
        this.rangeCircle.visible = wasVisible;
        this.rangeCircle.userData = { selected: wasVisible }; // 이전 선택 상태 유지
        scene.add(this.rangeCircle);
        
        // 방공영역 시각화 업데이트
        if (rangeVisualizer && wasVisible) {
            rangeVisualizer.updateAllRanges();
        }
        
        // UI 업데이트
        document.getElementById('rangeValue').textContent = this.range;
        
        // 시각적 피드백 제공
        this.showRangeUpgradeEffect();
    }
    
    /**
     * 발사대 범위 업그레이드 시 시각 효과
     */
    showRangeUpgradeEffect() {
        if (PERFORMANCE.effectsQuality === 'low') return;
        
        // 범위 확장 애니메이션 효과
        const expansionRing = new THREE.Mesh(
            new THREE.RingGeometry(this.range - 2, this.range, 64),
            new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        expansionRing.rotation.x = -Math.PI / 2;
        expansionRing.position.copy(this.position);
        expansionRing.position.y = 0.02;
        scene.add(expansionRing);
        
        // 확장 애니메이션
        gsap.to(expansionRing.material, {
            opacity: 0,
            duration: 1.5,
            ease: "power2.out",
            onComplete: () => scene.remove(expansionRing)
        });
        
        // 파티클 효과
        if (PERFORMANCE.effectsQuality === 'high') {
            const upgradeEffect = new ParticleSystem(this.position.clone(), {
                count: 30,
                color: 0x00ffff,
                size: { min: 0.1, max: 0.3 },
                speed: { min: 0.1, max: 0.3 },
                lifetime: { min: 40, max: 60 },
                shape: 'sphere',
                spread: this.range / 4
            });
            activeEffects.push(upgradeEffect);
        }
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
        
        // Visual feedback
        this.createLaunchEffect();
        
        return missile;
    }
    
    createLaunchEffect() {
        // Enhanced launch effect
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
        
        // Muzzle flash
        const flash = new THREE.PointLight(0x00ffff, 3, 8);
        flash.position.copy(this.position);
        flash.position.y += 2;
        scene.add(flash);
        
        gsap.to(flash, {
            intensity: 0,
            duration: 0.2,
            ease: "power2.out",
            onComplete: () => scene.remove(flash)
        });
    }

    damage(amount) {
        this.health = Math.max(0, this.health - amount);
        if (this.health <= 0) {
            this.destroy();
            return true;
        }
        return false;
    }

    destroy() {
        scene.remove(this.mesh);
        scene.remove(this.rangeCircle);
        
        if (this.countText && this.countText.parentNode) {
            document.body.removeChild(this.countText);
        }
        
        const index = launchers.indexOf(this);
        if (index > -1) {
            launchers.splice(index, 1);
        }
    }
}

class DefenseMissile {
    constructor(start, target) {
        this.position = start.clone();
        this.initialPosition = start.clone();
        this.target = target;
        this.minAltitude = 1;

        // Calculate horizontal distance for dynamic scaling
        this.horizontalDistance = new THREE.Vector2(start.x, start.z).distanceTo(new THREE.Vector2(target.x, target.z));

        // Dynamically adjust missile speed based on horizontal distance
        this.speed = 0.25 + (this.horizontalDistance * 0.005);
        this.speed = Math.min(this.speed, 1.0);

        this.launchPhase = 'arc';
        this.arcProgress = 0;
        this.arcStartPoint = this.initialPosition.clone();

        // Dynamically adjust arc duration based on horizontal distance
        this.arcDuration = Math.max(30, this.horizontalDistance * 2);

        // Calculate Bezier control points for arc trajectory
        const p0Arc = this.initialPosition.clone();
        
        // Calculate the horizontal midpoint between start and target
        const horizontalMidpoint = new THREE.Vector3(
            (p0Arc.x + this.target.x) / 2,
            0,
            (p0Arc.z + this.target.z) / 2
        );

        // Calculate perpendicular direction for arc offset
        const horizontalDir = new THREE.Vector3(this.target.x, 0, this.target.z).sub(new THREE.Vector3(p0Arc.x, 0, p0Arc.z)).normalize();
        const perpendicularDir = new THREE.Vector3(-horizontalDir.z, 0, horizontalDir.x);

        // Create arc control point
        const arcOffset = this.horizontalDistance * 0.3;
        this.controlPoint = horizontalMidpoint.add(perpendicularDir.multiplyScalar(arcOffset));
        this.controlPoint.y = Math.max(p0Arc.y, this.target.y) + (this.horizontalDistance * 0.8);

        // Create missile mesh
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0x00ffff })
        );
        this.mesh.position.copy(start);
        scene.add(this.mesh);

        // Create trail
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
            const p0 = this.arcStartPoint;
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

        // Update trail
        this.trailPoints.push(this.position.clone());
        if (this.trailPoints.length > 300) {
            this.trailPoints.shift();
        }
        this.trail.geometry.setFromPoints(this.trailPoints);

        // Check collision with enemy missiles
        for (let i = 0; i < enemyMissiles.length; i++) {
            const enemy = enemyMissiles[i];
            if (this.position.distanceTo(enemy.position) < 2) {
                // Hit enemy missile
                interceptedCount++;
                consecutiveInterceptions++;
                document.getElementById('intercepted').textContent = interceptedCount;
                
                // Calculate interception bonus
                let bonus = 5; // Base interception bonus
                
                // Consecutive interception bonus (up to 5x multiplier)
                if (consecutiveInterceptions >= 5) {
                    bonus += 10; // +$10 for 5+ consecutive
                    showMessage(`연속 요격 보너스! +$${bonus}`, 1500);
                } else if (consecutiveInterceptions >= 3) {
                    bonus += 5; // +$5 for 3+ consecutive
                    showMessage(`연속 요격! +$${bonus}`, 1000);
                } else {
                    showMessage(`요격 성공! +$${bonus}`, 800);
                }
                
                money += bonus;
                document.getElementById('money').textContent = money;
                
                // Create explosion effect
                this.createExplosion();
                enemy.cleanup();
                enemyMissiles.splice(i, 1);
                this.cleanup();
                return true;
            }
        }

        // Check if reached target or ground
        if (this.position.y <= this.minAltitude || this.position.distanceTo(this.target) < 1) {
            this.cleanup();
            return true;
        }
        return false;
    }
    
    createExplosion() {
        // Create multi-layered explosion effect
        if (PERFORMANCE.effectsQuality !== 'low') {
            // Core explosion
            const coreExplosion = new ParticleSystem(this.position.clone(), {
                count: PERFORMANCE.effectsQuality === 'high' ? 25 : 12,
                color: 0x00ffff,
                size: { min: 0.1, max: 0.3 },
                speed: { min: 0.2, max: 0.4 },
                lifetime: { min: 30, max: 50 },
                shape: 'sphere'
            });
            activeEffects.push(coreExplosion);
            
            // Sparks effect
            const sparksEffect = new ParticleSystem(this.position.clone(), {
                count: PERFORMANCE.effectsQuality === 'high' ? 15 : 8,
                color: 0xffffff,
                size: { min: 0.05, max: 0.15 },
                speed: { min: 0.3, max: 0.6 },
                lifetime: { min: 15, max: 25 },
                shape: 'sphere',
                gravity: true
            });
            activeEffects.push(sparksEffect);
        }
        
        // Simple flash for low quality
        const flash = new THREE.PointLight(0x00ffff, 2, 10);
        flash.position.copy(this.position);
        scene.add(flash);
        
        gsap.to(flash, {
            intensity: 0,
            duration: 0.3,
            ease: "power2.out",
            onComplete: () => scene.remove(flash)
        });
    }

    // 점수 표시 이펙트 제거됨

    cleanup() {
        scene.remove(this.mesh);
        scene.remove(this.trail);
    }
}

class EnemyMissile {
    constructor(type = 'A') {
        this.type = type;
        this.gravity = new THREE.Vector3(0, -0.001, 0);
        
        const currentDifficulty = difficultySettings[DIFFICULTY];
        const speedMultiplier = currentDifficulty.missileSpeedMultiplier;

        switch(type) {
            case 'A':
                this.baseSpeed = (0.0001 + (currentStage * 0.00002)) * speedMultiplier;
                this.color = 0xff8800; // 주황
                this.explosionRadius = 3;
                this.damageAmount = 20;
                break;
            case 'B':
                this.baseSpeed = (0.00015 + (currentStage * 0.00002)) * speedMultiplier;
                this.color = 0xff0000; // 빨강
                this.explosionRadius = 4.5;
                this.damageAmount = 25;
                break;
            case 'C':
                this.baseSpeed = (0.00027 + (currentStage * 0.00002)) * speedMultiplier;
                this.color = 0xB04DFD; // 보라
                this.explosionRadius = 6;
                this.damageAmount = 40;
                break;
        }
        
        // Random spawn position
        const angle = Math.random() * Math.PI * 2;
        const radius = gridSize * 2;
        this.position = new THREE.Vector3(
            Math.cos(angle) * radius,
            50 + Math.random() * 10,
            Math.sin(angle) * radius
        );

        // Target city center with some randomness
        const cityTargetRange = 60;
        const halfSize = cityTargetRange / 2;
        this.target = new THREE.Vector3(
            ((Math.random() + Math.random()) / 2) * cityTargetRange - halfSize,
            0,
            ((Math.random() + Math.random()) / 2) * cityTargetRange - halfSize
        );

        // Calculate ballistic trajectory
        this.flightTime = 5000 / (this.baseSpeed * 100000);
        const horizontalDistanceToTarget = new THREE.Vector3(this.target.x, 0, this.target.z).distanceTo(new THREE.Vector3(this.position.x, 0, this.position.z));
        
        const horizontalVelocityMagnitude = horizontalDistanceToTarget / this.flightTime;
        const horizontalDirection = new THREE.Vector3(this.target.x - this.position.x, 0, this.target.z - this.position.z).normalize();
        
        this.velocity = horizontalDirection.multiplyScalar(horizontalVelocityMagnitude);
        this.velocity.y = (this.target.y - this.position.y - 0.5 * this.gravity.y * this.flightTime * this.flightTime) / this.flightTime;

        // Create missile mesh
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 4, 4),
            new THREE.MeshPhongMaterial({ color: this.color })
        );
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);

        // Create trail
        this.trail = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: this.color, transparent: true, opacity: 0.4 })
        );
        scene.add(this.trail);
        this.trailPoints = [];
        this.maxTrailLength = 120;
    }

    update() {
        // Apply gravity and velocity
        this.velocity.add(this.gravity.clone());
        this.position.add(this.velocity.clone());
        this.mesh.position.copy(this.position);

        // Update trail
        this.trailPoints.push(this.position.clone());
        if (this.trailPoints.length > this.maxTrailLength) {
            this.trailPoints.shift();
        }
        this.trail.geometry.setFromPoints(this.trailPoints);

        // Check collision with buildings
        if (cityGroup) {
            for (const building of cityGroup.children) {
                if (!(building instanceof Building)) continue;
                
                const box = new THREE.Box3().setFromObject(building);
                if (box.containsPoint(this.position)) {
                    // Direct hit - apply full damage to the hit building
                    const wasDestroyed = building.damage(this.damageAmount * 2); // Double damage for direct hit
                    if (wasDestroyed) {
                        const buildingHeight = building.geometry.parameters.height;
                        destroyedTotalHeight += buildingHeight;
                        destroyedBuildingCount++;
                        console.log(`Direct hit! Building destroyed! Height: ${buildingHeight}, Total destroyed height: ${destroyedTotalHeight}`);
                    }
                    
                    this.explode();
                    return true;
                }
            }
        }

        // Check if hit ground
        if (this.position.y <= 0) {
            this.explode();
            return true;
        }
        return false;
    }

    explode() {
        groundHitsCount++;
        document.getElementById('groundHits').textContent = groundHitsCount;
        
        // Reset consecutive interceptions when enemy missile hits ground
        consecutiveInterceptions = 0;
        
        console.log(`미사일 폭발! 위치: (${this.position.x.toFixed(1)}, ${this.position.y.toFixed(1)}, ${this.position.z.toFixed(1)}), 폭발 반경: ${this.explosionRadius}, 데미지: ${this.damageAmount}`);
        
        // Damage nearby buildings with explosion radius
        if (cityGroup) {
            let buildingsInRange = 0;
            cityGroup.children.forEach(building => {
                if (building instanceof Building) {
                    const distance = building.position.distanceTo(this.position);
                    if (distance < this.explosionRadius) {
                        buildingsInRange++;
                        const normalizedDistance = distance / this.explosionRadius;
                        const damage = this.damageAmount * (1 - normalizedDistance);
                        
                        console.log(`건물 데미지: 거리 ${distance.toFixed(1)}, 데미지 ${damage.toFixed(1)}, 건물 체력 ${building.health}/${building.maxHealth}`);
                        
                        // Apply damage and check if building is destroyed
                        const wasDestroyed = building.damage(damage);
                        if (wasDestroyed) {
                            const buildingHeight = building.geometry.parameters.height;
                            // Note: destroyedTotalHeight is updated in Building.collapse() method
                            console.log(`건물 파괴됨! 높이: ${buildingHeight}, 현재 파괴된 총 높이: ${destroyedTotalHeight}`);
                        }
                    }
                }
            });
            console.log(`폭발 범위 내 건물 수: ${buildingsInRange}`);
        }
        
        // Damage launchers in range
        launchers.forEach(launcher => {
            const distance = launcher.position.distanceTo(this.position);
            if (distance < this.explosionRadius) {
                const damage = (1 - distance / this.explosionRadius) * this.damageAmount;
                launcher.damage(damage);
            }
        });
        
        // Create explosion effect
        this.createExplosion();
        this.cleanup();
    }
    
    createExplosion() {
        // Create multi-layered ground explosion effect
        if (PERFORMANCE.effectsQuality !== 'low') {
            // Main explosion
            const mainExplosion = new ParticleSystem(this.position.clone(), {
                count: PERFORMANCE.effectsQuality === 'high' ? 30 : 15,
                color: this.color,
                size: { min: 0.2, max: 0.5 },
                speed: { min: 0.2, max: 0.5 },
                lifetime: { min: 40, max: 60 },
                shape: 'sphere'
            });
            activeEffects.push(mainExplosion);
            
            // Shockwave effect
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
            
            // Smoke effect for high quality
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
        }
        
        // Ground crater effect
        const crater = new THREE.Mesh(
            new THREE.RingGeometry(0.5, 2, 8),
            new THREE.MeshBasicMaterial({ 
                color: 0x332211, 
                transparent: true, 
                opacity: 0.6,
                side: THREE.DoubleSide 
            })
        );
        crater.rotation.x = -Math.PI / 2;
        crater.position.copy(this.position);
        crater.position.y = 0.01;
        scene.add(crater);
        
        // Fade out crater
        gsap.to(crater.material, {
            opacity: 0,
            duration: 10,
            onComplete: () => scene.remove(crater)
        });
    }

    cleanup() {
        scene.remove(this.mesh);
        scene.remove(this.trail);
    }
}

// ==================== Game Functions ====================

function spawnEnemyMissile() {
    if (!isGameActive || isCooldown) return;
    if (Date.now() <= nextEnemySpawn) return;

    const currentDifficulty = difficultySettings[DIFFICULTY];
    const maxMissiles = currentDifficulty.maxMissiles;
    if (enemyMissiles.length >= maxMissiles) return;

    const missileCount = Math.min(
        Math.min(2 + Math.floor(currentStage / 2), 5),
        maxMissiles - enemyMissiles.length
    );

    for (let i = 0; i < missileCount; i++) {
        enemyMissiles.push(new EnemyMissile('A'));
    }

    nextEnemySpawn = Date.now() + spawnInterval / Math.max(currentStage, 1);
}

function createCity() {
    cityGroup = new THREE.Group();
    scene.add(cityGroup);

    let totalHeight = 0;
    let buildingCount = 0;
    let highBuildingCount = 0;
    let midBuildingCount = 0;
    let lowBuildingCount = 0;

    // Create varied city districts
    for (let x = -30; x <= 30; x += 4) {
        for (let z = -30; z <= 30; z += 4) {
            if (Math.random() > 0.25) {
                // Distance from center affects building height (downtown effect)
                const distanceFromCenter = Math.sqrt(x * x + z * z);
                const heightMultiplier = Math.max(0.3, 1 - distanceFromCenter / 50);
                
                // Create varied building types
                const buildingType = Math.random();
                let height, width, depth, color, buildingCategory;
                
                if (buildingType < 0.3) {
                    // Skyscrapers (tall, narrow)
                    height = (8 + Math.random() * 15) * heightMultiplier;
                    width = 1.2 + Math.random() * 0.8;
                    depth = 1.2 + Math.random() * 0.8;
                    color = new THREE.Color().setHSL(0.6 + Math.random() * 0.1, 0.6, 0.3 + Math.random() * 0.2);
                    buildingCategory = 'high';
                    highBuildingCount++;
                } else if (buildingType < 0.6) {
                    // Mid-rise buildings
                    height = (4 + Math.random() * 8) * heightMultiplier;
                    width = 1.5 + Math.random() * 1.2;
                    depth = 1.5 + Math.random() * 1.2;
                    color = new THREE.Color().setHSL(0.1 + Math.random() * 0.2, 0.7, 0.4 + Math.random() * 0.2);
                    buildingCategory = 'mid';
                    midBuildingCount++;
                } else {
                    // Low-rise buildings
                    height = (2 + Math.random() * 4) * heightMultiplier;
                    width = 1.8 + Math.random() * 1.5;
                    depth = 1.8 + Math.random() * 1.5;
                    color = new THREE.Color().setHSL(0.05 + Math.random() * 0.15, 0.5, 0.5 + Math.random() * 0.2);
                    buildingCategory = 'low';
                    lowBuildingCount++;
                }

                const geometry = new THREE.BoxGeometry(width, height, depth);
                const material = new THREE.MeshLambertMaterial({ color });

                const building = new Building(geometry, material, height);
                building.buildingCategory = buildingCategory; // Store category for tracking
                
                // Add some random offset for more natural look
                const offsetX = x + (Math.random() - 0.5) * 1.5;
                const offsetZ = z + (Math.random() - 0.5) * 1.5;
                building.position.set(offsetX, height / 2, offsetZ);
                
                // Add architectural details for taller buildings
                if (height > 10) {
                    // Add antenna or spire
                    const antennaHeight = height * 0.1;
                    const antenna = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.05, 0.05, antennaHeight),
                        new THREE.MeshBasicMaterial({ color: 0x888888 })
                    );
                    antenna.position.set(0, height / 2 + antennaHeight / 2, 0);
                    building.add(antenna);
                }
                
                cityGroup.add(building);

                totalHeight += height;
                buildingCount++;
            }
        }
    }

    initialTotalHeight = totalHeight;
    initialBuildingCount = buildingCount;
    
    // Store building type counts globally
    window.initialHighBuildingCount = highBuildingCount;
    window.initialMidBuildingCount = midBuildingCount;
    window.initialLowBuildingCount = lowBuildingCount;
    window.destroyedHighBuildingCount = 0;
    window.destroyedMidBuildingCount = 0;
    window.destroyedLowBuildingCount = 0;
    
    console.log(`도시 생성 완료: 총 건물 ${buildingCount}개 (고층: ${highBuildingCount}, 중층: ${midBuildingCount}, 저층: ${lowBuildingCount}), 총 높이 ${totalHeight.toFixed(1)}`);
}

function updateTimer(delta) {
    if (isCooldown) {
        cooldownTimer -= delta;
        document.getElementById('cooldownTime').textContent = Math.ceil(cooldownTimer);
        if (cooldownTimer <= 0) {
            // Calculate wave completion bonuses
            const waveBonus = calculateWaveCompletionBonus();
            
            isCooldown = false;
            gameTimer = 20;
            currentStage++;
            document.getElementById('stage').textContent = currentStage;
            document.getElementById('timeDisplay').textContent = `${gameTimer}초`;
            money += 100 + waveBonus; // Base bonus + wave completion bonus
            document.getElementById('money').textContent = money;
            document.getElementById('cooldown').style.display = 'none';
            
            // Reset wave tracking variables
            waveStartInterceptedCount = interceptedCount;
            waveStartGroundHitsCount = groundHitsCount;
        }
    } else {
        gameTimer -= delta;
        document.getElementById('timeDisplay').textContent = `${Math.ceil(gameTimer)}초`;

        if (gameTimer <= 0) {
            isCooldown = true;
            cooldownTimer = 5;
            document.getElementById('cooldown').style.display = 'block';
        }
    }
}

// ==================== Game Loop ====================
let previousTime = performance.now();
function animate(currentTime) {
    const delta = (currentTime - previousTime) / 1000;
    previousTime = currentTime;

    if (isGameActive) {
        updateTimer(delta);

        // Update factories
        factories.forEach(factory => {
            factory.update();
        });

        // Update launchers
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
        defenseMissiles = defenseMissiles.filter(missile => !missile.update());
        enemyMissiles = enemyMissiles.filter(missile => !missile.update());

        // Spawn enemies
        spawnEnemyMissile();

        // Update city health
        const remainingHeight = Math.max(0, initialTotalHeight - destroyedTotalHeight);
        cityHealthPercentage = (initialTotalHeight > 0) ? Math.max(0, (remainingHeight / initialTotalHeight) * 100) : 0;
        const remainingScore = Math.max(0, Math.round(remainingHeight));
        const totalScore = Math.max(0, Math.round(initialTotalHeight));
        document.getElementById('cityHealth').textContent = `${remainingScore} (${cityHealthPercentage.toFixed(2)}%)`;
        
        // Update left panel stats
        updateLeftPanelStats();
        
        // Debug: Log city health changes
        if (destroyedTotalHeight > 0) {
            console.log(`도시 체력 업데이트: ${remainingHeight.toFixed(1)}/${initialTotalHeight.toFixed(1)} (${cityHealthPercentage.toFixed(1)}%)`);
        }
    }

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

// ==================== Event Handlers ====================
document.getElementById('startButton').addEventListener('click', () => {
    if (!isGameActive) {
        isGameActive = true;
        createCity();
        
        // 방공영역 시각화 객체 초기화
        rangeVisualizer = new DefenseRangeVisualizer();
        
        document.getElementById('startButton').style.display = 'none';
        document.getElementById('settingsMenu').style.display = 'none';
        
        // Initialize UI
        document.getElementById('stage').textContent = currentStage;
        document.getElementById('timeDisplay').textContent = `${gameTimer}초`;
        document.getElementById('money').textContent = money;
        document.getElementById('intercepted').textContent = interceptedCount;
        document.getElementById('groundHits').textContent = groundHitsCount;
        
        // Initialize left panel stats
        updateLeftPanelStats();
        
        // Initialize wave tracking
        waveStartInterceptedCount = 0;
        waveStartGroundHitsCount = 0;
        consecutiveInterceptions = 0;
        
        // Setup purchase buttons
        setupPurchaseButtons();
        
        // 방공영역 표시 설정 초기화
        initializeRangeVisualizerSettings();
    }
});

document.getElementById('settingsButton').addEventListener('click', () => {
    const menu = document.getElementById('settingsMenu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
});

// Difficulty buttons
document.querySelectorAll('#difficultyButtons .setting-button').forEach(button => {
    button.addEventListener('click', () => {
        DIFFICULTY = button.getAttribute('data-value');
        document.querySelectorAll('#difficultyButtons .setting-button').forEach(btn => {
            btn.classList.remove('selected');
        });
        button.classList.add('selected');
        
        // Update difficulty display
        const difficultyText = {
            'EASY': '쉬움',
            'NORMAL': '보통', 
            'HARD': '어려움'
        };
        document.getElementById('difficultyDisplay').textContent = difficultyText[DIFFICULTY];
    });
});

// Effects buttons
document.querySelectorAll('#effectsButtons .setting-button').forEach(button => {
    button.addEventListener('click', () => {
        effectsQuality = button.getAttribute('data-value');
        
        switch(effectsQuality) {
            case 'HIGH':
                PERFORMANCE.particleLimit = 200;
                PERFORMANCE.effectsQuality = 'high';
                break;
            case 'MEDIUM':
                PERFORMANCE.particleLimit = 100;
                PERFORMANCE.effectsQuality = 'medium';
                break;
            case 'LOW':
                PERFORMANCE.particleLimit = 50;
                PERFORMANCE.effectsQuality = 'low';
                break;
        }
        
        document.querySelectorAll('#effectsButtons .setting-button').forEach(btn => {
            btn.classList.remove('selected');
        });
        button.classList.add('selected');
    });
});

// Window resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==================== Player Interaction ====================
function setupPurchaseButtons() {
    const container = document.getElementById('SystemCards');
    container.innerHTML = '';

    // Factory button
    const factoryButton = document.createElement('div');
    factoryButton.className = 'purchase-button factory-card';
    factoryButton.innerHTML = `
        <div>🏭</div>
        <div>공장</div>
        <div>$100</div>
    `;
    factoryButton.addEventListener('click', () => selectItem('factory'));
    container.appendChild(factoryButton);

    // Launcher button
    const launcherButton = document.createElement('div');
    launcherButton.className = 'purchase-button launcher-card';
    launcherButton.innerHTML = `
        <div>🚀</div>
        <div>발사대</div>
        <div>$100</div>
    `;
    launcherButton.addEventListener('click', () => selectItem('launcher'));
    container.appendChild(launcherButton);

    // Start Wave button
    const startWaveButton = document.createElement('div');
    startWaveButton.className = 'purchase-button start-wave-card';
    startWaveButton.innerHTML = `
        <div>⚡</div>
        <div>웨이브 시작</div>
        <div>지금!</div>
    `;
    startWaveButton.addEventListener('click', () => startWaveImmediately());
    container.appendChild(startWaveButton);
}

/**
 * 방공영역 시각화 설정을 초기화합니다.
 */
function initializeRangeVisualizerSettings() {
    // 방공영역 표시 버튼 이벤트 처리
    document.querySelectorAll('#rangeVisualizationButtons .setting-button').forEach(button => {
        button.addEventListener('click', () => {
            const value = button.getAttribute('data-value');
            const showRanges = value === 'ON';
            
            // UI 업데이트
            document.querySelectorAll('#rangeVisualizationButtons .setting-button').forEach(btn => {
                btn.classList.remove('selected');
            });
            button.classList.add('selected');
            
            // 시각화 설정 업데이트
            if (rangeVisualizer) {
                const showOverlaps = document.querySelector('#overlapVisualizationButtons .selected').getAttribute('data-value') === 'ON';
                rangeVisualizer.updateSettings(showRanges, showOverlaps);
            }
        });
    });
    
    // 중첩 영역 표시 버튼 이벤트 처리
    document.querySelectorAll('#overlapVisualizationButtons .setting-button').forEach(button => {
        button.addEventListener('click', () => {
            const value = button.getAttribute('data-value');
            const showOverlaps = value === 'ON';
            
            // UI 업데이트
            document.querySelectorAll('#overlapVisualizationButtons .setting-button').forEach(btn => {
                btn.classList.remove('selected');
            });
            button.classList.add('selected');
            
            // 시각화 설정 업데이트
            if (rangeVisualizer) {
                const showRanges = document.querySelector('#rangeVisualizationButtons .selected').getAttribute('data-value') === 'ON';
                rangeVisualizer.updateSettings(showRanges, showOverlaps);
            }
        });
    });
}

/**
 * 발사대 호버 이벤트 처리를 위한 함수
 * @param {MouseEvent} event - 마우스 이벤트
 */
function onMouseMove(event) {
    // 게임이 활성화되지 않았거나 방공영역 시각화 객체가 없으면 리턴
    if (!isGameActive || !rangeVisualizer) return;
    
    // 마우스 좌표 계산
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // 발사대 객체와의 충돌 검사
    const intersects = raycaster.intersectObjects(
        launchers.map(launcher => launcher.mesh)
    );
    
    // 기존에 마우스 오버 중인 발사대가 있는 경우
    if (window.hoveredLauncher && (!intersects.length || 
        !launchers.some(launcher => launcher.mesh === intersects[0].object.parent))) {
        // 마우스가 발사대에서 벗어났으므로 방공영역 숨기기
        const launcher = window.hoveredLauncher;
        if (rangeVisualizer && !launcher.rangeCircle.userData.selected) {
            rangeVisualizer.hideRange(launcher);
        }
        window.hoveredLauncher = null;
    }
    
    // 마우스가 발사대 위에 있는 경우
    if (intersects.length > 0) {
        // 마우스 아래에 있는 발사대 찾기
        for (const launcher of launchers) {
            if (launcher.mesh === intersects[0].object.parent || 
                launcher.mesh.children.includes(intersects[0].object)) {
                // 방공영역 표시
                if (rangeVisualizer && launcher !== window.hoveredLauncher) {
                    rangeVisualizer.showRange(launcher);
                    window.hoveredLauncher = launcher;
                }
                break;
            }
        }
    }
}

/**
 * 발사대 클릭 이벤트 처리를 확장합니다.
 * @param {MouseEvent} event - 마우스 이벤트
 */
function onMouseClickForRange(event) {
    // 게임이 활성화되지 않았거나 방공영역 시각화 객체가 없으면 리턴
    if (!isGameActive || !rangeVisualizer || isPlacementMode) return;
    
    // 마우스 좌표 계산
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // 발사대 객체와의 충돌 검사
    const intersects = raycaster.intersectObjects(
        launchers.map(launcher => launcher.mesh)
    );
    
    // 발사대를 클릭한 경우
    if (intersects.length > 0) {
        // 클릭한 발사대 찾기
        for (const launcher of launchers) {
            if (launcher.mesh === intersects[0].object.parent || 
                launcher.mesh.children.includes(intersects[0].object)) {
                // 방공영역 토글
                if (rangeVisualizer) {
                    if (!launcher.rangeCircle.visible) {
                        rangeVisualizer.showRange(launcher);
                        // 선택 상태 표시
                        launcher.rangeCircle.userData.selected = true;
                    } else {
                        rangeVisualizer.hideRange(launcher);
                        launcher.rangeCircle.userData.selected = false;
                    }
                }
                break;
            }
        }
    }
}

// 마우스 이벤트 리스너 추가
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onMouseClickForRange);

function selectItem(itemType) {
    selectedItem = itemType;
    isPlacementMode = true;
    
    // Update UI
    document.querySelectorAll('.purchase-button').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    if (itemType === 'launcher') {
        document.querySelector('.launcher-card').classList.add('selected');
        document.getElementById('placementMessage').textContent = '그리드를 클릭하여 발사대를 배치하세요';
    } else if (itemType === 'factory') {
        document.querySelector('.factory-card').classList.add('selected');
        document.getElementById('placementMessage').textContent = '그리드를 클릭하여 공장을 배치하세요';
    }
    
    // Show placement message
    document.getElementById('placementMessage').style.display = 'block';
}

function getGridPosition(intersectPoint) {
    // Snap to grid
    const gridStep = 2;
    const x = Math.round(intersectPoint.x / gridStep) * gridStep;
    const z = Math.round(intersectPoint.z / gridStep) * gridStep;
    return new THREE.Vector3(x, 0, z);
}

function canPlaceAt(position) {
    // Check if position is within bounds
    if (Math.abs(position.x) > 30 || Math.abs(position.z) > 30) {
        return false;
    }
    
    // Check if position is occupied
    for (let launcher of launchers) {
        if (launcher.position.distanceTo(position) < 3) {
            return false;
        }
    }
    
    // Check if position conflicts with buildings
    if (cityGroup) {
        for (let building of cityGroup.children) {
            if (building.position.distanceTo(position) < 2) {
                return false;
            }
        }
    }
    
    return true;
}

function placeLauncher(position) {
    const cost = 100;
    if (money < cost) {
        showMessage('자금이 부족합니다!', 2000);
        return false;
    }
    
    if (!canPlaceAt(position)) {
        showMessage('여기에는 배치할 수 없습니다!', 2000);
        return false;
    }
    
    money -= cost;
    document.getElementById('money').textContent = money;
    
    const launcher = new MissileLauncher(position);
    launchers.push(launcher);
    
    showMessage('발사대가 배치되었습니다!', 1500);
    return true;
}

function placeFactory(position) {
    const cost = 100;
    if (money < cost) {
        showMessage('자금이 부족합니다!', 2000);
        return false;
    }
    
    if (!canPlaceAt(position)) {
        showMessage('여기에는 배치할 수 없습니다!', 2000);
        return false;
    }
    
    money -= cost;
    document.getElementById('money').textContent = money;
    
    const factory = new MissileFactory(position);
    factories.push(factory);
    
    showMessage('공장이 배치되었습니다!', 1500);
    return true;
}

function startWaveImmediately() {
    if (!isGameActive) {
        showMessage('먼저 게임을 시작하세요!', 2000);
        return;
    }
    
    if (!isCooldown) {
        showMessage('웨이브가 이미 진행 중입니다!', 2000);
        return;
    }
    
    // Calculate wave completion bonuses first
    const waveBonus = calculateWaveCompletionBonus();
    
    // End cooldown immediately and start next wave
    isCooldown = false;
    gameTimer = 20; // Reset wave timer
    currentStage++;
    document.getElementById('stage').textContent = currentStage;
    document.getElementById('timeDisplay').textContent = `${gameTimer}초`;
    money += 50 + waveBonus; // Early start bonus + wave completion bonus
    document.getElementById('money').textContent = money;
    document.getElementById('cooldown').style.display = 'none';
    
    // Reset wave tracking variables
    waveStartInterceptedCount = interceptedCount;
    waveStartGroundHitsCount = groundHitsCount;
    
    showMessage(`웨이브 ${currentStage} 시작! +$${50 + waveBonus} 총 보너스`, 2000);
    
    // Visual effect for wave start
    if (PERFORMANCE.effectsQuality !== 'low') {
        const waveStartEffect = new ParticleSystem(new THREE.Vector3(0, 10, 0), {
            count: 20,
            color: 0xffff00,
            size: { min: 0.2, max: 0.4 },
            speed: { min: 0.2, max: 0.5 },
            lifetime: { min: 30, max: 50 },
            shape: 'sphere'
        });
        activeEffects.push(waveStartEffect);
    }
}

function calculateWaveCompletionBonus() {
    let totalBonus = 0;
    let bonusMessages = [];
    
    // Building protection bonus (based on city health)
    if (cityHealthPercentage >= 90) {
        totalBonus += 50;
        bonusMessages.push('완벽한 도시 보호! +$50');
    } else if (cityHealthPercentage >= 75) {
        totalBonus += 30;
        bonusMessages.push('우수한 도시 보호! +$30');
    } else if (cityHealthPercentage >= 50) {
        totalBonus += 15;
        bonusMessages.push('양호한 도시 보호! +$15');
    }
    
    // Perfect defense bonus (no missiles hit ground this wave)
    const missedThisWave = groundHitsCount - waveStartGroundHitsCount;
    if (missedThisWave === 0 && (interceptedCount - waveStartInterceptedCount) > 0) {
        totalBonus += 75;
        bonusMessages.push('완벽한 방어! +$75');
    }
    
    // High interception rate bonus
    const interceptedThisWave = interceptedCount - waveStartInterceptedCount;
    const totalMissilesThisWave = interceptedThisWave + missedThisWave;
    if (totalMissilesThisWave > 0) {
        const interceptionRate = interceptedThisWave / totalMissilesThisWave;
        if (interceptionRate >= 0.8) {
            totalBonus += 25;
            bonusMessages.push(`높은 요격률 (${(interceptionRate * 100).toFixed(0)}%)! +$25`);
        }
    }
    
    // Show bonus messages
    if (bonusMessages.length > 0) {
        const combinedMessage = bonusMessages.join('\n') + `\n총 보너스: +$${totalBonus}`;
        showMessage(combinedMessage, 4000);
    }
    
    return totalBonus;
}

function updateLeftPanelStats() {
    // Update intercepted and missed counts
    document.getElementById('interceptedRange').textContent = interceptedCount;
    document.getElementById('missedRange').textContent = groundHitsCount;
    
    // Update city health percentage
    const cityHealthElement = document.getElementById('cityHealthRange');
    cityHealthElement.textContent = `${cityHealthPercentage.toFixed(2)}%`;
    
    // Update buildings count
    const remainingBuildings = Math.max(0, initialBuildingCount - destroyedBuildingCount);
    document.getElementById('buildingsCount').textContent = `${remainingBuildings}/${initialBuildingCount}`;
    
    // Update building type counts with actual data
    if (initialBuildingCount > 0) {
        const initialHigh = window.initialHighBuildingCount || 0;
        const initialMid = window.initialMidBuildingCount || 0;
        const initialLow = window.initialLowBuildingCount || 0;
        
        const destroyedHigh = window.destroyedHighBuildingCount || 0;
        const destroyedMid = window.destroyedMidBuildingCount || 0;
        const destroyedLow = window.destroyedLowBuildingCount || 0;
        
        const remainingHigh = Math.max(0, initialHigh - destroyedHigh);
        const remainingMid = Math.max(0, initialMid - destroyedMid);
        const remainingLow = Math.max(0, initialLow - destroyedLow);
        
        document.getElementById('highBuildings').textContent = `${remainingHigh}/${initialHigh}`;
        document.getElementById('midBuildings').textContent = `${remainingMid}/${initialMid}`;
        document.getElementById('lowBuildings').textContent = `${remainingLow}/${initialLow}`;
    }
    
    // Update difficulty display
    const difficultyText = {
        'EASY': '쉬움',
        'NORMAL': '보통', 
        'HARD': '어려움'
    };
    document.getElementById('difficultyDisplay').textContent = difficultyText[DIFFICULTY];
    
    // Update detection range
    const currentRange = launchers.length > 0 ? launchers[0].range : difficultySettings[DIFFICULTY].range;
    document.getElementById('rangeValue').textContent = currentRange;
    
    // 범위 업그레이드 버튼이 없으면 추가
    if (launchers.length > 0 && !document.getElementById('upgradeRangeButton')) {
        const rangeContainer = document.getElementById('launcherStatsSection');
        const rangeStat = rangeContainer.querySelector('div:nth-child(2)'); // 탐지 범위 요소
        
        if (rangeStat) {
            // 기존 내용 저장
            const originalContent = rangeStat.innerHTML;
            
            // 업그레이드 버튼 추가
            rangeStat.innerHTML = `
                ${originalContent}
                <button id="upgradeRangeButton" class="small-button">+</button>
            `;
            
            // 버튼 스타일 추가
            const styleElement = document.createElement('style');
            styleElement.textContent = `
                .small-button {
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    padding: 2px 5px;
                    margin-left: 5px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .small-button:hover {
                    background-color: #45a049;
                }
            `;
            document.head.appendChild(styleElement);
            
            // 버튼 이벤트 리스너 추가
            document.getElementById('upgradeRangeButton').addEventListener('click', upgradeAllLaunchersRange);
        }
    }
}

/**
 * 테스트 목적으로 모든 발사대의 범위를 업그레이드합니다.
 */
function upgradeAllLaunchersRange() {
    if (launchers.length === 0) {
        showMessage('업그레이드할 발사대가 없습니다!', 2000);
        return;
    }
    
    // 자금 확인
    const upgradeCost = 50;
    if (money < upgradeCost) {
        showMessage('업그레이드를 위한 자금이 부족합니다!', 2000);
        return;
    }
    
    money -= upgradeCost;
    document.getElementById('money').textContent = money;
    
    // 모든 발사대 범위 증가
    const rangeIncrease = 4;
    launchers.forEach(launcher => {
        launcher.updateRange(launcher.range + rangeIncrease);
    });
    
    showMessage(`모든 발사대의 방공영역이 증가했습니다! (+${rangeIncrease})`, 2000);
}

function showMessage(text, duration) {
    const messageEl = document.getElementById('logMessage');
    if (!messageEl) {
        const newMessageEl = document.createElement('div');
        newMessageEl.id = 'logMessage';
        newMessageEl.style.cssText = `
            position: fixed;
            top: 200px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 16px;
            z-index: 1000;
            text-align: center;
        `;
        document.body.appendChild(newMessageEl);
    }
    
    const msgEl = document.getElementById('logMessage');
    msgEl.innerHTML = text.replace(/\n/g, '<br>'); // Support multi-line messages
    msgEl.style.display = 'block';
    
    setTimeout(() => {
        msgEl.style.display = 'none';
    }, duration);
}

// Mouse event handlers
function onMouseClick(event) {
    if (!isGameActive || !isPlacementMode) return;
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([ground]);
    
    if (intersects.length > 0) {
        const intersectPoint = intersects[0].point;
        const gridPos = getGridPosition(intersectPoint);
        
        if (selectedItem === 'launcher') {
            if (placeLauncher(gridPos)) {
                isPlacementMode = false;
                selectedItem = null;
                document.getElementById('placementMessage').style.display = 'none';
                document.querySelectorAll('.purchase-button').forEach(btn => {
                    btn.classList.remove('selected');
                });
            }
        } else if (selectedItem === 'factory') {
            if (placeFactory(gridPos)) {
                isPlacementMode = false;
                selectedItem = null;
                document.getElementById('placementMessage').style.display = 'none';
                document.querySelectorAll('.purchase-button').forEach(btn => {
                    btn.classList.remove('selected');
                });
            }
        }
    }
}

// Add event listeners
window.addEventListener('click', onMouseClick);

// ESC key to cancel placement
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isPlacementMode) {
        isPlacementMode = false;
        selectedItem = null;
        document.getElementById('placementMessage').style.display = 'none';
        document.querySelectorAll('.purchase-button').forEach(btn => {
            btn.classList.remove('selected');
        });
    }
});

// Start animation loop
animate();

console.log('미사일 방어 시뮬레이터가 성공적으로 로드되었습니다!');