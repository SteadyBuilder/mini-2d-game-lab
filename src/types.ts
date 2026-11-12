export interface ProjectControl {
  key: string;
  action: string;
}

export interface ProjectMeta {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: 'sandbox' | 'arcade' | 'physics' | 'rhythm' | 'puzzle';
  tags: string[];
  icon: string;
  badge?: string;
  badgeColor?: string;
  accentColor: string;
  accentGlow: string;
  sceneKey: string;
  controls: ProjectControl[];
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Sandbox';
  status: 'ready' | 'wip';
}
