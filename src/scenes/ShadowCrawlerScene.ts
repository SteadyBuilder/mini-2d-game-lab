import Phaser from 'phaser';
import { sound } from '../utils/audio';
import { VirtualJoystick } from '../utils/mobileControls';

interface Drone {
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  path: Phaser.Math.Vector2[];
  currentPointIndex: number;
  coneGraphics: Phaser.GameObjects.Graphics;
  speed: number;
}

export class ShadowCrawlerScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private joystick!: VirtualJoystick;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private terminals!: Phaser.Physics.Arcade.StaticGroup;
  private exitPad!: Phaser.GameObjects.Rectangle;
  private drones: Drone[] = [];
  private flashlightGfx!: Phaser.GameObjects.Graphics;

  private hackedCount: number = 0;
  private readonly TOTAL_TERMINALS = 3;
  private isGameOver: boolean = false;
  private isEscaped: boolean = false;
  private statusText!: Phaser.GameObjects.Text;
  private gameOverContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'ShadowCrawlerScene' });
  }

  preload() {
    // 1. Agent Texture
    if (!this.textures.exists('stealth_agent')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillCircle(16, 16, 14);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(22, 16, 4); // eye visor
      gfx.generateTexture('stealth_agent', 32, 32);
      gfx.destroy();
    }

    // 2. Drone Texture
    if (!this.textures.exists('security_drone')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0xff0055, 1);
      gfx.fillCircle(16, 16, 12);
      gfx.fillStyle(0xffffff, 0.8);
      gfx.fillCircle(16, 16, 5);
      gfx.generateTexture('security_drone', 32, 32);
      gfx.destroy();
    }

    // 3. Terminal Texture
    if (!this.textures.exists('hack_terminal')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00ff88, 1);
      gfx.fillRoundedRect(0, 0, 28, 28, 6);
      gfx.fillStyle(0x07090e, 1);
      gfx.fillRect(6, 6, 16, 16);
      gfx.fillStyle(0x00ff88, 1);
      gfx.fillRect(10, 10, 8, 8);
      gfx.generateTexture('hack_terminal', 28, 28);
      gfx.destroy();
    }
  }

  create() {
    const { width, height } = this.scale;
    this.hackedCount = 0;
    this.isGameOver = false;
    this.isEscaped = false;
    this.drones = [];

    // Dark Floor Background
    this.createDungeonMap(width, height);

    // Flashlight overlay graphics
    this.flashlightGfx = this.add.graphics();
    this.flashlightGfx.setDepth(15);

    // Player Agent
    this.player = this.physics.add.sprite(width / 2, height - 100, 'stealth_agent');
    this.player.setCollideWorldBounds(true);
    this.player.setCircle(14, 2, 2);
    this.player.setDepth(20);

    // Terminals
    this.terminals = this.physics.add.staticGroup();
    const termPositions = [
      { x: 70, y: 150 },
      { x: width - 70, y: 280 },
      { x: 80, y: 440 },
    ];
    termPositions.forEach((pos) => {
      const term = this.terminals.create(pos.x, pos.y, 'hack_terminal');
      term.setDepth(10);
    });

    // Exit pad at top center (activates when all terminals hacked)
    this.exitPad = this.add.rectangle(width / 2, 60, 90, 40, 0x1e293b);
    this.exitPad.setStrokeStyle(2, 0x64748b);
    this.exitPad.setDepth(10);

    // Security Drones with patrol routes
    this.setupDrones(width, height);

    // Collisions / Overlaps
    this.physics.add.overlap(this.player, this.terminals, (_, terminal) => {
      terminal.destroy();
      this.hackedCount++;
      sound.playScore(1.4);
      sound.vibrate(40);
      this.cameras.main.flash(80, 0, 255, 136, false);
      this.updateStatus();

      if (this.hackedCount >= this.TOTAL_TERMINALS) {
        this.exitPad.setFillStyle(0x00f0ff);
        this.exitPad.setStrokeStyle(3, 0xffffff);
        sound.playClear();
      }
    });

    // Mobile Virtual Joystick (bottom left)
    this.joystick = new VirtualJoystick(this, {
      x: 75,
      y: height - 85,
      radius: 46,
      handleRadius: 22,
    });

    // Keyboard support
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.input.keyboard.on('keydown-R', () => this.scene.restart());
    }

    // Direct touch drag support (can touch and drag agent directly)
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && pointer.x > 150 && pointer.y < height - 120 && !this.isGameOver) {
        this.physics.moveToObject(this.player, pointer, 200);
      }
    });

    // HUD Text
    this.statusText = this.add.text(20, 20, 'HACK: 0 / 3  |  STATUS: UNNOTICED', {
      fontFamily: 'monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: 'rgba(7, 9, 14, 0.9)',
      padding: { x: 10, y: 6 },
    }).setDepth(100);

    this.createGameOverUI(width, height);
  }

  private setupDrones(width: number, _: number) {
    // Drone 1: Horizontal patrol near terminals
    this.createDrone([
      new Phaser.Math.Vector2(60, 220),
      new Phaser.Math.Vector2(width - 60, 220),
    ], 110);

    // Drone 2: Diagonal / Box patrol
    this.createDrone([
      new Phaser.Math.Vector2(width - 70, 360),
      new Phaser.Math.Vector2(70, 360),
    ], 130);

    // Drone 3: Exit guardian patrol
    this.createDrone([
      new Phaser.Math.Vector2(70, 100),
      new Phaser.Math.Vector2(width - 70, 100),
    ], 140);
  }

  private createDrone(points: Phaser.Math.Vector2[], speed: number) {
    const sprite = this.physics.add.sprite(points[0].x, points[0].y, 'security_drone');
    sprite.setCollideWorldBounds(true);
    sprite.setDepth(20);

    const coneGraphics = this.add.graphics();
    coneGraphics.setDepth(16);

    this.drones.push({
      sprite,
      path: points,
      currentPointIndex: 0,
      coneGraphics,
      speed,
    });
  }

  private updateStatus() {
    const isReady = this.hackedCount >= this.TOTAL_TERMINALS;
    this.statusText.setText(
      `HACK: ${this.hackedCount} / ${this.TOTAL_TERMINALS}  |  ${isReady ? '⚡ 탈출구 개방됨!' : '경비 드론 회피 중'}`
    );
  }

  update() {
    if (this.isGameOver || this.isEscaped) return;

    // Movement: Joystick or Keyboard
    let vx = 0;
    let vy = 0;
    const speed = 210;

    if (this.joystick.isDown) {
      vx = this.joystick.force.x * speed;
      vy = this.joystick.force.y * speed;
    } else if (this.cursors) {
      if (this.cursors.left.isDown) vx = -speed;
      else if (this.cursors.right.isDown) vx = speed;
      if (this.cursors.up.isDown) vy = -speed;
      else if (this.cursors.down.isDown) vy = speed;
    }

    this.player.setVelocity(vx, vy);

    // Rotate player towards velocity
    if (vx !== 0 || vy !== 0) {
      this.player.setRotation(Math.atan2(vy, vx));
    }

    // Check exit trigger
    if (this.hackedCount >= this.TOTAL_TERMINALS) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitPad.x, this.exitPad.y);
      if (dist < 40) {
        this.triggerVictory();
        return;
      }
    }

    // Flashlight beam render
    this.flashlightGfx.clear();
    const facingAngle = this.player.rotation;
    this.flashlightGfx.fillStyle(0x00f0ff, 0.12);
    this.flashlightGfx.beginPath();
    this.flashlightGfx.moveTo(this.player.x, this.player.y);
    this.flashlightGfx.arc(this.player.x, this.player.y, 140, facingAngle - 0.45, facingAngle + 0.45);
    this.flashlightGfx.closePath();
    this.flashlightGfx.fill();

    // Update Drones and searchlights
    this.updateDrones();
  }

  private updateDrones() {
    for (const drone of this.drones) {
      const target = drone.path[drone.currentPointIndex];
      const dist = Phaser.Math.Distance.Between(drone.sprite.x, drone.sprite.y, target.x, target.y);

      if (dist < 15) {
        drone.currentPointIndex = (drone.currentPointIndex + 1) % drone.path.length;
      } else {
        this.physics.moveTo(drone.sprite, target.x, target.y, drone.speed);
      }

      const angle = drone.sprite.body.velocity.angle();
      drone.sprite.setRotation(angle);

      // Draw searchlight cone
      drone.coneGraphics.clear();
      drone.coneGraphics.fillStyle(0xff0055, 0.22);
      drone.coneGraphics.beginPath();
      drone.coneGraphics.moveTo(drone.sprite.x, drone.sprite.y);
      drone.coneGraphics.arc(drone.sprite.x, drone.sprite.y, 110, angle - 0.4, angle + 0.4);
      drone.coneGraphics.closePath();
      drone.coneGraphics.fill();

      // Check detection: player inside search cone
      const distToPlayer = Phaser.Math.Distance.Between(drone.sprite.x, drone.sprite.y, this.player.x, this.player.y);
      if (distToPlayer < 110) {
        const angleToPlayer = Phaser.Math.Angle.Between(drone.sprite.x, drone.sprite.y, this.player.x, this.player.y);
        const diff = Phaser.Math.Angle.Wrap(angleToPlayer - angle);
        if (Math.abs(diff) < 0.4) {
          this.triggerCaught();
          return;
        }
      }
    }
  }

  private triggerCaught() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    sound.playExplode();
    this.cameras.main.shake(250, 0.02);
    this.player.setTint(0xff0055);
    this.physics.pause();

    this.showEndUI('침입 발각 (DETECTED)', '보안 드론에게 발각되었습니다!', false);
  }

  private triggerVictory() {
    if (this.isEscaped) return;
    this.isEscaped = true;
    sound.playClear();
    this.physics.pause();

    this.showEndUI('잠입 탈출 성공 (CLEAR!)', '모든 보안 터미널 해킹 후 무사 탈출!', true);
  }

  private showEndUI(title: string, desc: string, isWin: boolean) {
    this.gameOverContainer.setVisible(true);
    const titleObj = this.gameOverContainer.getByName('end_title') as Phaser.GameObjects.Text;
    const descObj = this.gameOverContainer.getByName('end_desc') as Phaser.GameObjects.Text;
    if (titleObj) {
      titleObj.setText(title);
      titleObj.setColor(isWin ? '#00ff88' : '#ff0055');
    }
    if (descObj) descObj.setText(desc);
  }

  private createDungeonMap(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillStyle(0x060911, 1);
    bg.fillRect(0, 0, width, height);

    // Grid Floor
    bg.lineStyle(1, 0x151f33, 0.6);
    for (let x = 0; x < width; x += 40) {
      bg.moveTo(x, 0);
      bg.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 40) {
      bg.moveTo(0, y);
      bg.lineTo(width, y);
    }
    bg.strokePath();

    // Decorative wall boundaries
    bg.lineStyle(4, 0x00f0ff, 0.4);
    bg.strokeRect(6, 6, width - 12, height - 12);
  }

  private createGameOverUI(width: number, height: number) {
    this.gameOverContainer = this.add.container(width / 2, height / 2);
    this.gameOverContainer.setDepth(2000);
    this.gameOverContainer.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x07090e, 0.88);

    const title = this.add.text(0, -60, 'INFILTRATION STATUS', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#00f0ff',
    }).setOrigin(0.5);
    title.setName('end_title');

    const desc = this.add.text(0, -10, '결과 설명', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      color: '#94a3b8',
    }).setOrigin(0.5);
    desc.setName('end_desc');

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

    this.gameOverContainer.add([backdrop, title, desc, restartBtn]);
  }

  destroy() {
    if (this.joystick) this.joystick.destroy();
  }
}
