import { determineBadgeForStreak } from './badge-eligibility.util';

describe('determineBadgeForStreak', () => {
  it('returns badge ID at exact milestones', () => {
    expect(determineBadgeForStreak(3)).toBe(1);
    expect(determineBadgeForStreak(5)).toBe(2);
    expect(determineBadgeForStreak(7)).toBe(3);
    expect(determineBadgeForStreak(10)).toBe(4);
    expect(determineBadgeForStreak(15)).toBe(5);
  });

  it('returns null between milestones', () => {
    expect(determineBadgeForStreak(1)).toBeNull();
    expect(determineBadgeForStreak(4)).toBeNull();
    expect(determineBadgeForStreak(6)).toBeNull();
    expect(determineBadgeForStreak(11)).toBeNull();
  });
});
