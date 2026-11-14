import Phaser from 'phaser';
import { NeonCarConfig } from '../config/neonCarConfig';

/**
 * Generates procedural neon sports car and particle textures for NeonCarSandboxScene.
 * Car sprite faces RIGHT (0 rad) by default so Phaser's rotation aligns with movement angle.
 */
export function ensureNeonCarTextures(scene: Phaser.Scene, config: NeonCarConfig): void {
  const { textures, palette } = config;

  if (!scene.textures.exists(textures.carBody)) {
    const w = 72;
    const h = 44;
    const gfx = scene.make.graphics({ x: 0, y: 0 });

    // Outer neon underglow
    gfx.fillStyle(palette.chassisGlow, 0.16);
    gfx.fillRoundedRect(4, 3, 64, 38, 12);

    // Tires (4 corners)
    gfx.fillStyle(0x050811, 1);
    gfx.lineStyle(1.5, palette.chassisGlow, 0.6);
    const wheelPositions = [
      { x: 14, y: 3 },
      { x: 46, y: 3 },
      { x: 14, y: 35 },
      { x: 46, y: 35 },
    ];
    for (const wp of wheelPositions) {
      gfx.fillRoundedRect(wp.x, wp.y, 13, 6, 2);
      gfx.strokeRoundedRect(wp.x, wp.y, 13, 6, 2);
    }

    // Main aerodynamic body
    gfx.fillStyle(palette.chassisFill, 0.96);
    gfx.lineStyle(2.2, palette.chassisGlow, 1);
    gfx.fillRoundedRect(8, 7, 56, 30, 9);
    gfx.strokeRoundedRect(8, 7, 56, 30, 9);

    // Side neon accent strips
    gfx.lineStyle(1.5, palette.taillight, 0.85);
    gfx.beginPath();
    gfx.moveTo(16, 10);
    gfx.lineTo(48, 10);
    gfx.moveTo(16, 34);
    gfx.lineTo(48, 34);
    gfx.strokePath();

    // Windshield & cockpit canopy
    gfx.fillStyle(palette.cockpit, 0.92);
    gfx.lineStyle(1.5, palette.chassisGlow, 0.9);
    gfx.fillRoundedRect(24, 12, 23, 20, 6);
    gfx.strokeRoundedRect(24, 12, 23, 20, 6);

    // Roof neon core line
    gfx.lineStyle(2, 0xffffff, 0.75);
    gfx.beginPath();
    gfx.moveTo(28, 22);
    gfx.lineTo(41, 22);
    gfx.strokePath();

    // Rear spoiler wing (left side)
    gfx.fillStyle(palette.taillight, 0.9);
    gfx.fillRoundedRect(6, 8, 4, 28, 2);

    // Twin rear taillights
    gfx.fillStyle(palette.taillight, 1);
    gfx.fillRect(8, 10, 3, 6);
    gfx.fillRect(8, 28, 3, 6);

    // Twin front headlights (right side)
    gfx.fillStyle(palette.headlight, 1);
    gfx.fillRoundedRect(60, 10, 4, 6, 2);
    gfx.fillRoundedRect(60, 28, 4, 6, 2);

    gfx.generateTexture(textures.carBody, w, h);
    gfx.destroy();
  }

  if (!scene.textures.exists(textures.nitroParticle)) {
    const gfx = scene.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(palette.nitroPrimary, 0.9);
    gfx.fillCircle(6, 6, 6);
    gfx.fillStyle(0xffffff, 0.8);
    gfx.fillCircle(6, 6, 2.5);
    gfx.generateTexture(textures.nitroParticle, 12, 12);
    gfx.destroy();
  }

  if (!scene.textures.exists(textures.driftParticle)) {
    const gfx = scene.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(palette.nitroSecondary, 0.75);
    gfx.fillCircle(5, 5, 5);
    gfx.generateTexture(textures.driftParticle, 10, 10);
    gfx.destroy();
  }

  if (!scene.textures.exists(textures.headlightGlow)) {
    const gfx = scene.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(palette.headlight, 0.14);
    gfx.fillTriangle(0, 28, 90, 0, 90, 56);
    gfx.fillStyle(palette.chassisGlow, 0.08);
    gfx.fillTriangle(0, 28, 70, 8, 70, 48);
    gfx.generateTexture(textures.headlightGlow, 90, 56);
    gfx.destroy();
  }
}

export function drawNeonArenaGrid(
  scene: Phaser.Scene,
  width: number,
  height: number,
  config: NeonCarConfig
): void {
  const { palette } = config;
  const gridGraphics = scene.add.graphics();
  gridGraphics.lineStyle(1, palette.gridLine, 0.75);

  const gridSize = 40;
  for (let x = 0; x <= width; x += gridSize) {
    gridGraphics.moveTo(x, 0);
    gridGraphics.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += gridSize) {
    gridGraphics.moveTo(0, y);
    gridGraphics.lineTo(width, y);
  }
  gridGraphics.strokePath();

  // Center neon crosshairs
  gridGraphics.lineStyle(1, palette.gridAccent, 0.28);
  gridGraphics.moveTo(width / 2, 0);
  gridGraphics.lineTo(width / 2, height);
  gridGraphics.moveTo(0, height / 2);
  gridGraphics.lineTo(width, height / 2);
  gridGraphics.strokePath();

  // Subtle neon perimeter track border
  gridGraphics.lineStyle(2, palette.nitroSecondary, 0.25);
  gridGraphics.strokeRoundedRect(12, 12, width - 24, height - 24, 18);
}
