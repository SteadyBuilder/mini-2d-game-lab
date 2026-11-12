import Phaser from 'phaser';

export class SandboxScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };

  private debugText!: Phaser.GameObjects.Text;
  private isPointerDown: boolean = false;
  private pointerTarget: Phaser.Math.Vector2 | null = null;
  private trailEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  // 플레이어 이동 파라미터 (빠른 튜닝 가능)
  private readonly NORMAL_SPEED = 300;
  private readonly DASH_SPEED = 600;
  private currentSpeed = 300;

  constructor() {
    super({ key: 'SandboxScene' });
  }

  preload() {
    // 1. 프로토타이핑을 위해 에셋 파일 없이 코드로 직접 원형 캐릭터 텍스처를 동적 생성합니다.
    const gfx = this.make.graphics({ x: 0, y: 0 });
    
    // 외곽 은은한 발광 원
    gfx.fillStyle(0x00f0ff, 0.25);
    gfx.fillCircle(32, 32, 28);
    
    // 메인 원형 바디
    gfx.fillStyle(0x00f0ff, 1.0);
    gfx.fillCircle(32, 32, 22);

    // 중앙 포인트 (디테일)
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillCircle(32, 32, 10);

    gfx.generateTexture('circle_character', 64, 64);
    gfx.destroy();

    // 2. 이동 잔상용 작은 파티클 텍스처 생성
    const pGfx = this.make.graphics({ x: 0, y: 0 });
    pGfx.fillStyle(0x00f0ff, 0.8);
    pGfx.fillCircle(8, 8, 8);
    pGfx.generateTexture('trail_particle', 16, 16);
    pGfx.destroy();
  }

  create() {
    const { width, height } = this.scale;

    // 1. 배경 그리드 생성 (좌표 감각 및 이동 체감을 위한 눈금)
    this.createBackgroundGrid(width, height);

    // 2. 이동 잔상 파티클 이미터 설정
    this.trailEmitter = this.add.particles(0, 0, 'trail_particle', {
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 250,
      frequency: 30,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });

    // 3. 화면 중앙에 동그라미 캐릭터 생성 및 물리 바디 설정
    const centerX = width / 2;
    const centerY = height / 2;

    this.player = this.physics.add.sprite(centerX, centerY, 'circle_character');
    this.player.setCollideWorldBounds(true);
    this.player.setCircle(22, 10, 10); // 원형 충돌 판정
    this.player.setDamping(true);
    this.player.setDrag(0.001); // 부드러운 감속 효과
    this.player.setMaxVelocity(this.DASH_SPEED);

    // 파티클 트레일을 플레이어 위치 추적
    this.trailEmitter.startFollow(this.player);

    // 4. 입력 컨트롤 바인딩 (화살표 + WASD + 스페이스바)
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        SPACE: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      };
      this.input.keyboard.on('keydown-R', () => {
        this.scene.restart();
      });
    }

    // 5. 마우스 / 터치 조작 이벤트 리스너
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isPointerDown = true;
      this.pointerTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPointerDown) {
        this.pointerTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      }
    });

    this.input.on('pointerup', () => {
      this.isPointerDown = false;
      this.pointerTarget = null;
    });

    // 6. 실시간 HUD 및 디버그 인포 표시
    this.debugText = this.add.text(16, 16, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#58a6ff',
      backgroundColor: 'rgba(13, 17, 23, 0.75)',
      padding: { x: 10, y: 8 },
    });

    const tipsText = this.add.text(width - 16, 16, [
      '⚡ 2D Experiment Lab',
      '• WASD / 방향키: 이동',
      '• 마우스 클릭/터치: 목표 이동',
      '• SPACE: 대시 (순간 가속)',
    ], {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#8b949e',
      align: 'right',
      backgroundColor: 'rgba(13, 17, 23, 0.6)',
      padding: { x: 10, y: 8 },
    }).setOrigin(1, 0);

    // 리사이즈 대응
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      tipsText.setPosition(gameSize.width - 16, 16);
    });
  }

  update() {
    // 1. 대시 (스페이스바) 체크
    const isDashing = this.wasdKeys?.SPACE?.isDown || this.cursors?.space?.isDown;
    this.currentSpeed = isDashing ? this.DASH_SPEED : this.NORMAL_SPEED;

    // 2. 방향 벡터 계산
    let moveX = 0;
    let moveY = 0;

    // 키보드 입력 확인
    const left = this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown;
    const right = this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown;
    const up = this.cursors?.up?.isDown || this.wasdKeys?.W?.isDown;
    const down = this.cursors?.down?.isDown || this.wasdKeys?.S?.isDown;

    if (left) moveX -= 1;
    if (right) moveX += 1;
    if (up) moveY -= 1;
    if (down) moveY += 1;

    // 3. 마우스 / 터치 입력 반영 (키보드 입력이 없을 때 우선 처리)
    if (moveX === 0 && moveY === 0 && this.isPointerDown && this.pointerTarget) {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.pointerTarget.x,
        this.pointerTarget.y
      );

      if (distance > 10) {
        const angle = Phaser.Math.Angle.Between(
          this.player.x,
          this.player.y,
          this.pointerTarget.x,
          this.pointerTarget.y
        );
        moveX = Math.cos(angle);
        moveY = Math.sin(angle);
      }
    }

    // 4. 물리 속도 적용
    if (moveX !== 0 || moveY !== 0) {
      const moveVec = new Phaser.Math.Vector2(moveX, moveY).normalize();
      this.player.setVelocity(moveVec.x * this.currentSpeed, moveVec.y * this.currentSpeed);
      this.trailEmitter.emitting = true;
    } else {
      this.player.setVelocity(0, 0);
      this.trailEmitter.emitting = false;
    }

    // 5. HUD 디버그 텍스트 갱신
    const fps = Math.round(this.game.loop.actualFps);
    const px = Math.round(this.player.x);
    const py = Math.round(this.player.y);
    const vx = Math.round(this.player.body.velocity.x);
    const vy = Math.round(this.player.body.velocity.y);

    this.debugText.setText([
      `FPS: ${fps}`,
      `Position: (${px}, ${py})`,
      `Velocity: (${vx}, ${vy})`,
      `Mode: ${isDashing ? 'DASH' : 'NORMAL'}`,
    ]);
  }

  private createBackgroundGrid(width: number, height: number) {
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x21262d, 0.7);

    const gridSize = 40;
    for (let x = 0; x <= width; x += gridSize) {
      gridGraphics.moveTo(x, 0);
      gridGraphics.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += gridSize) {
      gridGraphics.moveTo(0, y);
      gridGraphics.lineTo(width, y);
    }
    gridGraphics.strokePath();

    // 중앙 십자 좌표선 (기준점)
    gridGraphics.lineStyle(1, 0x30363d, 1.0);
    gridGraphics.moveTo(width / 2, 0);
    gridGraphics.lineTo(width / 2, height);
    gridGraphics.moveTo(0, height / 2);
    gridGraphics.lineTo(width, height / 2);
    gridGraphics.strokePath();
  }
}
