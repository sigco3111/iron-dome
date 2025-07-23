# 디자인 문서

## 개요

아이언돔(Iron Dome) 게임 고도화 프로젝트는 기존 게임에 방공영역 시각화, 업그레이드 시스템, 자동 저장 기능, 게임 오버 시 플레이어 이력 시각화, 게임 밸런스 조정, 일시 중지 및 도움말 기능을 추가하여 게임의 깊이와 사용자 경험을 향상시키는 것을 목표로 합니다. 이 디자인 문서는 각 기능의 구현 방법과 기술적 접근 방식을 상세히 설명합니다.

## 아키텍처

아이언돔 게임은 Three.js를 기반으로 한 3D 웹 게임으로, 기존 아키텍처를 확장하여 새로운 기능을 구현합니다. 전체 시스템은 다음과 같은 주요 모듈로 구성됩니다:

1. **렌더링 엔진**: Three.js를 사용한 3D 그래픽 렌더링
2. **게임 로직**: 게임 상태 관리 및 규칙 적용
3. **사용자 인터페이스**: 게임 내 메뉴, HUD, 상호작용 요소
4. **데이터 관리**: 게임 상태 저장 및 로드
5. **이벤트 시스템**: 사용자 입력 및 게임 이벤트 처리

새로운 기능을 위해 다음과 같은 모듈을 추가 또는 확장합니다:

1. **업그레이드 시스템**: 게임 내 요소 업그레이드 관리
2. **저장 시스템**: 로컬 스토리지를 활용한 게임 상태 저장
3. **시각화 모듈**: 방공영역 및 게임 결과 시각화
4. **밸런스 조정 시스템**: 난이도별 게임 매개변수 관리

## 컴포넌트 및 인터페이스

### 1. 방공영역 시각화 컴포넌트

```javascript
class DefenseRangeVisualizer {
  constructor() {
    this.activeRanges = new Map(); // 발사대 ID와 시각화 객체 매핑
    this.overlapMaterial = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.4
    });
  }

  // 발사대 범위 표시
  showRange(launcher) {
    // 구현 로직
  }

  // 범위 숨기기
  hideRange(launcherId) {
    // 구현 로직
  }

  // 중첩 영역 계산 및 표시
  calculateOverlaps() {
    // 구현 로직
  }

  // 모든 범위 업데이트
  updateAllRanges() {
    // 구현 로직
  }
}
```

**인터페이스**:
- `MissileLauncher` 클래스와 연동하여 발사대 선택 시 범위 표시
- 마우스 호버 이벤트와 연결하여 발사대에 마우스를 올렸을 때 범위 표시
- 게임 설정 UI와 연결하여 범위 표시 옵션 제공

### 2. 업그레이드 시스템 컴포넌트

```javascript
class UpgradeSystem {
  constructor() {
    this.upgrades = {
      launcher: {
        range: { level: 0, maxLevel: 3, cost: [100, 200, 300], effect: [2, 4, 6] },
        capacity: { level: 0, maxLevel: 3, cost: [150, 250, 350], effect: [2, 3, 4] },
        reloadSpeed: { level: 0, maxLevel: 3, cost: [120, 220, 320], effect: [0.1, 0.2, 0.3] }
      },
      factory: {
        productionRate: { level: 0, maxLevel: 3, cost: [100, 200, 300], effect: [0.1, 0.2, 0.3] },
        capacity: { level: 0, maxLevel: 3, cost: [150, 250, 350], effect: [4, 8, 12] },
        deliveryCost: { level: 0, maxLevel: 3, cost: [120, 220, 320], effect: [0.5, 1, 1.5] }
      },
      city: {
        buildingHealth: { level: 0, maxLevel: 3, cost: [200, 300, 400], effect: [0.1, 0.2, 0.3] },
        repairRate: { level: 0, maxLevel: 3, cost: [250, 350, 450], effect: [0.05, 0.1, 0.15] },
        income: { level: 0, maxLevel: 3, cost: [300, 400, 500], effect: [10, 20, 30] }
      }
    };
  }

  // 업그레이드 가능 여부 확인
  canUpgrade(category, type, money) {
    // 구현 로직
  }

  // 업그레이드 적용
  applyUpgrade(category, type, money) {
    // 구현 로직
  }

  // 현재 업그레이드 효과 계산
  calculateEffect(category, type) {
    // 구현 로직
  }

  // UI 업데이트
  updateUI() {
    // 구현 로직
  }
}
```

**인터페이스**:
- 게임 UI에 업그레이드 메뉴 버튼 추가
- 업그레이드 메뉴 모달 창 구현
- 각 업그레이드 항목별 현재 레벨, 비용, 효과 표시
- 업그레이드 구매 시 시각적 피드백 제공

### 3. 자동 저장 및 게임 초기화 컴포넌트

