import Phaser from 'phaser';
import { sound } from '../utils/audio';

export class NeonBreakerScene extends Phaser.Scene {
  private paddle!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private ball!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private bricks!: Phaser.Physics.Arcade.StaticGroup;
  private score: number = 0;
  private lives: number = 3;
  private ballLaunched: boolean = false;

  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super({ key: 'NeonBreakerScene' });
  }

  preload() {
    // 1. 패들 텍스처
    if (!this.textures.exists('breaker_paddle')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillRoundedRect(0, 0, 96, 18, 9);
      gfx.fillStyle(0xffffff, 0.8);
      gfx.fillRoundedRect(8, 4, 80, 4, 2);
      gfx.generateTexture('breaker_paddle', 96, 18);
      gfx.destroy();
    }

    // 2. 공 텍스처
    if (!this.textures.exists('breaker_ball')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0xffe600, 1);
      gfx.fillCircle(10, 10, 9);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(8, 8, 3);
      gfx.generateTexture('breaker_ball', 20, 20);
      gfx.destroy();
    }

    // 3. 브릭 텍스처 4종 (모바일 세로 폭 450px에 최적화: 폭 68px, 높이 24px)
    const brickColors = [
      { key: 'brick_cyan', color: 0x00f0ff },
      { key: 'brick_magenta', color: 0xff007f },
      { key: 'brick_purple', color: 0x9b51e0 },
      { key: 'brick_lime', color: 0x00ff88 },
    ];

    brickColors.forEach(({ key, color }) => {
      if (!this.textures.exists(key)) {
        const gfx = this.make.graphics({ x: 0, y: 0 });
        gfx.fillStyle(color, 0.9);
        gfx.fillRoundedRect(0, 0, 68, 22, 4);
        gfx.lineStyle(1.5, 0xffffff, 0.6);
        gfx.strokeRoundedRect(0, 0, 68, 22, 4);
        gfx.generateTexture(key, 68, 22);
        gfx.destroy();
      }
    });
  }

  create() {
    const { width, height } = this.scale;
    this.score = 0;
    this.lives = 3;
    this.ballLaunched = false;

    // 패들 (하단 70px)
    this.paddle = this.physics.add.sprite(width / 2, height - 70, 'breaker_paddle');
    this.paddle.setCollideWorldBounds(true);
    this.paddle.setImmovable(true);

    // 공
    this.ball = this.physics.add.sprite(width / 2, height - 95, 'breaker_ball');
    this.ball.setCollideWorldBounds(true);
    this.ball.setBounce(1, 1);
    this.ball.setCircle(9, 1, 1);

    // 벽돌 그룹 (5열 x 6행)
    this.bricks = this.physics.add.staticGroup();
    this.generateBricks(width);

    // 충돌 처리
    this.physics.add.collider(this.ball, this.paddle, () => {
      const diff = this.ball.x - this.paddle.x;
      this.ball.setVelocityX(diff * 8.5);
      sound.playHit();
      sound.vibrate(15);
      this.cameras.main.shake(60, 0.005);
    });

    this.physics.add.collider(this.ball, this.bricks, (_, brick) => {
      brick.destroy();
      this.score += 20;
      this.scoreText.setText(`SCORE: ${this.score}`);
      sound.playBounce();
      sound.vibrate(12);
      this.cameras.main.flash(40, 255, 255, 255, false);

      if (this.bricks.countActive() === 0) {
        sound.playClear();
        this.messageText.setText('STAGE CLEAR! 터치하여 재시작');
        this.messageText.setVisible(true);
        this.ball.setVelocity(0, 0);
        this.ballLaunched = false;
      }
    });

    // 키보드 지원
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.on('keydown-SPACE', () => {
        if (!this.ballLaunched) this.launchBall();
      });
      this.input.keyboard.on('keydown-R', () => this.scene.restart());
    }

    // 모바일 터치 드래그 패들 이동 및 탭 발사
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.paddle.x = Phaser.Math.Clamp(pointer.x, 50, width - 50);
      if (!this.ballLaunched) {
        this.ball.x = this.paddle.x;
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.paddle.x = Phaser.Math.Clamp(pointer.x, 50, width - 50);
      if (!this.ballLaunched) {
        if (this.lives <= 0 || this.bricks.countActive() === 0) {
          this.scene.restart();
        } else {
          this.launchBall();
        }
      }
    });

    // HUD
    this.scoreText = this.add.text(18, 16, 'SCORE: 0', {
      fontFamily: 'monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffe600',
      backgroundColor: 'rgba(7, 9, 14, 0.85)',
      padding: { x: 8, y: 5 },
    }).setDepth(100);

    this.livesText = this.add.text(width - 18, 16, 'BALLS: ●●●', {
      fontFamily: 'monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: 'rgba(7, 9, 14, 0.85)',
      padding: { x: 8, y: 5 },
    }).setOrigin(1, 0).setDepth(100);

    this.messageText = this.add.text(width / 2, height / 2 + 50, '👆 화면을 탭하여 공 발사!', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(100);
  }

  private generateBricks(width: number) {
    const keys = ['brick_lime', 'brick_cyan', 'brick_magenta', 'brick_purple'];
    const rows = 6;
    const cols = 5;
    const brickWidth = 74;
    const startX = (width - cols * brickWidth) / 2 + brickWidth / 2;
    const startY = 80;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * brickWidth;
        const y = startY + r * 30;
        this.bricks.create(x, y, keys[r % keys.length]);
      }
    }
  }

  private launchBall() {
    this.ballLaunched = true;
    this.messageText.setVisible(false);
    sound.playJump();
    this.ball.setVelocity(Phaser.Math.Between(-140, 140), -450);
  }

  private resetBall() {
    this.ballLaunched = false;
    this.ball.setVelocity(0, 0);
    this.ball.setPosition(this.paddle.x, this.scale.height - 95);
    this.messageText.setText('👆 화면을 탭하여 공 발사!');
    this.messageText.setVisible(true);
  }

  update() {
    const { width, height } = this.scale;

    // 키보드 조작 보조
    if (this.cursors?.left?.isDown) {
      this.paddle.x = Math.max(50, this.paddle.x - 9);
      if (!this.ballLaunched) this.ball.x = this.paddle.x;
    } else if (this.cursors?.right?.isDown) {
      this.paddle.x = Math.min(width - 50, this.paddle.x + 9);
      if (!this.ballLaunched) this.ball.x = this.paddle.x;
    }

    // 공 탈락
    if (this.ball.y > height + 20) {
      this.lives -= 1;
      sound.playExplode();
      sound.vibrate(50);
      this.livesText.setText(`BALLS: ${'●'.repeat(Math.max(0, this.lives))}`);
      if (this.lives > 0) {
        this.resetBall();
      } else {
        this.messageText.setText('GAME OVER! 탭하여 재도전');
        this.messageText.setVisible(true);
      }
    }
  }
}
