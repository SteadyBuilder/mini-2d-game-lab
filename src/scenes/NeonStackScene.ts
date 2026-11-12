import Phaser from 'phaser';
import { sound } from '../utils/audio';

interface StackBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  rect: Phaser.GameObjects.Rectangle;
}

export class NeonStackScene extends Phaser.Scene {
  private stack: StackBlock[] = [];
  private activeBlock: {
    rect: Phaser.GameObjects.Rectangle;
    x: number;
    y: number;
    width: number;
    direction: number;
    speed: number;
    color: number;
  } | null = null;

  private readonly BLOCK_HEIGHT = 28;
  private readonly INITIAL_WIDTH = 240;
  private combo: number = 0;
  private score: number = 0;
  private isGameOver: boolean = false;

  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private gameOverContainer!: Phaser.GameObjects.Container;
  private cameraOffsetY: number = 0;

  // Aesthetic neon color palette progression
  private colors = [
    0x00f0ff, 0x00d2ff, 0x00aaff, 0x7000ff, 0x9b00ff,
    0xd000ff, 0xff00b4, 0xff0066, 0xff3300, 0xff9900,
    0xffe600, 0x00ff88, 0x00ffcc,
  ];

  constructor() {
    super({ key: 'NeonStackScene' });
  }

  create() {
    const { width, height } = this.scale;
    this.stack = [];
    this.activeBlock = null;
    this.combo = 0;
    this.score = 0;
    this.isGameOver = false;
    this.cameraOffsetY = 0;

    // Background gradient
    this.createBackground(width, height);

    // Initial base block
    const baseY = height - 140;
    const baseColor = this.colors[0];
    const baseRect = this.add.rectangle(width / 2, baseY, this.INITIAL_WIDTH, this.BLOCK_HEIGHT, baseColor);
    baseRect.setStrokeStyle(1.5, 0xffffff, 0.7);

    this.stack.push({
      x: width / 2,
      y: baseY,
      width: this.INITIAL_WIDTH,
      height: this.BLOCK_HEIGHT,
      color: baseColor,
      rect: baseRect,
    });

    // Spawn first moving slab
    this.spawnNextBlock();

    // Tap to drop block
    this.input.on('pointerdown', () => {
      this.placeBlock();
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => this.placeBlock());
      this.input.keyboard.on('keydown-R', () => this.scene.restart());
    }

    // HUD
    this.scoreText = this.add.text(width / 2, 70, '0', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(200).setScrollFactor(0);

    this.comboText = this.add.text(width / 2, 130, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffe600',
    }).setOrigin(0.5).setDepth(200).setScrollFactor(0);

    this.createGameOverUI(width, height);
  }

  private spawnNextBlock() {
    if (this.isGameOver) return;
    const { width } = this.scale;
    const topBlock = this.stack[this.stack.length - 1];
    const newY = topBlock.y - this.BLOCK_HEIGHT;
    const colorIndex = this.stack.length % this.colors.length;
    const color = this.colors[colorIndex];

    const startX = Math.random() > 0.5 ? -topBlock.width / 2 : width + topBlock.width / 2;
    const direction = startX < width / 2 ? 1 : -1;
    const speed = 260 + Math.min(this.score * 4, 180);

    const rect = this.add.rectangle(startX, newY, topBlock.width, this.BLOCK_HEIGHT, color);
    rect.setStrokeStyle(1.5, 0xffffff, 0.8);

    this.activeBlock = {
      rect,
      x: startX,
      y: newY,
      width: topBlock.width,
      direction,
      speed,
      color,
    };
  }

