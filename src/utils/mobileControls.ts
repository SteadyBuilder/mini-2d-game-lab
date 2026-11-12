import Phaser from 'phaser';

export interface VirtualJoystickOptions {
  x: number;
  y: number;
  radius?: number;
  handleRadius?: number;
}

export class VirtualJoystick {
  private scene: Phaser.Scene;
  private baseCircle: Phaser.GameObjects.Graphics;
  private handleCircle: Phaser.GameObjects.Graphics;
  private origin: Phaser.Math.Vector2;
  private current: Phaser.Math.Vector2;
  private radius: number;
  private handleRadius: number;
  private pointerId: number | null = null;
  public force: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);
  public isDown: boolean = false;

  constructor(scene: Phaser.Scene, options: VirtualJoystickOptions) {
    this.scene = scene;
    this.radius = options.radius || 46;
    this.handleRadius = options.handleRadius || 24;
    this.origin = new Phaser.Math.Vector2(options.x, options.y);
    this.current = new Phaser.Math.Vector2(options.x, options.y);

    // Joystick Base
    this.baseCircle = scene.add.graphics();
    this.baseCircle.fillStyle(0xffffff, 0.08);
    this.baseCircle.fillCircle(this.origin.x, this.origin.y, this.radius);
    this.baseCircle.lineStyle(2, 0x00f0ff, 0.4);
    this.baseCircle.strokeCircle(this.origin.x, this.origin.y, this.radius);
    this.baseCircle.setDepth(999);
    this.baseCircle.setScrollFactor(0);

    // Joystick Handle
    this.handleCircle = scene.add.graphics();
    this.drawHandle();
    this.handleCircle.setDepth(1000);
    this.handleCircle.setScrollFactor(0);

    // Setup input listeners
    this.scene.input.on('pointerdown', this.onPointerDown, this);
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
  }

  private drawHandle() {
    this.handleCircle.clear();
    this.handleCircle.fillStyle(0x00f0ff, 0.6);
    this.handleCircle.fillCircle(this.current.x, this.current.y, this.handleRadius);
    this.handleCircle.fillStyle(0xffffff, 0.9);
    this.handleCircle.fillCircle(this.current.x, this.current.y, this.handleRadius * 0.4);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (this.pointerId !== null) return;
    const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.origin.x, this.origin.y);
    // Allow generous touch zone
    if (dist <= this.radius * 2) {
      this.pointerId = pointer.id;
      this.isDown = true;
      this.updatePosition(pointer.x, pointer.y);
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.pointerId && this.isDown) {
      this.updatePosition(pointer.x, pointer.y);
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.pointerId) {
      this.pointerId = null;
      this.isDown = false;
      this.force.set(0, 0);
      this.current.copy(this.origin);
      this.drawHandle();
    }
  }

  private updatePosition(px: number, py: number) {
    const angle = Phaser.Math.Angle.Between(this.origin.x, this.origin.y, px, py);
    const dist = Phaser.Math.Distance.Between(this.origin.x, this.origin.y, px, py);
    const clampedDist = Math.min(dist, this.radius);

    this.current.x = this.origin.x + Math.cos(angle) * clampedDist;
    this.current.y = this.origin.y + Math.sin(angle) * clampedDist;
    this.drawHandle();

    // Normalized force from -1 to 1
    const normalizedDist = clampedDist / this.radius;
    this.force.x = Math.cos(angle) * normalizedDist;
    this.force.y = Math.sin(angle) * normalizedDist;
  }

  public destroy() {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.baseCircle.destroy();
    this.handleCircle.destroy();
  }
}

export class TouchActionButton {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bgGfx: Phaser.GameObjects.Graphics;
  private labelText: Phaser.GameObjects.Text;
  private radius: number;
  private isPressed: boolean = false;
  private callback: () => void;
  private pointerId: number | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    callback: () => void,
    options?: { radius?: number; color?: number }
  ) {
    this.scene = scene;
    this.callback = callback;
    this.radius = options?.radius || 32;
    const color = options?.color || 0x00f0ff;

    this.container = scene.add.container(x, y);
    this.container.setDepth(1000);
    this.container.setScrollFactor(0);

    this.bgGfx = scene.add.graphics();
    this.drawButton(color, 0.4);

    this.labelText = scene.add.text(0, 0, label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.container.add([this.bgGfx, this.labelText]);

    // Touch events
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, x, y);
      if (dist <= this.radius * 1.3 && this.pointerId === null) {
        this.pointerId = pointer.id;
        this.isPressed = true;
        this.drawButton(color, 0.85);
        this.callback();
      }
    });

    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.pointerId) {
        this.pointerId = null;
        this.isPressed = false;
        this.drawButton(color, 0.4);
      }
    });
  }

  private drawButton(color: number, alpha: number) {
    this.bgGfx.clear();
    this.bgGfx.fillStyle(color, alpha);
    this.bgGfx.fillCircle(0, 0, this.radius);
    this.bgGfx.lineStyle(2, 0xffffff, 0.6);
    this.bgGfx.strokeCircle(0, 0, this.radius);
  }

  public getPressed(): boolean {
    return this.isPressed;
  }

  public destroy() {
    this.container.destroy();
  }
}
