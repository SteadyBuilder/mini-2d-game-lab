import Phaser from 'phaser';
import { SandboxScene } from './scenes/SandboxScene';
import { NeonDodgerScene } from './scenes/NeonDodgerScene';
import { GravityOrbitScene } from './scenes/GravityOrbitScene';
import { NeonBreakerScene } from './scenes/NeonBreakerScene';
import { ChronoRunnerScene } from './scenes/ChronoRunnerScene';
import { ShadowCrawlerScene } from './scenes/ShadowCrawlerScene';
import { CyberDaggerScene } from './scenes/CyberDaggerScene';
import { NeonStackScene } from './scenes/NeonStackScene';
import { BladeSlicerScene } from './scenes/BladeSlicerScene';
import { GravityHookScene } from './scenes/GravityHookScene';
import { ColorShiftScene } from './scenes/ColorShiftScene';
import { PinballNeonScene } from './scenes/PinballNeonScene';
import { BeatPulseScene } from './scenes/BeatPulseScene';
import { MagneticMergeScene } from './scenes/MagneticMergeScene';

import { PROJECTS } from './projects';
import { ProjectMeta } from './types';
import { sound } from './utils/audio';

// Phaser Game Instance
let game: Phaser.Game | null = null;
let currentProject: ProjectMeta | null = null;

// Phaser Game Config: 모바일 세로 화면 기준 (450 x 800, 9:16 비율)
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#07090e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 450,
    height: 800,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  input: {
    activePointers: 3, // 모바일 멀티터치 지원 (양손 조작)
  },
  // 총 14종의 모바일 미니게임 씬 등록
  scene: [
    SandboxScene,
    NeonDodgerScene,
    GravityOrbitScene,
    NeonBreakerScene,
    ChronoRunnerScene,
    ShadowCrawlerScene,
    CyberDaggerScene,
    NeonStackScene,
    BladeSlicerScene,
    GravityHookScene,
    ColorShiftScene,
    PinballNeonScene,
    BeatPulseScene,
    MagneticMergeScene,
  ],
};

