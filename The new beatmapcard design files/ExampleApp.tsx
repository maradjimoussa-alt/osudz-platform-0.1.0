import React, { useRef, useState } from 'react';
import './card.css';
import { BeatmapBounty } from './types';
import { BeatmapCard } from './components/BeatmapCard';

const SAMPLE_BOUNTY: BeatmapBounty = {
  id: '1',
  title: 'Harumachi Clover',
  artist: 'YUC"e',
  mapper: 'doormat',
  genre: 'Electronic',
  difficultyRating: 5.82,
  difficultyName: 'Extra',
  votes: 1247,
  userVoted: false,
  userFavorited: false,
  bannerUrl: 'https://assets.ppy.sh/beatmaps/751771/covers/cover.jpg',
  previewSeconds: 90,
  bpm: 200,
  length: '2:07',
  circleSize: 4.2,
  approachRate: 9.5,
  accuracy: 8.0,
  hpDrain: 6.0,
  bountyRewardPoints: 50,
  comments: [
    {
      id: '1',
      user: 'cookiezi',
      avatar: 'https://a.ppy.sh/124493',
      time: '3h ago',
      text: 'Insane map, the jumps at 01:45 are brutal.',
      rating: 5,
    },
    {
      id: '2',
      user: 'whitecat',
      avatar: 'https://a.ppy.sh/4504101',
      time: '1h ago',
      text: 'The streams are actually readable once you get used to the bpm.',
      rating: 4,
    },
  ],
  challenges: [
    {
      id: 'c1',
      title: 'Full Combo',
      description: 'Complete the map without breaking your combo.',
      reward: 100,
      icon: 'trophy',
      difficulty: 'Gold',
      completedBy: 312,
    },
    {
      id: 'c2',
      title: 'S Rank',
      description: 'Achieve at least 95% accuracy.',
      reward: 75,
      icon: 'medal',
      difficulty: 'Silver',
      completedBy: 891,
    },
    {
      id: 'c3',
      title: 'Hidden Pass',
      description: 'Clear the map with the Hidden mod enabled.',
      reward: 150,
      icon: 'zap',
      difficulty: 'Platinum',
      completedBy: 98,
    },
  ],
};

export default function ExampleApp() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [bounty, setBounty] = useState(SAMPLE_BOUNTY);

  const handleTogglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(`https://b.ppy.sh/preview/${bounty.id}.mp3`);
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setAudioProgress(audioRef.current.currentTime / (audioRef.current.duration || 1));
        }
      };
      audioRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleScrubAudio = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setAudioProgress(ratio);
    if (audioRef.current) {
      audioRef.current.currentTime = ratio * (audioRef.current.duration || 0);
    }
  };

  const handleVote = () => {
    setBounty((b) => ({
      ...b,
      userVoted: !b.userVoted,
      votes: b.userVoted ? b.votes - 1 : b.votes + 1,
    }));
  };

  const handleFavorite = () => {
    setBounty((b) => ({ ...b, userFavorited: !b.userFavorited }));
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
      <div className="w-72">
        <BeatmapCard
          bounty={bounty}
          isPlaying={isPlaying}
          audioProgress={audioProgress}
          onTogglePlay={handleTogglePlay}
          onScrubAudio={handleScrubAudio}
          onVote={handleVote}
          onFavorite={handleFavorite}
          onOpenComments={() => {}}
        />
      </div>
    </div>
  );
}