```javascript
class GameSaveSystem {
  constructor() {
    this.saveKey = 'ironDomeSaveData';
    this.autoSaveInterval = 60000; // 1분마다 자동 저장
    this.lastSaveTime = 0;
  }

  // 게임 상태 저장
  saveGame(gameState) {
    // 구현 로직
  }

  // 게임 상태 로드
  loadGame() {
    // 구현 로직
  }

  // 자동 저장 처리
  handleAutoSave(gameState) {
    // 구현 로직
  }

  // 게임 초기화
  resetGame() {
    // 구현 로직
  }

  // 저장 파일 목록 가져오기
  getSaveFiles() {
    // 구현 로직
  }
}
```

**인터페이스**:
- 게임 시작 화면에 '계속하기' 옵션 추가
- 설정 메뉴에 '게임 초기화' 옵션 추가
- 웨이브 완료 시 자동 저장 알림 표시
- 저장 파일 선택 UI 구현

### 4. 게임 오버 시 플레이어 이력 시각화 컴포넌트

```javascript
class PlayerHistoryVisualizer {
  constructor() {
    this.gameHistory = [];
    this.charts = {};
  }

  // 게임 진행 중 데이터 기록
  recordGameData(waveData) {
    // 구현 로직
  }

  // 결과 화면 생성
  createResultScreen() {
    // 구현 로직
  }

  // 그래프 생성
  createCharts() {
    // 구현 로직
  }

  // 업적 표시
  showAchievements() {
    // 구현 로직
  }

  // 이전 게임과 비교
  compareWithPreviousGames() {
    // 구현 로직
  }
}
```

**인터페이스**:
- 게임 오버 화면에 결과 요약 표시
- 웨이브별 성과를 보여주는 그래프 UI
- 주요 업적 하이라이트 섹션
- 웨이브 선택 및 상세 정보 표시 UI
- 이전 게임과의 비교 섹션

### 5. 게임 밸런스 조정 컴포넌트

```javascript
class GameBalanceManager {
  constructor() {
    this.difficultySettings = {
      EASY: {
        missileSpeed: 0.5,
        missileFrequency: 0.7,
        missileDurability: 0.8,
        rewardMultiplier: 0.8
      },
      NORMAL: {
        missileSpeed: 0.7,
        missileFrequency: 1.0,
        missileDurability: 1.0,
        rewardMultiplier: 1.0
      },
      HARD: {
        missileSpeed: 0.9,
        missileFrequency: 1.3,
        missileDurability: 1.2,
        rewardMultiplier: 1.3
      }
    };
    
    this.waveDifficultyProgression = [
      // 웨이브별 난이도 조정 계수
    ];
    
    this.failureAssistance = {
      consecutiveFailures: 0,
      maxAssistance: 0.3
    };
  }

  // 현재 난이도 설정 가져오기
  getCurrentSettings(difficulty, wave) {
    // 구현 로직
  }

  // 연속 실패 시 난이도 조정
  adjustForFailures() {
    // 구현 로직
  }

  // 정체 시 보너스 제공
  provideStagnationBonus(stagnationTime) {
    // 구현 로직
  }

  // 난이도 변경 적용
  applyDifficultyChange(newDifficulty) {
    // 구현 로직
  }
}
```

**인터페이스**:
- 게임 설정 메뉴에 난이도 선택 옵션
- 게임 내 난이도 표시기
- 연속 실패 시 힌트 또는 도움말 표시
- 정체 시 보너스 알림 UI

### 6. 추가 고도화 요소 컴포넌트

```javascript
class GameUtilityManager {
  constructor() {
    this.isPaused = false;
    this.helpTopics = {
      // 도움말 주제별 내용
    };
  }

  // 게임 일시 중지
  pauseGame() {
    // 구현 로직
  }

  // 게임 재개
  resumeGame() {
    // 구현 로직
  }

  // 도움말 표시
  showHelp(topic) {
    // 구현 로직
  }

  // 상황별 팁 제공
  provideSituationalTips(gameState) {
    // 구현 로직
  }
}
```

**인터페이스**:
- 게임 화면에 일시 중지 버튼 추가
- 일시 중지 화면 UI
- 도움말 메뉴 및 내용 표시 UI
- 상황별 팁 알림 UI

## 데이터 모델

### 1. 업그레이드 데이터 모델

```javascript
const upgradeData = {
  id: String,           // 업그레이드 고유 ID
  category: String,     // 카테고리 (launcher, factory, city)
  type: String,         // 업그레이드 유형 (range, capacity 등)
  level: Number,        // 현재 레벨
  maxLevel: Number,     // 최대 레벨
  costs: Array,         // 레벨별 비용
  effects: Array,       // 레벨별 효과
  description: String   // 설명
};
```

### 2. 게임 저장 데이터 모델

```javascript
const saveData = {
  timestamp: Number,    // 저장 시간
  wave: Number,         // 현재 웨이브
  money: Number,        // 보유 자금
  cityHealth: Number,   // 도시 체력
  launchers: Array,     // 발사대 정보
  factories: Array,     // 공장 정보
  buildings: Array,     // 건물 정보
  upgrades: Object,     // 업그레이드 상태
  statistics: Object,   // 게임 통계
  settings: Object      // 게임 설정
};
```

