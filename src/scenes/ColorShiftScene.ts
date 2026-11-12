import Phaser from 'phaser';
import { sound } from '../utils/audio';

const PALETTE = [
  { name: 'cyan', hex: 0x00f0ff },
  { name: 'magenta', hex: 0xff007f },
  { name: 'yellow', hex: 0xffe600 },
  { name: 'lime', hex: 0x00ff88 },
];

interface ObstacleRing {
  container: Phaser.GameObjects.Container;
  y: number;
  rotationSpeed: number;
  arcs: { colorIndex: number; startAngle: number; endAngle: number }[];
  isPassed: boolean;
}

export class ColorShiftScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private currentColorIndex: number = 0;
  private obstacles: ObstacleRing[] = [];
  private colorSwitchers: Phaser.GameObjects.Container[] = [];
  private stars: Phaser.GameObjects.Container[] = [];

  private score: number = 0;
  private isGameOver: boolean = false;
  private scoreText!: Phaser.GameObjects.Text;
  private gameOverContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'ColorShiftScene' });
  }

  preload() {
    if (!this.textures.exists('color_ball')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(12, 12, 10);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(10, 10, 3);
      gfx.generateTexture('color_ball', 24, 24);
      gfx.destroy();
    }
  }

  create() {
    const { width, height } = this.scale;
    this.score = 0;
    this.isGameOver = false;
    this.obstacles = [];
    this.colorSwitchers = [];
    this.stars = [];

    // Dark Background
    this.createBackground(width, height);

    // Initial random color
    this.currentColorIndex = Phaser.Math.Between(0, 3);

    // Player ball
    this.player = this.physics.add.sprite(width / 2, height - 160, 'color_ball');
    this.player.setCollideWorldBounds(false);
    this.player.setCircle(10, 2, 2);
    this.player.setGravityY(1150);
    this.player.setDepth(20);
    this.updatePlayerColor();

    // Spawn initial vertical obstacles
    this.generateObstacles(width, height);

    // Tap to jump upward
    this.input.on('pointerdown', () => {
      this.jump();
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => this.jump());
      this.input.keyboard.on('keydown-R', () => this.scene.restart());
    }

    // Camera follow player upward only
    this.cameras.main.startFollow(this.player, false, 0, 0.1, 0, height * 0.2);

    // HUD
    this.scoreText = this.add.text(20, 20, '0', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setScrollFactor(0).setDepth(200);

    const hint = this.add.text(width / 2, height - 35, '👆 화면을 탭하여 상승! 동일한 색상만 통과 가능', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.45)',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.createGameOverUI(width, height);
  }

  private updatePlayerColor() {
    const current = PALETTE[this.currentColorIndex];
    this.player.setTint(current.hex);
  }

  private jump() {
    if (this.isGameOver) return;
    this.player.setVelocityY(-390);
    sound.playJump();
  }

  private generateObstacles(width: number, height: number) {
    const startY = height - 360;
    const spacing = 340;

    for (let i = 0; i < 20; i++) {
      const y = startY - i * spacing;

      // 1. Rotating Color Ring Obstacle
      this.createColorRing(width / 2, y, (i % 2 === 0 ? 1 : -1) * 0.022);

      // 2. Star in the center of ring
      this.createScoreStar(width / 2, y);

      // 3. Color Switcher Orb between rings
      if (i < 19) {
        this.createColorSwitcher(width / 2, y - spacing / 2);
      }
    }
  }

  private createColorRing(x: number, y: number, speed: number) {
    const container = this.add.container(x, y);
    const gfx = this.add.graphics();
    container.add(gfx);

    const radius = 80;
    const thickness = 14;
    const arcs = [
      { colorIndex: 0, startAngle: 0, endAngle: Math.PI / 2 },
      { colorIndex: 1, startAngle: Math.PI / 2, endAngle: Math.PI },
      { colorIndex: 2, startAngle: Math.PI, endAngle: (Math.PI * 3) / 2 },
      { colorIndex: 3, startAngle: (Math.PI * 3) / 2, endAngle: Math.PI * 2 },
    ];

    arcs.forEach((arc) => {
      gfx.lineStyle(thickness, PALETTE[arc.colorIndex].hex, 1);
      gfx.beginPath();
      gfx.arc(0, 0, radius, arc.startAngle, arc.endAngle);
      gfx.strokePath();
    });

    this.obstacles.push({
      container,
      y,
      rotationSpeed: speed,
      arcs,
      isPassed: false,
    });
  }

  private createScoreStar(x: number, y: number) {
    const starContainer = this.add.container(x, y);
    const starGfx = this.add.graphics();
    starGfx.fillStyle(0xffe600, 1);
    starGfx.fillCircle(0, 0, 10);
    starGfx.fillStyle(0xffffff, 0.9);
    starGfx.fillCircle(0, 0, 4);
    starContainer.add(starGfx);
    this.stars.push(starContainer);
  }

  private createColorSwitcher(x: number, y: number) {
    const container = this.add.container(x, y);
    const gfx = this.add.graphics();

    // 4 quadrants of different colors
    const r = 16;
    PALETTE.forEach((p, idx) => {
      gfx.fillStyle(p.hex, 1);
      gfx.beginPath();
      gfx.moveTo(0, 0);
      gfx.arc(0, 0, r, (idx * Math.PI) / 2, ((idx + 1) * Math.PI) / 2);
      gfx.closePath();
      gfx.fillPath();
    });

    container.add(gfx);
    this.colorSwitchers.push(container);
  }

  update() {
    if (this.isGameOver) return;

    // Rotate obstacles
    for (const obs of this.obstacles) {
      obs.container.rotation += obs.rotationSpeed;

      // Check collision with ring if player is near ring's vertical span
      const dy = Math.abs(this.player.y - obs.y);
      if (dy < 95) {
        this.checkRingCollision(obs);
      }
    }

    // Check Star collection
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const star = this.stars[i];
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, star.x, star.y);
      if (dist < 28) {
        star.destroy();
        this.stars.splice(i, 1);
        this.score++;
        this.scoreText.setText(`${this.score}`);
        sound.playScore(1.4);
        sound.vibrate(20);
        this.cameras.main.flash(60, 255, 255, 255, false);
      }
    }

    // Check Color Switcher
    for (let i = this.colorSwitchers.length - 1; i >= 0; i--) {
      const sw = this.colorSwitchers[i];
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, sw.x, sw.y);
      if (dist < 26) {
        sw.destroy();
        this.colorSwitchers.splice(i, 1);
        // Switch to a new different color
        let nextColor = this.currentColorIndex;
        while (nextColor === this.currentColorIndex) {
          nextColor = Phaser.Math.Between(0, 3);
        }
        this.currentColorIndex = nextColor;
        this.updatePlayerColor();
        sound.playClear();
        sound.vibrate(30);
      }
    }

    // Check falling off screen bottom
    const camBottom = this.cameras.main.scrollY + this.scale.height;
    if (this.player.y > camBottom + 40) {
      this.triggerDefeat();
    }
  }

  private checkRingCollision(obs: ObstacleRing) {
    const px = this.player.x;
    const py = this.player.y;
    const ox = obs.container.x;
    const oy = obs.container.y;

    const dist = Phaser.Math.Distance.Between(px, py, ox, oy);
    const ringRadius = 80;
    const thickness = 14;

    // If player is on the edge of ring border
    if (Math.abs(dist - ringRadius) < thickness / 2 + 8) {
      // Find angle of player relative to ring's current rotation
      const globalAngle = Phaser.Math.Angle.Between(ox, oy, px, py);
      const relativeAngle = Phaser.Math.Angle.Normalize(globalAngle - obs.container.rotation);

      // Determine which quadrant was hit
      const quadrant = Math.floor(relativeAngle / (Math.PI / 2)) % 4;

      if (quadrant !== this.currentColorIndex) {
        // Mismatched color! Game Over!
        this.triggerDefeat();
      }
    }
  }

  private triggerDefeat() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    sound.playExplode();
    this.cameras.main.shake(250, 0.02);

    this.player.setVisible(false);
    this.physics.pause();

    // Color explosion particles
    for (let i = 0; i < 20; i++) {
      const p = this.add.circle(this.player.x, this.player.y, 4, PALETTE[this.currentColorIndex].hex);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const spd = Phaser.Math.Between(80, 240);
      this.tweens.add({
        targets: p,
        x: p.x + Math.cos(angle) * spd,
        y: p.y + Math.sin(angle) * spd,
        alpha: 0,
        duration: 400,
        onComplete: () => p.destroy(),
      });
    }

    this.time.delayedCall(450, () => {
      this.gameOverContainer.setVisible(true);
      const scoreObj = this.gameOverContainer.getByName('end_score') as Phaser.GameObjects.Text;
      if (scoreObj) scoreObj.setText(`통과한 별 개수: ${this.score}`);
    });
  }

  private createBackground(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x060710, 0x060710, 0x0f1422, 0x0f1422, 1);
    bg.fillRect(0, -10000, width, height + 10000);
  }

  private createGameOverUI(width: number, height: number) {
    this.gameOverContainer = this.add.container(width / 2, height / 2);
    this.gameOverContainer.setDepth(2000);
    this.gameOverContainer.setScrollFactor(0);
    this.gameOverContainer.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x07090e, 0.88);

    const title = this.add.text(0, -60, 'COLOR SHIFT FAILURE', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ff0055',
    }).setOrigin(0.5);

    const scoreInfo = this.add.text(0, -10, '별 개수: 0', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#00f0ff',
    }).setOrigin(0.5);
    scoreInfo.setName('end_score');

    const restartBtn = this.add.text(0, 60, '🔄 화면을 터치하여 재도전', {
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
