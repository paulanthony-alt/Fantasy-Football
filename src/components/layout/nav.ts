import { ArrowLeftRight, CalendarRange, ClipboardList, LayoutDashboard, LineChart, Newspaper, Settings, Swords, Trophy, Users, UserPlus } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  shortcut?: string;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'G D' }] },
  {
    label: 'Research',
    items: [
      { to: '/players', label: 'Players', icon: Users, shortcut: 'G P' },
      { to: '/matchups', label: 'Matchups', icon: Swords, shortcut: 'G M' },
      { to: '/news', label: 'News & Injuries', icon: Newspaper, shortcut: 'G N' },
    ],
  },
  {
    label: 'Decisions',
    items: [
      { to: '/lineup', label: 'Lineup Optimizer', icon: ClipboardList, shortcut: 'G L' },
      { to: '/trade', label: 'Trade Analyzer', icon: ArrowLeftRight, shortcut: 'G T' },
      { to: '/waivers', label: 'Waivers', icon: UserPlus, shortcut: 'G W' },
    ],
  },
  { label: 'Markets', items: [{ to: '/betting', label: 'Betting Hub', icon: LineChart, shortcut: 'G B' }] },
];

export const FOOTER_NAV: NavItem[] = [
  { to: '/leagues', label: 'Leagues', icon: Trophy },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const MOBILE_TABS: NavItem[] = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/trade', label: 'Trade', icon: ArrowLeftRight },
  { to: '/lineup', label: 'Lineup', icon: ClipboardList },
  { to: '/betting', label: 'Bets', icon: LineChart },
];

export const ALL_NAV: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_NAV, { to: '/matchups', label: 'Schedule', icon: CalendarRange }].filter((v, i, a) => a.findIndex((x) => x.to === v.to) === i);
