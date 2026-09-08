import React, { useRef, useState, useEffect } from 'react';
import { BeatmapBounty, BeatmapComment } from '../types';
import { api } from '../api/client';
import {
  Star, Play, Pause, MessageSquare, Heart,
  CheckCircle2, Sliders, Trophy, Medal, Zap, Target, Flame, Crown,
  CornerDownRight, Send, X,
} from 'lucide-react';

interface BeatmapCardProps {
  bounty: BeatmapBounty;
  isPlaying: boolean;
  audioProgress: number;
  onTogglePlay: () => void;
  onScrubAudio: (e: React.MouseEvent<HTMLDivElement>) => void;
  onVote: () => void;
  onFavorite: () => void;
  onOpenComments: () => void;
  onInspectCard?: () => void;
}

const difficultyColors = {
  Bronze: { bg: 'bg-amber-900/40', border: 'border-amber-700/60', text: 'text-amber-400', badge: 'bg-amber-800/60' },
  Silver: { bg: 'bg-slate-700/40', border: 'border-slate-500/60', text: 'text-slate-300', badge: 'bg-slate-700/60' },
  Gold: { bg: 'bg-yellow-900/40', border: 'border-yellow-500/60', text: 'text-yellow-400', badge: 'bg-yellow-800/60' },
  Platinum: { bg: 'bg-cyan-900/40', border: 'border-cyan-500/60', text: 'text-cyan-400', badge: 'bg-cyan-800/60' },
};

const challengeIcons: Record<string, React.ReactNode> = {
  trophy: <Trophy className="w-4 h-4" />,
  medal: <Medal className="w-4 h-4" />,
  zap: <Zap className="w-4 h-4" />,
  target: <Target className="w-4 h-4" />,
  flame: <Flame className="w-4 h-4" />,
  crown: <Crown className="w-4 h-4" />,
};

const ratingColors = [
  'text-rose-400', 'text-amber-400', 'text-yellow-300', 'text-emerald-400', 'text-cyan-400',
];

function starColorScheme(rating: number): { header: string; fill: string } {
  if (rating < 2.0) return { header: 'bg-lime-500 text-slate-950',   fill: 'bg-lime-400' };
  if (rating < 2.7) return { header: 'bg-sky-500 text-slate-950',    fill: 'bg-sky-400' };
  if (rating < 4.0) return { header: 'bg-amber-400 text-slate-950',  fill: 'bg-amber-400' };
  if (rating < 5.3) return { header: 'bg-rose-500 text-white',       fill: 'bg-rose-400' };
  if (rating < 6.5) return { header: 'bg-purple-600 text-white',     fill: 'bg-purple-400' };
  return                    { header: 'bg-gray-900 text-white',       fill: 'bg-gray-300' };
}

function StarRow({ rating }: { rating: number }) {
  const total = Math.max(1, Math.ceil(rating));
  const fraction = rating % 1 || 1;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: total }).map((_, i) => {
        const pct = i < total - 1 ? 100 : Math.round(fraction * 100);
        return (
          <span key={i} className="relative w-3.5 h-3.5 flex-shrink-0 inline-block">
            <Star className="absolute inset-0 w-3.5 h-3.5 opacity-25 fill-current stroke-current" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
              <Star className="w-3.5 h-3.5 fill-current stroke-current" />
            </span>
          </span>
        );
      })}
    </div>
  );
}

