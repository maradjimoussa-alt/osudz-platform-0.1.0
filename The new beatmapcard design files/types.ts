export interface BountyChallenge {
  id: string;
  title: string;
  description: string;
  reward: number;
  icon: string;
  difficulty: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  completedBy: number;
}

export interface BeatmapComment {
  id: string;
  user: string;
  avatar: string;
  time: string;
  text: string;
  rating?: number;
  parentId?: string;
}

export interface BeatmapBounty {
  id: string;
  title: string;
  artist: string;
  mapper: string;
  genre: 'Electronic' | 'Rock' | 'Pop' | 'Classical' | 'Anime' | string;
  difficultyRating: number;
  difficultyName: string;
  votes: number;
  userVoted: boolean;
  userFavorited: boolean;
  bannerUrl: string;
  previewSeconds: number;
  bpm: number;
  length: string;
  circleSize: number;
  approachRate: number;
  accuracy: number;
  hpDrain: number;
  bountyRewardPoints: number;
  comments: BeatmapComment[];
  challenges: BountyChallenge[];
}
