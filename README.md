# 🎮 2D Game Prototyping Sandbox (mini-2d-game-lab)

> 다양한 2D 게임 메커니즘과 아이디어를 브라우저에서 신속하게 구현하고 테스트하기 위한 샌드박스 프로젝트입니다.  
> **Phaser 3**와 **Vite**를 기반으로 구성되어 있어, 가볍고 빠른 빌드 속도 및 Vercel 즉시 배포를 지원합니다.

---

## 🚀 추천 기술 스택 선정 이유

- **엔진: Phaser 3**
  - 웹 2D 게임 분야의 표준 프레임워크로, 2D 물리 엔진(Arcade/Matter.js), 스프라이트 애니메이션, 타일맵, 파티클 시스템, 사운드, 카메라 제어 등 방대한 기능을 기본 제공합니다.
  - 외부 그래픽 리소스 없이도 그래픽스 API(`Phaser.GameObjects.Graphics`)를 통해 코드만으로 즉시 도형 기반 프로토타이핑이 가능합니다.
- **번들러: Vite + TypeScript**
  - 초고속 HMR(Hot Module Replacement) 지원으로 코드를 저장하는 즉시 화면에 변경 사항이 반영되어 빠른 실험에 최적입니다.
  - 타입 안정성과 Phaser 3의 방대한 API 자동완성을 제공합니다.
- **배포: Vercel**
  - 정적 SPA 빌드(`dist`)를 기본 지원하며, 설정 없이 Git Push만으로 자동 배포 및 프리뷰 URL을 생성합니다.

---

## ✨ 기본 구현 기능

1. **중앙 원형 캐릭터**
   - 화면 정중앙(`centerX`, `centerY`)에 네온 사이언 스타일의 발광 원형 캐릭터 배치.
   - 외부 에셋 파일 없이 코드로 텍스처를 동적 생성하여 번들 의존성을 최소화.
2. **반응형 조작계 (듀얼 인풋)**
   - **키보드**: 방향키(`Arrow Keys`) 및 `WASD` 동시 지원.
   - **대각선 이동 보정**: 벡터 정규화(`normalize`)를 적용하여 대각선 이동 시에도 속도 균일 유지.
   - **순간 대시**: `Spacebar`를 누르면 가속(300px/s → 600px/s).
   - **마우스 / 터치**: 클릭 또는 드래그한 위치로 부드럽게 목표 이동 (모바일/태블릿 대응).
3. **공간 인지 그리드 및 잔상 파티클**
   - 좌표계와 속도감을 체감할 수 있는 40px 그리드 배경 및 중심 십자선.
   - 이동 시 캐릭터 뒤에 생성되는 부드러운 네온 트레일(Trail) 파티클.
4. **실시간 HUD / 디버그 패널**
   - FPS, 실시간 좌표 `(X, Y)`, 물리 속도 `(VX, VY)`, 현재 이동 모드 실시간 출력.

---

## 🛠️ 개발 및 빌드 명령어

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 개발 서버 시작 (Hot Reload 지원)
npm run dev

# 3. 배포용 빌드 (dist 생성 및 타입 체크)
npm run build

# 4. 빌드 결과물 로컬 프리뷰
npm run preview
```

---

## 🌐 Vercel에 배포하기

이 레포지토리는 Vercel 배포 설정(`vercel.json`)이 이미 완벽히 포함되어 있어 클릭 한 번으로 배포할 수 있습니다.

### 방법 1. Vercel 웹 콘솔에서 배포 (추천)
1. [Vercel 대시보드](https://vercel.com/new)에 접속합니다.
2. GitHub 계정을 연동하고 **`SteadyBuilder/mini-2d-game-lab`** 레포지토리를 선택(Import)합니다.
3. Framework Preset이 **`Vite`**로 자동 인식됩니다:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **[Deploy]** 버튼을 누르면 약 20초 이내에 라이브 배포 URL이 발급됩니다.

### 방법 2. Vercel CLI로 터미널 배포
```bash
npx vercel
# 프로덕션 즉시 배포:
npx vercel --prod
```

---

## 🧪 새로운 2D 기능/아이디어 실험 팁

새로운 게임 요소를 추가할 때는 `src/scenes/SandboxScene.ts`에 기능을 붙이거나, 새로운 Scene 클래스를 생성하여 전환할 수 있습니다.

### 예시 1. 총알(투사체) 발사 실험
```typescript
// 클릭하거나 스페이스바를 누를 때 플레이어 위치에서 총알 발사
const bullet = this.physics.add.circle(this.player.x, this.player.y, 6, 0xffff00);
bullet.setVelocity(400, 0); // 원하는 방향 벡터로 발사
```

### 예시 2. 장애물 및 충돌 판정 실험
```typescript
const obstacle = this.physics.add.staticGroup();
obstacle.create(400, 300, 'obstacle_key');
this.physics.add.collider(this.player, obstacle, () => {
  console.log('충돌 감지!');
});
```

---

## 📂 프로젝트 구조

```
mini-2d-game-lab/
├── dist/                  # 빌드 출력 디렉토리
├── src/
│   ├── scenes/
│   │   └── SandboxScene.ts # 원형 캐릭터, 입력 처리, HUD, 그리드 씬
│   └── main.ts            # Phaser 게임 인스턴스 설정
├── index.html             # 모바일/데스크톱 반응형 캔버스 뷰포트
├── package.json           # 의존성 및 스크립트 정의
├── tsconfig.json          # TypeScript 설정
├── vercel.json            # Vercel 배포 프리셋 및 라우팅 설정
└── vite.config.ts         # Vite 빌드 설정
```
