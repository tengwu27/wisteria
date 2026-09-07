import hall2048 from '../../assets/cinematic/scenes/library-grand-hall/delivery/library-grand-hall-2048.webp';
import hall3072 from '../../assets/cinematic/scenes/library-grand-hall/delivery/library-grand-hall-3072.webp';
import hall4096 from '../../assets/cinematic/scenes/library-grand-hall/delivery/library-grand-hall-4096.webp';
import shelf1254 from '../../assets/cinematic/scenes/library-grand-hall/delivery/library-shelf-close-1254.webp';
import shelf1672 from '../../assets/cinematic/scenes/library-grand-hall/delivery/library-shelf-close-1672.webp';
import table1254 from '../../assets/cinematic/scenes/library-grand-hall/delivery/library-table-over-chair-1254.webp';
import table1672 from '../../assets/cinematic/scenes/library-grand-hall/delivery/library-table-over-chair-1672.webp';
import type { SceneManifest } from '@/types/immersive';
import constructionLedgerJson from '../../world/structures/library/construction-ledger.json';
import locationRegistryJson from '../../world/structures/library/locations.json';
import type {
  LibraryConstructionRecord,
  RegisteredWisteriaEntity
} from '@/types/libraryFramework';

const LIBRARY_CANVAS_WIDTH = 4096;
const MAIN_GATE_AXIS_X = 2199;

export const librarySpatialGraph = locationRegistryJson.map;

export const libraryScene = {
  id: 'library-grand-hall',
  canvas: { width: LIBRARY_CANVAS_WIDTH, height: 1536 },
  initialFocalRatio: MAIN_GATE_AXIS_X / LIBRARY_CANVAS_WIDTH,
  overviewAssets: [
    { src: hall2048.src, width: hall2048.width, height: hall2048.height },
    { src: hall3072.src, width: hall3072.width, height: hall3072.height },
    { src: hall4096.src, width: hall4096.width, height: hall4096.height }
  ],
  zones: [
    {
      id: 'reading-table',
      labelZh: '前景阅览桌',
      labelEn: 'READING TABLE',
      description: '站在走廊的椅背后，俯视灯光下的皮革手记。',
      overviewBounds: { x: 0.285, y: 0.56, width: 0.2, height: 0.37 },
      registration: {
        kind: 'independent-viewpoint',
        sourceZone: { x: 0.285, y: 0.56, width: 0.2, height: 0.37 },
        cameraDescription:
          'Standing in the central hallway immediately behind the aisle-side chair, looking down about 55 degrees across its upper edge to the reading table.',
        continuityAnchors: [
          'oxblood book on a darker supporting volume',
          'brass and dark writing vessels beside the book',
          'burgundy leather chair between the aisle and table',
          'parquet floor and central red carpet beyond the table'
        ]
      },
      assets: [
        { src: table1254.src, width: table1254.width, height: table1254.height },
        { src: table1672.src, width: table1672.width, height: table1672.height }
      ],
      artifacts: [
        {
          artifactId: 'wisteria-field-notes',
          kind: 'book',
          labelZh: '查看《紫藤镇手记》',
          labelEn: 'INSPECT WISTERIA FIELD NOTES',
          bounds: { x: 0.414, y: 0.372, width: 0.18, height: 0.24 }
        }
      ]
    },
    {
      id: 'west-shelf',
      labelZh: '西侧书架',
      labelEn: 'WEST SHELF',
      description: '站在西侧拱形书柜前，架上立着深青色潮汐图谱与酒红色微光集。',
      overviewBounds: { x: 0.135, y: 0.34, width: 0.235, height: 0.39 },
      registration: {
        kind: 'independent-viewpoint',
        sourceZone: { x: 0.135, y: 0.34, width: 0.235, height: 0.39 },
        cameraDescription:
          'Standing directly before the lower west arched bookcase at eye level, looking nearly straight on at its reachable central shelf.',
        continuityAnchors: [
          'pointed teal-black arched shelf with aged brass trim',
          'warm brass reading lamp mounted at the left side',
          'rolling library ladder beside the alcove',
          'dense rows of dark leather volumes surrounding the featured books'
        ]
      },
      assets: [
        { src: shelf1254.src, width: shelf1254.width, height: shelf1254.height },
        { src: shelf1672.src, width: shelf1672.width, height: shelf1672.height }
      ],
      artifacts: [
        {
          artifactId: 'atlas-of-tides',
          kind: 'book',
          labelZh: '查看《潮汐图谱》',
          labelEn: 'INSPECT ATLAS OF TIDES',
          bounds: { x: 0.417, y: 0.44, width: 0.075, height: 0.33 }
        },
        {
          artifactId: 'collected-glimmers',
          kind: 'book',
          labelZh: '查看《微光集》',
          labelEn: 'INSPECT COLLECTED GLIMMERS',
          bounds: { x: 0.49, y: 0.44, width: 0.075, height: 0.33 }
        }
      ]
    }
  ]
} satisfies SceneManifest;

const notionPlacements = (
  constructionLedgerJson.records as unknown as RegisteredWisteriaEntity[]
).filter(
  (record): record is LibraryConstructionRecord =>
    record.entityKind === 'item' &&
    record.source === 'notion' &&
    record.state === 'locked'
);

export function getLibrarySceneForBooks(
  books: Array<{ artifactId: string; title: string }>
): SceneManifest {
  const available = new Map(books.map((book) => [book.artifactId, book]));
  return {
    ...libraryScene,
    zones: libraryScene.zones.map((zone) => ({
      ...zone,
      artifacts: [
        ...zone.artifacts,
        ...notionPlacements
          .filter(
            (record) =>
              record.sceneId === zone.id && available.has(record.wisteriaId)
          )
          .map((record) => {
            const book = available.get(record.wisteriaId)!;
            return {
              artifactId: record.wisteriaId,
              // This experience currently opens editorial items in the book reader.
              // The construction ledger may describe future letters or objects, but
              // those require their own inspector before they can be rendered here.
              kind: 'book' as const,
              labelZh: `查看《${book.title}》`,
              labelEn: `INSPECT ${book.title.toUpperCase()}`,
              bounds: record.bounds
            };
          })
      ]
    }))
  };
}

export function findArtifactPlacement(
  artifactId: string,
  scene: SceneManifest = libraryScene
) {
  for (const zone of scene.zones) {
    const artifact = zone.artifacts.find((item) => item.artifactId === artifactId);
    if (artifact) return { zone, artifact };
  }

  return undefined;
}
