import Phaser from 'phaser';
import { sound } from '../utils/audio';

export class ChronoRunnerScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private ground!: Phaser.GameObjects.TileSprite;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private energyCubes!: Phaser.Physics.Arcade.Group;
  private speedLines!: Phaser.GameObjects.Graphics;

  private isJumping: boolean = false;
  private jumpCount: number = 0;
  private isSliding: boolean = false;
  private isGameOver: boolean = false;

  private score: number = 0;
  private distance: number = 0;
  private speed: number = 380;
  private scoreText!: Phaser.GameObjects.Text;
  private gameOverContainer!: Phaser.GameObjects.Container;
  private spawnTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'ChronoRunnerScene' });
  }

  preload() {
    // 1. Player texture (Running runner shape)
    if (!this.textures.exists('runner_player')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillRoundedRect(4, 4, 32, 48, 8);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(20, 16, 7);
      gfx.fillStyle(0xff007f, 1);
      gfx.fillRoundedRect(10, 28, 20, 16, 4);
      gfx.generateTexture('runner_player', 40, 56);
      gfx.destroy();
    }

    // 2. Obstacle - Low Neon Spike Barrier
    if (!this.textures.exists('runner_spike')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0xff007f, 0.9);
      gfx.beginPath();
      gfx.moveTo(16, 0);
      gfx.lineTo(32, 40);
      gfx.lineTo(0, 40);
      gfx.closePath();
      gfx.fillPath();
      gfx.lineStyle(2, 0xffffff, 0.8);
      gfx.strokePath();
      gfx.generateTexture('runner_spike', 32, 40);
      gfx.destroy();
    }

    // 3. Obstacle - High Overhead Laser Drone
    if (!this.textures.exists('runner_drone')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0xffe600, 1);
      gfx.fillRoundedRect(0, 0, 48, 20, 6);
      gfx.fillStyle(0xff0000, 0.8);
      gfx.fillCircle(24, 10, 5);
      gfx.fillStyle(0xff007f, 0.4);
      gfx.fillRect(20, 20, 8, 30); // Laser beam downwards
      gfx.generateTexture('runner_drone', 48, 50);
      gfx.destroy();
    }

    // 4. Collectible Prism
    if (!this.textures.exists('runner_cube')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00ff88, 1);
      gfx.fillCircle(12, 12, 10);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(12, 12, 4);
      gfx.generateTexture('runner_cube', 24, 24);
      gfx.destroy();
    }

    // 5. Ground Tile Texture
    if (!this.textures.exists('runner_ground')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x0a1020, 1);
      gfx.fillRect(0, 0, 64, 64);
      gfx.lineStyle(2, 0x00f0ff, 0.5);
      gfx.moveTo(0, 0);
      gfx.lineTo(64, 0);
      gfx.strokePath();
      gfx.lineStyle(1, 0x1e293b, 0.4);
      gfx.moveTo(32, 0);
      gfx.lineTo(32, 64);
      gfx.strokePath();
      gfx.generateTexture('runner_ground', 64, 64);
      gfx.destroy();
    }
  }

  create() {
    const { width, height } = this.scale;
    this.score = 0;
    this.distance = 0;
    this.speed = 380;
    this.isJumping = false;
    this.jumpCount = 0;
    this.isSliding = false;
    this.isGameOver = false;

    // Moving Background & Speed lines
    this.createCyberBackground(width, height);

    // Ground platform
    const groundY = height - 120;
    this.ground = this.add.tileSprite(width / 2, groundY + 32, width, 64, 'runner_ground');
    const staticGround = this.physics.add.staticGroup();
    const groundBody = this.add.zone(width / 2, groundY + 2, width, 10);
    staticGround.add(groundBody);

    // Speed lines
    this.speedLines = this.add.graphics();

    // Player
    this.player = this.physics.add.sprite(90, groundY - 40, 'runner_player');
    this.player.setCollideWorldBounds(true);
    this.player.setGravityY(1400);

    // Physics collider with ground
    this.physics.add.collider(this.player, staticGround, () => {
      if (this.isJumping) {
        this.isJumping = false;
        this.jumpCount = 0;
      }
    });

    // Groups
    this.obstacles = this.physics.add.group();
    this.energyCubes = this.physics.add.group();

    // Obstacle hit
    this.physics.add.overlap(this.player, this.obstacles, () => {
      this.triggerGameOver();
    });

    // Collect prism
    this.physics.add.overlap(this.player, this.energyCubes, (_, cube) => {
      cube.destroy();
      this.score += 50;
      sound.playScore(1.2);
      this.cameras.main.flash(40, 0, 255, 136, false);
      this.updateHud();
    });

    // Obstacle spawn timer
    this.spawnTimer = this.time.addEvent({
      delay: 1400,
      callback: this.spawnObstacle,
      callbackScope: this,
      loop: true,
    });

    // Mobile On-Screen Touch Controls (Left Half = Slide, Right Half = Jump)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isGameOver) return;
      if (pointer.x < width * 0.45) {
        this.startSlide();
      } else {
        this.jump();
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < width * 0.45 && this.isSliding) {
        this.stopSlide();
      }
    });

    // Keyboard support (WASD / Arrows)
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => this.jump());
      this.input.keyboard.on('keydown-UP', () => this.jump());
      this.input.keyboard.on('keydown-W', () => this.jump());
      this.input.keyboard.on('keydown-DOWN', () => this.startSlide());
      this.input.keyboard.on('keyup-DOWN', () => this.stopSlide());
      this.input.keyboard.on('keydown-S', () => this.startSlide());
      this.input.keyboard.on('keyup-S', () => this.stopSlide());
      this.input.keyboard.on('keydown-R', () => this.scene.restart());
    }

    // Mobile control hint overlays
    const hintLeft = this.add.text(width * 0.22, height - 50, '🔽 슬라이드 (좌측 터치)', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.45)',
    }).setOrigin(0.5);

    const hintRight = this.add.text(width * 0.75, height - 50, '🔼 점프 (우측 터치)', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.45)',
    }).setOrigin(0.5);

    // Score HUD
    this.scoreText = this.add.text(20, 20, 'SCORE: 0  |  DIST: 0m', {
      fontFamily: 'monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: 'rgba(7, 9, 14, 0.85)',
      padding: { x: 10, y: 6 },
    });

    // Game Over Container
    this.createGameOverUI(width, height);
  }

  private jump() {
    if (this.jumpCount < 2) {
      this.isJumping = true;
      this.jumpCount++;
      this.player.setVelocityY(-560);
      sound.playJump();
      if (this.isSliding) this.stopSlide();
    }
  }

  private startSlide() {
    if (this.isSliding || this.isJumping) return;
    this.isSliding = true;
    this.player.setScale(1.2, 0.45);
    this.player.y += 14;
    sound.playSlice();

    this.time.delayedCall(450, () => {
      if (this.isSliding) {
        this.stopSlide();
      }
    });
  }

  private stopSlide() {
    if (!this.isSliding) return;
    this.isSliding = false;
    this.player.setScale(1, 1);
  }

  private spawnObstacle() {
    if (this.isGameOver) return;
    const { width, height } = this.scale;
    const groundY = height - 120;

    const isHigh = Math.random() > 0.55;

    if (isHigh) {
      // Drone obstacle: need to slide under
      const drone = this.obstacles.create(width + 40, groundY - 70, 'runner_drone') as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
      drone.setVelocityX(-this.speed);
      drone.setImmovable(true);
      drone.body.setAllowGravity(false);
    } else {
      // Ground spike: need to jump over
      const spike = this.obstacles.create(width + 40, groundY - 20, 'runner_spike') as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
      spike.setVelocityX(-this.speed);
      spike.setImmovable(true);
      spike.body.setAllowGravity(false);
    }

    // Chance to spawn energy cube
    if (Math.random() > 0.4) {
      const cubeY = isHigh ? groundY - 15 : groundY - 90;
      const cube = this.energyCubes.create(width + 100, cubeY, 'runner_cube') as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
      cube.setVelocityX(-this.speed);
      cube.body.setAllowGravity(false);
    }
  }

  private triggerGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    sound.playExplode();
    this.cameras.main.shake(250, 0.02);

    this.physics.pause();
    if (this.spawnTimer) this.spawnTimer.remove();

    this.player.setTint(0xff0055);
    this.gameOverContainer.setVisible(true);

    const finalScoreText = this.gameOverContainer.getByName('final_score') as Phaser.GameObjects.Text;
    if (finalScoreText) {
      finalScoreText.setText(`최종 점수: ${this.score + Math.floor(this.distance)}`);
    }
  }

  private updateHud() {
    this.scoreText.setText(`SCORE: ${this.score}  |  DIST: ${Math.floor(this.distance)}m`);
  }

  update(_: number, delta: number) {
    if (this.isGameOver) return;

    // Scroll ground
    this.ground.tilePositionX += (this.speed * delta) / 1000;

    // Increase distance & speed slightly
    this.distance += (this.speed * delta) / 12000;
    this.speed = Math.min(620, 380 + this.distance * 1.5);
    this.updateHud();

    // Clean up passed obstacles
    this.obstacles.getChildren().forEach((obs: any) => {
      if (obs.x < -60) obs.destroy();
    });
    this.energyCubes.getChildren().forEach((cube: any) => {
      if (cube.x < -60) cube.destroy();
    });
  }

  private createCyberBackground(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x050710, 0x050710, 0x11162b, 0x11162b, 1);
    bg.fillRect(0, 0, width, height);

    // Neon city skyline silhouettes
    bg.fillStyle(0x0e172a, 0.6);
    for (let x = 0; x < width; x += 45) {
      const h = Phaser.Math.Between(120, 260);
      bg.fillRect(x, height - 120 - h, 40, h);
    }
  }

  private createGameOverUI(width: number, height: number) {
    this.gameOverContainer = this.add.container(width / 2, height / 2);
    this.gameOverContainer.setDepth(2000);
    this.gameOverContainer.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x07090e, 0.85);

    const title = this.add.text(0, -60, 'SYSTEM OVERLOAD', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ff007f',
    }).setOrigin(0.5);

    const finalScore = this.add.text(0, -10, '최종 점수: 0', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#00f0ff',
    }).setOrigin(0.5);
    finalScore.setName('final_score');

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

    this.gameOverContainer.add([backdrop, title, finalScore, restartBtn]);
  }
}