### 3. 플레이어 이력 데이터 모델

```javascript
const playerHistoryData = {
  gameId: String,       // 게임 세션 ID
  timestamp: Number,    // 게임 종료 시간
  totalWaves: Number,   // 총 웨이브 수
  finalMoney: Number,   // 최종 자금
  finalCityHealth: Number, // 최종 도시 체력
  waveData: Array,      // 웨이브별 데이터
  achievements: Array,  // 달성한 업적
  upgrades: Object      // 최종 업그레이드 상태
};

const waveData = {
  waveNumber: Number,   // 웨이브 번호
  intercepted: Number,  // 요격 성공 수
  missed: Number,       // 요격 실패 수
  moneyEarned: Number,  // 획득한 자금
  moneySpent: Number,   // 사용한 자금
  buildingsLost: Number, // 잃은 건물 수
  duration: Number      // 웨이브 지속 시간
};
```

## 오류 처리

### 1. 저장 시스템 오류 처리

```javascript
try {
  // 저장 로직
  localStorage.setItem(this.saveKey, JSON.stringify(saveData));
} catch (error) {
  // 오류 처리
  console.error('저장 실패:', error);
  
  if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
    // 저장 공간 부족 오류
    showErrorMessage('저장 공간이 부족합니다. 다른 게임 데이터를 삭제하거나 브라우저 캐시를 정리해 주세요.');
  } else {
    // 기타 오류
    showErrorMessage('게임 저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
  }
  
  return false;
}
```

### 2. 업그레이드 시스템 오류 처리

```javascript
function applyUpgrade(category, type, playerMoney) {
  const upgrade = this.upgrades[category][type];
  
  if (!upgrade) {
    console.error('존재하지 않는 업그레이드:', category, type);
    showErrorMessage('업그레이드를 적용할 수 없습니다.');
    return false;
  }
  
  if (upgrade.level >= upgrade.maxLevel) {
    showMessage('이미 최대 레벨입니다.');
    return false;
  }
  
  const cost = upgrade.cost[upgrade.level];
  if (playerMoney < cost) {
    showMessage('자금이 부족합니다.');
    return false;
  }
  
  // 업그레이드 적용 로직
  upgrade.level++;
  return { success: true, cost: cost };
}
```

### 3. 시각화 오류 처리

```javascript
function createCharts() {
  try {
    // 차트 생성 로직
  } catch (error) {
    console.error('차트 생성 실패:', error);
    
    // 대체 표시 방법 사용
    const fallbackContainer = document.createElement('div');
    fallbackContainer.className = 'fallback-stats';
    
    // 텍스트 기반 통계 표시
    this.gameHistory.forEach(wave => {
      const waveStats = document.createElement('p');
      waveStats.textContent = `웨이브 ${wave.waveNumber}: 요격 ${wave.intercepted}, 실패 ${wave.missed}`;
      fallbackContainer.appendChild(waveStats);
    });
    
    document.getElementById('charts-container').appendChild(fallbackContainer);
  }
}
```

## 테스트 전략

### 1. 단위 테스트

- 각 컴포넌트의 핵심 기능에 대한 단위 테스트 구현
- Jest 또는 Mocha와 같은 JavaScript 테스트 프레임워크 활용
- 주요 테스트 대상:
  - 업그레이드 효과 계산 함수
  - 저장 및 로드 기능
  - 밸런스 조정 알고리즘

### 2. 통합 테스트

- 여러 컴포넌트 간의 상호작용 테스트
- 주요 테스트 시나리오:
  - 업그레이드 구매 후 게임 요소 변화 확인
  - 저장 후 로드 시 게임 상태 일치 확인
  - 난이도 변경 시 게임 매개변수 적용 확인

### 3. 사용자 인터페이스 테스트

- UI 요소의 정상 작동 및 사용성 테스트
- 주요 테스트 항목:
  - 방공영역 시각화 정확성
  - 업그레이드 메뉴 상호작용
  - 결과 화면 그래프 표시
  - 일시 중지 및 도움말 기능

### 4. 성능 테스트

- 새로운 기능 추가로 인한 성능 영향 평가
- 주요 테스트 항목:
  - 방공영역 시각화 시 프레임 레이트 변화
  - 다수의 발사대 배치 시 중첩 영역 계산 성능
  - 게임 저장 및 로드 시간

## 구현 계획

1. **기반 작업**
   - 기존 코드 리팩토링 및 모듈화
   - 새로운 컴포넌트를 위한 인터페이스 설계

2. **핵심 기능 구현**
   - 방공영역 시각화 기능
   - 업그레이드 시스템 기본 구조
   - 자동 저장 시스템

3. **UI 개발**
   - 업그레이드 메뉴 UI
   - 결과 화면 및 그래프 UI
   - 일시 중지 및 도움말 UI

4. **기능 통합 및 테스트**
   - 각 기능 통합 및 상호작용 테스트
   - 밸런스 조정 및 최적화

5. **최종 테스트 및 배포**
   - 사용자 피드백 수집 및 반영
   - 최종 버그 수정 및 배포