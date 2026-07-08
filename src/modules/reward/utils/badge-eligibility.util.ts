import { BADGE_MILESTONES } from '../constants/reward.constants';

/**
 * Returns the badge ID earned at an exact streak milestone, or null if none.
 */
export function determineBadgeForStreak(currentStreak: number): number | null {
  const milestone = BADGE_MILESTONES.find((entry) => entry.streak === currentStreak);
  return milestone?.badgeId ?? null;
}
