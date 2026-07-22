import worldImage from '@/assets/images/world/landscape/base-v2.png?url';
import type { GlowLayer, WorldSceneData } from '@/lib/world/types';

export type { WorldDestination } from '@/lib/world/types';

/** Warm pools of light aligned to the painted street lamps. */
const streetLampGlows: GlowLayer[] = [
  { x: 0.021, y: 0.516 },
  { x: 0.265, y: 0.421 },
  { x: 0.438, y: 0.351 },
  { x: 0.457, y: 0.527 },
  { x: 0.603, y: 0.647 },
  { x: 0.326, y: 0.815 },
  { x: 0.677, y: 0.199 }
].map((point, index) => ({
  id: `street-lamp-${index + 1}`,
  kind: 'glow',
  env: 'night',
  shape: 'circle',
  color: '#ffe2a0',
  soft: 'rgba(255, 190, 72, 0.62)',
  frame: { x: point.x, y: point.y, w: 0.012, h: 0.021 },
  halo: '18px 8px',
  behavior: {
    name: 'blink',
    trigger: 'night',
    duration: 2600 + (index % 3) * 350,
    delay: index * 180,
    min: 0.82,
    max: 1
  }
}));

/**
 * The approved landscape uses a canonical 2048×1152 coordinate system.
 * The painting remains the visual base while small transparent layers add
 * state and motion without repainting the composition at runtime.
 */
