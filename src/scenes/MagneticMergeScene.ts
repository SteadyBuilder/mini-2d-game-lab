import Phaser from 'phaser';
import { sound } from '../utils/audio';

const TIERS = [
  { val: 2, radius: 20, color: 0x00f0ff },
  { val: 4, radius: 26, color: 0x00ff88 },
  { val: 8, radius: 32, color: 0xffe600 },
  { val: 16, radius: 38, color: 0xff9900 },
  { val: 32, radius: 45, color: 0xff007f },
  { val: 64, radius: 52, color: 0xa855f7 },
  { val: 128, radius: 60, color: 0x00ffff },
  { val: 256, radius: 68, color: 0xff0055 },
  { val: 512, radius: 76, color: 0x00ffcc },
  { val: 1024, radius: 84, color: 0xffd700 },
  { val: 2048, radius: 92, color: 0xffffff },
];

export class MagneticMergeScene extends Phaser.Scene {
  private orbsGroup!: Phaser.Physics.Arcade.Group;
  private currentTierIndex: number = 0;
  private previewOrb!: Phaser.GameObjects.Container;
  private canDrop: boolean = true;
  private score: number = 0;
  private isGameOver: boolean = false;

  private scoreText!: Phaser.GameObjects.Text;
  private gameOverContainer!: Phaser.GameObjects.Container;
  private readonly DROP_Y = 110;
  private readonly DANGER_Y = 160;

  constructor() {
    super({ key: 'MagneticMergeScene' });
  }

  preload() {
    // Generate orb textures for each tier
    TIERS.forEach((t) => {
      const key = `orb_${t.val}`;
      if (!this.textures.exists(key)) {
        const gfx = this.make.graphics({ x: 0, y: 0 });
        const size = t.radius * 2;
        gfx.fillStyle(t.color, 0.9);
        gfx.fillCircle(t.radius, t.radius, t.radius);
        gfx.fillStyle(0xffffff, 0.4);
        gfx.fillCircle(t.radius * 0.7, t.radius * 0.7, t.radius * 0.35);
        gfx.lineStyle(2, 0xffffff, 0.8);
        gfx.strokeCircle(t.radius, t.radius, t.radius - 1);
        gfx.generateTexture(key, size, size);
        gfx.destroy();
      }
    });
  }

