import Phaser from 'phaser';
import { sound } from '../utils/audio';

interface FlyingTarget {
  container: Phaser.GameObjects.Container;
  body: Phaser.Physics.Arcade.Body;
  isBomb: boolean;
  type: string;
  color: number;
  isSliced: boolean;
  radius: number;
}

export class BladeSlicerScene extends Phaser.Scene {
  private targets: FlyingTarget[] = [];
  private bladeTrailPoints: { x: number; y: number; time: number }[] = [];
  private bladeGfx!: Phaser.GameObjects.Graphics;

  private score: number = 0;
  private combo: number = 0;
  private isGameOver: boolean = false;
  private spawnTimer?: Phaser.Time.TimerEvent;

  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private gameOverContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'BladeSlicerScene' });
  }

  create() {
    const { width, height } = this.scale;
    this.targets = [];
    this.bladeTrailPoints = [];
    this.score = 0;
    this.combo = 0;
    this.isGameOver = false;

    // Dark slice dojo background
    this.createBackground(width, height);

    // Blade trail graphics
    this.bladeGfx = this.add.graphics();
    this.bladeGfx.setDepth(100);

    // Spawn waves of shapes & bombs
    this.spawnTimer = this.time.addEvent({
      delay: 1500,
      callback: this.spawnWave,
      callbackScope: this,
      loop: true,
    });

    // Touch Drag / Swipe Input for Blade Trail
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && !this.isGameOver) {
        this.addBladePoint(pointer.x, pointer.y);
        this.checkBladeSlice(pointer);
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isGameOver) {
        this.bladeTrailPoints = [];
        this.addBladePoint(pointer.x, pointer.y);
      }
    });

    this.input.on('pointerup', () => {
      this.combo = 0;
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-R', () => this.scene.restart());
    }

    // HUD
    this.scoreText = this.add.text(20, 20, 'SCORE: 0', {
      fontFamily: 'monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: 'rgba(7, 9, 14, 0.85)',
      padding: { x: 10, y: 6 },
    }).setDepth(200);

    this.comboText = this.add.text(width / 2, 70, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffe600',
    }).setOrigin(0.5).setDepth(200);

    this.createGameOverUI(width, height);
  }

  private addBladePoint(x: number, y: number) {
    this.bladeTrailPoints.push({ x, y, time: this.time.now });
    if (this.bladeTrailPoints.length > 12) {
      this.bladeTrailPoints.shift();
    }
  }

  private spawnWave() {
    if (this.isGameOver) return;
    const { width, height } = this.scale;
    const count = Phaser.Math.Between(1, 3);

    for (let i = 0; i < count; i++) {
      const isBomb = Math.random() < 0.22;
      const x = Phaser.Math.Between(70, width - 70);
      const y = height + 30;

      const container = this.add.container(x, y);
      const gfx = this.add.graphics();

      let color = 0x00f0ff;
      let radius = 26;

      if (isBomb) {
        // Red Pulsing EMP Bomb
        color = 0xff0055;
        gfx.fillStyle(0xff0055, 1);
        gfx.fillCircle(0, 0, 22);
        gfx.fillStyle(0xffffff, 0.9);
        gfx.fillCircle(0, 0, 7);
        gfx.lineStyle(2, 0xffe600, 0.9);
        gfx.strokeCircle(0, 0, 26);
      } else {
        const types = [
          { color: 0x00f0ff, shape: 'circle' },
          { color: 0xff00b4, shape: 'diamond' },
          { color: 0x00ff88, shape: 'square' },
          { color: 0xffe600, shape: 'hexagon' },
        ];
        const chosen = Phaser.Math.RND.pick(types);
        color = chosen.color;

        gfx.fillStyle(color, 0.85);
        if (chosen.shape === 'diamond') {
          gfx.beginPath();
          gfx.moveTo(0, -26);
          gfx.lineTo(24, 0);
          gfx.lineTo(0, 26);
          gfx.lineTo(-24, 0);
          gfx.closePath();
          gfx.fillPath();
        } else if (chosen.shape === 'square') {
          gfx.fillRoundedRect(-22, -22, 44, 44, 8);
        } else {
          gfx.fillCircle(0, 0, 24);
        }
        gfx.lineStyle(2, 0xffffff, 0.8);
        gfx.strokeCircle(0, 0, 24);
      }

      container.add(gfx);
      this.physics.world.enable(container);
      const body = container.body as Phaser.Physics.Arcade.Body;
      body.setCollideWorldBounds(false);

      // Launch upward with physics arc
      const vx = (width / 2 - x) * Phaser.Math.FloatBetween(0.8, 1.4);
      const vy = Phaser.Math.Between(-880, -700);
      body.setVelocity(vx, vy);
      body.setGravityY(980);

      this.targets.push({
        container,
        body,
        isBomb,
        type: isBomb ? 'bomb' : 'core',
        color,
        isSliced: false,
        radius,
      });
    }
  }

  private checkBladeSlice(pointer: Phaser.Input.Pointer) {
    for (const target of this.targets) {
      if (target.isSliced) continue;

      const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, target.container.x, target.container.y);
      if (dist < target.radius * 1.3) {
        target.isSliced = true;

        if (target.isBomb) {
          // BOMB HIT! GAME OVER!
          this.triggerBombExplosion(target.container.x, target.container.y);
          return;
        }

        // Slice shape into 2 halves!
        this.sliceTarget(target, pointer);
      }
    }
  }

  private sliceTarget(target: FlyingTarget, _: Phaser.Input.Pointer) {
    sound.playSlice();
    sound.vibrate(20);
    this.combo++;

    const x = target.container.x;
    const y = target.container.y;
    target.container.destroy();

    // Spawn 2 split halves
    for (let side = -1; side <= 1; side += 2) {
      const half = this.add.graphics();
      half.fillStyle(target.color, 0.85);
      half.beginPath();
      half.arc(0, 0, target.radius, side > 0 ? -Math.PI / 2 : Math.PI / 2, side > 0 ? Math.PI / 2 : (Math.PI * 3) / 2);
      half.closePath();
      half.fillPath();
      half.setPosition(x, y);

      this.tweens.add({
        targets: half,
        x: x + side * Phaser.Math.Between(50, 100),
        y: y + Phaser.Math.Between(40, 150),
        angle: side * 90,
        alpha: 0,
        duration: 500,
        ease: 'Cubic.easeIn',
        onComplete: () => half.destroy(),
      });
    }

    // Spark particles
    this.spawnSparks(x, y, target.color);

    // Score calculation with combo
    const pts = 10 * Math.max(1, this.combo);
    this.score += pts;
    this.scoreText.setText(`SCORE: ${this.score}`);

    if (this.combo > 1) {
      this.comboText.setText(`COMBO x${this.combo}! +${pts}`);
      sound.playCombo(this.combo);
    }
  }

  private spawnSparks(x: number, y: number, color: number) {
    for (let i = 0; i < 14; i++) {
      const spark = this.add.circle(x, y, 2.5, color);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.Between(60, 180);

      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        duration: 350,
        onComplete: () => spark.destroy(),
      });
    }
  }

  private triggerBombExplosion(x: number, y: number) {
    this.isGameOver = true;
    sound.playExplode();
    this.cameras.main.flash(200, 255, 0, 85, true);
    this.cameras.main.shake(300, 0.03);

    if (this.spawnTimer) this.spawnTimer.remove();

    this.time.delayedCall(400, () => {
      this.gameOverContainer.setVisible(true);
      const scoreObj = this.gameOverContainer.getByName('end_score') as Phaser.GameObjects.Text;
      if (scoreObj) scoreObj.setText(`베어낸 코어 점수: ${this.score}`);
    });
  }

  update() {
    if (this.isGameOver) return;

    // Draw Blade Trail
    this.bladeGfx.clear();
    const now = this.time.now;
    this.bladeTrailPoints = this.bladeTrailPoints.filter((p) => now - p.time < 120);

    if (this.bladeTrailPoints.length >= 2) {
      for (let i = 1; i < this.bladeTrailPoints.length; i++) {
        const p1 = this.bladeTrailPoints[i - 1];
        const p2 = this.bladeTrailPoints[i];
        const ageFactor = 1 - (now - p2.time) / 120;

        // Outer cyan glow
        this.bladeGfx.lineStyle(10 * ageFactor, 0x00f0ff, 0.35 * ageFactor);
        this.bladeGfx.strokeLineShape(new Phaser.Geom.Line(p1.x, p1.y, p2.x, p2.y));

        // Inner sharp white blade
        this.bladeGfx.lineStyle(4 * ageFactor, 0xffffff, 0.9 * ageFactor);
        this.bladeGfx.strokeLineShape(new Phaser.Geom.Line(p1.x, p1.y, p2.x, p2.y));
      }
    }

    // Clean up off-screen targets
    const height = this.scale.height;
    this.targets = this.targets.filter((t) => {
      if (t.container.y > height + 80 && t.body.velocity.y > 0) {
        t.container.destroy();
        return false;
      }
      return true;
    });
  }

  private createBackground(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x060812, 0x060812, 0x120e24, 0x120e24, 1);
    bg.fillRect(0, 0, width, height);

    // Bamboo / neon slash cut aesthetic marks in background
    bg.lineStyle(1, 0xffffff, 0.05);
    for (let i = 0; i < 6; i++) {
      const x1 = Phaser.Math.Between(20, width - 20);
      const y1 = Phaser.Math.Between(40, height - 100);
      bg.strokeLineShape(new Phaser.Geom.Line(x1, y1, x1 + 80, y1 + 140));
    }
  }

  private createGameOverUI(width: number, height: number) {
    this.gameOverContainer = this.add.container(width / 2, height / 2);
    this.gameOverContainer.setDepth(2000);
    this.gameOverContainer.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x07090e, 0.85);

    const title = this.add.text(0, -60, 'EMP DETONATED', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ff0055',
    }).setOrigin(0.5);

    const scoreInfo = this.add.text(0, -10, '점수: 0', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#00f0ff',
    }).setOrigin(0.5);
    scoreInfo.setName('end_score');

    const restartBtn = this.add.text(0, 60, '🔄 화면을 터치하여 재시작', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#07090e',
      backgroundColor: '#00f0ff',
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerdown', () => {
      sound.playTap();
      this.scene.restart();
    });

    this.gameOverContainer.add([backdrop, title, scoreInfo, restartBtn]);
  }
}
