import type { MediaKey } from '@/assets/images/placeholders';

export interface NormalizedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MasterCrop {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type FocusRegistration =
  | {
      kind: 'registered-crop';
      masterCrop: MasterCrop;
      protectedAnchors: string[];
    }
  | {
      kind: 'independent-viewpoint';
      sourceZone: NormalizedBounds;
      cameraDescription: string;
      continuityAnchors: string[];
    };

export interface ResponsiveSceneAsset {
  src: string;
  width: number;
  height: number;
}

export type ArtifactKind = 'book' | 'framed-art';

export interface ArtifactPlacement {
  artifactId: string;
  kind: ArtifactKind;
  labelZh: string;
  labelEn: string;
  bounds: NormalizedBounds;
}

export interface FocusZone {
  id: string;
  labelZh: string;
  labelEn: string;
  description: string;
  overviewBounds: NormalizedBounds;
  registration: FocusRegistration;
  assets: ResponsiveSceneAsset[];
  artifacts: ArtifactPlacement[];
}

export interface SceneManifest {
  id: string;
  canvas: { width: number; height: number };
  initialFocalRatio: number;
  overviewAssets: ResponsiveSceneAsset[];
  zones: FocusZone[];
}

export type BookPageLayout = 'title' | 'prose' | 'image' | 'prose-image';

export interface BookPagePresentation {
  layout: BookPageLayout;
  imageKey?: MediaKey;
  imageAlt?: string;
  imageCaption?: string;
}

export interface BookPresentation {
  artifactId: string;
  kind: 'book';
  fixture: boolean;
  noindex: boolean;
  cover: {
    titleZh: string;
    titleEn: string;
    emblem: 'wisteria' | 'sun' | 'wave';
    color: string;
    foil: string;
  };
  pages: BookPagePresentation[];
}
