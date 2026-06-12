export type HomeChapter = {
  title: string;
  href: string;
  imageKey: 'artPaperStudy' | 'lifestyleTable' | 'travelCoast';
  description: string;
};

export const homeChapters: HomeChapter[] = [
  {
    title: '艺术',
    href: '/art',
    imageKey: 'artPaperStudy',
    description: '收藏绘画、习作、照片、实验，以及那些仍在慢慢生长的安静作品。'
  },
  {
    title: '生活',
    href: '/lifestyle',
    imageKey: 'lifestyleTable',
    description: '记录日常、器物、书、餐桌、音乐，以及一路遇见并想要留下的事物。'
  },
  {
    title: '旅行',
    href: '/travel',
    imageKey: 'travelCoast',
    description: '按时间收藏地点、季节，以及那些让旅程停留在记忆里的细小细节。'
  }
];
