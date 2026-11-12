import Phaser from 'phaser';
import { sound } from '../utils/audio';

interface AnchorNode {
  x: number;
  y: number;
  circle: Phaser.GameObjects.Arc;
}

export class GravityHookScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private ropeGfx!: Phaser.GameObjects.Graphics;
  private anchors: AnchorNode[] = [];
  private obstacles: Phaser.GameObjects.Rectangle[] = [];
  private rings: Phaser.GameObjects.Arc[] = [];

  private activeAnchor: AnchorNode | null = null;
  private ropeLength: number = 0;
  private isHooked: boolean = false;
  private isGameOver: boolean = false;

  private score: number = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private gameOverContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'GravityHookScene' });
  }

  preload() {
    if (!this.textures.exists('hook_player')) {
      const gfx = this.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(0x00f0ff, 1);
      gfx.fillCircle(16, 16, 14);
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(16, 16, 6);
      gfx.generateTexture('hook_player', 32, 32);
      gfx.destroy();
    }
  }

  create() {
    const { width, height } = this.scale;
    this.anchors = [];
    this.obstacles = [];
    this.rings = [];
    this.activeAnchor = null;
    this.isHooked = false;
    this.isGameOver = false;
    this.score = 0;

    // Cosmic background
    this.createBackground(width, height);

    // Rope graphics
    this.ropeGfx = this.add.graphics();
    this.ropeGfx.setDepth(15);

    // Player
    this.player = this.physics.add.sprite(80, 240, 'hook_player');
    this.player.setCollideWorldBounds(false);
    this.player.setGravityY(750);
    this.player.setVelocity(220, 0);
    this.player.setDepth(20);

    // Setup level course with anchors, rings, and laser hazards
    this.generateCourse(width, height);

    // Mobile Touch & Hold to Grapple Hook
    this.input.on('pointerdown', () => {
      if (!this.isGameOver) {
        this.attachHook();
      }
    });

    this.input.on('pointerup', () => {
      this.releaseHook();
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-SPACE', () => this.attachHook());
      this.input.keyboard.on('keyup-SPACE', () => this.releaseHook());
      this.input.keyboard.on('keydown-R', () => this.scene.restart());
    }

    // Camera follow player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.05, -width * 0.25, 0);

    // HUD (fixed to screen)
    this.scoreText = this.add.text(20, 20, 'DIST: 0m', {
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#00f0ff',
      backgroundColor: 'rgba(7, 9, 14, 0.85)',
      padding: { x: 10, y: 6 },
    }).setScrollFactor(0).setDepth(200);

    const hint = this.add.text(width / 2, height - 40, '👆 화면 터치 & 홀드하여 로프 연결, 떼면 가속 방출!', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.5)',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.createGameOverUI(width, height);
  }

  private generateCourse(width: number, height: number) {
    // Generate endless sequential course nodes
    for (let i = 0; i < 30; i++) {
      const ax = 180 + i * 220;
      const ay = 120 + (i % 2 === 0 ? 0 : 50);

      // Anchor node
      const circle = this.add.circle(ax, ay, 12, 0x00ff88);
      circle.setStrokeStyle(3, 0xffffff, 0.8);
      circle.setDepth(10);
      this.anchors.push({ x: ax, y: ay, circle });

      // Bonus energy ring
      if (i > 0) {
        const ring = this.add.circle(ax - 110, ay + 140, 16, 0xffe600, 0.2);
        ring.setStrokeStyle(2, 0xffe600, 0.8);
        this.rings.push(ring);
      }

      // Laser barrier hazard
      if (i % 3 === 0 && i > 1) {
        const obs = this.add.rectangle(ax + 80, height - 160, 20, 180, 0xff0055);
        obs.setStrokeStyle(2, 0xffffff, 0.6);
        this.obstacles.push(obs);
      }
    }
  }

  private attachHook() {
    if (this.isHooked || this.isGameOver) return;

    // Find closest anchor in front of or above player within range
    let closest: AnchorNode | null = null;
    let minDist = 320;

    for (const anchor of this.anchors) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, anchor.x, anchor.y);
      if (dist < minDist && anchor.x >= this.player.x - 80) {
        minDist = dist;
        closest = anchor;
      }
    }

    if (closest) {
      this.activeAnchor = closest;
      this.isHooked = true;
      this.ropeLength = minDist;
      sound.playJump();
      sound.vibrate(20);

      // Highlight active anchor
      closest.circle.setFillStyle(0x00f0ff);
      closest.circle.setScale(1.3);
    }
  }

  private releaseHook() {
    if (!this.isHooked) return;
    this.isHooked = false;

    if (this.activeAnchor) {
      this.activeAnchor.circle.setFillStyle(0x00ff88);
      this.activeAnchor.circle.setScale(1.0);
    }
    this.activeAnchor = null;
    this.ropeGfx.clear();
    sound.playSlice();
  }

  update() {
    if (this.isGameOver) return;

    // Pendulum physics when hooked
    if (this.isHooked && this.activeAnchor) {
      const anchor = this.activeAnchor;
      const angle = Phaser.Math.Angle.Between(anchor.x, anchor.y, this.player.x, this.player.y);
      const currentDist = Phaser.Math.Distance.Between(anchor.x, anchor.y, this.player.x, this.player.y);

      // Enforce rope length constraint
      if (currentDist > this.ropeLength) {
        this.player.x = anchor.x + Math.cos(angle) * this.ropeLength;
        this.player.y = anchor.y + Math.sin(angle) * this.ropeLength;

        // Tangent velocity preservation
        const tangentAngle = angle + Math.PI / 2;
        const currentVel = new Phaser.Math.Vector2(this.player.body.velocity.x, this.player.body.velocity.y);
        const tangentDir = new Phaser.Math.Vector2(Math.cos(tangentAngle), Math.sin(tangentAngle));
        const dot = currentVel.dot(tangentDir);

        // Add slight pendulum boost
        const boost = 1.015;
        this.player.setVelocity(tangentDir.x * dot * boost, tangentDir.y * dot * boost);
      }

      // Draw glowing laser rope
      this.ropeGfx.clear();
      this.ropeGfx.lineStyle(3, 0x00f0ff, 0.9);
      this.ropeGfx.strokeLineShape(new Phaser.Geom.Line(this.player.x, this.player.y, anchor.x, anchor.y));
    } else {
      this.ropeGfx.clear();
    }

    // Ring collection check
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, ring.x, ring.y);
      if (dist < 32) {
        ring.destroy();
        this.rings.splice(i, 1);
        this.score += 50;
        sound.playScore(1.3);
        sound.vibrate(25);
        this.cameras.main.flash(60, 255, 230, 0, false);
      }
    }

    // Laser barrier collision check
    for (const obs of this.obstacles) {
      const bounds = obs.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), bounds)) {
        this.triggerDefeat('LASER VAPORIZED');
        return;
      }
    }

    // Check fall off bottom
    if (this.player.y > this.scale.height + 60) {
      this.triggerDefeat('FELL INTO THE VOID');
      return;
    }

    // Update HUD
    const distMetres = Math.max(0, Math.floor(this.player.x / 10));
    this.scoreText.setText(`DIST: ${distMetres}m  |  SCORE: ${this.score}`);
  }

  private triggerDefeat(reason: string) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    sound.playExplode();
    this.cameras.main.shake(250, 0.02);

    this.player.setTint(0xff0055);
    this.physics.pause();
    this.ropeGfx.clear();

    this.time.delayedCall(400, () => {
      this.gameOverContainer.setVisible(true);
      const title = this.gameOverContainer.getByName('end_title') as Phaser.GameObjects.Text;
      const scoreObj = this.gameOverContainer.getByName('end_score') as Phaser.GameObjects.Text;
      if (title) title.setText(reason);
      if (scoreObj) scoreObj.setText(`총 도달 거리: ${Math.floor(this.player.x / 10)}m  |  점수: ${this.score}`);
    });
  }

  private createBackground(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x04060d, 0x04060d, 0x11162a, 0x11162a, 1);
    bg.fillRect(0, 0, width * 10, height);

    // Deep space distant stars
    bg.fillStyle(0xffffff, 0.5);
    for (let i = 0; i < 200; i++) {
      bg.fillCircle(Phaser.Math.Between(0, width * 10), Phaser.Math.Between(0, height), Math.random() * 1.5 + 0.5);
    }
  }

  private createGameOverUI(width: number, height: number) {
    this.gameOverContainer = this.add.container(width / 2, height / 2);
    this.gameOverContainer.setDepth(2000);
    this.gameOverContainer.setScrollFactor(0);
    this.gameOverContainer.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x07090e, 0.85);

    const title = this.add.text(0, -60, 'MISSION TERMINATED', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ff0055',
    }).setOrigin(0.5);
    title.setName('end_title');

    const scoreInfo = this.add.text(0, -10, '결과', {
      fontFamily: 'monospace',
      fontSize: '15px',
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
