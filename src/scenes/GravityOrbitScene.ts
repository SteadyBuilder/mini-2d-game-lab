import Phaser from 'phaser';

export class GravityOrbitScene extends Phaser.Scene {
  private ship!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private asteroids!: Phaser.Physics.Arcade.Group;
  private crystals!: Phaser.Physics.Arcade.Group;
  private fuel: number = 100;
  private minedCrystals: number = 0;
  private fuelBar!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private corePoint!: Phaser.Math.Vector2;
  private isThrusting: boolean = false;

  constructor() {
    super({ key: 'GravityOrbitScene' });
  }

  preload() {
    // 1. 우주선 텍스처 (삼각형 네온 형태)
    if (!this.textures.exists('gravity_ship')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00ffcc, 1);
      gfx.beginPath();
      gfx.moveTo(32, 16);
      gfx.lineTo(8, 6);
      gfx.lineTo(14, 16);
      gfx.lineTo(8, 26);
      gfx.closePath();
      gfx.fillPath();

      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(18, 16, 3);

      gfx.generateTexture('gravity_ship', 36, 32);
      gfx.destroy();
    }

    // 2. 소행성 텍스처
    if (!this.textures.exists('asteroid')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x8a99ad, 0.9);
      gfx.fillCircle(16, 16, 14);
      gfx.fillStyle(0x566270, 0.7);
      gfx.fillCircle(13, 13, 5);
      gfx.fillCircle(20, 18, 4);
      gfx.generateTexture('asteroid', 32, 32);
      gfx.destroy();
    }

    // 3. 우주 크리스탈
    if (!this.textures.exists('space_crystal')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0xff00e1, 1);
      gfx.fillCircle(12, 12, 8);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(12, 12, 3);
      gfx.generateTexture('space_crystal', 24, 24);
      gfx.destroy();
    }
  }

  create() {
    const { width, height } = this.scale;
    this.corePoint = new Phaser.Math.Vector2(width / 2, height / 2);
    this.fuel = 100;
    this.minedCrystals = 0;

    // 배경 별빛 생성
    this.createStarfield(width, height);

    // 중앙 중력 코어 시각화
    const coreGlow = this.add.circle(this.corePoint.x, this.corePoint.y, 42, 0x4a9eff, 0.25);
    const coreBody = this.add.circle(this.corePoint.x, this.corePoint.y, 24, 0x0066ff, 0.85);
    this.tweens.add({
      targets: [coreGlow, coreBody],
      scale: 1.15,
      yoyo: true,
      repeat: -1,
      duration: 1000,
    });

    // 플레이어 우주선 (물리 속성: 우주 관성)
    this.ship = this.physics.add.sprite(this.corePoint.x, this.corePoint.y - 200, 'gravity_ship');
    this.ship.setCollideWorldBounds(true);
    this.ship.setDamping(true);
    this.ship.setDrag(0.985); // 우주 감속 (매우 작음)
    this.ship.setAngularDrag(250);
    this.ship.setMaxVelocity(350);
    this.ship.setVelocity(140, 0); // 초기 궤도 속도

    // 소행성 및 크리스탈 그룹
    this.asteroids = this.physics.add.group();
    this.crystals = this.physics.add.group();

    for (let i = 0; i < 7; i++) {
      this.spawnAsteroid(width, height);
    }

    for (let i = 0; i < 5; i++) {
      this.spawnCrystal(width, height);
    }

    // 소행성 충돌
    this.physics.add.collider(this.ship, this.asteroids, () => {
      this.fuel = Math.max(0, this.fuel - 15);
      this.cameras.main.shake(120, 0.012);
    });

    // 크리스탈 채굴 충돌
    this.physics.add.overlap(this.ship, this.crystals, (_, crystal) => {
      crystal.destroy();
      this.minedCrystals += 1;
      this.fuel = Math.min(100, this.fuel + 25);
      this.cameras.main.flash(100, 255, 0, 225, true);
      this.time.delayedCall(3000, () => this.spawnCrystal(width, height));
    });

    // 조작키
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.input.keyboard.on('keydown-R', () => {
        this.scene.restart();
      });
    }

    // UI
    this.fuelBar = this.add.graphics();
    this.infoText = this.add.text(24, 24, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#00ffcc',
      backgroundColor: 'rgba(10, 15, 25, 0.85)',
      padding: { x: 14, y: 8 },
    });
  }

  private createStarfield(width: number, height: number) {
    const starGfx = this.add.graphics();
    starGfx.fillStyle(0xffffff, 0.8);
    for (let i = 0; i < 120; i++) {
      const sx = Phaser.Math.Between(0, width);
      const sy = Phaser.Math.Between(0, height);
      const radius = Phaser.Math.FloatBetween(0.6, 2.2);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.9);
      starGfx.fillStyle(0xffffff, alpha);
      starGfx.fillCircle(sx, sy, radius);
    }
  }

  private spawnAsteroid(width: number, height: number) {
    const x = Phaser.Math.Between(50, width - 50);
    const y = Phaser.Math.Between(50, height - 50);
    // 중앙 코어 근처는 피해서 스폰
    if (Phaser.Math.Distance.Between(x, y, this.corePoint.x, this.corePoint.y) < 90) return;

    const ast = this.asteroids.create(x, y, 'asteroid') as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    if (!ast) return;
    ast.setCircle(14, 2, 2);
    ast.setBounce(1, 1);
    ast.setCollideWorldBounds(true);
    ast.setVelocity(Phaser.Math.Between(-60, 60), Phaser.Math.Between(-60, 60));
  }

  private spawnCrystal(width: number, height: number) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.Between(100, Math.min(width, height) / 2 - 40);
    const x = this.corePoint.x + Math.cos(angle) * dist;
    const y = this.corePoint.y + Math.sin(angle) * dist;

    const crystal = this.crystals.create(x, y, 'space_crystal') as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    if (!crystal) return;
    crystal.setCircle(10, 2, 2);
  }

  update() {
    // 1. 중앙 중력장 가속도 계산 (중력 코어 인력)
    const distToCore = Phaser.Math.Distance.Between(
      this.ship.x,
      this.ship.y,
      this.corePoint.x,
      this.corePoint.y
    );
    const gravityStrength = Math.min(180, 8000 / Math.max(distToCore, 40));
    const gravityAngle = Phaser.Math.Angle.Between(
      this.ship.x,
      this.ship.y,
      this.corePoint.x,
      this.corePoint.y
    );

    const gravAx = Math.cos(gravityAngle) * gravityStrength;
    const gravAy = Math.sin(gravityAngle) * gravityStrength;
    this.ship.body.velocity.x += gravAx * (1 / 60);
    this.ship.body.velocity.y += gravAy * (1 / 60);

    // 2. 조작 (회전 및 스러스트)
    const turnLeft = this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown;
    const turnRight = this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown;
    const thrust = this.cursors?.up?.isDown || this.wasdKeys?.W?.isDown;

    if (turnLeft) {
      this.ship.setAngularVelocity(-220);
    } else if (turnRight) {
      this.ship.setAngularVelocity(220);
    } else {
      this.ship.setAngularVelocity(0);
    }

    if (thrust && this.fuel > 0) {
      this.isThrusting = true;
      this.fuel = Math.max(0, this.fuel - 0.12);
      const rad = Phaser.Math.DegToRad(this.ship.angle);
      const thrustPower = 280;
      this.ship.body.velocity.x += Math.cos(rad) * thrustPower * (1 / 60);
      this.ship.body.velocity.y += Math.sin(rad) * thrustPower * (1 / 60);
    } else {
      this.isThrusting = false;
    }

    // 마우스 누르고 있을 시 해당 방향으로 기수 회전 및 추진
    if (this.input.activePointer.isDown && this.fuel > 0) {
      const targetAngle = Phaser.Math.Angle.Between(
        this.ship.x,
        this.ship.y,
        this.input.activePointer.worldX,
        this.input.activePointer.worldY
      );
      this.ship.rotation = Phaser.Math.Angle.RotateTo(this.ship.rotation, targetAngle, 0.08);
      this.fuel = Math.max(0, this.fuel - 0.08);
      const thrustPower = 220;
      this.ship.body.velocity.x += Math.cos(this.ship.rotation) * thrustPower * (1 / 60);
      this.ship.body.velocity.y += Math.sin(this.ship.rotation) * thrustPower * (1 / 60);
    }

    // HUD 업데이트
    const speed = Math.round(this.ship.body.velocity.length());
    this.infoText.setText([
      `ENERGY CRYSTALS: ${this.minedCrystals}`,
      `THRUST SPEED: ${speed} AU`,
      `CORE DISTANCE: ${Math.round(distToCore)} km`,
      `FUEL: ${Math.round(this.fuel)}%`,
    ]);

    // 연료 게이지 바 그리기
    this.fuelBar.clear();
    this.fuelBar.fillStyle(0x1a2333, 0.85);
    this.fuelBar.fillRoundedRect(24, 110, 180, 10, 4);

    const fuelColor = this.fuel > 40 ? 0x00ffcc : (this.fuel > 15 ? 0xffbb00 : 0xff3355);
    this.fuelBar.fillStyle(fuelColor, 1);
    this.fuelBar.fillRoundedRect(24, 110, (this.fuel / 100) * 180, 10, 4);
  }
}