  private placeBlock() {
    if (this.isGameOver || !this.activeBlock) return;

    const current = this.activeBlock;
    const prev = this.stack[this.stack.length - 1];

    const deltaX = current.x - prev.x;
    const tolerance = 4; // Perfect alignment threshold in pixels

    if (Math.abs(deltaX) <= tolerance) {
      // PERFECT MATCH!
      this.combo++;
      sound.playCombo(this.combo);
      sound.vibrate(20);

      current.x = prev.x;
      current.rect.x = prev.x;

      this.comboText.setText(`PERFECT! x${this.combo}`);
      this.cameras.main.flash(60, 255, 255, 255, false);

      // Flash particles
      this.spawnSparkParticles(current.x, current.y, current.width, current.color);

      // Slight width expansion bonus on high combo
      if (this.combo >= 4 && current.width < this.INITIAL_WIDTH) {
        current.width = Math.min(this.INITIAL_WIDTH, current.width + 10);
        current.rect.width = current.width;
      }
    } else {
      // Overhang slicing
      this.combo = 0;
      this.comboText.setText('');

      const overlapWidth = prev.width - Math.abs(deltaX);

      if (overlapWidth <= 0) {
        // Complete Miss! Game Over!
        this.triggerMiss(current);
        return;
      }

      sound.playHit();
      sound.vibrate(20);

      // Calculate new width & center
      const newWidth = overlapWidth;
      const newX = prev.x + deltaX / 2;

      // Sliced falling piece
      const slicedWidth = Math.abs(deltaX);
      const slicedX = deltaX > 0 ? newX + newWidth / 2 + slicedWidth / 2 : newX - newWidth / 2 - slicedWidth / 2;
      this.spawnFallingPiece(slicedX, current.y, slicedWidth, this.BLOCK_HEIGHT, current.color);

      current.width = newWidth;
      current.x = newX;
      current.rect.width = newWidth;
      current.rect.x = newX;
    }

    // Add to stack
    this.stack.push({
      x: current.x,
      y: current.y,
      width: current.width,
      height: this.BLOCK_HEIGHT,
      color: current.color,
      rect: current.rect,
    });

    this.activeBlock = null;
    this.score++;
    this.scoreText.setText(`${this.score}`);

    // Camera follow tower upwards
    if (this.stack.length > 8) {
      this.cameraOffsetY += this.BLOCK_HEIGHT;
      this.tweens.add({
        targets: this.cameras.main,
        scrollY: -this.cameraOffsetY,
        duration: 250,
        ease: 'Cubic.easeOut',
      });
    }

    this.spawnNextBlock();
  }

  private spawnFallingPiece(x: number, y: number, w: number, h: number, color: number) {
    const piece = this.add.rectangle(x, y, w, h, color);
    piece.setStrokeStyle(1, 0xffffff, 0.6);

    this.tweens.add({
      targets: piece,
      y: y + 250,
      angle: Phaser.Math.Between(-45, 45),
      alpha: 0,
      duration: 650,
      ease: 'Quad.easeIn',
      onComplete: () => piece.destroy(),
    });
  }

  private spawnSparkParticles(x: number, y: number, w: number, color: number) {
    for (let i = 0; i < 12; i++) {
      const p = this.add.circle(x + Phaser.Math.Between(-w / 2, w / 2), y, 3, color);
      this.tweens.add({
        targets: p,
        y: y + Phaser.Math.Between(-40, 20),
        x: p.x + Phaser.Math.Between(-25, 25),
        alpha: 0,
        scale: 0.1,
        duration: 350,
        onComplete: () => p.destroy(),
      });
    }
  }

  private triggerMiss(current: { rect: Phaser.GameObjects.Rectangle; y: number }) {
    this.isGameOver = true;
    sound.playGameOver();
    this.cameras.main.shake(250, 0.02);

    this.tweens.add({
      targets: current.rect,
      y: current.y + 400,
      angle: 60,
      duration: 800,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.gameOverContainer.setVisible(true);
        const scoreObj = this.gameOverContainer.getByName('end_score') as Phaser.GameObjects.Text;
        if (scoreObj) scoreObj.setText(`쌓은 높이: ${this.score}층`);
      },
    });
  }

  update(_: number, delta: number) {
    if (this.isGameOver || !this.activeBlock) return;

    const { width } = this.scale;
    const block = this.activeBlock;

    block.x += block.direction * ((block.speed * delta) / 1000);
    block.rect.x = block.x;

    const limit = width + block.width / 2;
    if (block.x > limit) {
      block.direction = -1;
    } else if (block.x < -block.width / 2) {
      block.direction = 1;
    }
  }

  private createBackground(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x070914, 0x070914, 0x141026, 0x141026, 1);
    bg.fillRect(0, -2000, width, height + 2000);

    // Subtle background guidelines
    bg.lineStyle(1, 0xffffff, 0.04);
    bg.moveTo(width / 2, -2000);
    bg.lineTo(width / 2, height);
    bg.strokePath();
  }

  private createGameOverUI(width: number, height: number) {
    this.gameOverContainer = this.add.container(width / 2, height / 2);
    this.gameOverContainer.setDepth(2000);
    this.gameOverContainer.setScrollFactor(0);
    this.gameOverContainer.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x07090e, 0.85);

    const title = this.add.text(0, -60, 'TOWER COLLAPSED', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ff007f',
    }).setOrigin(0.5);

    const scoreInfo = this.add.text(0, -10, '쌓은 높이: 0층', {
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
