import { useEffect, useReducer } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { worldRegistry } from '@/lib/world/registry';
import {
  worldRectToPercent,
  type ImageLayer,
  type WorldFacing,
  type WorldSceneData,
  type WorldSceneInstance
} from '@/lib/world/types';
import './immersive.css';

export type Exhibit = {
  kind: 'painting' | 'book' | 'postcard';
  title: string;
  blurb: string;
  href: string;
  cta: string;
  image?: string;
  imageAlt?: string;
};

interface Props {
  scene: WorldSceneData;
  exhibits: Exhibit[];
}

type View = 'exterior' | 'approaching' | 'interior';
type State = { view: View; focus: Exhibit['kind'] | null };
type Action =
  | { type: 'APPROACH' }
  | { type: 'ENTER' }
  | { type: 'EXIT' }
  | { type: 'FOCUS'; kind: Exhibit['kind'] }
  | { type: 'BLUR' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'APPROACH':
      return state.view === 'exterior' ? { view: 'approaching', focus: null } : state;
    case 'ENTER':
      return state.view === 'approaching' ? { view: 'interior', focus: null } : state;
    case 'EXIT':
      return { view: 'exterior', focus: null };
    case 'FOCUS':
      return state.view === 'interior' ? { ...state, focus: action.kind } : state;
    case 'BLUR':
      return { ...state, focus: null };
  }
}

const APPROACH_SCALE = 2.4;
const APPROACH_MS = 1150;

/** The camera focal point: the house door's center, in stage fractions. */
function doorFocal(scene: WorldSceneData) {
  const house = scene.instances.find((instance) => instance.id === 'house');
  const manifest = worldRegistry.house;
  const socket = manifest?.sockets?.mainDoor;
  const canvas = manifest?.authoringCanvas;
  if (!house || !socket?.aperture || !canvas) return { fx: 0.52, fy: 0.43 };
  let localX = (socket.aperture.x + socket.aperture.w / 2) / canvas.w;
  if (manifest.nativeFacing && house.facing && manifest.nativeFacing !== house.facing) localX = 1 - localX;
  const localY = (socket.aperture.y + socket.aperture.h / 2) / canvas.h;
  const cx = house.at.x + localX * house.at.w;
  const cy = house.at.y + localY * house.at.h;
  return { fx: cx / scene.canvas.w, fy: cy / scene.canvas.h };
}

const EXHIBIT_EYEBROWS: Record<Exhibit['kind'], string> = {
  painting: '墙上的画 · 艺术',
  book: '桌上的手账 · 生活',
  postcard: '钉着的明信片 · 旅行'
};