export const BeatmapCard: React.FC<BeatmapCardProps> = ({
  bounty, isPlaying, audioProgress,
  onTogglePlay, onScrubAudio, onVote, onFavorite, onOpenComments, onInspectCard,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [spinClass, setSpinClass] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [localComments, setLocalComments] = useState<BeatmapComment[]>(bounty.comments);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    const numId = parseInt(bounty.id, 10);
    if (!showComments || isNaN(numId)) return;
    api.comments.list(numId).then((cs) => {
      if (cs && cs.length > 0) {
        setLocalComments(cs.map((c) => ({
          id: c.id,
          user: c.user,
          avatar: `https://a.ppy.sh/${c.userId}`,
          time: c.time,
          text: c.text,
          rating: c.rating ?? undefined,
          parentId: c.parentId != null ? String(c.parentId) : undefined,
        })));
      }
    });
  }, [showComments, bounty.id]);
  const spinRef = useRef<(() => void) | null>(null);

  const { header: headerBgClass, fill: barFillColor } = starColorScheme(bounty.difficultyRating);

  const formatTime = (ratio: number, total: number) => {
    const s = Math.floor(ratio * total);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const triggerSpin = (callback: () => void) => {
    spinRef.current = callback;
    setSpinClass('spinning');
  };

  const handleAnimationEnd = () => {
    spinRef.current?.();
    spinRef.current = null;
    setSpinClass('');
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-scrub]') || target.closest('input') || target.closest('textarea')) return;
    setIsFlipped((f) => !f);
  };

  const handleSubmitComment = async () => {
    const text = newComment.trim();
    if (!text) return;
    const numId = parseInt(bounty.id, 10);
    const optimistic: BeatmapComment = {
      id: Date.now().toString(),
      user: 'you',
      avatar: '',
      time: 'just now',
      text,
      rating: undefined,
    };
    setLocalComments((prev) => [optimistic, ...prev]);
    setNewComment('');
    if (!isNaN(numId)) api.comments.post(numId, text).catch(() => {});
  };

  const handleSubmitReply = async (parentId: string) => {
    const text = replyText.trim();
    if (!text) return;
    const numId = parseInt(bounty.id, 10);
    const reply: BeatmapComment = {
      id: Date.now().toString(),
      user: 'you',
      avatar: '',
      time: 'just now',
      text,
      parentId,
    };
    setLocalComments((prev) => {
      const idx = prev.findIndex((c) => c.id === parentId);
      const next = [...prev];
      next.splice(idx + 1, 0, reply);
      return next;
    });
    setReplyText('');
    setReplyingTo(null);
    const parentNumId = parseInt(parentId, 10);
    if (!isNaN(numId)) api.comments.post(numId, text, undefined, isNaN(parentNumId) ? undefined : parentNumId).catch(() => {});
  };

  const innerClass = `card-inner ${isFlipped ? 'flipped' : ''} ${spinClass}`;

  return (
    <div className="card-scene w-full" style={{ height: '540px' }}>
      <div
        className={innerClass}
        onAnimationEnd={handleAnimationEnd}
        onClick={handleCardClick}
        style={{ cursor: 'pointer' }}
      >
        {/* ── FRONT FACE ── */}
        <div className="card-face bg-[#0f172a] border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-slate-500/90 transition-shadow duration-300 flex flex-col text-slate-100 group">

          {/* Star Rating Banner */}
          <div className={`w-full py-1.5 px-3 flex items-center justify-between font-bold text-xs tracking-wider select-none flex-shrink-0 ${headerBgClass}`}>
            <StarRow rating={bounty.difficultyRating} />
            <span className="font-mono font-black text-sm tracking-tight">{bounty.difficultyRating.toFixed(2)}</span>
          </div>

          {/* Cover Artwork */}
          <div className="relative h-28 w-full bg-slate-900 overflow-hidden flex-shrink-0">
            <img
              src={bounty.bannerUrl}
              alt={bounty.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/20 to-transparent" />
            <span className="absolute top-2.5 left-2.5 bg-slate-950/80 backdrop-blur-md text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-slate-700/80 text-slate-200">
              {bounty.genre}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSpin(onFavorite); }}
              aria-label="Favorite"
              className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                bounty.userFavorited
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/60'
                  : 'bg-slate-950/60 text-slate-400 hover:text-white border border-slate-700/60'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${bounty.userFavorited ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
            <div className="absolute bottom-2 right-2.5 bg-slate-950/85 backdrop-blur-md px-2 py-0.5 rounded-md border border-slate-700/80 flex items-center gap-1.5 text-[11px]">
              <span className="font-bold text-white font-mono">{bounty.votes.toLocaleString()}</span>
              <span className="text-slate-400 text-[10px]">votes</span>
            </div>
          </div>

          {/* Info */}
          <div className="px-4 pt-3 flex-shrink-0">
            <h3 className="text-sm font-bold text-white tracking-tight line-clamp-1 group-hover:text-amber-400 transition-colors">
              {bounty.title}
            </h3>
            <p className="text-[11px] text-slate-300 font-medium mt-0.5">{bounty.artist}
              <span className="text-slate-500 font-normal"> · mapped by </span>
              <span className="text-slate-200 font-semibold">{bounty.mapper}</span>
            </p>
            <div className="mt-1.5 mb-2">
              <span className="inline-block bg-slate-800/90 text-slate-200 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-700">
                {bounty.difficultyName}
              </span>
            </div>
          </div>

          {/* Panel switcher */}
          <div className="flex-1 flex flex-col px-4 pb-2 min-h-0 overflow-hidden">
            {!showComments ? (
              <>
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-2 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                  <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Length</span>
                      <span className="text-slate-100 font-bold font-mono">{bounty.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">BPM</span>
                      <span className="text-slate-100 font-bold font-mono">{bounty.bpm}</span>
                    </div>
                  </div>
                  {[
                    { label: 'Circle Size', value: bounty.circleSize, max: 7 },
                    { label: 'Approach Rate', value: bounty.approachRate, max: 10 },
                    { label: 'Accuracy', value: bounty.accuracy, max: 10 },
                    { label: 'HP Drain', value: bounty.hpDrain, max: 10 },
                  ].map(({ label, value, max }) => (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">{label}</span>
                        <span className="text-slate-200 font-bold font-mono">{value.toFixed(1)}</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barFillColor}`}
                          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5 flex items-center gap-2.5 flex-shrink-0 mt-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      isPlaying ? 'bg-amber-400 text-slate-950 scale-105' : 'bg-slate-800 text-white hover:bg-slate-700'
                    }`}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                  </button>
                  <div
                    data-scrub="true"
                    onClick={(e) => { e.stopPropagation(); onScrubAudio(e); }}
                    className="flex-1 h-2 bg-slate-800 rounded-full relative overflow-hidden cursor-pointer"
                  >
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all ${isPlaying ? 'bg-amber-400' : 'bg-slate-400'}`}
                      style={{ width: `${Math.round(audioProgress * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 tabular-nums font-mono w-12 text-right">
                    {formatTime(audioProgress, bounty.previewSeconds || 60)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between mb-2 px-0">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                    {localComments.length} comment{localComments.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pb-2 pr-0.5" style={{ scrollbarWidth: 'thin' }}>
                  {localComments.length === 0 && (
                    <p className="text-xs text-slate-600 text-center py-4">No comments yet. Be the first!</p>
                  )}
                  {localComments.filter((c) => !c.parentId).map((c) => {
                    const threadReplies = localComments.filter((r) => r.parentId === c.id);
                    return (
                      <div key={c.id}>
                        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-2.5">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              {c.avatar ? (
                                <img
                                  src={c.avatar}
                                  alt={c.user}
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                  className="w-5 h-5 rounded-full object-cover flex-shrink-0 border border-slate-600"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[9px] font-bold text-slate-300 uppercase flex-shrink-0">
                                  {c.user[0]}
                                </div>
                              )}
                              <span className="text-[11px] font-bold text-slate-200">{c.user}</span>
                              <span className="text-[10px] text-slate-600">{c.time}</span>
                            </div>
                            {c.rating != null && (
                              <span className={`text-[10px] font-mono font-bold ${ratingColors[(c.rating - 1) % ratingColors.length]}`}>
                                ★{c.rating}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-300 leading-snug">{c.text}</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplyingTo(replyingTo === c.id ? null : c.id);
                              setReplyText('');
                            }}
                            className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500 hover:text-amber-400 transition-colors"
                          >
                            <CornerDownRight className="w-3 h-3" />
                            Reply
                          </button>

                          {replyingTo === c.id && (
                            <div
                              className="mt-2 flex gap-1.5 pl-3 border-l-2 border-slate-700"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                autoFocus
                                type="text"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitReply(c.id); }}
                                placeholder={`Reply to ${c.user}…`}
                                className="flex-1 bg-slate-950/60 border border-slate-800 rounded-md px-2 py-1 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600"
                              />
                              <button
                                type="button"
                                onClick={() => handleSubmitReply(c.id)}
                                className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                              >
                                <Send className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}

                          {threadReplies.length > 0 && (
                            <div className="ml-3 mt-1 pl-2.5 border-l-2 border-slate-700/50 space-y-1">
                              {threadReplies.map((r) => (
                                <div key={r.id} className="bg-slate-900/50 border border-slate-800/60 rounded-lg p-2">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    {r.avatar ? (
                                      <img
                                        src={r.avatar}
                                        alt={r.user}
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                        className="w-4 h-4 rounded-full object-cover flex-shrink-0 border border-slate-600"
                                      />
                                    ) : (
                                      <div className="w-4 h-4 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-[8px] font-bold text-slate-400 uppercase flex-shrink-0">
                                        {r.user[0]}
                                      </div>
                                    )}
                                    <span className="text-[10px] font-bold text-slate-300">{r.user}</span>
                                    <span className="text-[9px] text-slate-600">{r.time}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 leading-snug">{r.text}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="mt-2 flex gap-1.5 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment(); }}
                    placeholder="Add a comment…"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400/60 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleSubmitComment}
                    className="px-2.5 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors flex-shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-auto pt-3 px-4 pb-4 border-t border-slate-800 flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSpin(onVote); }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                bounty.userVoted
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold'
              }`}
            >
              {bounty.userVoted
                ? <><CheckCircle2 className="w-3.5 h-3.5" /><span>Voted (+{bounty.bountyRewardPoints} pts)</span></>
                : <span>Vote (+{bounty.bountyRewardPoints} pts)</span>}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowComments((v) => !v);
                onOpenComments();
              }}
              className={`px-2.5 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                showComments
                  ? 'bg-amber-400/20 border-amber-400/60 text-amber-400'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
              title="Toggle comments"
            >
              {showComments
                ? <X className="w-3.5 h-3.5" />
                : <MessageSquare className="w-3.5 h-3.5 text-slate-400" />}
              {!showComments && localComments.length > 0 && (
                <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded-full font-bold">{localComments.length}</span>
              )}
            </button>

            {onInspectCard && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onInspectCard(); }}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── BACK FACE ── */}
        <div className="card-face card-face-back bg-[#0f172a] border border-slate-700/80 rounded-2xl overflow-hidden shadow-lg flex flex-col text-slate-100">
          <div className={`w-full py-2 px-3 flex items-center justify-between font-bold text-xs tracking-wider select-none flex-shrink-0 ${headerBgClass}`}>
            <span className="font-mono font-black">BOUNTY CHALLENGES</span>
            <Trophy className="w-4 h-4" />
          </div>

          <div className="relative h-20 overflow-hidden flex-shrink-0">
            <img src={bounty.bannerUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a]/95 via-[#0f172a]/70 to-[#0f172a]/95" />
            <div className="absolute inset-0 px-3 py-2.5 flex flex-col justify-center gap-0.5">
              <p className="text-sm font-black text-white line-clamp-2 leading-tight">{bounty.title}</p>
              <p className="text-[11px] text-slate-300 truncate">{bounty.artist} · <span className="text-slate-500">mapped by</span> {bounty.mapper}</p>
              <p className="text-[10px] text-amber-400 font-mono font-bold">
                ★ {bounty.difficultyRating.toFixed(2)} · {bounty.difficultyName}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              Complete challenges · Earn points
            </p>
            {bounty.challenges.map((ch) => {
              const colors = difficultyColors[ch.difficulty];
              return (
                <div key={ch.id} className={`rounded-xl border p-3 ${colors.bg} ${colors.border}`}>
                  <div className="flex items-start gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.badge} ${colors.text}`}>
                      {challengeIcons[ch.icon] ?? <Trophy className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-bold ${colors.text} leading-tight`}>{ch.title}</p>
                        <span className={`text-[10px] font-mono font-black ${colors.text} flex-shrink-0`}>+{ch.reward} pts</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{ch.description}</p>
                      <p className="text-[10px] text-slate-600 mt-1 font-mono">{ch.completedBy.toLocaleString()} players completed</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-slate-800 flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSpin(onVote); }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                bounty.userVoted ? 'bg-emerald-600 text-white' : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
            >
              {bounty.userVoted ? <><CheckCircle2 className="w-3.5 h-3.5" /> Voted</> : `Vote · +${bounty.bountyRewardPoints} pts`}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); triggerSpin(onFavorite); }}
              className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${
                bounty.userFavorited
                  ? 'bg-rose-500/20 border-rose-500/60 text-rose-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${bounty.userFavorited ? 'fill-rose-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BeatmapCard;
