import Phaser from 'phaser';
import { sound } from '../utils/audio';
import { VirtualJoystick, TouchActionButton } from '../utils/mobileControls';

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

  private joystick!: VirtualJoystick;
  private dashButton!: TouchActionButton;
  private isTouchDashing: boolean = false;

  private readonly NORMAL_SPEED = 280;
  private readonly DASH_SPEED = 560;
  private currentSpeed = 280;

  constructor() {
    super({ key: 'SandboxScene' });
  }

  preload() {
    if (!this.textures.exists('circle_character')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00f0ff, 0.25);
      gfx.fillCircle(28, 28, 26);
      gfx.fillStyle(0x00f0ff, 1.0);
      gfx.fillCircle(28, 28, 20);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(28, 28, 9);
      gfx.generateTexture('circle_character', 56, 56);
      gfx.destroy();
    }

    if (!this.textures.exists('trail_particle')) {
      const pGfx = this.make.graphics({ x: 0, y: 0 });
      pGfx.fillStyle(0x00f0ff, 0.8);
      pGfx.fillCircle(6, 6, 6);
      pGfx.generateTexture('trail_particle', 12, 12);
      pGfx.destroy();
    }
  }

  create() {
    const { width, height } = this.scale;

    // 1. 배경 그리드
    this.createBackgroundGrid(width, height);

    // 2. 이동 잔상 파티클 이미터
    this.trailEmitter = this.add.particles(0, 0, 'trail_particle', {
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 250,
      frequency: 25,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });

    // 3. 캐릭터 생성
    this.player = this.physics.add.sprite(width / 2, height / 2, 'circle_character');
    this.player.setCollideWorldBounds(true);
    this.player.setCircle(20, 8, 8);
    this.player.setDamping(true);
    this.player.setDrag(0.001);
    this.player.setMaxVelocity(this.DASH_SPEED);

    this.trailEmitter.startFollow(this.player);

    // 4. 모바일 온스크린 조작계: 가상 조이스틱 (좌측 하단) + 대시 버튼 (우측 하단)
    this.joystick = new VirtualJoystick(this, {
      x: 75,
      y: height - 85,
      radius: 46,
      handleRadius: 22,
    });

    this.dashButton = new TouchActionButton(
      this,
      width - 65,
      height - 85,
      'DASH⚡',
      () => {
        this.isTouchDashing = true;
        sound.playJump();
        sound.vibrate(25);
        this.time.delayedCall(300, () => {
          this.isTouchDashing = false;
        });
      },
      { radius: 34, color: 0x00f0ff }
    );

    // 5. 키보드 컨트롤 (PC 겸용)
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

    // 6. 터치 탭 이동 지원 (조이스틱/버튼 영역 제외)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < height - 150) {
        this.isPointerDown = true;
        this.pointerTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPointerDown && pointer.y < height - 150) {
        this.pointerTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      }
    });

    this.input.on('pointerup', () => {
      this.isPointerDown = false;
      this.pointerTarget = null;
    });

    // 7. 실시간 모바일 HUD
    this.debugText = this.add.text(14, 14, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#00f0ff',
      backgroundColor: 'rgba(7, 9, 14, 0.85)',
      padding: { x: 8, y: 6 },
    }).setDepth(100);
  }

  update() {
    // 1. 대시 체크 (키보드 Space 또는 모바일 DASH 버튼)
    const isDashing = this.wasdKeys?.SPACE?.isDown || this.cursors?.space?.isDown || this.isTouchDashing;
    this.currentSpeed = isDashing ? this.DASH_SPEED : this.NORMAL_SPEED;

    let moveX = 0;
    let moveY = 0;

    // 2. 가상 조이스틱 우선 확인
    if (this.joystick && this.joystick.isDown) {
      moveX = this.joystick.force.x;
      moveY = this.joystick.force.y;
    } else {
      // 키보드 입력
      const left = this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown;
      const right = this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown;
      const up = this.cursors?.up?.isDown || this.wasdKeys?.W?.isDown;
      const down = this.cursors?.down?.isDown || this.wasdKeys?.S?.isDown;

      if (left) moveX -= 1;
      if (right) moveX += 1;
      if (up) moveY -= 1;
      if (down) moveY += 1;

      // 터치 목표점 이동
      if (moveX === 0 && moveY === 0 && this.isPointerDown && this.pointerTarget) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.pointerTarget.x, this.pointerTarget.y);
        if (dist > 10) {
          const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.pointerTarget.x, this.pointerTarget.y);
          moveX = Math.cos(angle);
          moveY = Math.sin(angle);
        }
      }
    }

    // 3. 물리 속도 적용
    if (moveX !== 0 || moveY !== 0) {
      const moveVec = new Phaser.Math.Vector2(moveX, moveY).normalize();
      this.player.setVelocity(moveVec.x * this.currentSpeed, moveVec.y * this.currentSpeed);
      this.trailEmitter.emitting = true;
    } else {
      this.player.setVelocity(0, 0);
      this.trailEmitter.emitting = false;
    }

    // 4. HUD
    const px = Math.round(this.player.x);
    const py = Math.round(this.player.y);
    const mode = isDashing ? '⚡ DASH' : 'NORMAL';
    this.debugText.setText([
      `POS: (${px}, ${py}) | MODE: ${mode}`,
      `MOBILE: 좌측 조이스틱 / 우측 DASH`,
    ]);
  }

  private createBackgroundGrid(width: number, height: number) {
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x161f30, 0.7);

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

    gridGraphics.lineStyle(1, 0x00f0ff, 0.3);
    gridGraphics.moveTo(width / 2, 0);
    gridGraphics.lineTo(width / 2, height);
    gridGraphics.moveTo(0, height / 2);
    gridGraphics.lineTo(width, height / 2);
    gridGraphics.strokePath();
  }

  destroy() {
    if (this.joystick) this.joystick.destroy();
    if (this.dashButton) this.dashButton.destroy();
  }
}
