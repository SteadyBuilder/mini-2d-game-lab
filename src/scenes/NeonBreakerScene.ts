import Phaser from 'phaser';

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
      gfx.fillRoundedRect(0, 0, 120, 18, 9);
      gfx.fillStyle(0xffffff, 0.8);
      gfx.fillRoundedRect(10, 4, 100, 4, 2);
      gfx.generateTexture('breaker_paddle', 120, 18);
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

    // 3. 브릭 텍스처 3종 (색상별)
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
        gfx.fillRoundedRect(0, 0, 72, 24, 4);
        gfx.lineStyle(1.5, 0xffffff, 0.6);
        gfx.strokeRoundedRect(0, 0, 72, 24, 4);
        gfx.generateTexture(key, 72, 24);
        gfx.destroy();
      }
    });
  }

  create() {
    const { width, height } = this.scale;
    this.score = 0;
    this.lives = 3;
    this.ballLaunched = false;

    // 패들
    this.paddle = this.physics.add.sprite(width / 2, height - 60, 'breaker_paddle');
    this.paddle.setCollideWorldBounds(true);
    this.paddle.setImmovable(true);

    // 공
    this.ball = this.physics.add.sprite(width / 2, height - 85, 'breaker_ball');
    this.ball.setCollideWorldBounds(true);
    this.ball.setBounce(1, 1);
    this.ball.setCircle(9, 1, 1);

    // 벽돌 그룹
    this.bricks = this.physics.add.staticGroup();
    this.generateBricks(width);

    // 충돌
    this.physics.add.collider(this.ball, this.paddle, () => {
      // 패들의 맞은 위치에 따른 반사각 계산
      const diff = this.ball.x - this.paddle.x;
      this.ball.setVelocityX(diff * 7);
      this.cameras.main.shake(60, 0.005);
    });

    this.physics.add.collider(this.ball, this.bricks, (_, brick) => {
      brick.destroy();
      this.score += 20;
      this.scoreText.setText(`SCORE: ${this.score}`);
      this.cameras.main.flash(50, 255, 255, 255, true);

      if (this.bricks.countActive() === 0) {
        this.messageText.setText('STAGE CLEAR! Press SPACE to restart');
        this.messageText.setVisible(true);
        this.ball.setVelocity(0, 0);
        this.ballLaunched = false;
      }
    });

    // 입력
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.on('keydown-SPACE', () => {
        if (!this.ballLaunched) {
          this.launchBall();
        }
      });
      this.input.keyboard.on('keydown-R', () => {
        this.scene.restart();
      });
    }

    // 마우스 패들 추적 및 클릭 발사
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.paddle.x = Phaser.Math.Clamp(pointer.worldX, 60, width - 60);
      if (!this.ballLaunched) {
        this.ball.x = this.paddle.x;
      }
    });

    this.input.on('pointerdown', () => {
      if (!this.ballLaunched) {
        this.launchBall();
      }
    });

    // HUD
    this.scoreText = this.add.text(24, 20, 'SCORE: 0', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffe600',
      backgroundColor: 'rgba(10, 15, 25, 0.8)',
      padding: { x: 12, y: 6 },
    });

    this.livesText = this.add.text(220, 20, 'BALLS: ●●●', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#00f0ff',
      backgroundColor: 'rgba(10, 15, 25, 0.8)',
      padding: { x: 12, y: 6 },
    });

    this.messageText = this.add.text(width / 2, height / 2 + 60, 'CLICK OR SPACE TO LAUNCH', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5);
  }

  private generateBricks(width: number) {
    const keys = ['brick_lime', 'brick_cyan', 'brick_magenta', 'brick_purple'];
    const rows = 4;
    const cols = 12;
    const startX = (width - (cols * 82)) / 2 + 40;
    const startY = 90;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * 82;
        const y = startY + r * 34;
        this.bricks.create(x, y, keys[r % keys.length]);
      }
    }
  }

  private launchBall() {
    this.ballLaunched = true;
    this.messageText.setVisible(false);
    this.ball.setVelocity(Phaser.Math.Between(-150, 150), -420);
  }

  private resetBall() {
    this.ballLaunched = false;
    this.ball.setVelocity(0, 0);
    this.ball.setPosition(this.paddle.x, this.scale.height - 85);
    this.messageText.setText('CLICK OR SPACE TO LAUNCH');
    this.messageText.setVisible(true);
  }

  update() {
    const { width, height } = this.scale;

    // 키보드 패들 조작
    if (this.cursors?.left?.isDown) {
      this.paddle.x = Math.max(60, this.paddle.x - 9);
      if (!this.ballLaunched) this.ball.x = this.paddle.x;
    } else if (this.cursors?.right?.isDown) {
      this.paddle.x = Math.min(width - 60, this.paddle.x + 9);
      if (!this.ballLaunched) this.ball.x = this.paddle.x;
    }

    // 공이 바닥으로 떨어진 경우
    if (this.ball.y > height) {
      this.lives -= 1;
      this.livesText.setText(`BALLS: ${'●'.repeat(Math.max(0, this.lives))}`);
      if (this.lives > 0) {
        this.resetBall();
      } else {
        this.messageText.setText('GAME OVER! Press R to Retry');
        this.messageText.setVisible(true);
      }
    }
  }
}