// ================= Background Canvas Animation =================
function initBackgroundParticles() {
  const canvas = document.getElementById('bg-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles: { x: number; y: number; r: number; vx: number; vy: number; alpha: number; color: string }[] = [];
  const colors = ['#00f0ff', '#ff007f', '#00ff88', '#ffe600', '#a855f7'];

  for (let i = 0; i < 40; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 2 + 0.8,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.5 + 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    requestAnimationFrame(render);
  }

  render();
}

// ================= UI Elements =================
const hubOverlay = document.getElementById('hub-overlay') as HTMLElement;
const gameNavbar = document.getElementById('game-navbar') as HTMLElement;
const gameBottomHint = document.getElementById('game-bottom-hint') as HTMLElement;
const projectsGrid = document.getElementById('projects-grid') as HTMLElement;
const searchInput = document.getElementById('project-search') as HTMLInputElement;
const categoryFilters = document.getElementById('category-filters') as HTMLElement;

const navGameIcon = document.getElementById('nav-game-icon') as HTMLElement;
const navGameName = document.getElementById('nav-game-name') as HTMLElement;
const navGameBadge = document.getElementById('nav-game-badge') as HTMLElement;
const hintBadge = document.getElementById('hint-badge') as HTMLElement;
const hintText = document.getElementById('hint-text') as HTMLElement;
const playableCount = document.getElementById('playable-count') as HTMLElement;

let selectedCategory = 'all';
let searchQuery = '';

// ================= Card Rendering =================
function renderProjectCards() {
  if (!projectsGrid) return;
  projectsGrid.innerHTML = '';

  const filtered = PROJECTS.filter((proj) => {
    const matchesCategory = selectedCategory === 'all' || proj.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      proj.title.toLowerCase().includes(query) ||
      proj.subtitle.toLowerCase().includes(query) ||
      proj.description.toLowerCase().includes(query) ||
      proj.tags.some((t) => t.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  if (playableCount) {
    playableCount.textContent = `${PROJECTS.filter((p) => p.status === 'ready').length} Playable Games`;
  }

  if (filtered.length === 0) {
    projectsGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: #64748b;">
        <div style="font-size: 36px; margin-bottom: 10px;">🔍</div>
        <div style="font-size: 15px; font-weight: 600; color: #94a3b8;">일치하는 모바일 미니게임이 없습니다.</div>
        <div style="font-size: 13px; margin-top: 4px;">다른 검색어나 카테고리 탭을 선택해 보세요.</div>
      </div>
    `;
    return;
  }

  filtered.forEach((proj) => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.setProperty('--card-accent', proj.accentColor);
    card.style.setProperty('--card-glow', proj.accentGlow);

    const isReady = proj.status === 'ready';

    card.innerHTML = `
      <div class="card-banner">
        <div class="card-banner-pattern"></div>
        <div class="card-banner-glow" style="background: ${proj.accentColor};"></div>
        <div class="card-top-badges">
          <span class="card-badge" style="background: ${proj.badgeColor || proj.accentColor}25; color: ${proj.badgeColor || proj.accentColor}; border: 1px solid ${proj.badgeColor || proj.accentColor}50;">
            ${proj.badge || proj.category.toUpperCase()}
          </span>
          <span class="card-difficulty">DIFF: ${proj.difficulty}</span>
        </div>
        <div class="card-icon">${proj.icon}</div>
      </div>

      <div class="card-body">
        <h3 class="card-title">${proj.title}</h3>
        <div class="card-subtitle">${proj.subtitle}</div>
        <p class="card-desc">${proj.description}</p>

        <div class="card-tags">
          ${proj.tags.map((tag) => `<span class="tag-pill">#${tag}</span>`).join('')}
        </div>

        <div class="card-controls">
          ${proj.controls
            .map(
              (c) => `
            <div class="control-row">
              <span class="control-key">${c.key}</span>
              <span class="control-action">${c.action}</span>
            </div>
          `
            )
            .join('')}
        </div>

        <div class="card-footer">
          <button class="btn-launch ${!isReady ? 'disabled' : ''}">
            <span>${isReady ? '플레이 시작 🚀' : '준비 중 (WIP) ⏳'}</span>
          </button>
        </div>
      </div>
    `;

    if (isReady) {
      card.addEventListener('click', () => {
        sound.playTap();
        launchProject(proj);
      });
    }

    projectsGrid.appendChild(card);
  });
}

// ================= Launch & Navigation Logic =================
function launchProject(project: ProjectMeta) {
  if (!project.sceneKey) return;
  currentProject = project;

  // Initialize Phaser Game instance on first launch
  if (!game) {
    game = new Phaser.Game(config);
  }

  // Stop currently running scenes if any
  game.scene.scenes.forEach((s) => {
    if (s.scene.isActive()) {
      s.scene.stop();
    }
  });

  // Start selected scene
  game.scene.start(project.sceneKey);

  // Update In-Game Navbar
  if (navGameIcon) navGameIcon.textContent = project.icon;
  if (navGameName) navGameName.textContent = project.title.split(':')[0].trim();
  if (navGameBadge) {
    navGameBadge.textContent = project.category.toUpperCase();
    navGameBadge.style.color = project.accentColor;
    navGameBadge.style.background = `${project.accentColor}25`;
  }

  // Update Bottom Hint
  if (hintBadge && hintText && gameBottomHint) {
    hintBadge.textContent = project.title.split(':')[0].trim();
    hintBadge.style.background = project.accentColor;
    hintBadge.style.color = '#000';
    hintText.textContent = project.controls.map((c) => `${c.key}: ${c.action}`).join('  |  ');
    gameBottomHint.style.opacity = '1';
  }

  // Transition UI
  hubOverlay.classList.add('hidden');
  gameNavbar.classList.add('active');

  // Sync URL hash
  window.location.hash = `project=${project.id}`;
}

function returnToHub() {
  sound.playTap();
  if (game && currentProject) {
    const activeScene = game.scene.getScene(currentProject.sceneKey);
    if (activeScene && activeScene.scene.isActive()) {
      activeScene.scene.stop();
    }
  }

  currentProject = null;
  hubOverlay.classList.remove('hidden');
  gameNavbar.classList.remove('active');
  if (gameBottomHint) {
    gameBottomHint.style.opacity = '0';
  }

  if (window.location.hash) {
    history.pushState(null, '', window.location.pathname);
  }
}

function restartCurrentProject() {
  sound.playTap();
  if (game && currentProject) {
    const activeScene = game.scene.getScene(currentProject.sceneKey);
    if (activeScene) {
      activeScene.scene.restart();
    }
  }
}

function toggleAudio() {
  const isMuted = sound.toggleMute();
  updateSoundButtonIcons(isMuted);
}

function updateSoundButtonIcons(isMuted: boolean) {
  const soundBtns = document.querySelectorAll('.btn-sound-toggle');
  soundBtns.forEach((btn) => {
    btn.textContent = isMuted ? '🔇' : '🔊';
  });
}

function toggleFullscreen() {
  sound.playTap();
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// ================= Event Listeners =================
window.addEventListener('load', () => {
  initBackgroundParticles();
  renderProjectCards();
  updateSoundButtonIcons(sound.isMuted);

  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = (e.target as HTMLInputElement).value;
      renderProjectCards();
    });
  }

  // Category filters
  if (categoryFilters) {
    categoryFilters.querySelectorAll('.category-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        sound.playTap();
        categoryFilters.querySelectorAll('.category-pill').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        selectedCategory = btn.getAttribute('data-category') || 'all';
        renderProjectCards();
      });
    });
  }

  // Back to Hub buttons
  const backBtn = document.getElementById('btn-back-to-hub');
  if (backBtn) {
    backBtn.addEventListener('click', returnToHub);
  }

  // Restart button
  const restartBtn = document.getElementById('btn-restart');
  if (restartBtn) {
    restartBtn.addEventListener('click', restartCurrentProject);
  }

  // Sound toggle buttons
  document.querySelectorAll('.btn-sound-toggle').forEach((btn) => {
    btn.addEventListener('click', toggleAudio);
  });

  // Fullscreen buttons
  const fsBtn = document.getElementById('btn-fullscreen');
  const hubFsBtn = document.getElementById('hub-btn-fullscreen');
  if (fsBtn) fsBtn.addEventListener('click', toggleFullscreen);
  if (hubFsBtn) hubFsBtn.addEventListener('click', toggleFullscreen);

  // Global Keyboard Navigation
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && currentProject) {
      returnToHub();
    }
  });

  // URL Hash routing on load
  const hash = window.location.hash;
  if (hash.startsWith('#project=')) {
    const projId = hash.replace('#project=', '');
    const found = PROJECTS.find((p) => p.id === projId && p.status === 'ready');
    if (found) {
      launchProject(found);
    }
  }
});
