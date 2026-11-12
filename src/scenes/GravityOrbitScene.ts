import Phaser from 'phaser';
import { sound } from '../utils/audio';

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

  // Mobile on-screen touch control flags
  private touchTurnLeft: boolean = false;
  private touchTurnRight: boolean = false;
  private touchThrust: boolean = false;

  constructor() {
    super({ key: 'GravityOrbitScene' });
  }

  preload() {
    // 1. 우주선 텍스처
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
    this.corePoint = new Phaser.Math.Vector2(width / 2, height / 2 - 40);
    this.fuel = 100;
    this.minedCrystals = 0;

    // 배경 별빛 생성
    this.createStarfield(width, height);

    // 중앙 중력 코어 시각화
    const coreGlow = this.add.circle(this.corePoint.x, this.corePoint.y, 42, 0x4a9eff, 0.25);
    const coreBody = this.add.circle(this.corePoint.x, this.corePoint.y, 22, 0x0066ff, 0.85);
    this.tweens.add({
      targets: [coreGlow, coreBody],
      scale: 1.15,
      yoyo: true,
      repeat: -1,
      duration: 1000,
    });

    // 플레이어 우주선
    this.ship = this.physics.add.sprite(this.corePoint.x, this.corePoint.y - 180, 'gravity_ship');
    this.ship.setCollideWorldBounds(true);
    this.ship.setDamping(true);
    this.ship.setDrag(0.985);
    this.ship.setAngularDrag(250);
    this.ship.setMaxVelocity(350);
    this.ship.setVelocity(140, 0);

    // 소행성 및 크리스탈 그룹
    this.asteroids = this.physics.add.group();
    this.crystals = this.physics.add.group();

    for (let i = 0; i < 6; i++) {
      this.spawnAsteroid(width, height);
    }

    for (let i = 0; i < 5; i++) {
      this.spawnCrystal(width, height);
    }

    // 소행성 충돌
    this.physics.add.collider(this.ship, this.asteroids, () => {
      this.fuel = Math.max(0, this.fuel - 15);
      sound.playHit();
      sound.vibrate(30);
      this.cameras.main.shake(120, 0.012);
    });

    // 크리스탈 채굴 충돌
    this.physics.add.overlap(this.ship, this.crystals, (_, crystal) => {
      crystal.destroy();
      this.minedCrystals += 1;
      this.fuel = Math.min(100, this.fuel + 25);
      sound.playScore(1.4);
      sound.vibrate(25);
      this.cameras.main.flash(80, 255, 0, 225, false);
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

    // 모바일 온스크린 버튼 생성 (하단 좌측: ◀ ▶ / 하단 우측: 🚀 분사)
    this.createMobileButtons(width, height);

    // UI
    this.fuelBar = this.add.graphics().setDepth(100);
    this.infoText = this.add.text(16, 16, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#00ffcc',
      backgroundColor: 'rgba(7, 9, 14, 0.85)',
      padding: { x: 10, y: 6 },
    }).setDepth(100);
  }

  private createMobileButtons(width: number, height: number) {
    const btnY = height - 60;

    // 좌회전 ◀
    const btnLeft = this.add.circle(55, btnY, 32, 0x1e293b, 0.6).setStrokeStyle(2, 0x00f0ff, 0.8).setDepth(150);
    const txtLeft = this.add.text(55, btnY, '◀', { fontSize: '18px', color: '#fff' }).setOrigin(0.5).setDepth(151);

    btnLeft.setInteractive();
    btnLeft.on('pointerdown', () => { this.touchTurnLeft = true; sound.playTap(); });
    btnLeft.on('pointerup', () => { this.touchTurnLeft = false; });
    btnLeft.on('pointerout', () => { this.touchTurnLeft = false; });

    // 우회전 ▶
    const btnRight = this.add.circle(135, btnY, 32, 0x1e293b, 0.6).setStrokeStyle(2, 0x00f0ff, 0.8).setDepth(150);
    const txtRight = this.add.text(135, btnY, '▶', { fontSize: '18px', color: '#fff' }).setOrigin(0.5).setDepth(151);

    btnRight.setInteractive();
    btnRight.on('pointerdown', () => { this.touchTurnRight = true; sound.playTap(); });
    btnRight.on('pointerup', () => { this.touchTurnRight = false; });
    btnRight.on('pointerout', () => { this.touchTurnRight = false; });

    // 스러스터 분사 🚀
    const btnThrust = this.add.circle(width - 65, btnY, 38, 0x00ffcc, 0.4).setStrokeStyle(2, 0xffffff, 0.9).setDepth(150);
    const txtThrust = this.add.text(width - 65, btnY, '🚀 분사', { fontFamily: 'Inter, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5).setDepth(151);

    btnThrust.setInteractive();
    btnThrust.on('pointerdown', () => { this.touchThrust = true; sound.playJump(); });
    btnThrust.on('pointerup', () => { this.touchThrust = false; });
    btnThrust.on('pointerout', () => { this.touchThrust = false; });
  }

  private createStarfield(width: number, height: number) {
    const starGfx = this.add.graphics();
    starGfx.fillStyle(0xffffff, 0.8);
    for (let i = 0; i < 90; i++) {
      const sx = Phaser.Math.Between(0, width);
      const sy = Phaser.Math.Between(0, height);
      const radius = Phaser.Math.FloatBetween(0.6, 2.0);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.9);
      starGfx.fillStyle(0xffffff, alpha);
      starGfx.fillCircle(sx, sy, radius);
    }
  }

  private spawnAsteroid(width: number, height: number) {
    const x = Phaser.Math.Between(40, width - 40);
    const y = Phaser.Math.Between(40, height - 120);
    if (Phaser.Math.Distance.Between(x, y, this.corePoint.x, this.corePoint.y) < 80) return;

    const ast = this.asteroids.create(x, y, 'asteroid') as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    if (!ast) return;
    ast.setCircle(14, 2, 2);
    ast.setBounce(1, 1);
    ast.setCollideWorldBounds(true);
    ast.setVelocity(Phaser.Math.Between(-50, 50), Phaser.Math.Between(-50, 50));
  }

  private spawnCrystal(width: number, height: number) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.Between(80, Math.min(width, height) / 2 - 20);
    const x = this.corePoint.x + Math.cos(angle) * dist;
    const y = this.corePoint.y + Math.sin(angle) * dist;

    const crystal = this.crystals.create(x, y, 'space_crystal') as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    if (!crystal) return;
    crystal.setCircle(10, 2, 2);
  }

  update() {
    // 1. 중앙 중력장 가속도 계산
    const distToCore = Phaser.Math.Distance.Between(
      this.ship.x,
      this.ship.y,
      this.corePoint.x,
      this.corePoint.y
    );
    const gravityStrength = Math.min(180, 7000 / Math.max(distToCore, 40));
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

    // 2. 조작 (모바일 온스크린 버튼 or 키보드)
    const turnLeft = this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown || this.touchTurnLeft;
    const turnRight = this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown || this.touchTurnRight;
    const thrust = this.cursors?.up?.isDown || this.wasdKeys?.W?.isDown || this.touchThrust;

    if (turnLeft) {
      this.ship.setAngularVelocity(-220);
    } else if (turnRight) {
      this.ship.setAngularVelocity(220);
    } else {
      this.ship.setAngularVelocity(0);
    }

    if (thrust && this.fuel > 0) {
      this.fuel = Math.max(0, this.fuel - 0.12);
      const rad = Phaser.Math.DegToRad(this.ship.angle);
      const thrustPower = 280;
      this.ship.body.velocity.x += Math.cos(rad) * thrustPower * (1 / 60);
      this.ship.body.velocity.y += Math.sin(rad) * thrustPower * (1 / 60);
    }

    // HUD 업데이트
    const speed = Math.round(this.ship.body.velocity.length());
    this.infoText.setText([
      `CRYSTALS: ${this.minedCrystals}  |  SPEED: ${speed}`,
      `FUEL: ${Math.round(this.fuel)}%`,
    ]);

    // 연료 게이지 바
    this.fuelBar.clear();
    this.fuelBar.fillStyle(0x1a2333, 0.85);
    this.fuelBar.fillRoundedRect(16, 68, 140, 8, 4);

    const fuelColor = this.fuel > 40 ? 0x00ffcc : (this.fuel > 15 ? 0xffbb00 : 0xff3355);
    this.fuelBar.fillStyle(fuelColor, 1);
    this.fuelBar.fillRoundedRect(16, 68, (this.fuel / 100) * 140, 8, 4);
  }
}
