import Phaser from 'phaser';
import { sound } from '../utils/audio';

interface StuckDagger {
  relativeAngle: number;
  graphics: Phaser.GameObjects.Graphics;
}

export class CyberDaggerScene extends Phaser.Scene {
  private targetCore!: Phaser.GameObjects.Arc;
  private targetRadius: number = 70;
  private currentAngle: number = 0;
  private rotationSpeed: number = 0.03;
  private speedTimer?: Phaser.Time.TimerEvent;

  private stuckDaggers: StuckDagger[] = [];
  private flyingDagger: Phaser.GameObjects.Graphics | null = null;
  private remainingDaggers: number = 7;
  private stage: number = 1;
  private score: number = 0;
  private isGameOver: boolean = false;

  private scoreText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private daggerIconsContainer!: Phaser.GameObjects.Container;
  private gameOverContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'CyberDaggerScene' });
  }

  create() {
    const { width, height } = this.scale;
    this.stuckDaggers = [];
    this.flyingDagger = null;
    this.remainingDaggers = 7;
    this.isGameOver = false;
    this.currentAngle = 0;
    this.rotationSpeed = 0.03;

    // Dark cyberpunk circular grid background
    this.createBackground(width, height);

    // Target Core Disk
    const coreY = height * 0.35;
    this.targetCore = this.add.circle(width / 2, coreY, this.targetRadius, 0x07090e);
    this.targetCore.setStrokeStyle(4, 0x00f0ff);
    this.targetCore.setDepth(10);

    const innerCore = this.add.circle(width / 2, coreY, 26, 0x00f0ff, 0.4);
    innerCore.setDepth(11);

    // Dynamic Rotation changes
    this.setupRotationPattern();

    // Spawn 1-2 initial stuck daggers based on stage
    this.spawnInitialObstacles();

    // Mobile One-Tap Throw
    this.input.on('pointerdown', () => {
      this.throwDagger();
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => this.throwDagger());
      this.input.keyboard.on('keydown-R', () => this.scene.restart());
    }

    // HUD
    this.scoreText = this.add.text(20, 20, `SCORE: ${this.score}`, {
      fontFamily: 'monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: 'rgba(7, 9, 14, 0.85)',
      padding: { x: 8, y: 5 },
    }).setDepth(100);

    this.stageText = this.add.text(width - 20, 20, `STAGE ${this.stage}`, {
      fontFamily: 'monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffe600',
      backgroundColor: 'rgba(7, 9, 14, 0.85)',
      padding: { x: 8, y: 5 },
    }).setOrigin(1, 0).setDepth(100);

    // Dagger ammo indicator
    this.daggerIconsContainer = this.add.container(26, height - 120);
    this.daggerIconsContainer.setDepth(100);
    this.renderDaggerIcons();

    // Ready Dagger at bottom
    this.drawReadyDagger(width, height);

    this.createGameOverUI(width, height);
  }

  private setupRotationPattern() {
    this.speedTimer = this.time.addEvent({
      delay: 2200,
      callback: () => {
        if (this.isGameOver) return;
        // Alternate directions and speed variance
        const dir = Math.random() > 0.4 ? 1 : -1;
        const baseSpeed = 0.025 + this.stage * 0.005;
        this.rotationSpeed = dir * Phaser.Math.FloatBetween(baseSpeed, baseSpeed * 1.6);
      },
      loop: true,
    });
  }

  private spawnInitialObstacles() {
    const obstacleCount = Math.min(4, Math.floor(this.stage / 2));
    for (let i = 0; i < obstacleCount; i++) {
      const angle = (Math.PI * 2 * i) / obstacleCount + 0.4;
      this.addStuckDagger(angle, 0xff0055);
    }
  }

  private drawReadyDagger(width: number, height: number) {
    const daggerGfx = this.add.graphics();
    daggerGfx.setName('ready_dagger');
    daggerGfx.fillStyle(0x00ff88, 1);
    daggerGfx.fillRect(width / 2 - 3, height - 160, 6, 50);
    daggerGfx.fillStyle(0xffffff, 1);
    daggerGfx.fillTriangle(width / 2 - 6, height - 160, width / 2 + 6, height - 160, width / 2, height - 176);
    daggerGfx.setDepth(10);
  }

  private renderDaggerIcons() {
    this.daggerIconsContainer.removeAll(true);
    for (let i = 0; i < this.remainingDaggers; i++) {
      const icon = this.add.rectangle(0, -i * 14, 8, 10, 0x00f0ff);
      this.daggerIconsContainer.add(icon);
    }
  }

  private throwDagger() {
    if (this.isGameOver || this.flyingDagger || this.remainingDaggers <= 0) return;

    sound.playJump();
    const { width, height } = this.scale;

    this.remainingDaggers--;
    this.renderDaggerIcons();

    // Create flying dagger
    this.flyingDagger = this.add.graphics();
    this.flyingDagger.fillStyle(0x00ff88, 1);
    this.flyingDagger.fillRect(-3, 0, 6, 50);
    this.flyingDagger.fillStyle(0xffffff, 1);
    this.flyingDagger.fillTriangle(-6, 0, 6, 0, 0, -16);
    this.flyingDagger.setPosition(width / 2, height - 160);
    this.flyingDagger.setDepth(15);
  }

  private addStuckDagger(relativeAngle: number, color = 0x00f0ff) {
    const gfx = this.add.graphics();
    gfx.fillStyle(color, 1);
    gfx.fillRect(-3, 0, 6, 44);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillTriangle(-5, 0, 5, 0, 0, -12);
    gfx.setDepth(12);

    this.stuckDaggers.push({
      relativeAngle,
      graphics: gfx,
    });
  }

  update() {
    if (this.isGameOver) return;

    // Rotate core
    this.currentAngle += this.rotationSpeed;

    // Update stuck daggers positions and rotations
    const cx = this.targetCore.x;
    const cy = this.targetCore.y;

    for (const dagger of this.stuckDaggers) {
      const totalAngle = this.currentAngle + dagger.relativeAngle;
      // Position at periphery
      dagger.graphics.x = cx + Math.cos(totalAngle) * this.targetRadius;
      dagger.graphics.y = cy + Math.sin(totalAngle) * this.targetRadius;
      dagger.graphics.rotation = totalAngle + Math.PI / 2;
    }

    // Update flying dagger
    if (this.flyingDagger) {
      this.flyingDagger.y -= 38;

      // Check collision with core
      if (this.flyingDagger.y <= cy + this.targetRadius) {
        this.checkDaggerImpact();
      }
    }
  }

  private checkDaggerImpact() {
    if (!this.flyingDagger) return;

    // Angle of impact: bottom of the core is angle PI / 2
    const impactAngle = Math.PI / 2;
    // Relative to current disk rotation:
    const relativeAngle = impactAngle - this.currentAngle;

    // Check collision with already stuck daggers (within ~0.26 rad)
    const collisionThreshold = 0.28;
    for (const stuck of this.stuckDaggers) {
      const diff = Phaser.Math.Angle.Wrap(stuck.relativeAngle - relativeAngle);
      if (Math.abs(diff) < collisionThreshold) {
        // Collision with another dagger!
        this.triggerDefeat();
        return;
      }
    }

    // Success! Stick dagger into core
    sound.playHit();
    sound.vibrate(25);
    this.cameras.main.shake(60, 0.006);

    this.addStuckDagger(relativeAngle, 0x00ff88);
    this.flyingDagger.destroy();
    this.flyingDagger = null;

    this.score += 10;
    this.scoreText.setText(`SCORE: ${this.score}`);

    // Check if stage complete
    if (this.remainingDaggers === 0) {
      this.triggerStageClear();
    }
  }

  private triggerStageClear() {
    sound.playClear();
    this.cameras.main.flash(120, 0, 240, 255, false);
    this.stage++;
    this.score += 50;

    this.time.delayedCall(400, () => {
      // Clear stuck daggers
      for (const d of this.stuckDaggers) {
        d.graphics.destroy();
      }
      this.stuckDaggers = [];
      this.remainingDaggers = 7 + Math.min(this.stage, 4);
      this.stageText.setText(`STAGE ${this.stage}`);
      this.scoreText.setText(`SCORE: ${this.score}`);
      this.renderDaggerIcons();
      this.spawnInitialObstacles();
    });
  }

  private triggerDefeat() {
    this.isGameOver = true;
    sound.playExplode();
    this.cameras.main.shake(250, 0.02);

    if (this.flyingDagger) {
      // Dagger bounce and fall
      this.tweens.add({
        targets: this.flyingDagger,
        y: this.scale.height + 50,
        x: this.flyingDagger.x + Phaser.Math.Between(-60, 60),
        angle: 180,
        duration: 400,
        ease: 'Cubic.easeIn',
      });
    }

    this.time.delayedCall(300, () => {
      this.gameOverContainer.setVisible(true);
      const scoreObj = this.gameOverContainer.getByName('end_score') as Phaser.GameObjects.Text;
      if (scoreObj) scoreObj.setText(`도달 스테이지: ${this.stage}  |  점수: ${this.score}`);
    });
  }

  private createBackground(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillStyle(0x060912, 1);
    bg.fillRect(0, 0, width, height);

    // Glowing target concentric rings
    bg.lineStyle(1, 0x1e293b, 0.5);
    const cy = height * 0.35;
    bg.strokeCircle(width / 2, cy, 110);
    bg.strokeCircle(width / 2, cy, 160);
    bg.strokeCircle(width / 2, cy, 210);

    // Aim guide line
    bg.lineStyle(1, 0x00f0ff, 0.15);
    bg.moveTo(width / 2, cy + this.targetRadius + 10);
    bg.lineTo(width / 2, height - 120);
    bg.strokePath();
  }

  private createGameOverUI(width: number, height: number) {
    this.gameOverContainer = this.add.container(width / 2, height / 2);
    this.gameOverContainer.setDepth(2000);
    this.gameOverContainer.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x07090e, 0.85);

    const title = this.add.text(0, -60, 'CORE DEFLECTED', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ff0055',
    }).setOrigin(0.5);

    const scoreInfo = this.add.text(0, -10, '점수 정보', {
      fontFamily: 'monospace',
      fontSize: '15px',
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