  create() {
    const { width, height } = this.scale;
    this.score = 0;
    this.canDrop = true;
    this.isGameOver = false;

    // Chamber background
    this.createChamber(width, height);

    // Physics group for dropped orbs
    this.orbsGroup = this.physics.add.group();

    // Orb to Orb collisions & Merging
    this.physics.add.collider(this.orbsGroup, this.orbsGroup, (objA, objB) => {
      this.handleMergeCollision(objA as any, objB as any);
    });

    // Preview dropping orb container at top
    this.previewOrb = this.add.container(width / 2, this.DROP_Y);
    this.previewOrb.setDepth(100);
    this.pickNextDropTier();

    // Touch Drag & Drop
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.canDrop && !this.isGameOver) {
        const minX = 40;
        const maxX = width - 40;
        this.previewOrb.x = Phaser.Math.Clamp(pointer.x, minX, maxX);
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.canDrop && !this.isGameOver && pointer.y < height - 60) {
        const minX = 40;
        const maxX = width - 40;
        this.previewOrb.x = Phaser.Math.Clamp(pointer.x, minX, maxX);
        this.dropCurrentOrb();
      }
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
    }).setDepth(200);

    const hint = this.add.text(width / 2, height - 30, '↔ 드래그하여 조준, 터치하여 드롭! 같은 숫자 병합', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.45)',
    }).setOrigin(0.5);

    this.createGameOverUI(width, height);
  }

  private pickNextDropTier() {
    // Drop only small orbs (tier 0 to 2: 2, 4, 8)
    this.currentTierIndex = Phaser.Math.Between(0, 2);
    const tier = TIERS[this.currentTierIndex];

    this.previewOrb.removeAll(true);

    const spr = this.add.sprite(0, 0, `orb_${tier.val}`);
    const txt = this.add.text(0, 0, `${tier.val}`, {
      fontFamily: 'monospace',
      fontSize: `${Math.floor(tier.radius * 0.75)}px`,
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.previewOrb.add([spr, txt]);
  }

  private dropCurrentOrb() {
    this.canDrop = false;
    const tier = TIERS[this.currentTierIndex];
    const x = this.previewOrb.x;
    const y = this.DROP_Y;

    this.spawnPhysicsOrb(x, y, this.currentTierIndex);
    sound.playTap();

    this.previewOrb.setVisible(false);

    // Delay before next orb is ready
    this.time.delayedCall(450, () => {
      if (!this.isGameOver) {
        this.pickNextDropTier();
        this.previewOrb.setVisible(true);
        this.canDrop = true;
      }
    });
  }

  private spawnPhysicsOrb(x: number, y: number, tierIndex: number): Phaser.Types.Physics.Arcade.SpriteWithDynamicBody {
    const tier = TIERS[tierIndex];
    const orb = this.orbsGroup.create(x, y, `orb_${tier.val}`) as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    orb.setCollideWorldBounds(true);
    orb.setBounce(0.25);
    orb.setCircle(tier.radius);
    orb.setGravityY(950);
    orb.setData('tierIndex', tierIndex);
    orb.setData('isMerging', false);

    // Number text overlay
    const txt = this.add.text(x, y, `${tier.val}`, {
      fontFamily: 'monospace',
      fontSize: `${Math.floor(tier.radius * 0.7)}px`,
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(15);
    orb.setData('label', txt);

    return orb;
  }

  private handleMergeCollision(orbA: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody, orbB: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody) {
    if (!orbA.active || !orbB.active) return;
    if (orbA.getData('isMerging') || orbB.getData('isMerging')) return;

    const tierA = orbA.getData('tierIndex');
    const tierB = orbB.getData('tierIndex');

    if (tierA === tierB && tierA < TIERS.length - 1) {
      orbA.setData('isMerging', true);
      orbB.setData('isMerging', true);

      const midX = (orbA.x + orbB.x) / 2;
      const midY = (orbA.y + orbB.y) / 2;
      const nextTier = tierA + 1;

      // Clean up old orbs and labels
      const labelA = orbA.getData('label') as Phaser.GameObjects.Text;
      const labelB = orbB.getData('label') as Phaser.GameObjects.Text;
      if (labelA) labelA.destroy();
      if (labelB) labelB.destroy();
      orbA.destroy();
      orbB.destroy();

      // Spawn next higher orb with pop effect
      const newOrb = this.spawnPhysicsOrb(midX, midY, nextTier);
      newOrb.setScale(0.2);
      this.tweens.add({
        targets: newOrb,
        scale: 1.0,
        duration: 180,
        ease: 'Back.easeOut',
      });

      // Sound & Sparks
      sound.playBounce();
      sound.playScore(1 + nextTier * 0.1);
      sound.vibrate(25);
      this.spawnMergeSparks(midX, midY, TIERS[nextTier].color);

      // Score bonus
      this.score += TIERS[nextTier].val;
      this.scoreText.setText(`SCORE: ${this.score}`);
    }
  }

  private spawnMergeSparks(x: number, y: number, color: number) {
    for (let i = 0; i < 10; i++) {
      const p = this.add.circle(x, y, 3, color);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const spd = Phaser.Math.Between(40, 140);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * spd,
        y: y + Math.sin(angle) * spd,
        alpha: 0,
        duration: 350,
        onComplete: () => p.destroy(),
      });
    }
  }

  update() {
    if (this.isGameOver) return;

    // Keep text labels aligned with dynamic physics orbs
    this.orbsGroup.getChildren().forEach((child: any) => {
      const orb = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
      const label = orb.getData('label') as Phaser.GameObjects.Text;
      if (label && orb.active) {
        label.setPosition(orb.x, orb.y);
      }

      // Check overflow danger line if orb has settled
      if (orb.y < this.DANGER_Y && Math.abs(orb.body.velocity.y) < 10 && orb.y > this.DROP_Y + 10) {
        this.triggerOverflow();
      }
    });
  }

  private triggerOverflow() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    sound.playGameOver();
    this.cameras.main.shake(250, 0.02);

    this.time.delayedCall(400, () => {
      this.gameOverContainer.setVisible(true);
      const scoreObj = this.gameOverContainer.getByName('end_score') as Phaser.GameObjects.Text;
      if (scoreObj) scoreObj.setText(`최종 점수: ${this.score}`);
    });
  }

  private createChamber(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x060814, 0x060814, 0x111628, 0x111628, 1);
    bg.fillRect(0, 0, width, height);

    // Magnetic Chamber boundaries
    bg.lineStyle(3, 0x00f0ff, 0.5);
    bg.strokeRect(10, this.DROP_Y + 30, width - 20, height - (this.DROP_Y + 80));

    // Dotted red overflow danger line
    bg.lineStyle(2, 0xff0055, 0.6);
    for (let x = 15; x < width - 15; x += 16) {
      bg.moveTo(x, this.DANGER_Y);
      bg.lineTo(x + 8, this.DANGER_Y);
    }
    bg.strokePath();

    this.add.text(width / 2, this.DANGER_Y - 14, '⚠️ OVERFLOW LIMIT', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ff0055',
    }).setOrigin(0.5);
  }

  private createGameOverUI(width: number, height: number) {
    this.gameOverContainer = this.add.container(width / 2, height / 2);
    this.gameOverContainer.setDepth(2000);
    this.gameOverContainer.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, width, height, 0x07090e, 0.88);

    const title = this.add.text(0, -60, 'CONTAINMENT BREACH', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ff0055',
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
