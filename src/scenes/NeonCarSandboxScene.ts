import Phaser from 'phaser';
import { NEON_CAR_CONFIG, NeonCarConfig } from '../config/neonCarConfig';
import { sound } from '../utils/audio';
import { TouchActionButton, VirtualJoystick } from '../utils/mobileControls';
import { drawNeonArenaGrid, ensureNeonCarTextures } from '../utils/neonCarRenderer';

export class NeonCarSandboxScene extends Phaser.Scene {
  private readonly cfg: NeonCarConfig = NEON_CAR_CONFIG;

  private car!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private headlightBeam!: Phaser.GameObjects.Image;
  private nitroLeftEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private nitroRightEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private driftEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };

  private joystick!: VirtualJoystick;
  private nitroButton!: TouchActionButton;
  private debugText!: Phaser.GameObjects.Text;

  private isPointerDown = false;
  private pointerTarget: Phaser.Math.Vector2 | null = null;
  private isTouchBoosting = false;
  private currentSpeed = 0;

  constructor() {
    super({ key: NEON_CAR_CONFIG.sceneKey });
  }

  preload(): void {
    ensureNeonCarTextures(this, this.cfg);
  }

  create(): void {
    const { width, height } = this.scale;
    const { physics, textures, palette } = this.cfg;

    drawNeonArenaGrid(this, width, height, this.cfg);

    // 1. Drift & dual nitro emitters (rendered beneath the car)
    this.driftEmitter = this.add.particles(0, 0, textures.driftParticle, {
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.45, end: 0 },
      lifespan: 340,
      frequency: 28,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(5);

    const nitroConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
      scale: { start: 0.85, end: 0 },
      alpha: { start: 0.75, end: 0 },
      lifespan: 220,
      frequency: 18,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    };
    this.nitroLeftEmitter = this.add.particles(0, 0, textures.nitroParticle, nitroConfig).setDepth(6);
    this.nitroRightEmitter = this.add.particles(0, 0, textures.nitroParticle, nitroConfig).setDepth(6);

    // 2. Front headlight cone
    this.headlightBeam = this.add.image(width / 2, height / 2, textures.headlightGlow)
      .setOrigin(0, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(7);

    // 3. Neon car physics sprite (facing up initially: -PI / 2)
    this.car = this.physics.add.sprite(width / 2, height / 2, textures.carBody);
    this.car.setDepth(10);
    this.car.setRotation(-Math.PI / 2);
    this.car.setCollideWorldBounds(true);
    this.car.setCircle(physics.collisionRadius, 14, 0);
    this.car.setDamping(true);
    this.car.setDrag(physics.drag);
    this.car.setMaxVelocity(physics.boostSpeed);

    // 4. Mobile controls: Virtual Joystick (left) + NITRO Button (right)
    this.joystick = new VirtualJoystick(this, {
      x: 75,
      y: height - 85,
      radius: 46,
      handleRadius: 22,
    });

    this.nitroButton = new TouchActionButton(
      this,
      width - 65,
      height - 85,
      'NITRO⚡',
      () => this.triggerBoost(),
      { radius: 34, color: palette.nitroSecondary }
    );

    // 5. Keyboard controls (PC)
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        SPACE: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      };
      this.input.keyboard.on('keydown-SPACE', () => {
        sound.playJump();
      });
      this.input.keyboard.on('keydown-R', () => {
        this.scene.restart();
      });
    }

    // 6. Tap-to-drive support (above bottom control zone)
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

    // 7. HUD
    this.debugText = this.add.text(14, 14, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#00f0ff',
      backgroundColor: 'rgba(7, 9, 14, 0.85)',
      padding: { x: 8, y: 6 },
    }).setDepth(100);
  }

  private triggerBoost(): void {
    this.isTouchBoosting = true;
    sound.playJump();
    sound.vibrate(25);
    this.time.delayedCall(this.cfg.physics.boostDurationMs, () => {
      this.isTouchBoosting = false;
    });
  }

  private getMovementInput(): Phaser.Math.Vector2 {
    if (this.joystick?.isDown && (this.joystick.force.x !== 0 || this.joystick.force.y !== 0)) {
      return new Phaser.Math.Vector2(this.joystick.force.x, this.joystick.force.y);
    }

    let moveX = 0;
    let moveY = 0;
    const left = this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown;
    const right = this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown;
    const up = this.cursors?.up?.isDown || this.wasdKeys?.W?.isDown;
    const down = this.cursors?.down?.isDown || this.wasdKeys?.S?.isDown;

    if (left) moveX -= 1;
    if (right) moveX += 1;
    if (up) moveY -= 1;
    if (down) moveY += 1;

    if (moveX === 0 && moveY === 0 && this.isPointerDown && this.pointerTarget) {
      const dist = Phaser.Math.Distance.Between(
        this.car.x,
        this.car.y,
        this.pointerTarget.x,
        this.pointerTarget.y
      );
      if (dist > 14) {
        const angle = Phaser.Math.Angle.Between(
          this.car.x,
          this.car.y,
          this.pointerTarget.x,
          this.pointerTarget.y
        );
        moveX = Math.cos(angle);
        moveY = Math.sin(angle);
      }
    }

    return new Phaser.Math.Vector2(moveX, moveY);
  }

  update(_time: number, delta: number): void {
    const { physics } = this.cfg;
    const isBoosting = Boolean(
      this.wasdKeys?.SPACE?.isDown || this.cursors?.space?.isDown || this.isTouchBoosting
    );
    const targetSpeed = isBoosting ? physics.boostSpeed : physics.normalSpeed;

    const inputVec = this.getMovementInput();
    const isMoving = inputVec.lengthSq() > 0.001;

    if (isMoving) {
      const dir = inputVec.clone().normalize();
      const targetAngle = Math.atan2(dir.y, dir.x);
      const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(targetAngle - this.car.rotation));

      // Smoothly rotate car chassis toward target direction
      const step = physics.turnSpeedRadPerSec * (delta / 1000);
      this.car.rotation = Phaser.Math.Angle.RotateTo(this.car.rotation, targetAngle, step);

      this.currentSpeed = targetSpeed;
      this.car.setVelocity(dir.x * this.currentSpeed, dir.y * this.currentSpeed);

      this.nitroLeftEmitter.emitting = true;
      this.nitroRightEmitter.emitting = true;
      this.driftEmitter.emitting = angleDiff > physics.driftAngleThresholdRad || isBoosting;
    } else {
      this.currentSpeed = 0;
      this.car.setVelocity(0, 0);
      this.nitroLeftEmitter.emitting = false;
      this.nitroRightEmitter.emitting = false;
      this.driftEmitter.emitting = false;
    }

    this.syncAttachments();

    const px = Math.round(this.car.x);
    const py = Math.round(this.car.y);
    const kmh = Math.round(this.currentSpeed * 0.42);
    const mode = isBoosting ? '⚡ NITRO' : isMoving ? '🏎️ CRUISE' : '🅿️ IDLE';
    this.debugText.setText([
      `SPEED: ${kmh} km/h | MODE: ${mode}`,
      `POS: (${px}, ${py}) | 조이스틱 + NITRO⚡`,
    ]);
  }

  private syncAttachments(): void {
    const cos = Math.cos(this.car.rotation);
    const sin = Math.sin(this.car.rotation);

    // Position headlight cone at front bumper
    this.headlightBeam.setPosition(this.car.x + cos * 28, this.car.y + sin * 28);
    this.headlightBeam.setRotation(this.car.rotation);

    // Position dual rear tailpipes (-28px back, +/-9px lateral)
    const backX = this.car.x - cos * 28;
    const backY = this.car.y - sin * 28;
    const sideX = -sin * 9;
    const sideY = cos * 9;

    this.nitroLeftEmitter.setPosition(backX + sideX, backY + sideY);
    this.nitroRightEmitter.setPosition(backX - sideX, backY - sideY);
    this.driftEmitter.setPosition(backX, backY);
  }

  destroy(): void {
    if (this.joystick) this.joystick.destroy();
    if (this.nitroButton) this.nitroButton.destroy();
  }
}
