import Phaser from 'phaser';
import { sound } from '../utils/audio';

interface Bumper {
  x: number;
  y: number;
  radius: number;
  score: number;
  color: number;
  circle: Phaser.GameObjects.Arc;
}

export class PinballNeonScene extends Phaser.Scene {
  private ballsLeft: number = 5;
  private score: number = 0;
  private currentBall: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null = null;
  private bumpers: Bumper[] = [];
  private basket!: Phaser.GameObjects.Rectangle;
  private basketDirection: number = 1;
  private basketSpeed: number = 160;

  private isDragging: boolean = false;
  private dragStart: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);
  private dragCurrent: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);
  private aimTrajectoryGfx!: Phaser.GameObjects.Graphics;
  private launchOrigin!: Phaser.Math.Vector2;

  private isGameOver: boolean = false;
  private scoreText!: Phaser.GameObjects.Text;
  private ballsText!: Phaser.GameObjects.Text;
  private gameOverContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'PinballNeonScene' });
  }

  preload() {
    if (!this.textures.exists('pinball_orb')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillCircle(12, 12, 10);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(9, 9, 4);
      gfx.generateTexture('pinball_orb', 24, 24);
      gfx.destroy();
    }
  }

  create() {
    const { width, height } = this.scale;
    this.ballsLeft = 5;
    this.score = 0;
    this.currentBall = null;
    this.bumpers = [];
    this.isDragging = false;
    this.isGameOver = false;

    // Launch Cannon origin at top center
    this.launchOrigin = new Phaser.Math.Vector2(width / 2, 80);

    // Pinball table background
    this.createBackground(width, height);

    // Trajectory Graphics
    this.aimTrajectoryGfx = this.add.graphics();
    this.aimTrajectoryGfx.setDepth(15);

    // Setup Bumper Pegs
    this.setupBumpers(width, height);

    // Moving Catch Basket at bottom
    this.basket = this.add.rectangle(width / 2, height - 40, 80, 20, 0x00ff88);
    this.basket.setStrokeStyle(2, 0xffffff, 0.9);
    this.basket.setDepth(20);

    // Mobile Slingshot Aim & Launch
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isGameOver || this.currentBall) return;
      this.isDragging = true;
      this.dragStart.set(pointer.x, pointer.y);
      this.dragCurrent.set(pointer.x, pointer.y);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.dragCurrent.set(pointer.x, pointer.y);
      }
    });

    this.input.on('pointerup', () => {
      if (this.isDragging && !this.currentBall && this.ballsLeft > 0) {
        this.launchBall();
      }
      this.isDragging = false;
      this.aimTrajectoryGfx.clear();
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-R', () => this.scene.restart());
    }

    // HUD
    this.scoreText = this.add.text(20, 20, 'SCORE: 0', {
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: 'rgba(7, 9, 14, 0.85)',
      padding: { x: 8, y: 5 },
    }).setDepth(100);

    this.ballsText = this.add.text(width - 20, 20, 'BALLS: 5', {
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffe600',
      backgroundColor: 'rgba(7, 9, 14, 0.85)',
      padding: { x: 8, y: 5 },
    }).setOrigin(1, 0).setDepth(100);

    const hint = this.add.text(width / 2, 115, '⬇️ 아래로 당겨서 각도와 파워 조절 후 발사!', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.45)',
    }).setOrigin(0.5);

    this.createGameOverUI(width, height);
  }

  private setupBumpers(width: number, _: number) {
    // Generate rows of glowing bumper pegs
    const rows = [
      { y: 190, count: 5, score: 50, color: 0x00f0ff },
      { y: 270, count: 6, score: 100, color: 0xff00b4 },
      { y: 350, count: 5, score: 250, color: 0xffe600 },
      { y: 430, count: 6, score: 100, color: 0x00ff88 },
      { y: 510, count: 4, score: 500, color: 0xa855f7 },
      { y: 590, count: 5, score: 150, color: 0x00f0ff },
    ];

    rows.forEach((row) => {
      const spacing = width / (row.count + 1);
      for (let c = 1; c <= row.count; c++) {
        const bx = spacing * c;
        const by = row.y;
        const radius = row.score === 500 ? 20 : 14;

        const circle = this.add.circle(bx, by, radius, row.color);
        circle.setStrokeStyle(2, 0xffffff, 0.7);
        circle.setDepth(10);

        this.bumpers.push({
          x: bx,
          y: by,
          radius,
          score: row.score,
          color: row.color,
          circle,
        });
      }
    });
  }

  private launchBall() {
    const pull = new Phaser.Math.Vector2(this.dragStart.x - this.dragCurrent.x, this.dragStart.y - this.dragCurrent.y);
    if (pull.length() < 15) return;

    this.ballsLeft--;
    this.ballsText.setText(`BALLS: ${this.ballsLeft}`);
    sound.playJump();

    const power = Math.min(pull.length() * 5.5, 750);
    const angle = pull.angle();

    this.currentBall = this.physics.add.sprite(this.launchOrigin.x, this.launchOrigin.y, 'pinball_orb');
    this.currentBall.setCollideWorldBounds(true);
    this.currentBall.setBounce(0.75, 0.75);
    this.currentBall.setCircle(10, 2, 2);
    this.currentBall.setGravityY(780);
    this.currentBall.setVelocity(Math.cos(angle) * power, Math.sin(angle) * power);
    this.currentBall.setDepth(20);
  }

  update(_: number, delta: number) {
    if (this.isGameOver) return;

    const { width, height } = this.scale;

    // Move catch basket horizontally
    this.basket.x += this.basketDirection * ((this.basketSpeed * delta) / 1000);
    if (this.basket.x > width - 50) {
      this.basketDirection = -1;
    } else if (this.basket.x < 50) {
      this.basketDirection = 1;
    }

    // Aim Trajectory Line preview
    if (this.isDragging && !this.currentBall) {
      this.aimTrajectoryGfx.clear();
      const pull = new Phaser.Math.Vector2(this.dragStart.x - this.dragCurrent.x, this.dragStart.y - this.dragCurrent.y);
      if (pull.length() > 15) {
        const power = Math.min(pull.length() * 5.5, 750);
        const angle = pull.angle();

        this.aimTrajectoryGfx.lineStyle(3, 0x00f0ff, 0.8);
        this.aimTrajectoryGfx.strokeLineShape(
          new Phaser.Geom.Line(
            this.launchOrigin.x,
            this.launchOrigin.y,
            this.launchOrigin.x + Math.cos(angle) * 80,
            this.launchOrigin.y + Math.sin(angle) * 80
          )
        );
      }
    }

    // Ball physics & Bumper collisions
    if (this.currentBall) {
      const ball = this.currentBall;

      // Check bumper collisions
      for (const bumper of this.bumpers) {
        const dist = Phaser.Math.Distance.Between(ball.x, ball.y, bumper.x, bumper.y);
        if (dist < bumper.radius + 12) {
          // Bounce off bumper
          const normAngle = Phaser.Math.Angle.Between(bumper.x, bumper.y, ball.x, ball.y);
          const bounceForce = 420;
          ball.setVelocity(Math.cos(normAngle) * bounceForce, Math.sin(normAngle) * bounceForce);

          // Bumper flash & sound
          sound.playHit();
          sound.vibrate(15);
          bumper.circle.setScale(1.35);
          this.tweens.add({
            targets: bumper.circle,
            scale: 1.0,
            duration: 180,
          });

          this.score += bumper.score;
          this.scoreText.setText(`SCORE: ${this.score}`);
        }
      }

      // Check Basket catch at bottom
      const basketBounds = this.basket.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(ball.getBounds(), basketBounds)) {
        // BONUS CATCH!
        sound.playClear();
        sound.vibrate(40);
        this.score += 1000;
        this.ballsLeft++;
        this.ballsText.setText(`BALLS: ${this.ballsLeft}`);
        this.scoreText.setText(`SCORE: ${this.score}`);
        this.cameras.main.flash(100, 0, 255, 136, false);

        ball.destroy();
        this.currentBall = null;
        return;
      }

      // Check Ball drain at bottom
      if (ball.y > height - 10) {
        ball.destroy();
        this.currentBall = null;

        // Check Game Over
        if (this.ballsLeft <= 0) {
          this.triggerGameOver();
        }
      }
    }
  }

  private triggerGameOver() {
    this.isGameOver = true;
    sound.playGameOver();
    this.time.delayedCall(400, () => {
      this.gameOverContainer.setVisible(true);
      const scoreObj = this.gameOverContainer.getByName('end_score') as Phaser.GameObjects.Text;
      if (scoreObj) scoreObj.setText(`최종 획득 점수: ${this.score}`);
    });
  }

  private createBackground(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x060912, 0x060912, 0x111628, 0x111628, 1);
    bg.fillRect(0, 0, width, height);

    // Neon table borders
    bg.lineStyle(3, 0x00f0ff, 0.4);
    bg.strokeRect(8, 8, width - 16, height - 16);

    // Top launch cannon base
    bg.fillStyle(0x1e293b, 1);
    bg.fillCircle(width / 2, 70, 24);
    bg.lineStyle(2, 0x00f0ff, 0.8);
    bg.strokeCircle(width / 2, 70, 24);
  }

  private createGameOverUI(width: number, height: number) {
    this.gameOverContainer = this.add.container(width / 2, height / 2);
    this.gameOverContainer.setDepth(2000);
    this.gameOverContainer.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x07090e, 0.88);

    const title = this.add.text(0, -60, 'BALLS DEPLETED', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ffe600',
    }).setOrigin(0.5);

    const scoreInfo = this.add.text(0, -10, '최종 점수: 0', {
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
