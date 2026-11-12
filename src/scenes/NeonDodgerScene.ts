import Phaser from 'phaser';

export class NeonDodgerScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private projectiles!: Phaser.Physics.Arcade.Group;
  private energyCores!: Phaser.Physics.Arcade.Group;
  private scoreText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private gameOverContainer!: Phaser.GameObjects.Container;

  private score: number = 0;
  private hp: number = 3;
  private isGameOver: boolean = false;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private coreTimer?: Phaser.Time.TimerEvent;
  private scoreTimer?: Phaser.Time.TimerEvent;
  private isPointerDown: boolean = false;
  private pointerTarget: Phaser.Math.Vector2 | null = null;

  constructor() {
    super({ key: 'NeonDodgerScene' });
  }

  preload() {
    // 1. 플레이어 텍스처 (마젠타/네온 퍼플)
    if (!this.textures.exists('dodger_player')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0xff007f, 0.3);
      gfx.fillCircle(24, 24, 24);
      gfx.fillStyle(0xff007f, 1);
      gfx.fillCircle(24, 24, 16);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(24, 24, 7);
      gfx.generateTexture('dodger_player', 48, 48);
      gfx.destroy();
    }

    // 2. 투사체 탄막 텍스처 (네온 옐로우/오렌지)
    if (!this.textures.exists('neon_bullet')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0xffaa00, 0.4);
      gfx.fillCircle(12, 12, 12);
      gfx.fillStyle(0xffdd00, 1);
      gfx.fillCircle(12, 12, 7);
      gfx.generateTexture('neon_bullet', 24, 24);
      gfx.destroy();
    }

    // 3. 수집용 에너지 코어 텍스처 (네온 에메랄드)
    if (!this.textures.exists('energy_core')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00ffaa, 0.4);
      gfx.fillCircle(16, 16, 16);
      gfx.fillStyle(0x00ffaa, 1);
      gfx.fillCircle(16, 16, 10);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(16, 16, 4);
      gfx.generateTexture('energy_core', 32, 32);
      gfx.destroy();
    }
  }

  create() {
    const { width, height } = this.scale;
    this.score = 0;
    this.hp = 3;
    this.isGameOver = false;

    // 배경 그리드
    this.createBackground(width, height);

    // 플레이어 생성
    this.player = this.physics.add.sprite(width / 2, height / 2, 'dodger_player');
    this.player.setCollideWorldBounds(true);
    this.player.setCircle(16, 8, 8);
    this.player.setDrag(0.002);

    // 그룹 생성
    this.projectiles = this.physics.add.group();
    this.energyCores = this.physics.add.group();

    // 탄막 충돌
    this.physics.add.overlap(this.player, this.projectiles, (_, bullet) => {
      bullet.destroy();
      this.takeDamage();
    });

    // 코어 수집 충돌
    this.physics.add.overlap(this.player, this.energyCores, (_, core) => {
      core.destroy();
      this.collectCore();
    });

    // 입력 설정
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      // 재시작 단축키 R
      this.input.keyboard.on('keydown-R', () => {
        if (this.isGameOver) {
          this.scene.restart();
        }
      });
    }

    // 마우스/터치
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isPointerDown = true;
      this.pointerTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPointerDown) {
        this.pointerTarget = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      }
    });
    this.input.on('pointerup', () => {
      this.isPointerDown = false;
      this.pointerTarget = null;
    });

    // HUD
    this.scoreText = this.add.text(24, 24, 'SCORE: 0', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#00ffaa',
      backgroundColor: 'rgba(10, 14, 23, 0.8)',
      padding: { x: 12, y: 6 },
    });

    this.hpText = this.add.text(200, 24, 'SHIELD: ❤❤❤', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ff007f',
      backgroundColor: 'rgba(10, 14, 23, 0.8)',
      padding: { x: 12, y: 6 },
    });

    // 스폰 타이머 (탄막)
    this.spawnTimer = this.time.addEvent({
      delay: 350,
      callback: () => this.spawnBullet(width, height),
      loop: true,
    });

    // 코어 스폰 타이머
    this.coreTimer = this.time.addEvent({
      delay: 2500,
      callback: () => this.spawnCore(width, height),
      loop: true,
    });

    // 생존 점수 타이머
    this.scoreTimer = this.time.addEvent({
      delay: 100,
      callback: () => {
        if (!this.isGameOver) {
          this.score += 1;
          this.scoreText.setText(`SCORE: ${this.score}`);
        }
      },
      loop: true,
    });

    // 게임 오버 UI 컨테이너
    this.createGameOverUI(width, height);
  }

  private createBackground(width: number, height: number) {
    const gfx = this.add.graphics();
    gfx.lineStyle(1, 0x1f1633, 0.8);
    for (let x = 0; x <= width; x += 40) {
      gfx.moveTo(x, 0);
      gfx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += 40) {
      gfx.moveTo(0, y);
      gfx.lineTo(width, y);
    }
    gfx.strokePath();
  }

  private spawnBullet(width: number, height: number) {
    if (this.isGameOver) return;

    // 화면 테두리 사방 중 한 곳에서 생성
    const side = Phaser.Math.Between(0, 3);
    let startX = 0;
    let startY = 0;

    if (side === 0) { // Top
      startX = Phaser.Math.Between(0, width);
      startY = -20;
    } else if (side === 1) { // Right
      startX = width + 20;
      startY = Phaser.Math.Between(0, height);
    } else if (side === 2) { // Bottom
      startX = Phaser.Math.Between(0, width);
      startY = height + 20;
    } else { // Left
      startX = -20;
      startY = Phaser.Math.Between(0, height);
    }

    const bullet = this.projectiles.create(startX, startY, 'neon_bullet') as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    if (!bullet) return;

    bullet.setCircle(7, 5, 5);

    // 플레이어를 향해 약간의 오차를 두고 발사
    const targetX = this.player.x + Phaser.Math.Between(-80, 80);
    const targetY = this.player.y + Phaser.Math.Between(-80, 80);
    const angle = Phaser.Math.Angle.Between(startX, startY, targetX, targetY);
    const speed = Phaser.Math.Between(220, 380) + Math.min(this.score * 0.1, 200);

    bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    // 화면 밖으로 나가면 삭제
    this.time.delayedCall(6000, () => {
      if (bullet.active) bullet.destroy();
    });
  }

  private spawnCore(width: number, height: number) {
    if (this.isGameOver) return;
    const x = Phaser.Math.Between(60, width - 60);
    const y = Phaser.Math.Between(60, height - 60);
    const core = this.energyCores.create(x, y, 'energy_core') as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    if (!core) return;
    core.setCircle(10, 6, 6);

    // 펄스 애니메이션
    this.tweens.add({
      targets: core,
      scale: 1.25,
      yoyo: true,
      repeat: -1,
      duration: 600,
    });

    // 10초 후 미획득 시 자동 소멸
    this.time.delayedCall(10000, () => {
      if (core.active) core.destroy();
    });
  }

  private collectCore() {
    this.score += 50;
    this.scoreText.setText(`SCORE: ${this.score}`);
    this.cameras.main.flash(120, 0, 255, 170, true);
  }

  private takeDamage() {
    if (this.isGameOver) return;
    this.hp -= 1;
    this.cameras.main.shake(150, 0.015);
    this.hpText.setText(`SHIELD: ${'❤'.repeat(Math.max(0, this.hp))}`);

    if (this.hp <= 0) {
      this.handleGameOver();
    }
  }

  private handleGameOver() {
    this.isGameOver = true;
    this.player.setVelocity(0, 0);
    this.projectiles.setVelocity(0, 0);
    this.spawnTimer?.remove();
    this.coreTimer?.remove();
    this.scoreTimer?.remove();

    this.gameOverContainer.setVisible(true);
    const finalScoreText = this.gameOverContainer.getAt(1) as Phaser.GameObjects.Text;
    finalScoreText.setText(`FINAL SCORE: ${this.score}`);
  }

  private createGameOverUI(width: number, height: number) {
    const bg = this.add.rectangle(0, 0, 480, 240, 0x090d16, 0.92);
    bg.setStrokeStyle(2, 0xff007f);

    const title = this.add.text(0, -60, 'SURVIVAL FAILED', {
      fontFamily: 'monospace',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ff007f',
    }).setOrigin(0.5);

    const score = this.add.text(0, -10, 'FINAL SCORE: 0', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const restartBtn = this.add.text(0, 45, '🔄 Press R or Click to Restart', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#00ffaa',
      backgroundColor: 'rgba(0, 255, 170, 0.15)',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerdown', () => {
      this.scene.restart();
    });

    this.gameOverContainer = this.add.container(width / 2, height / 2, [bg, score, title, restartBtn]);
    this.gameOverContainer.setVisible(false);
  }

  update() {
    if (this.isGameOver) return;

    let moveX = 0;
    let moveY = 0;
    const speed = 360;

    const left = this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown;
    const right = this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown;
    const up = this.cursors?.up?.isDown || this.wasdKeys?.W?.isDown;
    const down = this.cursors?.down?.isDown || this.wasdKeys?.S?.isDown;

    if (left) moveX -= 1;
    if (right) moveX += 1;
    if (up) moveY -= 1;
    if (down) moveY += 1;

    if (moveX === 0 && moveY === 0 && this.isPointerDown && this.pointerTarget) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.pointerTarget.x, this.pointerTarget.y);
      if (distance > 15) {
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.pointerTarget.x, this.pointerTarget.y);
        moveX = Math.cos(angle);
        moveY = Math.sin(angle);
      }
    }

    if (moveX !== 0 || moveY !== 0) {
      const moveVec = new Phaser.Math.Vector2(moveX, moveY).normalize();
      this.player.setVelocity(moveVec.x * speed, moveVec.y * speed);
    } else {
      this.player.setVelocity(0, 0);
    }
  }
}