export default function ImmersiveWorld({ scene, exhibits }: Props) {
  const [state, dispatch] = useReducer(reducer, { view: 'exterior', focus: null });
  const reducedMotion = useReducedMotion() ?? false;
  const { fx, fy } = doorFocal(scene);

  const zoomedIn = state.view !== 'exterior';
  const camera = zoomedIn
    ? { x: `${((0.5 - fx) * 100).toFixed(3)}%`, y: `${((0.5 - fy) * 100).toFixed(3)}%`, scale: APPROACH_SCALE }
    : { x: '0%', y: '0%', scale: 1 };

  const cameraTransition = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 52, damping: 19, mass: 1.1 };

  // The approach timeline owns the exterior→interior handoff; cancelling
  // it (EXIT mid-flight) simply lets the camera spring back.
  useEffect(() => {
    if (state.view !== 'approaching') return;
    const timer = window.setTimeout(() => dispatch({ type: 'ENTER' }), reducedMotion ? 30 : APPROACH_MS);
    return () => window.clearTimeout(timer);
  }, [state.view, reducedMotion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (state.focus) dispatch({ type: 'BLUR' });
      else if (state.view !== 'exterior') dispatch({ type: 'EXIT' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.focus, state.view]);

  const focusedExhibit = exhibits.find((exhibit) => exhibit.kind === state.focus);

  return (
    <section className="iw-hero" aria-label={scene.viewportLabel}>
      <motion.div
        className={`iw-stage ${state.view !== 'exterior' ? 'is-approaching' : ''} ${zoomedIn ? 'is-open' : ''}`}
        style={{ transformOrigin: `${(fx * 100).toFixed(3)}% ${(fy * 100).toFixed(3)}%` }}
        animate={camera}
        transition={cameraTransition}
      >
        <img
          className="iw-bg"
          src={scene.background.src}
          alt={scene.background.alt}
          width={scene.canvas.w}
          height={scene.canvas.h}
          fetchPriority="high"
          decoding="async"
        />

        {scene.instances.map((instance) => (
          <Hotspot
            key={instance.id}
            instance={instance}
            scene={scene}
            onEnterHouse={() => dispatch({ type: 'APPROACH' })}
          />
        ))}
      </motion.div>

      <motion.div
        className="iw-vignette"
        initial={false}
        animate={{ opacity: state.view === 'approaching' ? 1 : 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.6 }}
      />

      <AnimatePresence>
        {state.view === 'interior' && (
          <InteriorRoom
            exhibits={exhibits}
            reducedMotion={reducedMotion}
            onExit={() => dispatch({ type: 'EXIT' })}
            onFocus={(kind) => dispatch({ type: 'FOCUS', kind })}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="iw-bloom"
        style={{ '--bloom-x': `${(fx * 100).toFixed(2)}%`, '--bloom-y': `${(fy * 100).toFixed(2)}%` } as React.CSSProperties}
        initial={false}
        animate={{ opacity: state.view === 'approaching' ? 1 : 0 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : state.view === 'approaching'
              ? { delay: 0.62, duration: 0.42, ease: 'easeIn' }
              : { duration: 0.55, ease: 'easeOut' }
        }
      />

      <AnimatePresence>
        {focusedExhibit && (
          <ExhibitDialog
            exhibit={focusedExhibit}
            reducedMotion={reducedMotion}
            onClose={() => dispatch({ type: 'BLUR' })}
          />
        )}
      </AnimatePresence>

      {state.view !== 'exterior' && (
        <button className="iw-back-pill" type="button" onClick={() => dispatch({ type: 'EXIT' })}>
          <span aria-hidden="true">←</span> 回到小镇
        </button>
      )}
    </section>
  );
}

function Hotspot({
  instance,
  scene,
  onEnterHouse
}: {
  instance: WorldSceneInstance;
  scene: WorldSceneData;
  onEnterHouse: () => void;
}) {
  const pos = worldRectToPercent(instance.at, scene.canvas);
  const isHouse = instance.id === 'house';
  const { content } = instance;

  const style: React.CSSProperties & Record<string, string> = {
    left: pos.left,
    top: pos.top,
    width: pos.width,
    height: pos.height,
    '--label-tone': scene.toneColors[content.tone]
  };
  if (instance.labelAnchor) {
    style['--label-left'] = instance.labelAnchor.left;
    style['--label-bottom'] = instance.labelAnchor.bottom;
  }

  return (
    <a
      className="iw-hotspot"
      href={content.href}
      style={style}
      aria-label={isHouse ? `${content.label}：走进屋里看看` : `${content.label}：${content.prompt}`}
      onClick={
        isHouse
          ? (event) => {
              event.preventDefault();
              onEnterHouse();
            }
          : undefined
      }
    >
      {isHouse && <HouseAssembly targetFacing={instance.facing} />}
      <span className="iw-label" aria-hidden="true">
        <span className="iw-label__icon">{content.icon}</span>
        <span>
          <b>{content.label}</b>
          <small>{isHouse ? '点击走进屋里' : content.eyebrow}</small>
        </span>
        <span className="iw-label__arrow">➜</span>
      </span>
    </a>
  );
}

function HouseAssembly({ targetFacing }: { targetFacing?: WorldFacing }) {
  const manifest = worldRegistry.house;
  const ids = new Set(['door-interior', 'house-shell', 'door-closed', 'door-open', 'door-foreground']);
  const layers = manifest?.layers
    .filter((layer): layer is ImageLayer => ids.has(layer.id) && layer.kind === 'image')
    .sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  if (!manifest || !layers?.length) return null;
  const flipX = Boolean(manifest.nativeFacing && targetFacing && manifest.nativeFacing !== targetFacing);
  return (
    <span className="iw-house-assembly" data-flip-x={flipX ? 'true' : undefined} aria-hidden="true">
      {layers.map((layer) => (
        <img
          key={layer.id}
          className={`iw-house-layer iw-${layer.id}`}
          src={layer.src}
          width={layer.width}
          height={layer.height}
          alt=""
        />
      ))}
    </span>
  );
}

function InteriorRoom({
  exhibits,
  reducedMotion,
  onExit,
  onFocus
}: {
  exhibits: Exhibit[];
  reducedMotion: boolean;
  onExit: () => void;
  onFocus: (kind: Exhibit['kind']) => void;
}) {
  const painting = exhibits.find((exhibit) => exhibit.kind === 'painting');
  const book = exhibits.find((exhibit) => exhibit.kind === 'book');
  const postcard = exhibits.find((exhibit) => exhibit.kind === 'postcard');

  return (
    <motion.div
      className="iw-room"
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 1.07 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.05 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.5, ease: [0.2, 0.8, 0.25, 1] }}
    >
      <div className="iw-window" aria-hidden="true">
        <span className="iw-window__cloud" />
      </div>

      <div className="iw-room__floor" aria-hidden="true" />
      <div className="iw-room__rug" aria-hidden="true" />

      <div className="iw-table" aria-hidden="true">
        <span className="iw-table__top" />
        <span className="iw-table__leg iw-table__leg--left" />
        <span className="iw-table__leg iw-table__leg--right" />
      </div>

      {painting && (
        <button className="iw-exhibit iw-painting" type="button" onClick={() => onFocus('painting')}>
          <span className="iw-painting__frame">
            <img src={painting.image} alt={painting.imageAlt ?? painting.title} loading="lazy" />
          </span>
          <span className="iw-exhibit__tag">{painting.title}</span>
        </button>
      )}

      {postcard && (
        <button className="iw-exhibit iw-postcard" type="button" onClick={() => onFocus('postcard')}>
          <span className="iw-postcard__paper">
            <img src={postcard.image} alt={postcard.imageAlt ?? postcard.title} loading="lazy" />
            <span className="iw-postcard__stamp" aria-hidden="true">✈</span>
          </span>
          <span className="iw-exhibit__tag">{postcard.title}</span>
        </button>
      )}

      {book && (
        <button className="iw-exhibit iw-book" type="button" onClick={() => onFocus('book')}>
          <span className="iw-book__cover">
            <span className="iw-book__title">{book.title}</span>
          </span>
          <span className="iw-exhibit__tag">{book.title}</span>
        </button>
      )}

      <button className="iw-backdoor" type="button" onClick={onExit} aria-label="回到小镇">
        <span className="iw-exhibit__tag">回到小镇</span>
      </button>

      <p className="iw-room__hint">✦ 点点屋里的物件，看看藏着什么 ✦</p>
    </motion.div>
  );
}

function ExhibitDialog({
  exhibit,
  reducedMotion,
  onClose
}: {
  exhibit: Exhibit;
  reducedMotion: boolean;
  onClose: () => void;
}) {
  const fade = reducedMotion ? { duration: 0 } : { duration: 0.22 };
  return (
    <>
      <motion.button
        className="iw-dialog-overlay"
        type="button"
        aria-label="关闭"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={fade}
      />
      <motion.aside
        className="iw-dialog"
        role="dialog"
        aria-label={exhibit.title}
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 26 }}
      >
        {exhibit.image && <img src={exhibit.image} alt={exhibit.imageAlt ?? exhibit.title} />}
        <p className="iw-dialog__eyebrow">{EXHIBIT_EYEBROWS[exhibit.kind]}</p>
        <h3>{exhibit.title}</h3>
        <p className="iw-dialog__copy">{exhibit.blurb}</p>
        <a className="iw-dialog__cta" href={exhibit.href}>
          {exhibit.cta} <span aria-hidden="true">➜</span>
        </a>
        <button className="iw-dialog__close" type="button" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </motion.aside>
    </>
  );
}
