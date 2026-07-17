type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    CHART: 2,
    TRADING_BOTS: 3,
    ANALYSIS_TOOL: 4,
    COPY_TRADING: 5,
    TRADINGVIEW: 6,
    TUTORIAL: 7,
    SIGNALS: 8,
    AUTO_TRADES: 9,
    SCANNER: 10,
    SMART_AUTO: 11,
    MANUAL_TRADING: 12,
    EASY_TOOL: 13,
    SIGNAL_CENTRE: 14,
    MARKETKILLER: 15,
    MULTI_TRADER: 16,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-charts',
    'id-trading-bots',
    'id-analysis-tool',
    'id-copy-trading',
    'id-tradingview',
    'id-tutorials',
    'id-signals',
    'id-auto-trades',
    'id-scanner',
    'id-smart-auto',
    'id-manual-trading',
    'id-easy-tool',
    'id-signal-centre',
    'id-marketkiller',
    'id-multi-trader',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
