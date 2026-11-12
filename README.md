# 🎮 Mini 2D Game Lab (미니 2D 게임 실험실)

> 다양한 2D 게임 메커니즘, 물리 시뮬레이션, 조작계를 브라우저에서 신속하게 구현하고 테스트할 수 있는 **인터랙티브 2D 게임 프로토타이핑 샌드박스 & 프로젝트 허브**입니다.  
> **Phaser 3**, **Vite**, **TypeScript**를 기반으로 하며, Vercel 즉시 배포를 지원합니다.

---

## 🌟 주요 특징 및 UI/UX

1. **멋진 아케이드 런처 & 프로젝트 허브 (Project Hub)**
   - **사이버펑크 네온 테마**: 모던 다크 글래스모피즘(Glassmorphism)과 반응형 파티클 배경 효과.
   - **카테고리 필터링**: 전체, 아케이드(Arcade), 물리 시뮬레이션(Physics), 조작 샌드박스(Sandbox).
   - **실시간 검색**: 프로젝트 타이틀, 부제목, 태그, 키워드 검색 지원.
   - **조작계 및 난이도 안내**: 각 미니 프로젝트마다 조작 키와 난이도 뱃지 미리보기 제공.
   - **URL 해시 라우팅**: `#project=neon-dodger`와 같이 URL 공유로 특정 프로젝트 즉시 진입 가능.

2. **인게임 상단 네비게이션 & 빠른 전환**
   - **허브 복귀**: `ESC` 단축키 또는 상단 `[← Hub로 돌아가기]` 버튼 클릭으로 언제든 목록으로 즉시 복귀.
   - **원클릭 재시작**: `R` 키 또는 상단 `[🔄]` 버튼으로 실시간 리셋.
   - **전체화면 모드**: `[⛶]` 버튼으로 몰입감 있는 플레이.

---

## 🕹️ 탑재된 미니 프로젝트 라인업

| 프로젝트명 | 카테고리 | 특징 & 메커니즘 | 조작법 |
|---|---|---|---|
| **⚡ Cyber Dash Sandbox** | Sandbox | 네온 플레이어, 부드러운 감속 및 순간 가속 대시(Dash), 트레일 파티클, 실시간 디버그 HUD | WASD / 방향키 / 마우스, `Space` 대시 |
| **🎯 Neon Dodger : Pulse Survival** | Arcade | 사방에서 쏟아지는 레이저 탄막 회피, 에너지 코어 수집, 실시간 점수 및 실드 시스템 | WASD / 방향키 / 마우스 터치 드래그 |
| **🪐 Gravity Orbit : Star Thruster** | Physics | 중앙 중력원의 인력장과 무중력 관성 비행, 소행성 충돌 회피, 우주 크리스탈 채굴 및 연료 관리 | `A/D` 회전, `W` 스러스터 추진 / 마우스 조준 |
| **💎 Neon Breaker : Particle Smash** | Arcade | 사이버펑크 네온 패들 벽돌깨기, 동적 반사 물리 및 스테이지 클리어 메커니즘 | 마우스 좌우 이동, 클릭/`Space` 발사 |
| **⚡ Chrono Runner (WIP)** | Arcade | 네온 그리드 위를 질주하는 절차적 생성 러닝 프로토타입 (준비 중) | `Space` 점프 |
| **🕯️ Shadow Crawler (WIP)** | Sandbox | 동적 시야(FOV) 및 2D 레이캐스팅 조명 던전 탐험 프로토타입 (준비 중) | WASD / 마우스 조명 |

---

## 🧪 새로운 미니 프로젝트 추가 방법

새로운 2D 미니게임을 추가하는 과정이 매우 간단하도록 모듈화되어 있습니다:

1. **`src/scenes/`에 새로운 Phaser 씬 생성**
   - 예: `src/scenes/MyNewGameScene.ts`
   ```typescript
   import Phaser from 'phaser';
   export class MyNewGameScene extends Phaser.Scene {
     constructor() { super({ key: 'MyNewGameScene' }); }
     // preload, create, update 구현...
   }
   ```

2. **`src/projects.ts`에 프로젝트 메타데이터 등록**
   ```typescript
   {
     id: 'my-game',
     title: 'My Awesome Game',
     subtitle: 'Prototype Subtitle',
     description: '프로젝트 설명...',
     category: 'arcade',
     tags: ['Phaser 3', 'Arcade'],
     icon: '🚀',
     badge: 'NEW',
     accentColor: '#00f0ff',
     accentGlow: 'rgba(0, 240, 255, 0.35)',
     sceneKey: 'MyNewGameScene',
     difficulty: 'Medium',
     status: 'ready',
     controls: [
       { key: 'WASD', action: '이동' },
     ],
   }
   ```

3. **`src/main.ts`의 scene 배열에 클래스 추가**
   - `scene: [SandboxScene, NeonDodgerScene, GravityOrbitScene, NeonBreakerScene, MyNewGameScene]`

등록 즉시 허브 화면의 카드 그리드, 카테고리 필터, 검색에 자동 반영됩니다!

---

## 🛠️ 개발 및 빌드 명령어

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 개발 서버 시작 (Hot Reload 지원)
npm run dev

# 3. 배포용 빌드 (타입 체크 및 Vite 빌드)
npm run build

# 4. 빌드 결과물 미리보기
npm run preview
```

---

## 🌐 Vercel에 배포하기

이 레포지토리는 Vercel 프리셋(`vercel.json`)이 이미 구성되어 있어 즉시 배포할 수 있습니다:
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
