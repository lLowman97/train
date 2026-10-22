import { supabase } from '@/lib/supabase';

export type Privacy = 'friends' | 'private';
export type PrivacyArea = 'privacy_workouts' | 'privacy_records' | 'privacy_bodyweight' | 'privacy_measurements';

export type Profile = {
  id: string;
  username: string;
} & Record<PrivacyArea, Privacy>;

export type FriendLink = {
  userId: string;
  username: string;
  /** accepted, incoming (they asked me) or outgoing (I asked them) */
  state: 'accepted' | 'incoming' | 'outgoing';
};

export type FeedRecord = {
  name: string;
  weight: number;
  previous_weight: number;
  e1rm: number;
  previous_e1rm: number;
};

export type FeedItem = {
  workoutId: string;
  userId: string;
  username: string;
  title: string;
  startedAt: string;
  finishedAt: string;
  details: {
    sets: number;
    volume: number;
    exercises: { name: string; sets: number; max_weight: number }[];
  } | null;
  records: FeedRecord[] | null;
};

export type FriendProfile = {
  username: string;
  workouts_this_week: number | null;
  records: { name: string; max_weight: number; best_e1rm: number }[] | null;
  weights: { date: string; value: number }[] | null;
  measurements: { type: string; date: string; value: number }[] | null;
};

async function myId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Nicht angemeldet.');
  return data.user.id;
}

export async function fetchMyProfile(): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, privacy_workouts, privacy_records, privacy_bodyweight, privacy_measurements')
    .eq('id', await myId())
    .single();
  if (error) throw error;
  return data;
}

export async function updatePrivacy(area: PrivacyArea, value: Privacy) {
  const { error } = await supabase.from('profiles').update({ [area]: value }).eq('id', await myId());
  if (error) throw error;
}

export async function searchUsers(query: string): Promise<{ id: string; username: string }[]> {
  const q = query.trim().toLowerCase().replace(/^@/, '');
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', `${q.replace(/[%_]/g, '\\$&')}%`)
    .neq('id', await myId())
    .order('username')
    .limit(10);
  if (error) throw error;
  return data;
}

export async function fetchFriendLinks(): Promise<FriendLink[]> {
  const me = await myId();
  const { data, error } = await supabase
    .from('friendships')
    .select(
      'user_id, friend_id, status, requester:profiles!friendships_user_id_fkey(username), addressee:profiles!friendships_friend_id_fkey(username)',
    );
  if (error) throw error;

  type Name = { username: string } | null;
  return data
    .map((f) => {
      const iAsked = f.user_id === me;
      const other = (iAsked ? f.addressee : f.requester) as unknown as Name;
      return {
        userId: iAsked ? f.friend_id : f.user_id,
        username: other?.username ?? '?',
        state: f.status === 'accepted' ? 'accepted' : iAsked ? 'outgoing' : 'incoming',
      } as FriendLink;
    })
    .sort((a, b) => a.username.localeCompare(b.username));
}

/** Sends a request, or accepts it right away if the other person already asked. */
export async function addFriend(userId: string) {
  const me = await myId();
  const { data: theirs } = await supabase
    .from('friendships')
    .select('status')
    .eq('user_id', userId)
    .eq('friend_id', me)
    .maybeSingle();
  if (theirs) return acceptFriend(userId);

  const { error } = await supabase.from('friendships').insert({ user_id: me, friend_id: userId });
  if (error && error.code !== '23505') throw error; // 23505: request already sent
}

export async function acceptFriend(userId: string) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('user_id', userId)
    .eq('friend_id', await myId());
  if (error) throw error;
}

/** Declines, cancels or ends a friendship, whichever direction it was created in. */
export async function removeFriend(userId: string) {
  const me = await myId();
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(user_id.eq.${me},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${me})`);
  if (error) throw error;
}

export async function fetchFeed(): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc('friend_feed', { p_limit: 30 });
  if (error) throw error;
  return data.map((r: Record<string, unknown>) => ({
    workoutId: String(r.workout_id),
    userId: String(r.user_id),
    username: String(r.username),
    title: String(r.title),
    startedAt: String(r.started_at),
    finishedAt: String(r.finished_at),
    details: (r.details as FeedItem['details']) ?? null,
    records: (r.records as FeedRecord[] | null) ?? null,
  }));
}

export async function fetchFriendProfile(userId: string): Promise<FriendProfile | null> {
  const { data, error } = await supabase.rpc('friend_profile', { p_friend_id: userId });
  if (error) throw error;
  return data;
}

export async function sharePlan(planId: string, friendId: string) {
  const { error } = await supabase.rpc('share_plan', { p_plan_id: planId, p_friend_id: friendId });
  if (error) throw error;
}
