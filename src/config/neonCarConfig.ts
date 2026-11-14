export interface NeonCarPalette {
  readonly chassisFill: number;
  readonly chassisGlow: number;
  readonly cockpit: number;
  readonly headlight: number;
  readonly taillight: number;
  readonly nitroPrimary: number;
  readonly nitroSecondary: number;
  readonly gridLine: number;
  readonly gridAccent: number;
}

export interface NeonCarPhysicsConfig {
  readonly normalSpeed: number;
  readonly boostSpeed: number;
  readonly turnSpeedRadPerSec: number;
  readonly boostDurationMs: number;
  readonly drag: number;
  readonly collisionRadius: number;
  readonly driftAngleThresholdRad: number;
}

export interface NeonCarTextureKeys {
  readonly carBody: string;
  readonly nitroParticle: string;
  readonly driftParticle: string;
  readonly headlightGlow: string;
}

export interface NeonCarConfig {
  readonly sceneKey: string;
  readonly palette: NeonCarPalette;
  readonly physics: NeonCarPhysicsConfig;
  readonly textures: NeonCarTextureKeys;
}

export const NEON_CAR_CONFIG: NeonCarConfig = {
  sceneKey: 'NeonCarSandboxScene',
  palette: {
    chassisFill: 0x0b1220,
    chassisGlow: 0x00f0ff,
    cockpit: 0x164e63,
    headlight: 0xe0faff,
    taillight: 0xff007f,
    nitroPrimary: 0x00f0ff,
    nitroSecondary: 0xff007f,
    gridLine: 0x161f30,
    gridAccent: 0x00f0ff,
  },
  physics: {
    normalSpeed: 290,
    boostSpeed: 580,
    turnSpeedRadPerSec: 11.5,
    boostDurationMs: 360,
    drag: 0.001,
    collisionRadius: 22,
    driftAngleThresholdRad: 0.45,
  },
  textures: {
    carBody: 'neon_car_body',
    nitroParticle: 'neon_car_nitro_particle',
    driftParticle: 'neon_car_drift_particle',
    headlightGlow: 'neon_car_headlight_glow',
  },
};