export const worldScene: WorldSceneData = {
  title: '我们的生活收藏：选择一个地方开始',
  viewportLabel: '可左右探索的生活收藏地图',
  canvas: { w: 2048, h: 1152 },
  background: {
    src: worldImage,
    alt: '花草环绕的等距海边小镇，有房子、咖啡店、车库、飞机、汽车、灯塔、码头和帆船'
  },
  toneColors: {
    lifestyle: '#ffd64f',
    art: '#ff9eb1',
    travel: '#75d7ed'
  },
  environments: [
    {
      id: 'day',
      label: '白天',
      icon: '🌞',
      tokens: {
        '--env-sky': '#75d7ed',
        '--env-image-filter': 'none',
        '--env-grade': 'none',
        '--env-grade-opacity': '0',
        '--env-smoke-fill': 'rgba(255, 248, 231, 0.94)',
        '--env-smoke-stroke': 'rgba(62, 53, 45, 0.58)',
        '--env-steam-stroke': 'rgba(62, 53, 45, 0.5)',
        '--env-ripple': 'rgba(255, 248, 231, 0.92)',
        '--env-shadow-scale': '1'
      }
    },
    {
      id: 'night',
      label: '夜晚',
      icon: '🌙',
      tokens: {
        '--env-sky': '#16214c',
        '--env-image-filter': 'saturate(0.76) brightness(0.58) hue-rotate(5deg)',
        '--env-grade': 'linear-gradient(180deg, #2a3577 0%, #141b45 55%, #1d2860 100%)',
        '--env-grade-opacity': '0.5',
        '--env-smoke-fill': 'rgba(216, 224, 248, 0.85)',
        '--env-smoke-stroke': 'rgba(30, 36, 66, 0.65)',
        '--env-steam-stroke': 'rgba(216, 224, 248, 0.7)',
        '--env-ripple': 'rgba(206, 222, 255, 0.85)',
        '--env-shadow-scale': '0.45'
      }
    }
  ],
  atmosphere: [
    ...streetLampGlows,
    {
      id: 'lighthouse-beacon',
      kind: 'glow',
      env: 'night',
      shape: 'circle',
      color: '#ffe9a3',
      soft: 'rgba(255, 233, 163, 0.75)',
      halo: '18px 8px',
      frame: { x: 0.726, y: 0.286, w: 0.018, h: 0.032 },
      behavior: { name: 'blink', trigger: 'night', duration: 2600, min: 0.35, max: 1 }
    },
    {
      id: 'harbor-water-sparkle',
      kind: 'emitter',
      variant: 'ring',
      trigger: 'idle',
      frame: { x: 0.765, y: 0.79, w: 0.18, h: 0.045 },
      duration: 2400
    }
  ],
  instances: [
    {
      id: 'house',
      object: 'house',
      at: { x: 820, y: 20, w: 432, h: 540 },
      facing: 'bottom-left',
      mobileFocus: true,
      content: {
        label: '生活',
        eyebrow: '家的任务板',
        href: '/lifestyle',
        preview: '关于每一天的点滴记录，平凡生活里的小确幸。',
        prompt: '打开生活收藏',
        icon: '⌂',
        tone: 'lifestyle'
      }
    },
    {
      id: 'coffee-shop',
      object: 'cafe',
      at: { x: 178, y: 355, w: 390, h: 390 },
      content: {
        label: '艺术',
        eyebrow: '咖啡店画室',
        href: '/art',
        preview: '沿着咖啡香走进画室，看看正在生长的作品与实验。',
        prompt: '进入艺术收藏',
        icon: '☕',
        tone: 'art'
      }
    },
    {
      id: 'airplane',
      object: 'airplane',
      at: { x: 225, y: 88, w: 320, h: 205 },
      labelAnchor: { left: '62%', bottom: '-17%' },
      content: {
        label: '旅行',
        eyebrow: '天空航线',
        href: '/travel',
        preview: '从云层上方回看共同走过的地点、季节和远方。',
        prompt: '起飞去旅行',
        icon: '✈',
        tone: 'travel'
      }
    },
    {
      id: 'sailboat',
      object: 'sailboat',
      at: { x: 1735, y: 505, w: 313, h: 630 },
      labelAnchor: { left: '39%', bottom: '0%' },
      content: {
        label: '旅行',
        eyebrow: '海港航线',
        href: '/travel',
        preview: '顺着海风翻开沿岸旅程，收藏潮汐与港口的记忆。',
        prompt: '扬帆去旅行',
        icon: '⛵',
        tone: 'travel'
      }
    },
    {
      id: 'car',
      object: 'car',
      at: { x: 730, y: 620, w: 330, h: 245 },
      labelAnchor: { left: '54%', bottom: '-2%' },
      content: {
        label: '旅行',
        eyebrow: '公路航线',
        href: '/travel',
        preview: '装好行李，沿着花田公路重温那些说走就走的日子。',
        prompt: '开车去旅行',
        icon: '🚗',
        tone: 'travel'
      }
    },
    {
      id: 'hangar',
      object: 'hangar',
      at: { x: 458, y: 120, w: 270, h: 250 },
      labelAnchor: { left: '52%', bottom: '-10%' },
      content: {
        label: '机库',
        eyebrow: '旅行准备站',
        href: '/travel',
        preview: '检查航线、风向与装备，准备下一次短途飞行。',
        prompt: '查看飞行日志',
        icon: '🧰',
        tone: 'travel'
      }
    },
    {
      id: 'garage',
      object: 'garage',
      at: { x: 555, y: 380, w: 330, h: 320 },
      labelAnchor: { left: '50%', bottom: '-9%' },
      content: {
        label: '车库工坊',
        eyebrow: '机械与手作',
        href: '/art',
        preview: '打开卷门，看看正在修复的老车、工具与机械实验。',
        prompt: '进入车库工坊',
        icon: '🔧',
        tone: 'art'
      }
    },
    {
      id: 'lighthouse',
      object: 'lighthouse',
      at: { x: 1390, y: 250, w: 215, h: 430 },
      labelAnchor: { left: '40%', bottom: '-4%' },
      content: {
        label: '灯塔',
        eyebrow: '海湾守望',
        href: '/travel',
        preview: '沿着灯塔的光束，翻开港湾与远行的记忆。',
        prompt: '登上灯塔',
        icon: '🔦',
        tone: 'travel'
      }
    },
    {
      id: 'harbor-office',
      object: 'harbor-office',
      at: { x: 1540, y: 360, w: 315, h: 310 },
      labelAnchor: { left: '62%', bottom: '-8%' },
      content: {
        label: '港务小屋',
        eyebrow: '潮汐任务板',
        href: '/lifestyle',
        preview: '查看今日潮汐、船期和码头边的小镇委托。',
        prompt: '打开港务日志',
        icon: '⚓',
        tone: 'lifestyle'
      }
    }
  ]
};
