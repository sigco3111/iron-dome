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
let upgradeSystem; // 업그레이드 시스템 객체
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

        // 배송 비용 계산 (업그레이드 효과 적용)
        let deliveryCost = 3;
        
        // 배송 비용 감소 업그레이드가 있으면 적용
        if (window.upgradeSystem) {
            const deliveryCostReduction = window.upgradeSystem.calculateEffect('factory', 'deliveryCost');
            deliveryCost = Math.max(1, Math.floor(deliveryCost - deliveryCostReduction)); // 최소 1원
        }
        
        // 자금 확인
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
                
                // 건물 파괴 기록
                if (playerHistory) {
                    playerHistory.recordBuildingDestroyed(this.buildingCategory);
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

/**
 * 게임 내 요소 업그레이드를 관리하는 클래스
 * 발사대, 공장, 도시에 대한 업그레이드 항목들을 정의하고 효과를 적용합니다.
 */
class UpgradeSystem {
  constructor() {
    // 업그레이드 데이터 정의 - 10단계로 확장
    this.upgrades = {
      launcher: {
        range: { 
          level: 0, 
          maxLevel: 10, 
          cost: [100, 150, 200, 250, 350, 500, 650, 800, 1000, 1250], 
          effect: [2, 4, 6, 8, 10, 12, 15, 18, 21, 25],
          title: '방어 범위',
          description: '발사대의 탐지 및 방어 범위를 증가시킵니다.'
        },
        capacity: { 
          level: 0, 
          maxLevel: 10, 
          cost: [150, 200, 250, 350, 450, 550, 650, 800, 950, 1200], 
          effect: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15],
          title: '미사일 용량',
          description: '발사대가 저장할 수 있는 최대 미사일 수를 증가시킵니다.'
        },
        reloadSpeed: { 
          level: 0, 
          maxLevel: 10, 
          cost: [120, 180, 240, 300, 400, 500, 650, 800, 950, 1100], 
          effect: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6],
          title: '발사 속도',
          description: '발사대의 미사일 발사 속도를 향상시킵니다.'
        }
      },
      factory: {
        productionRate: { 
          level: 0, 
          maxLevel: 10, 
          cost: [100, 150, 200, 300, 400, 500, 600, 750, 900, 1100], 
          effect: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7],
          title: '생산 속도',
          description: '공장의 미사일 생산 속도를 향상시킵니다.'
        },
        capacity: { 
          level: 0, 
          maxLevel: 10, 
          cost: [150, 200, 300, 400, 500, 600, 750, 900, 1050, 1200], 
          effect: [2, 4, 6, 8, 10, 15, 20, 25, 30, 40],
          title: '저장 용량',
          description: '공장이 저장할 수 있는 최대 미사일 수를 증가시킵니다.'
        },
        deliveryCost: { 
          level: 0, 
          maxLevel: 10, 
          cost: [120, 180, 240, 320, 400, 500, 600, 750, 900, 1050], 
          effect: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],
          title: '배송 비용',
          description: '미사일 배송 비용을 감소시킵니다.'
        }
      },
      city: {
        buildingHealth: { 
          level: 0, 
          maxLevel: 10, 
          cost: [200, 250, 300, 400, 500, 650, 800, 950, 1100, 1300], 
          effect: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75],
          title: '건물 내구도',
          description: '도시 건물들의 내구도를 증가시킵니다.'
        },
        repairRate: { 
          level: 0, 
          maxLevel: 10, 
          cost: [250, 300, 350, 450, 550, 650, 800, 950, 1100, 1300], 
          effect: [0.025, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5],
          title: '복구 속도',
          description: '손상된 건물의 자동 복구 속도를 증가시킵니다.'
        },
        income: { 
          level: 0, 
          maxLevel: 10, 
          cost: [300, 350, 400, 500, 600, 750, 900, 1050, 1200, 1500], 
          effect: [10, 15, 20, 30, 40, 55, 70, 85, 100, 120],
          title: '수입 증가',
          description: '웨이브 완료 시 추가 수입을 제공합니다.'
        }
      }
    };
    
    // 메뉴 열림 여부
    this.isMenuOpen = false;
  }

  /**
   * 업그레이드 가능 여부를 확인합니다.
   * @param {string} category - 업그레이드 카테고리 (launcher, factory, city)
   * @param {string} type - 업그레이드 유형 (range, capacity 등)
   * @param {number} money - 현재 보유 자금
   * @returns {boolean} 업그레이드 가능 여부
   */
  canUpgrade(category, type, money) {
    const upgrade = this.upgrades[category][type];
    
    // 최대 레벨 확인
    if (upgrade.level >= upgrade.maxLevel) {
      return false;
    }
    
    // 비용 확인
    const cost = upgrade.cost[upgrade.level];
    if (money < cost) {
      return false;
    }
    
    return true;
  }

  /**
   * 업그레이드를 적용합니다.
   * @param {string} category - 업그레이드 카테고리 (launcher, factory, city)
   * @param {string} type - 업그레이드 유형 (range, capacity 등)
   * @param {number} money - 현재 보유 자금
   * @returns {Object|boolean} - 성공 시 {success: true, cost: 비용}, 실패 시 false
   */
  applyUpgrade(category, type, money) {
    if (!this.canUpgrade(category, type, money)) {
      return false;
    }
    
    const upgrade = this.upgrades[category][type];
    const cost = upgrade.cost[upgrade.level];
    
    // 레벨 증가
    upgrade.level++;
    
    // 효과 적용
    this.applyUpgradeEffect(category, type);
    
    // 업그레이드 기록
    if (playerHistory) {
      playerHistory.recordUpgrade(category, type, upgrade.level);
    }
    
    return { success: true, cost: cost };
  }

  /**
   * 업그레이드 효과를 게임 객체에 적용합니다.
   * @param {string} category - 업그레이드 카테고리
   * @param {string} type - 업그레이드 유형
   */
  applyUpgradeEffect(category, type) {
    const upgrade = this.upgrades[category][type];
    const currentLevel = upgrade.level;
    const effect = upgrade.effect[currentLevel - 1]; // 현재 레벨의 효과 적용
    
    if (category === 'launcher') {
      // 발사대 업그레이드 효과
      launchers.forEach(launcher => {
        if (type === 'range') {
          launcher.updateRange(difficultySettings[DIFFICULTY].range + effect);
        } else if (type === 'capacity') {
          launcher.maxMissiles += effect;
        } else if (type === 'reloadSpeed') {
          // 발사 속도 향상 효과는 미사일 발사 로직에서 처리
        }
      });
    } else if (category === 'factory') {
      // 공장 업그레이드 효과
      factories.forEach(factory => {
        if (type === 'productionRate') {
          factory.productionRate = Math.floor(3000 * (1 - effect));
        } else if (type === 'capacity') {
          factory.maxMissiles += effect;
        } else if (type === 'deliveryCost') {
          // 배송 비용 감소 효과는 deliverMissile 함수에서 처리
        }
      });
    } else if (category === 'city') {
      // 도시 업그레이드 효과 (추후 구현)
    }
  }

  /**
   * 현재 업그레이드 효과를 계산합니다.
   * @param {string} category - 업그레이드 카테고리
   * @param {string} type - 업그레이드 유형
   * @returns {number} 현재 효과 값
   */
  calculateEffect(category, type) {
    const upgrade = this.upgrades[category][type];
    let totalEffect = 0;
    
    // 현재까지의 모든 레벨 효과 합산
    for (let i = 0; i < upgrade.level; i++) {
      totalEffect += upgrade.effect[i];
    }
    
    return totalEffect;
  }
  
  /**
   * 업그레이드 메뉴를 생성하고 표시합니다.
   */
  showUpgradeMenu() {
    if (this.isMenuOpen) return;
    
    // 게임 일시정지
    this.pauseGame();
    
    // 메뉴 컨테이너 생성
    const menuContainer = document.createElement('div');
    menuContainer.id = 'upgradeMenu';
    menuContainer.className = 'upgrade-menu';
    
    // 메뉴 제목
    const title = document.createElement('h2');
    title.textContent = '업그레이드 메뉴';
    menuContainer.appendChild(title);
    
    // 탭 메뉴
    const tabContainer = document.createElement('div');
    tabContainer.className = 'tab-container';
    tabContainer.style.width = '100%'; // 너비 100%로 설정
    
    const categories = {
      'launcher': '발사대',
      'factory': '공장',
      'city': '도시'
    };
    
    // 탭 버튼 생성
    Object.keys(categories).forEach((category, index) => {
      const tabButton = document.createElement('button');
      tabButton.className = 'tab-button' + (index === 0 ? ' active' : '');
      tabButton.textContent = categories[category];
      tabButton.dataset.category = category;
      tabButton.style.flex = '1'; // 버튼이 동일한 너비를 갖도록 설정
      tabButton.addEventListener('click', (e) => this.switchTab(e.target.dataset.category));
      tabContainer.appendChild(tabButton);
    });
    menuContainer.appendChild(tabContainer);
    
    // 업그레이드 항목 컨테이너
    const upgradeItemsContainer = document.createElement('div');
    upgradeItemsContainer.id = 'upgradeItems';
    upgradeItemsContainer.className = 'upgrade-items';
    menuContainer.appendChild(upgradeItemsContainer);
    
    // 닫기 버튼
    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.textContent = '닫기';
    closeButton.addEventListener('click', () => this.hideUpgradeMenu());
    menuContainer.appendChild(closeButton);
    
    // 메뉴를 body에 추가
    document.body.appendChild(menuContainer);
    
    // 초기 탭 표시
    this.switchTab('launcher');
    
    // 메뉴 상태 업데이트
    this.isMenuOpen = true;
  }
  
  /**
   * 업그레이드 메뉴를 숨깁니다.
   */
  hideUpgradeMenu() {
    try {
      const menu = document.getElementById('upgradeMenu');
      if (menu) {
        menu.classList.add('fade-out');
        
        // 페이드 아웃 애니메이션 후 제거
        setTimeout(() => {
          if (menu.parentNode) {
            menu.remove();
          }
          // 게임 재개
          this.resumeGame();
        }, 300);
      } else {
        // 메뉴가 없으면 바로 게임 재개
        this.resumeGame();
      }
      
      this.isMenuOpen = false;
    } catch (error) {
      console.error('업그레이드 메뉴 닫기 오류:', error);
      // 오류 발생 시 강제로 게임 재개
      this.resumeGame();
      this.isMenuOpen = false;
    }
  }
  
  /**
   * 지정된 카테고리의 탭으로 전환합니다.
   * @param {string} category - 표시할 카테고리 (launcher, factory, city)
   */
  switchTab(category) {
    // 활성 탭 버튼 갱신
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    // 업그레이드 항목 생성
    const upgradeItems = document.getElementById('upgradeItems');
    upgradeItems.innerHTML = '';
    
    // 선택된 카테고리의 업그레이드 항목 표시
    const categoryUpgrades = this.upgrades[category];
    
    Object.entries(categoryUpgrades).forEach(([type, data]) => {
      const item = document.createElement('div');
      item.className = 'upgrade-item';
      
      // 업그레이드 정보
      const info = document.createElement('div');
      info.className = 'upgrade-info';
      
      // 제목 및 설명
      const itemTitle = document.createElement('h3');
      itemTitle.textContent = data.title;
      info.appendChild(itemTitle);
      
      const itemDesc = document.createElement('p');
      itemDesc.className = 'description';
      itemDesc.textContent = data.description;
      info.appendChild(itemDesc);
      
      // 레벨 표시 (10단계에 맞게 수정)
      const levelContainer = document.createElement('div');
      levelContainer.className = 'level-container';
      
      const levelLabel = document.createElement('span');
      levelLabel.textContent = `레벨: ${data.level}/${data.maxLevel} `;
      levelContainer.appendChild(levelLabel);
      
      // 10단계일 경우 너무 많은 점이 생기므로 진행 바로 표시
      const progressBar = document.createElement('div');
      progressBar.className = 'level-progress-bar';
      
      const progress = document.createElement('div');
      progress.className = 'level-progress';
      progress.style.width = `${(data.level / data.maxLevel) * 100}%`;
      
      progressBar.appendChild(progress);
      levelContainer.appendChild(progressBar);
      
      info.appendChild(levelContainer);
      item.appendChild(info);
      
      // 효과 및 비용 정보
      const effectCost = document.createElement('div');
      effectCost.className = 'effect-cost';
      
      // 효과 - 현재 레벨 효과와 다음 레벨 효과 표시
      let effectText = '';
      // 다음 레벨 또는 현재 레벨의 효과 가져오기
      const nextLevelIndex = data.level < data.maxLevel ? data.level : data.maxLevel - 1;
      const nextEffect = data.effect[nextLevelIndex];
      
      // 현재까지 누적된 총 효과 계산
      let totalEffect = 0;
      for (let i = 0; i < data.level; i++) {
        totalEffect += data.effect[i];
      }
      
      // 항목별 효과 표시 형식 설정
      if (type === 'range') {
        effectText = `총 +${totalEffect} (다음 레벨: +${nextEffect})`;
      } else if (type === 'capacity') {
        effectText = `총 +${totalEffect} (다음 레벨: +${nextEffect})`;
      } else if (type === 'reloadSpeed') {
        effectText = `총 ${(totalEffect * 100).toFixed(0)}% 증가 (다음 레벨: +${(nextEffect * 100).toFixed(0)}%)`;
      } else if (type === 'productionRate') {
        effectText = `총 ${(totalEffect * 100).toFixed(0)}% 증가 (다음 레벨: +${(nextEffect * 100).toFixed(0)}%)`;
      } else if (type === 'deliveryCost') {
        effectText = `총 -$${totalEffect.toFixed(1)} (다음 레벨: -$${nextEffect})`;
      } else if (type === 'buildingHealth') {
        effectText = `총 ${(totalEffect * 100).toFixed(0)}% 증가 (다음 레벨: +${(nextEffect * 100).toFixed(0)}%)`;
      } else if (type === 'repairRate') {
        effectText = `총 ${(totalEffect * 100).toFixed(0)}% 증가 (다음 레벨: +${(nextEffect * 100).toFixed(0)}%)`;
      } else if (type === 'income') {
        effectText = `총 +$${totalEffect} (다음 레벨: +$${nextEffect})`;
      }
      
      const effect = document.createElement('div');
      effect.className = 'effect';
      effect.textContent = `효과: ${effectText}`;
      effectCost.appendChild(effect);
      
      // 비용
      const costValue = data.level < data.maxLevel ? data.cost[data.level] : '최대';
      const cost = document.createElement('div');
      cost.className = 'cost';
      cost.textContent = `비용: ${costValue === '최대' ? '최대' : '$' + costValue}`;
      effectCost.appendChild(cost);
      
      item.appendChild(effectCost);
      
      // 업그레이드 버튼
      const upgradeButton = document.createElement('button');
      upgradeButton.className = 'upgrade-button';
      upgradeButton.textContent = data.level < data.maxLevel ? '업그레이드' : '최대 레벨';
      upgradeButton.disabled = data.level >= data.maxLevel || money < costValue;
      
      // 버튼 비활성화 스타일
      if (upgradeButton.disabled) {
        upgradeButton.classList.add('disabled');
      }
      
      upgradeButton.addEventListener('click', () => this.onUpgradeButtonClick(category, type));
      item.appendChild(upgradeButton);
      
      upgradeItems.appendChild(item);
    });
  }
  
  /**
   * 업그레이드 버튼 클릭 처리
   * @param {string} category - 업그레이드 카테고리
   * @param {string} type - 업그레이드 유형
   */
  onUpgradeButtonClick(category, type) {
    const result = this.applyUpgrade(category, type, money);
    
    if (result && result.success) {
      // 자금 차감
      money -= result.cost;
      document.getElementById('money').textContent = money;
      
      // 자금 지출 기록
      if (playerHistory) {
        playerHistory.recordMoneySpent(result.cost);
      }
      
      // 시각적 효과 및 알림
      const currentLevel = this.upgrades[category][type].level;
      const maxLevel = this.upgrades[category][type].maxLevel;
      const levelText = currentLevel < maxLevel ? `레벨 ${currentLevel}/${maxLevel}` : `최대 레벨`;
      showMessage(`${this.upgrades[category][type].title} 업그레이드 성공! (${levelText})`, 2000);
      
      // 메뉴 갱신
      this.switchTab(category);
    } else {
      // 업그레이드 실패 메시지
      if (this.upgrades[category][type].level >= this.upgrades[category][type].maxLevel) {
        showMessage('이미 최대 레벨입니다!', 2000);
      } else {
        showMessage('자금이 부족합니다!', 2000);
      }
    }
  }
  
  /**
   * 게임 일시정지
   */
  pauseGame() {
    // 기존 게임 상태 저장
    this.previousGameState = isGameActive;
    isGameActive = false;
    
    // 오버레이 생성
    const overlay = document.createElement('div');
    overlay.id = 'pauseOverlay';
    overlay.className = 'pause-overlay';
    document.body.appendChild(overlay);
  }
  
  /**
   * 게임 재개
   */
  resumeGame() {
    // 게임 상태 복원
    isGameActive = this.previousGameState;
    
    // 오버레이 제거
    const overlay = document.getElementById('pauseOverlay');
    if (overlay) {
      overlay.remove();
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
        
        // 방어 미사일 발사 기록
        if (playerHistory) {
            playerHistory.recordMissileFired('defense');
        }
        
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
        
        // 적 미사일 발사 기록
        if (playerHistory) {
            playerHistory.recordMissileFired('enemy');
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
        
        // 자동으로 웨이브 시작 (웨이브 시작 버튼 제거로 인한 기능 통합)
        if (cooldownTimer <= 0) {
            // 웨이브 종료 데이터 기록
            if (playerHistory) {
                playerHistory.endWaveTracking();
            }
            
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
            
            // 자금 획득 기록
            if (playerHistory) {
                playerHistory.recordMoneyEarned(100 + waveBonus);
                playerHistory.startWaveTracking(); // 새 웨이브 추적 시작
            }
            
            // Reset wave tracking variables
            waveStartInterceptedCount = interceptedCount;
            waveStartGroundHitsCount = groundHitsCount;
            
            // 웨이브 시작 알림 메시지
            showMessage(`웨이브 ${currentStage} 시작! +$${100 + waveBonus} 보너스`, 2000);
        }
    } else {
        gameTimer -= delta;
        document.getElementById('timeDisplay').textContent = `${Math.ceil(gameTimer)}초`;

        if (gameTimer <= 0) {
            isCooldown = true;
            cooldownTimer = 5;
            document.getElementById('cooldown').style.display = 'block';
            
            // 웨이브 종료 메시지
            showMessage(`웨이브 ${currentStage} 종료! 5초 후 다음 웨이브 시작`, 2000);
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
        
        // 게임 오버 체크 - 도시 건물이 모두 파괴된 경우
        if (cityHealthPercentage <= 0.1 && isGameActive) {
            // 게임 종료 처리
            isGameActive = false;
            
            // 결과 화면 표시
            if (playerHistory) {
                playerHistory.showGameResultsScreen();
            }
            
            console.log("게임 오버: 도시가 파괴되었습니다.");
        }
        
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
        
        // 업그레이드 시스템 초기화
        upgradeSystem = new UpgradeSystem();
        window.upgradeSystem = upgradeSystem; // 전역에서 접근 가능하도록 설정
        
        // 플레이어 이력 시각화 초기화
        playerHistory = new PlayerHistoryVisualizer();
        playerHistory.initialize();
        
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
    const isMenuVisible = menu.style.display === 'block';
    
    // 메뉴 표시/숨김 처리
    menu.style.display = isMenuVisible ? 'none' : 'block';
    
    // 메뉴가 표시될 때 방공영역 설정 이벤트 리스너 초기화
    if (!isMenuVisible) {
        initializeRangeVisualizerSettings();
    }
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
    
    // Upgrade button
    const upgradeButton = document.createElement('div');
    upgradeButton.className = 'purchase-button upgrade-card';
    upgradeButton.innerHTML = `
        <div>⬆️</div>
        <div>업그레이드</div>
        <div>메뉴</div>
    `;
    upgradeButton.addEventListener('click', () => {
        if (upgradeSystem) {
            upgradeSystem.showUpgradeMenu();
        }
    });
    container.appendChild(upgradeButton);

    // 웨이브 시작 버튼 제거됨
}

/**
 * 방공영역 시각화 설정을 초기화합니다.
 */
function initializeRangeVisualizerSettings() {
    try {
        // 방공영역 표시 버튼 이벤트 처리
        const rangeButtons = document.querySelectorAll('#rangeVisualizationButtons .setting-button');
        rangeButtons.forEach(button => {
            // 기존 이벤트 리스너 제거 (중복 방지)
            button.removeEventListener('click', handleRangeButtonClick);
            
            // 새 이벤트 리스너 추가
            button.addEventListener('click', handleRangeButtonClick);
        });
        
        // 중첩 영역 표시 버튼 이벤트 처리
        const overlapButtons = document.querySelectorAll('#overlapVisualizationButtons .setting-button');
        overlapButtons.forEach(button => {
            // 기존 이벤트 리스너 제거 (중복 방지)
            button.removeEventListener('click', handleOverlapButtonClick);
            
            // 새 이벤트 리스너 추가
            button.addEventListener('click', handleOverlapButtonClick);
        });
        
        console.log('방공영역 설정 초기화 완료:', rangeButtons.length, '개의 범위 버튼,', overlapButtons.length, '개의 중첩 버튼');
    } catch (error) {
        console.error('방공영역 설정 초기화 중 오류 발생:', error);
    }
}

// 방공영역 표시 버튼 클릭 핸들러
function handleRangeButtonClick(event) {
    try {
        const button = event.currentTarget;
        const value = button.getAttribute('data-value');
        const showRanges = value === 'ON';
        
        // UI 업데이트
        document.querySelectorAll('#rangeVisualizationButtons .setting-button').forEach(btn => {
            btn.classList.remove('selected');
        });
        button.classList.add('selected');
        
        // 시각화 설정 업데이트
        if (rangeVisualizer) {
            const overlapButton = document.querySelector('#overlapVisualizationButtons .selected');
            const showOverlaps = overlapButton ? overlapButton.getAttribute('data-value') === 'ON' : true;
            rangeVisualizer.updateSettings(showRanges, showOverlaps);
            console.log('방공영역 표시 설정 변경:', showRanges);
        }
    } catch (error) {
        console.error('방공영역 표시 버튼 처리 중 오류 발생:', error);
    }
}

// 중첩 영역 표시 버튼 클릭 핸들러
function handleOverlapButtonClick(event) {
    try {
        const button = event.currentTarget;
        const value = button.getAttribute('data-value');
        const showOverlaps = value === 'ON';
        
        // UI 업데이트
        document.querySelectorAll('#overlapVisualizationButtons .setting-button').forEach(btn => {
            btn.classList.remove('selected');
        });
        button.classList.add('selected');
        
        // 시각화 설정 업데이트
        if (rangeVisualizer) {
            const rangeButton = document.querySelector('#rangeVisualizationButtons .selected');
            const showRanges = rangeButton ? rangeButton.getAttribute('data-value') === 'ON' : true;
            rangeVisualizer.updateSettings(showRanges, showOverlaps);
            console.log('중첩 영역 표시 설정 변경:', showOverlaps);
        }
    } catch (error) {
        console.error('중첩 영역 표시 버튼 처리 중 오류 발생:', error);
    }
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

// 페이지 로드 시 설정 메뉴 초기화
document.addEventListener('DOMContentLoaded', () => {
    initializeRangeVisualizerSettings();
});

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
    
    // 지출 기록
    if (playerHistory) {
        playerHistory.recordMoneySpent(cost);
        playerHistory.recordLauncherPlaced();
    }
    
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
    
    // 지출 기록
    if (playerHistory) {
        playerHistory.recordMoneySpent(cost);
        playerHistory.recordFactoryPlaced();
    }
    
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

/**
 * 플레이어 이력 시각화 클래스
 * 게임 진행 데이터를 기록하고 시각화하는 기능을 담당합니다.
 */
class PlayerHistoryVisualizer {
  constructor() {
    // 게임 데이터 저장 객체
    this.gameData = {
      waves: [],                 // 웨이브별 데이터
      totalIntercepted: 0,       // 총 요격 수
      totalGroundHits: 0,        // 총 미사일 피해 수
      buildingsLost: 0,          // 파괴된 건물 수
      initialBuildingsCount: 0,  // 초기 건물 수
      moneyEarned: 0,            // 총 획득 자금
      moneySpent: 0,             // 총 지출 자금
      launchers: 0,              // 배치한 발사대 수
      factories: 0,              // 배치한 공장 수
      upgrades: {                // 업그레이드 내역
        launcher: {},
        factory: {},
        city: {}
      },
      startTime: 0,              // 게임 시작 시간
      endTime: 0,                // 게임 종료 시간
      difficulty: '',            // 난이도
    };
    
    // 현재 웨이브 데이터
    this.currentWaveData = null;
    
    // 이전 저장된 게임 데이터
    this.previousGameData = null;
    
    console.log('플레이어 이력 시각화 클래스 초기화됨');
  }
  
  /**
   * 게임 시작 시 초기화
   */
  initialize() {
    this.gameData.startTime = Date.now();
    this.gameData.difficulty = DIFFICULTY;
    this.gameData.initialBuildingsCount = initialBuildingCount || 0;
    this.startWaveTracking();
    
    // 이전 게임 데이터 로드
    this.loadPreviousGameData();
    
    console.log('게임 데이터 추적 시작');
  }
  
  /**
   * 새 웨이브 시작 시 웨이브 데이터 추적 시작
   */
  startWaveTracking() {
    this.currentWaveData = {
      waveNumber: currentStage,
      startTime: Date.now(),
      endTime: null,
      intercepted: 0,
      groundHits: 0,
      missilesFired: 0,
      moneyAtStart: money,
      moneyAtEnd: 0,
      buildingsLostDuringWave: 0,
      buildingsHealthAtStart: this.getCurrentCityHealth(),
      buildingsHealthAtEnd: 0
    };
  }
  
  /**
   * 웨이브 종료 시 웨이브 데이터 저장
   */
  endWaveTracking() {
    if (!this.currentWaveData) return;
    
    // 현재 웨이브 데이터 완성
    this.currentWaveData.endTime = Date.now();
    this.currentWaveData.intercepted = interceptedCount - this.gameData.totalIntercepted;
    this.currentWaveData.groundHits = groundHitsCount - this.gameData.totalGroundHits;
    this.currentWaveData.moneyAtEnd = money;
    this.currentWaveData.buildingsHealthAtEnd = this.getCurrentCityHealth();
    
    // 전체 게임 데이터에 웨이브 데이터 추가
    this.gameData.waves.push(this.currentWaveData);
    
    // 전체 통계 업데이트
    this.gameData.totalIntercepted = interceptedCount;
    this.gameData.totalGroundHits = groundHitsCount;
    
    console.log(`웨이브 ${currentStage} 데이터 기록: 요격 ${this.currentWaveData.intercepted}, 피해 ${this.currentWaveData.groundHits}`);
  }
  
  /**
   * 현재 도시 건물 체력 백분율 계산
   * @returns {number} 도시 건물 체력 백분율 (0-100)
   */
  getCurrentCityHealth() {
    if (!initialTotalHeight) return 100;
    const remainingHeight = Math.max(0, initialTotalHeight - destroyedTotalHeight);
    return (remainingHeight / initialTotalHeight) * 100;
  }
  
  /**
   * 미사일 발사 시 기록
   * @param {string} type - 미사일 타입 ('defense' 또는 'enemy')
   */
  recordMissileFired(type) {
    if (type === 'defense' && this.currentWaveData) {
      this.currentWaveData.missilesFired++;
    }
  }
  
  /**
   * 자금 획득 기록
   * @param {number} amount - 획득한 자금
   */
  recordMoneyEarned(amount) {
    this.gameData.moneyEarned += amount;
  }
  
  /**
   * 자금 지출 기록
   * @param {number} amount - 지출한 자금
   */
  recordMoneySpent(amount) {
    this.gameData.moneySpent += amount;
  }
  
  /**
   * 건물 파괴 기록
   * @param {string} buildingType - 건물 유형
   */
  recordBuildingDestroyed(buildingType) {
    this.gameData.buildingsLost++;
    if (this.currentWaveData) {
      this.currentWaveData.buildingsLostDuringWave++;
    }
  }
  
  /**
   * 발사대 배치 기록
   */
  recordLauncherPlaced() {
    this.gameData.launchers++;
  }
  
  /**
   * 공장 배치 기록
   */
  recordFactoryPlaced() {
    this.gameData.factories++;
  }
  
  /**
   * 업그레이드 기록
   * @param {string} category - 업그레이드 카테고리 (launcher, factory, city)
   * @param {string} type - 업그레이드 유형
   * @param {number} level - 업그레이드 레벨
   */
  recordUpgrade(category, type, level) {
    if (!this.gameData.upgrades[category]) {
      this.gameData.upgrades[category] = {};
    }
    
    this.gameData.upgrades[category][type] = level;
  }
  
  /**
   * 게임 종료 시 최종 데이터 기록
   */
  finalizeGameData() {
    // 마지막 웨이브 데이터 저장
    this.endWaveTracking();
    
    // 게임 종료 시간 기록
    this.gameData.endTime = Date.now();
    
    // 게임 총 점수 계산
    const finalScore = this.calculateFinalScore();
    this.gameData.finalScore = finalScore;
    
    // 이전 게임 데이터 저장
    this.saveCurrentGameData();
    
    console.log('게임 데이터 기록 완료:', this.gameData);
    return finalScore;
  }
  
  /**
   * 최종 점수 계산
   * @returns {number} 최종 점수
   */
  calculateFinalScore() {
    const cityHealthPercent = this.getCurrentCityHealth();
    const interceptRatio = this.gameData.totalIntercepted / (this.gameData.totalIntercepted + this.gameData.totalGroundHits || 1);
    const upgradeFactor = this.calculateUpgradeFactor();
    
    // 점수 계산 공식: 웨이브 수 * (도시 건물 체력 % + 요격율 * 100) * 난이도 계수 * 업그레이드 계수
    const difficultyFactor = DIFFICULTY === 'EASY' ? 0.8 : DIFFICULTY === 'NORMAL' ? 1 : 1.5;
    
    let score = currentStage * (cityHealthPercent + interceptRatio * 100) * difficultyFactor * upgradeFactor;
    
    // 최소값 보장
    score = Math.max(100, Math.round(score));
    
    return score;
  }
  
  /**
   * 업그레이드 계수 계산
   * @returns {number} 업그레이드 계수 (1.0-1.5)
   */
  calculateUpgradeFactor() {
    let totalUpgradeCount = 0;
    
    // 모든 카테고리의 업그레이드 수 합산
    Object.keys(this.gameData.upgrades).forEach(category => {
      Object.values(this.gameData.upgrades[category]).forEach(level => {
        totalUpgradeCount += level || 0;
      });
    });
    
    // 업그레이드에 따른 보너스 계수 (1.0-1.5 사이)
    return 1 + Math.min(0.5, totalUpgradeCount * 0.05);
  }
  
  /**
   * 이전 게임 데이터를 localStorage에서 로드
   */
  loadPreviousGameData() {
    try {
      const savedData = localStorage.getItem('missileDefensePreviousGameData');
      if (savedData) {
        this.previousGameData = JSON.parse(savedData);
        console.log('이전 게임 데이터 로드됨');
      }
    } catch (error) {
      console.error('이전 게임 데이터 로드 실패:', error);
    }
  }
  
  /**
   * 현재 게임 데이터를 localStorage에 저장
   */
  saveCurrentGameData() {
    try {
      localStorage.setItem('missileDefensePreviousGameData', JSON.stringify(this.gameData));
      console.log('현재 게임 데이터 저장됨');
    } catch (error) {
      console.error('게임 데이터 저장 실패:', error);
    }
  }
  
  /**
   * 업적 계산 및 생성
   * @returns {Array} 업적 목록
   */
  generateAchievements() {
    const achievements = [];
    const { totalIntercepted, totalGroundHits, buildingsLost, launchers, factories, waves } = this.gameData;
    
    // 요격 전문가
    if (totalIntercepted > 0) {
      const interceptRatio = totalIntercepted / (totalIntercepted + totalGroundHits || 1);
      let title, description;
      
      if (interceptRatio >= 0.9) {
        title = "철벽 방어의 달인";
        description = "90% 이상의 적 미사일을 요격하여 최고의 방어 능력을 보여주었습니다!";
      } else if (interceptRatio >= 0.7) {
        title = "우수 방공 지휘관";
        description = "70% 이상의 적 미사일을 요격하여 훌륭한 방어 능력을 보여주었습니다.";
      } else if (interceptRatio >= 0.5) {
        title = "유능한 방어자";
        description = "50% 이상의 적 미사일을 요격하여 적절한 방어 능력을 보여주었습니다.";
      }
      
      if (title) {
        achievements.push({
          title,
          description,
          highlight: `요격율: ${(interceptRatio * 100).toFixed(1)}%`
        });
      }
    }
    
    // 도시 보호자
    const cityHealth = this.getCurrentCityHealth();
    if (cityHealth >= 90) {
      achievements.push({
        title: "불굴의 도시 수호자",
        description: "도시 건물을 90% 이상 보존하여 시민들의 안전을 지켜냈습니다!",
        highlight: `도시 상태: ${cityHealth.toFixed(1)}%`
      });
    } else if (cityHealth >= 70) {
      achievements.push({
        title: "헌신적인 방위자",
        description: "도시 건물을 70% 이상 보존하여 피해를 최소화했습니다.",
        highlight: `도시 상태: ${cityHealth.toFixed(1)}%`
      });
    }
    
    // 웨이브 생존
    if (waves.length >= 10) {
      achievements.push({
        title: "생존의 달인",
        description: "10웨이브 이상 생존하여 뛰어난 지구력을 보여주었습니다!",
        highlight: `생존 웨이브: ${waves.length}`
      });
    } else if (waves.length >= 5) {
      achievements.push({
        title: "경험많은 지휘관",
        description: "5웨이브 이상 생존하여 침착한 지휘 능력을 보여주었습니다.",
        highlight: `생존 웨이브: ${waves.length}`
      });
    }
    
    // 전략가
    if (launchers >= 5 && factories >= 2) {
      achievements.push({
        title: "전략적 지휘관",
        description: "다수의 방어 시스템을 효율적으로 배치하여 뛰어난 전략적 안목을 보여주었습니다.",
        highlight: `발사대: ${launchers}개, 공장: ${factories}개`
      });
    }
    
    // 경제 전문가
    const economyRatio = this.gameData.moneyEarned / (this.gameData.moneySpent || 1);
    if (economyRatio > 1.5) {
      achievements.push({
        title: "자원 관리의 달인",
        description: "뛰어난 경제 관리로 높은 자원 효율성을 달성했습니다!",
        highlight: `자원 효율성: ${(economyRatio * 100).toFixed(0)}%`
      });
    }
    
    // 난이도 관련
    if (DIFFICULTY === 'HARD' && waves.length >= 3) {
      achievements.push({
        title: "무모한 용기",
        description: "어려운 난이도에서 3웨이브 이상 생존하여 뛰어난 기량을 보여주었습니다!",
        highlight: `난이도: 어려움`
      });
    }
    
    return achievements;
  }
  
  /**
   * 웨이브 상세 정보 생성
   * @param {number} waveNumber - 웨이브 번호
   * @returns {Object} 웨이브 상세 정보
   */
  getWaveDetails(waveNumber) {
    const waveData = this.gameData.waves.find(wave => wave.waveNumber === waveNumber);
    if (!waveData) return null;
    
    const duration = (waveData.endTime - waveData.startTime) / 1000; // 초 단위
    const interceptRate = waveData.intercepted / (waveData.intercepted + waveData.groundHits || 1) * 100;
    const moneyEarned = waveData.moneyAtEnd - waveData.moneyAtStart;
    const buildingHealthChange = waveData.buildingsHealthAtEnd - waveData.buildingsHealthAtStart;
    
    return {
      waveNumber: waveData.waveNumber,
      duration: duration.toFixed(1),
      intercepted: waveData.intercepted,
      groundHits: waveData.groundHits,
      interceptRate: interceptRate.toFixed(1),
      missilesFired: waveData.missilesFired,
      moneyEarned,
      buildingsLost: waveData.buildingsLostDuringWave,
      buildingHealthChange: buildingHealthChange.toFixed(1)
    };
  }
  
  /**
   * 게임 결과 화면 표시
   */
  showGameResultsScreen() {
    // 최종 점수 계산
    const finalScore = this.finalizeGameData();
    
    // 결과 화면의 기본 통계 업데이트
    document.getElementById('finalIntercepted').textContent = this.gameData.totalIntercepted;
    document.getElementById('finalGroundHits').textContent = this.gameData.totalGroundHits;
    document.getElementById('finalCityHealth').textContent = `${this.getCurrentCityHealth().toFixed(1)}%`;
    document.getElementById('finalScore').textContent = finalScore.toLocaleString();
    
    // 그래프 데이터 생성 및 그래프 렌더링
    this.renderCharts();
    
    // 업적 표시
    this.renderAchievements();
    
    // 웨이브 선택기 초기화
    this.initializeWaveSelector();
    
    // 이전 게임과 비교 데이터 표시
    this.renderComparisonData();
    
    // 탭 전환 이벤트 리스너 등록
    this.setupTabEventListeners();
    
    // 결과 화면 표시
    document.getElementById('endGameScreen').classList.add('visible');
  }
  
  /**
   * 탭 전환 이벤트 리스너 설정
   */
  setupTabEventListeners() {
    const tabButtons = document.querySelectorAll('.player-history-tab');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
        
        // 모든 탭 내용 숨기기
        document.querySelectorAll('.player-history-panel').forEach(panel => {
          panel.classList.remove('active');
        });
        
        // 모든 탭 버튼 비활성화
        tabButtons.forEach(btn => {
          btn.classList.remove('active');
        });
        
        // 선택한 탭 내용 및 버튼 활성화
        document.getElementById(targetTab).classList.add('active');
        button.classList.add('active');
      });
    });
  }
  
  /**
   * 차트 렌더링
   */
  renderCharts() {
    // 1. 요격 성공률 차트
    this.renderInterceptRateChart();
    
    // 2. 도시 건물 손실률 차트
    this.renderBuildingLossChart();
    
    // 3. 자원 관리 효율성 차트
    this.renderResourceEfficiencyChart();
  }
  
  /**
   * 요격 성공률 차트 렌더링
   */
  renderInterceptRateChart() {
    const ctx = document.getElementById('interceptRateChart').getContext('2d');
    
    // 웨이브별 요격률 데이터 준비
    const waveLabels = this.gameData.waves.map(wave => `웨이브 ${wave.waveNumber}`);
    const interceptRates = this.gameData.waves.map(wave => {
      const total = wave.intercepted + wave.groundHits;
      return total > 0 ? (wave.intercepted / total * 100) : 0;
    });
    
    // 차트 생성
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: waveLabels,
        datasets: [{
          label: '요격 성공률 (%)',
          data: interceptRates,
          borderColor: '#00ffd5',
          backgroundColor: 'rgba(0, 255, 213, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#aaa'
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#aaa'
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#fff'
            }
          }
        }
      }
    });
  }
  
  /**
   * 도시 건물 손실률 차트 렌더링
   */
  renderBuildingLossChart() {
    const ctx = document.getElementById('buildingLossChart').getContext('2d');
    
    // 웨이브별 도시 건물 상태 데이터 준비
    const waveLabels = this.gameData.waves.map(wave => `웨이브 ${wave.waveNumber}`);
    const buildingHealthData = this.gameData.waves.map(wave => wave.buildingsHealthAtEnd);
    
    // 차트 생성
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: waveLabels,
        datasets: [{
          label: '도시 건물 상태 (%)',
          data: buildingHealthData,
          backgroundColor: '#00ff00',
          borderColor: '#008800',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#aaa'
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#aaa'
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#fff'
            }
          }
        }
      }
    });
  }
  
  /**
   * 자원 관리 효율성 차트 렌더링
   */
  renderResourceEfficiencyChart() {
    const ctx = document.getElementById('resourceEfficiencyChart').getContext('2d');
    
    // 웨이브별 자금 변화 계산
    const waveLabels = this.gameData.waves.map(wave => `웨이브 ${wave.waveNumber}`);
    const moneyData = this.gameData.waves.map(wave => wave.moneyAtEnd - wave.moneyAtStart);
    
    // 차트 생성
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: waveLabels,
        datasets: [{
          label: '자금 변화',
          data: moneyData,
          backgroundColor: moneyData.map(val => val >= 0 ? '#ffaa00' : '#ff0000'),
          borderColor: moneyData.map(val => val >= 0 ? '#cc8800' : '#cc0000'),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#aaa'
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#aaa'
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#fff'
            }
          }
        }
      }
    });
  }
  
  /**
   * 업적 렌더링
   */
  renderAchievements() {
    const achievements = this.generateAchievements();
    const container = document.getElementById('achievementsList');
    
    // 이전 내용 제거
    container.innerHTML = '';
    
    if (achievements.length === 0) {
      container.innerHTML = '<div class="achievement-item"><div class="achievement-title">업적 없음</div><div class="achievement-description">다음 게임에서 도전해보세요!</div></div>';
      return;
    }
    
    // 업적 항목 생성
    achievements.forEach(achievement => {
      const achievementElem = document.createElement('div');
      achievementElem.className = 'achievement-item';
      
      const titleElem = document.createElement('div');
      titleElem.className = 'achievement-title';
      titleElem.textContent = achievement.title;
      
      const descElem = document.createElement('div');
      descElem.className = 'achievement-description';
      descElem.textContent = achievement.description;
      
      achievementElem.appendChild(titleElem);
      achievementElem.appendChild(descElem);
      
      if (achievement.highlight) {
        const highlightElem = document.createElement('div');
        highlightElem.className = 'achievement-highlight';
        highlightElem.textContent = achievement.highlight;
        achievementElem.appendChild(highlightElem);
      }
      
      container.appendChild(achievementElem);
    });
  }
  
  /**
   * 웨이브 선택기 초기화
   */
  initializeWaveSelector() {
    const selector = document.getElementById('waveSelect');
    selector.innerHTML = '';
    
    // 웨이브 옵션 추가
    this.gameData.waves.forEach(wave => {
      const option = document.createElement('option');
      option.value = wave.waveNumber;
      option.textContent = `웨이브 ${wave.waveNumber}`;
      selector.appendChild(option);
    });
    
    // 첫번째 웨이브 상세 정보 표시
    if (this.gameData.waves.length > 0) {
      this.showWaveDetails(this.gameData.waves[0].waveNumber);
    }
    
    // 선택 이벤트 추가
    selector.addEventListener('change', (e) => {
      this.showWaveDetails(parseInt(e.target.value));
    });
  }
  
  /**
   * 웨이브 상세 정보 표시
   * @param {number} waveNumber - 웨이브 번호
   */
  showWaveDetails(waveNumber) {
    const waveDetails = this.getWaveDetails(waveNumber);
    const container = document.getElementById('waveDetailsContent');
    
    if (!waveDetails) {
      container.innerHTML = '<div>선택한 웨이브의 데이터가 없습니다.</div>';
      return;
    }
    
    // 웨이브 상세 정보 표시
    container.innerHTML = `
      <div class="wave-stat">
        <span class="wave-stat-label">웨이브 지속시간:</span>
        <span>${waveDetails.duration}초</span>
      </div>
      <div class="wave-stat">
        <span class="wave-stat-label">요격된 적 미사일:</span>
        <span>${waveDetails.intercepted}개</span>
      </div>
      <div class="wave-stat">
        <span class="wave-stat-label">지상 타격 미사일:</span>
        <span>${waveDetails.groundHits}개</span>
      </div>
      <div class="wave-stat">
        <span class="wave-stat-label">요격 성공률:</span>
        <span>${waveDetails.interceptRate}%</span>
      </div>
      <div class="wave-stat">
        <span class="wave-stat-label">발사한 방어 미사일:</span>
        <span>${waveDetails.missilesFired}개</span>
      </div>
      <div class="wave-stat">
        <span class="wave-stat-label">자금 변화:</span>
        <span class="${waveDetails.moneyEarned >= 0 ? 'improvement' : 'decline'}">$${waveDetails.moneyEarned}</span>
      </div>
      <div class="wave-stat">
        <span class="wave-stat-label">파괴된 건물:</span>
        <span>${waveDetails.buildingsLost}개</span>
      </div>
      <div class="wave-stat">
        <span class="wave-stat-label">도시 상태 변화:</span>
        <span class="${waveDetails.buildingHealthChange >= 0 ? 'improvement' : 'decline'}">${waveDetails.buildingHealthChange}%</span>
      </div>
    `;
  }
  
  /**
   * 이전 게임과 비교 데이터 렌더링
   */
  renderComparisonData() {
    const container = document.getElementById('comparisonDetails');
    
    if (!this.previousGameData) {
      container.innerHTML = '<div class="comparison-item"><div class="comparison-title">이전 게임 데이터 없음</div><div class="achievement-description">첫 번째 게임을 완료했습니다. 다음 게임과 비교 데이터를 볼 수 있습니다.</div></div>';
      return;
    }
    
    // 비교 차트 렌더링
    this.renderComparisonChart();
    
    // 비교 항목 준비
    const comparisons = [
      {
        title: '웨이브 생존',
        previous: this.previousGameData.waves.length,
        current: this.gameData.waves.length,
        unit: '웨이브'
      },
      {
        title: '요격 성공률',
        previous: this.calculateInterceptRate(this.previousGameData),
        current: this.calculateInterceptRate(this.gameData),
        unit: '%'
      },
      {
        title: '도시 상태',
        previous: this.previousGameData.waves.length > 0 ? this.previousGameData.waves[this.previousGameData.waves.length - 1].buildingsHealthAtEnd : 100,
        current: this.getCurrentCityHealth(),
        unit: '%'
      },
      {
        title: '최종 점수',
        previous: this.previousGameData.finalScore || 0,
        current: this.gameData.finalScore,
        unit: '점'
      }
    ];
    
    // 비교 항목 렌더링
    container.innerHTML = '';
    comparisons.forEach(item => {
      const comparisonItem = document.createElement('div');
      comparisonItem.className = 'comparison-item';
      
      const titleElem = document.createElement('div');
      titleElem.className = 'comparison-title';
      titleElem.textContent = item.title;
      
      const dataElem = document.createElement('div');
      dataElem.className = 'comparison-data';
      
      const previousElem = document.createElement('div');
      previousElem.className = 'comparison-previous';
      previousElem.textContent = `이전: ${item.previous}${item.unit}`;
      
      const currentElem = document.createElement('div');
      currentElem.className = 'comparison-current';
      const diff = item.current - item.previous;
      let diffText = '';
      
      if (diff > 0) {
        diffText = ` (+${diff}${item.unit})`;
        currentElem.classList.add('improvement');
      } else if (diff < 0) {
        diffText = ` (${diff}${item.unit})`;
        currentElem.classList.add('decline');
      }
      
      currentElem.textContent = `현재: ${item.current}${item.unit}${diffText}`;
      
      dataElem.appendChild(previousElem);
      dataElem.appendChild(currentElem);
      
      comparisonItem.appendChild(titleElem);
      comparisonItem.appendChild(dataElem);
      
      container.appendChild(comparisonItem);
    });
  }
  
  /**
   * 요격 성공률 계산
   * @param {Object} gameData - 게임 데이터 객체
   * @returns {number} 요격 성공률 (백분율)
   */
  calculateInterceptRate(gameData) {
    const total = gameData.totalIntercepted + gameData.totalGroundHits;
    return total > 0 ? parseFloat(((gameData.totalIntercepted / total) * 100).toFixed(1)) : 0;
  }
  
  /**
   * 이전 게임과의 비교 차트 렌더링
   */
  renderComparisonChart() {
    if (!this.previousGameData) return;
    
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    
    const data = {
      labels: ['웨이브 수', '요격 수', '도시 상태 (%)', '점수'],
      datasets: [
        {
          label: '이전 게임',
          data: [
            this.previousGameData.waves.length,
            this.previousGameData.totalIntercepted,
            this.previousGameData.waves.length > 0 ? this.previousGameData.waves[this.previousGameData.waves.length - 1].buildingsHealthAtEnd : 100,
            this.previousGameData.finalScore || 0
          ],
          backgroundColor: 'rgba(128, 128, 255, 0.5)',
          borderColor: 'rgba(128, 128, 255, 1)',
          borderWidth: 1
        },
        {
          label: '현재 게임',
          data: [
            this.gameData.waves.length,
            this.gameData.totalIntercepted,
            this.getCurrentCityHealth(),
            this.gameData.finalScore
          ],
          backgroundColor: 'rgba(0, 255, 213, 0.5)',
          borderColor: 'rgba(0, 255, 213, 1)',
          borderWidth: 1
        }
      ]
    };
    
    new Chart(ctx, {
      type: 'radar',
      data: data,
      options: {
        scales: {
          r: {
            angleLines: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            pointLabels: {
              color: '#fff'
            },
            ticks: {
              color: '#aaa',
              backdropColor: 'transparent'
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#fff'
            }
          }
        },
        elements: {
          line: {
            tension: 0.2
          }
        }
      }
    });
  }
}

