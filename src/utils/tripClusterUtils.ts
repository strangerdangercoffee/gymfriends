import type { UserAreaPlan, User } from '../types';

export function tripClusterKey(plan: UserAreaPlan): string {
  return `${plan.areaId}|${plan.startDate}|${plan.endDate}`;
}

/** Group plans with identical area + date range (shared group trip). */
export function clusterAreaPlans(plans: UserAreaPlan[]): UserAreaPlan[][] {
  const map = new Map<string, UserAreaPlan[]>();
  for (const p of plans) {
    const k = tripClusterKey(p);
    if (!map.has(k)) map.set(k, []);
    const arr = map.get(k)!;
    if (!arr.some((x) => x.userId === p.userId)) arr.push(p);
  }
  return Array.from(map.values()).map((g) =>
    g.sort((a, b) => a.userId.localeCompare(b.userId))
  );
}

function firstName(full: string): string {
  const t = full.trim();
  if (!t) return '?';
  return t.split(/\s+/)[0] || t;
}

function joinNames(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function othersFriendsPhrase(n: number): string {
  if (n <= 0) return '';
  if (n === 1) return 'one friend';
  return `${n} friends`;
}

/**
 * @param friends - Viewer’s friends (e.g. shareSchedule === true) for “known” names on others’ trips.
 */
export function formatTripClusterLabel(opts: {
  viewerUserId: string;
  viewerName: string;
  friends: User[];
  memberPlans: UserAreaPlan[];
  nameById: Record<string, string>;
}): string {
  const { viewerUserId, viewerName, friends, memberPlans, nameById } = opts;
  const names: Record<string, string> = { ...nameById };
  names[viewerUserId] = firstName(viewerName || 'You');
  for (const f of friends) {
    names[f.id] = firstName(f.name || 'Friend');
  }

  const memberIds = [...new Set(memberPlans.map((p) => p.userId))].sort();
  const friendSet = new Set(friends.map((f) => f.id));

  if (memberIds.includes(viewerUserId)) {
    const others = memberIds.filter((id) => id !== viewerUserId);
    const parts = others.map((id) => names[id] || 'Someone');
    if (parts.length === 0) return 'My trip';
    return `My trip with ${joinNames(parts)}`;
  }

  const unknownCount = memberIds.filter((id) => !friendSet.has(id)).length;
  if (unknownCount === 0) {
    return joinNames(memberIds.map((id) => names[id] || 'Friend'));
  }

  const knownMembers = memberIds.filter((id) => friendSet.has(id));
  const knownFirstNames = knownMembers.map((id) => names[id] || 'Friend');

  if (knownFirstNames.length === 0) {
    return memberIds.length === 1
      ? 'A friend’s trip'
      : `${memberIds.length} friends’ trip`;
  }
  if (knownFirstNames.length === 1) {
    const rest = memberIds.length - 1;
    return `${knownFirstNames[0]} and ${othersFriendsPhrase(rest)}`;
  }
  const rest = memberIds.length - 2;
  return `${knownFirstNames[0]}, ${knownFirstNames[1]} and ${othersFriendsPhrase(rest)}`;
}
