import Phaser from 'phaser';
import { sound } from '../utils/audio';

interface RhythmNote {
  lane: number;
  y: number;
  rect: Phaser.GameObjects.Rectangle;
  isHit: boolean;
}

export class BeatPulseScene extends Phaser.Scene {
  private readonly LANE_COUNT = 4;
  private laneWidth: number = 0;
  private hitLineY: number = 0;
  private notes: RhythmNote[] = [];
  private laneColors = [0x00f0ff, 0xff007f, 0xffe600, 0x00ff88];
  private laneFlashes: Phaser.GameObjects.Rectangle[] = [];

  private score: number = 0;
  private combo: number = 0;
  private maxCombo: number = 0;
  private noteSpeed: number = 420;
  private spawnTimer?: Phaser.Time.TimerEvent;

  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private ratingText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'BeatPulseScene' });
  }

  create() {
    const { width, height } = this.scale;
    this.laneWidth = width / this.LANE_COUNT;
    this.hitLineY = height - 140;
    this.notes = [];
    this.laneFlashes = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;

    // Rhythm arena background & lane tracks
    this.createLanes(width, height);

    // Hit receptor triggers at bottom
    this.createReceptors(width);

    // Spawn rhythmic note waves
    this.spawnTimer = this.time.addEvent({
      delay: 550,
      callback: this.spawnNote,
      callbackScope: this,
      loop: true,
    });

    // Mobile 4-Lane Touch Listeners
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const lane = Math.floor(pointer.x / this.laneWidth);
      if (lane >= 0 && lane < this.LANE_COUNT) {
        this.triggerLaneHit(lane);
      }
    });

    // Keyboard support: D, F, J, K or 1, 2, 3, 4
    if (this.input.keyboard) {
      const keys = ['D', 'F', 'J', 'K'];
      keys.forEach((k, lane) => {
        this.input.keyboard!.on(`keydown-${k}`, () => this.triggerLaneHit(lane));
      });
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

    this.comboText = this.add.text(width / 2, 100, '', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(100);

    this.ratingText = this.add.text(width / 2, 140, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffe600',
    }).setOrigin(0.5).setDepth(100);

    // Mobile control hint at bottom
    const hint = this.add.text(width / 2, height - 30, '👆 하단 4개 레인을 비트에 맞춰 터치하세요!', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.45)',
    }).setOrigin(0.5);
  }

  private createLanes(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillStyle(0x060814, 1);
    bg.fillRect(0, 0, width, height);

    // Draw vertical lane divider lines
    bg.lineStyle(1, 0x1e293b, 0.8);
    for (let i = 1; i < this.LANE_COUNT; i++) {
      const x = i * this.laneWidth;
      bg.moveTo(x, 0);
      bg.lineTo(x, height);
    }
    bg.strokePath();

    // Hit judgment line
    bg.lineStyle(3, 0xffffff, 0.6);
    bg.moveTo(0, this.hitLineY);
    bg.lineTo(width, this.hitLineY);
    bg.strokePath();

    // Lane Flash Overlays
    for (let i = 0; i < this.LANE_COUNT; i++) {
      const flash = this.add.rectangle(
        i * this.laneWidth + this.laneWidth / 2,
        height / 2,
        this.laneWidth,
        height,
        this.laneColors[i],
        0
      );
      flash.setDepth(5);
      this.laneFlashes.push(flash);
    }
  }

  private createReceptors(width: number) {
    for (let i = 0; i < this.LANE_COUNT; i++) {
      const rx = i * this.laneWidth + this.laneWidth / 2;
      const receptor = this.add.rectangle(rx, this.hitLineY, this.laneWidth - 8, 36, this.laneColors[i], 0.25);
      receptor.setStrokeStyle(2, this.laneColors[i], 0.8);
      receptor.setDepth(10);

      // Key or Touch icon label
      const labels = ['D', 'F', 'J', 'K'];
      this.add.text(rx, this.hitLineY + 36, labels[i], {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.4)',
      }).setOrigin(0.5);
    }
  }

  private spawnNote() {
    // Pick 1 or occasionally 2 lanes
    const lane = Phaser.Math.Between(0, this.LANE_COUNT - 1);
    const x = lane * this.laneWidth + this.laneWidth / 2;
    const y = -20;

    const rect = this.add.rectangle(x, y, this.laneWidth - 14, 22, this.laneColors[lane]);
    rect.setStrokeStyle(1.5, 0xffffff, 0.9);
    rect.setDepth(20);

    this.notes.push({
      lane,
      y,
      rect,
      isHit: false,
    });
  }

  private triggerLaneHit(lane: number) {
    // Flash lane visually
    const flash = this.laneFlashes[lane];
    flash.setAlpha(0.25);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 180,
    });

    // Check closest note in this lane near hit line
    let closestNote: RhythmNote | null = null;
    let minDiff = 999;

    for (const note of this.notes) {
      if (note.lane === lane && !note.isHit) {
        const diff = Math.abs(note.y - this.hitLineY);
        if (diff < minDiff) {
          minDiff = diff;
          closestNote = note;
        }
      }
    }

    if (closestNote && minDiff < 75) {
      closestNote.isHit = true;
      closestNote.rect.destroy();

      if (minDiff < 26) {
        this.registerRating('PERFECT', 100, '#00ff88');
      } else if (minDiff < 48) {
        this.registerRating('GREAT', 70, '#00f0ff');
      } else {
        this.registerRating('GOOD', 40, '#ffe600');
      }

      sound.playCombo(Math.min(10, this.combo + 1));
      sound.vibrate(15);
    } else {
      // Empty tap
      sound.playTap();
    }
  }

  private registerRating(text: string, baseScore: number, color: string) {
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    this.score += baseScore * Math.min(4, 1 + Math.floor(this.combo / 10));
    this.scoreText.setText(`SCORE: ${this.score}`);

    this.comboText.setText(`${this.combo} COMBO!`);
    this.comboText.setColor(color);

    this.ratingText.setText(text);
    this.ratingText.setColor(color);
  }

  private registerMiss() {
    this.combo = 0;
    this.comboText.setText('');
    this.ratingText.setText('MISS');
    this.ratingText.setColor('#ff0055');
    sound.vibrate(40);
  }

  update(_: number, delta: number) {
    // Move falling notes
    const dy = (this.noteSpeed * delta) / 1000;

    for (let i = this.notes.length - 1; i >= 0; i--) {
      const note = this.notes[i];
      if (note.isHit) {
        this.notes.splice(i, 1);
        continue;
      }

      note.y += dy;
      note.rect.y = note.y;

      // Note missed below hit line
      if (note.y > this.hitLineY + 65) {
        note.rect.destroy();
        this.notes.splice(i, 1);
        this.registerMiss();
      }
    }
  }
}