// 전역 PlayerHistoryVisualizer 인스턴스 생성
let playerHistory = new PlayerHistoryVisualizer();

// 재시작 버튼 이벤트 리스너
document.getElementById('restartButtonEndGame').addEventListener('click', () => {
    // 게임 종료 화면 숨기기
    document.getElementById('endGameScreen').classList.remove('visible');
    
    // 게임 상태 초기화
    isGameActive = false;
    currentStage = 1;
    gameTimer = 20;
    isCooldown = false;
    money = 250;
    interceptedCount = 0;
    groundHitsCount = 0;
    enemyMissiles = [];
    defenseMissiles = [];
    launchers = [];
    factories = [];
    destroyedTotalHeight = 0;
    destroyedBuildingCount = 0;
    activeEffects = [];
    window.destroyedHighBuildingCount = 0;
    window.destroyedMidBuildingCount = 0;
    window.destroyedLowBuildingCount = 0;
    
    // 게임 객체 정리
    while(scene.children.length > 0){ 
        const object = scene.children[0];
        scene.remove(object);
    }
    
    // 환경 요소 재생성
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x009900, 0x009900);
    scene.add(gridHelper);
    
    const groundHeight = 4;
    const groundGeometry = new THREE.BoxGeometry(gridSize, groundHeight, gridSize);
    const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.position.set(0, (-groundHeight / 2) - 0.05, 0);
    scene.add(ground);
    
    // 조명 재생성
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(50, 100, 50);
    scene.add(directionalLight);
    
    // 시작 버튼 표시
    document.getElementById('startButton').style.display = 'block';
    
    console.log('게임 재시작 준비 완료');
});