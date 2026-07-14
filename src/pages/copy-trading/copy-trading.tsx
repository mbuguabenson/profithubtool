import { useEffect, useRef, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import CopyTradingManager from './copy-trading-manager';
import { getGlobalCopyTradingManager } from './copy-trading-manager-singleton';
import Dialog from '@/components/shared_ui/dialog';
import { useStore } from '@/hooks/useStore';
import { getAppId, isProduction } from '@/components/shared/utils/config/config';
import { getTradeLogs } from './replicator';
import './copy-trading.scss';

// ─── Token Bridge Utilities ───────────────────────────────────────────────────
const getAccountsList = (): Record<string, string> => {
    try { return JSON.parse(localStorage.getItem('accountsList') || '{}'); }
    catch { return {}; }
};

const getActiveLoginId = (): string => localStorage.getItem('active_loginid') || '';

const getActiveToken = (): string | null => {
    const list = getAccountsList();
    const id = getActiveLoginId();
    return list[id] || null;
};

const getAllStoredTokens = (): string[] => {
    const list = getAccountsList();
    return Object.values(list).filter(Boolean);
};

const getCopyTokensArray = (): string[] => {
    try { return JSON.parse(localStorage.getItem('copyTokensArray') || '[]'); }
    catch { return []; }
};

// ─── Component ────────────────────────────────────────────────────────────────
const CopyTrading = observer(() => {
    const { client } = useStore();
    const htmlContentRef = useRef<HTMLDivElement>(null);
    const managerRef = useRef<CopyTradingManager | null>(null);

    // Active tab
    const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'logs' | 'settings'>('dashboard');

    // UI state
    const [isTutorialOpen, setIsTutorialOpen] = useState(false);
    const [tutorialUrl, setTutorialUrl] = useState('');
    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [demoToRealActive, setDemoToRealActive] = useState(false);
    const [copyTradingActive, setCopyTradingActive] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [successMessage2, setSuccessMessage2] = useState('');
    const [tokenInput, setTokenInput] = useState('');

    // Account info state (React-driven)
    const [loginIdDisplay, setLoginIdDisplay] = useState<string>('Loading...');
    const [balanceDisplay, setBalanceDisplay] = useState<string>('------');
    const [clientsTotal, setClientsTotal] = useState(0);
    const [clientsConnected, setClientsConnected] = useState(0);
    const [copierList, setCopierList] = useState<string[]>([]);

    // Live Trade Logs state
    const [tradeLogs, setTradeLogs] = useState<any[]>([]);

    // Auto-detect connected account on mount
    useEffect(() => {
        const active = getActiveLoginId();
        if (active) {
            setLoginIdDisplay(active.startsWith('VR') ? `Demo: ${active}` : active);
        }
    }, []);

    // ─── Manager Setup & Token Auto-Sync ─────────────────────────────────────
    useEffect(() => {
        const autoSyncLoginTokens = async (manager: CopyTradingManager) => {
            try {
                const accountsList = getAccountsList();
                const activeToken = getActiveToken();
                let storedTokens = getCopyTokensArray();
                let updated = false;

                // Auto-add all login account tokens to copier list (except active/master)
                Object.keys(accountsList).forEach(key => {
                    const token = accountsList[key];
                    if (token && token !== activeToken && !storedTokens.includes(token)) {
                        storedTokens.push(token);
                        updated = true;
                    }
                });

                if (updated) {
                    localStorage.setItem('copyTokensArray', JSON.stringify(storedTokens));
                    for (const token of storedTokens) {
                        if (!manager.copiers.find(c => c.token === token)) {
                            try {
                                const copier = manager.addCopier(token);
                                const isCopyTrading = localStorage.getItem('iscopyTrading') === 'true';
                                if (isCopyTrading && copier) {
                                    void manager.connectCopier(copier.id);
                                }
                            } catch { /* Already added */ }
                        }
                    }
                }
                refreshClientList();
            } catch (e) {
                console.warn('Auto-sync login tokens failed:', e);
            }
        };

        const setupManager = () => {
            const globalManager = getGlobalCopyTradingManager();
            if (globalManager) {
                managerRef.current = globalManager;
                autoSyncLoginTokens(globalManager);
                return true;
            }
            return false;
        };

        if (!setupManager()) {
            const retryInterval = setInterval(() => {
                if (setupManager()) clearInterval(retryInterval);
            }, 100);

            setTimeout(() => {
                clearInterval(retryInterval);
                if (!managerRef.current) {
                    const m = new CopyTradingManager();
                    managerRef.current = m;
                    autoSyncLoginTokens(m);
                }
            }, 2000);
        }

        // Sync demo to real & restore state
        const syncTokensToManager = async () => {
            const manager = managerRef.current;
            if (!manager) return;
            await new Promise(resolve => setTimeout(resolve, 150));

            const isDemoToReal = localStorage.getItem('demo_to_real') === 'true';
            if (isDemoToReal) {
                const accounts_list = getAccountsList();
                const key = Object.keys(accounts_list).find(k => !k.startsWith('VR'));
                if (key) manager.setMasterToken(accounts_list[key]);
            }

            const copyTokensArray = getCopyTokensArray();
            for (const token of copyTokensArray) {
                if (!manager.copiers.find(c => c.token === token)) {
                    try { manager.addCopier(token); } catch { /* Already exists */ }
                }
            }
            refreshClientList();
        };

        setTimeout(syncTokensToManager, 200);

        setDemoToRealActive(localStorage.getItem('demo_to_real') === 'true');
        setCopyTradingActive(localStorage.getItem('iscopyTrading') === 'true');

        const logInterval = setInterval(() => setTradeLogs(getTradeLogs()), 1000);
        return () => clearInterval(logInterval);
    }, []);

    // ─── Account Details Poller ───────────────────────────────────────────────
    useEffect(() => {
        const updateAccountDetails = async () => {
            const accounts_list = getAccountsList();
            const allTokens = getAllStoredTokens();
            const copyTokensArray = getCopyTokensArray();
            const uniqueTokens = Array.from(new Set([...allTokens, ...copyTokensArray].filter(Boolean)));

            if (uniqueTokens.length === 0) {
                setLoginIdDisplay('Not logged in');
                setBalanceDisplay('------');
                return;
            }

            const appId = getAppId?.() ?? localStorage.getItem('APP_ID') ?? '1069';
            const baseURL = isProduction()
                ? 'https://api.derivws.com/trading/v1/'
                : 'https://staging-api.derivws.com/trading/v1/';

            for (const token of uniqueTokens) {
                try {
                    const res = await fetch(`${baseURL}options/accounts`, {
                        method: 'GET',
                        headers: { Authorization: `Bearer ${token}`, 'Deriv-App-ID': appId },
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const accounts = data?.data || [];
                        const realAcc = accounts.find((acc: any) =>
                            !acc.account_id.startsWith('VR') && !acc.account_id.startsWith('VRT')
                        );
                        if (realAcc) {
                            localStorage.setItem('cr_loginid', realAcc.account_id);
                            const active = getActiveLoginId();
                            setLoginIdDisplay(active?.startsWith('VR') ? `CR: ${realAcc.account_id}` : realAcc.account_id);
                            const balNum = parseFloat(realAcc.balance?.toString() || '0');
                            setBalanceDisplay(`${balNum.toFixed(2)} ${realAcc.currency || 'USD'}`);
                            return;
                        }
                    }
                } catch { /* Ignore per-token failures */ }
            }
            setLoginIdDisplay('CR — not linked yet');
            setBalanceDisplay('------');
        };

        const interval = setInterval(updateAccountDetails, 10000);
        updateAccountDetails();
        return () => clearInterval(interval);
    }, [client]);

    // ─── Client Count Poller ──────────────────────────────────────────────────
    useEffect(() => {
        const poll = setInterval(() => {
            const arr = getCopyTokensArray();
            setClientsTotal(arr.length);
            const active = managerRef.current?.copiers?.filter(c => c.status === 'connected').length ?? 0;
            setClientsConnected(active);
        }, 2000);
        return () => clearInterval(poll);
    }, []);

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const refreshClientList = useCallback(() => {
        setCopierList([...getCopyTokensArray()]);
    }, []);

    // ─── Handlers ─────────────────────────────────────────────────────────────
    const handleDemoToReal = async () => {
        const isStart = !demoToRealActive;
        const accounts_list = getAccountsList();
        const manager = managerRef.current;
        if (!manager) return;

        if (isStart) {
            const key = Object.keys(accounts_list).find(k => !k.startsWith('VR'));
            if (key) {
                const value = accounts_list[key];
                let arr = getCopyTokensArray();
                if (!arr.includes(value)) arr.push(value);
                localStorage.setItem('copyTokensArray', JSON.stringify(arr));
                localStorage.setItem('demo_to_real', 'true');
                manager.setMasterToken(value);
                if (localStorage.getItem('iscopyTrading') === 'true') {
                    try { await manager.connectMaster(); } catch { /* Ignore */ }
                }
                setDemoToRealActive(true);
                setSuccessMessage('✅ Demo to Real copy trading activated');
                setTimeout(() => setSuccessMessage(''), 6000);
                refreshClientList();
            } else {
                setErrorMessage('No real account (CR) found. Please log in to a real account first.');
                setErrorModalVisible(true);
            }
        } else {
            const key = Object.keys(accounts_list).find(k => !k.startsWith('VR'));
            if (key) {
                const value = accounts_list[key];
                let arr = getCopyTokensArray().filter((t: string) => t !== value);
                localStorage.setItem('copyTokensArray', JSON.stringify(arr));
                localStorage.setItem('demo_to_real', 'false');
                manager.disconnectMaster();
                manager.setMasterToken('');
                setDemoToRealActive(false);
                setSuccessMessage('⏹️ Demo to Real stopped');
                setTimeout(() => setSuccessMessage(''), 6000);
                refreshClientList();
            }
        }
    };

    const handleStartCopyTrading = async () => {
        const isStart = !copyTradingActive;
        const manager = managerRef.current;
        if (!manager) return;

        if (isStart) {
            try {
                const copyTokensArray = getCopyTokensArray();
                if (copyTokensArray.length > 0) {
                    try {
                        const { saveAllTokensToSupabase } = await import('@/utils/supabase');
                        void saveAllTokensToSupabase(copyTokensArray);
                    } catch { /* Ignore supabase errors */ }
                }
                manager.enableReplication(true);
                if (localStorage.getItem('demo_to_real') === 'true' && manager.master.token) {
                    try { await manager.connectMaster(); } catch { /* Ignore */ }
                }
                for (const token of copyTokensArray) {
                    try {
                        let copier = manager.copiers.find(c => c.token === token);
                        if (!copier) copier = manager.addCopier(token);
                        if (copier.enabled && copier.status !== 'connected') await manager.connectCopier(copier.id);
                    } catch { /* Ignore per-copier failures */ }
                }
                localStorage.setItem('iscopyTrading', 'true');
                setCopyTradingActive(true);
                setSuccessMessage2(`🚀 Replication live for ${copyTokensArray.length} clients!`);
                setTimeout(() => setSuccessMessage2(''), 8000);
            } catch (err) {
                setErrorMessage(`Failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`);
                setErrorModalVisible(true);
            }
        } else {
            manager.enableReplication(false);
            manager.disconnectMaster();
            manager.copiers.forEach(c => manager.disconnectCopier(c.id));
            localStorage.setItem('iscopyTrading', 'false');
            setCopyTradingActive(false);
            setSuccessMessage2('⏸️ Replication paused');
            setTimeout(() => setSuccessMessage2(''), 6000);
        }
    };

    const handleAddToken = async () => {
        const newToken = tokenInput.trim();
        const manager = managerRef.current;
        if (!manager) { setErrorMessage('Manager not active. Please log in first.'); setErrorModalVisible(true); return; }
        if (!newToken) return;

        const arr = getCopyTokensArray();
        if (arr.includes(newToken)) {
            setErrorMessage('This token is already in your client list.');
            setErrorModalVisible(true);
        } else {
            try {
                const copier = manager.addCopier(newToken);
                arr.push(newToken);
                localStorage.setItem('copyTokensArray', JSON.stringify(arr));
                if (localStorage.getItem('iscopyTrading') === 'true') {
                    try { await manager.connectCopier(copier.id); } catch { /* Ignore */ }
                }
                setTokenInput('');
                refreshClientList();
            } catch (e: any) {
                setErrorMessage(e?.error?.message || e?.message || 'Authorization failed. Make sure the token is valid.');
                setErrorModalVisible(true);
            }
        }
    };

    const handleRemoveToken = (index: number) => {
        const manager = managerRef.current;
        const tokens = getCopyTokensArray();
        const tokenToRemove = tokens[index];
        if (manager) {
            const copier = manager.copiers.find(c => c.token === tokenToRemove);
            if (copier) manager.removeCopier(copier.id);
        }
        tokens.splice(index, 1);
        localStorage.setItem('copyTokensArray', JSON.stringify(tokens));
        refreshClientList();
    };

    const handleAutoImportTokens = () => {
        const accountsList = getAccountsList();
        const activeToken = getActiveToken();
        let arr = getCopyTokensArray();
        let added = 0;
        Object.values(accountsList).forEach((token: string) => {
            if (token && token !== activeToken && !arr.includes(token)) {
                arr.push(token);
                if (managerRef.current) {
                    try { managerRef.current.addCopier(token); } catch { /* Already added */ }
                }
                added++;
            }
        });
        localStorage.setItem('copyTokensArray', JSON.stringify(arr));
        refreshClientList();
        setSuccessMessage2(added > 0 ? `✅ Auto-imported ${added} token(s) from your session` : 'No new tokens to import');
        setTimeout(() => setSuccessMessage2(''), 5000);
    };

    const handleSyncTokens = async () => {
        setIsSyncing(true);
        try {
            const manager = managerRef.current;
            if (manager) {
                const tokens = manager.copiers.map(c => c.token);
                localStorage.setItem('copyTokensArray', JSON.stringify(tokens));
                refreshClientList();
            }
        } finally {
            setIsSyncing(false);
        }
    };

    const openTutorial = () => { setTutorialUrl('https://www.youtube.com/embed/gsWzKmslEnY'); setIsTutorialOpen(true); };
    const closeTutorial = () => { setIsTutorialOpen(false); setTutorialUrl(''); };

    const truncateToken = (t: string) => t.length > 14 ? `${t.slice(0, 6)}••••${t.slice(-4)}` : t;

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className='ct2-root' ref={htmlContentRef}>
            {/* Error Dialog */}
            <Dialog
                is_visible={errorModalVisible}
                title='System Alert'
                confirm_button_text='OK'
                onConfirm={() => setErrorModalVisible(false)}
                onClose={() => setErrorModalVisible(false)}
                portal_element_id='modal_root'
                login={() => {}}
            >
                <div className='ct2-dialog-body'>{errorMessage}</div>
            </Dialog>

            {/* Tutorial Overlay */}
            {isTutorialOpen && (
                <div className='ct2-video-overlay' onClick={closeTutorial}>
                    <div className='ct2-video-wrapper' onClick={e => e.stopPropagation()}>
                        <button className='ct2-video-close' onClick={closeTutorial}>✕</button>
                        <iframe
                            width='100%' height='100%'
                            src={tutorialUrl}
                            title='Copy Trading Tutorial'
                            frameBorder='0'
                            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                            allowFullScreen
                        />
                    </div>
                </div>
            )}

            {/* ── Animated Background ── */}
            <div className='ct2-bg'>
                <div className='ct2-bg__mesh' />
                <div className='ct2-bg__orb ct2-bg__orb--1' />
                <div className='ct2-bg__orb ct2-bg__orb--2' />
                <div className='ct2-bg__orb ct2-bg__orb--3' />
            </div>

            {/* ── Main Content ── */}
            <div className='ct2-content'>

                {/* ── Hero Header ── */}
                <div className='ct2-hero'>
                    <div className='ct2-hero__left'>
                        <div className='ct2-hero__badge'>
                            <span className='ct2-hero__badge-dot' />
                            Replicator Node
                        </div>
                        <h1 className='ct2-hero__title'>
                            Copy Trading
                            <span className='ct2-hero__title-accent'> Console</span>
                        </h1>
                        <p className='ct2-hero__subtitle'>
                            Replicate trades across linked accounts in real-time
                        </p>
                    </div>
                    <div className='ct2-hero__right'>
                        {/* Live Account Card */}
                        <div className='ct2-account-card'>
                            <div className='ct2-account-card__glow' />
                            <div className='ct2-account-card__row'>
                                <div className='ct2-account-card__field'>
                                    <span className='ct2-account-card__label'>Master Account</span>
                                    <span className='ct2-account-card__value'>{loginIdDisplay}</span>
                                </div>
                                <div className='ct2-account-card__sep' />
                                <div className='ct2-account-card__field'>
                                    <span className='ct2-account-card__label'>Balance</span>
                                    <span className='ct2-account-card__value ct2-account-card__value--green'>{balanceDisplay}</span>
                                </div>
                                <div className='ct2-account-card__sep' />
                                <div className='ct2-account-card__field'>
                                    <span className='ct2-account-card__label'>Clients</span>
                                    <span className='ct2-account-card__value'>{clientsTotal}</span>
                                </div>
                                <div className='ct2-account-card__sep' />
                                <div className='ct2-account-card__field'>
                                    <span className='ct2-account-card__label'>Live</span>
                                    <span className={`ct2-account-card__value ${clientsConnected > 0 ? 'ct2-account-card__value--green' : ''}`}>{clientsConnected}</span>
                                </div>
                            </div>
                            {/* Master control buttons */}
                            <div className='ct2-account-card__actions'>
                                <button
                                    className={`ct2-pill-btn ${demoToRealActive ? 'ct2-pill-btn--danger' : 'ct2-pill-btn--blue'}`}
                                    onClick={handleDemoToReal}
                                >
                                    {demoToRealActive ? '⏹ Stop Demo→Real' : '⚡ Demo → Real'}
                                </button>
                                <button className='ct2-pill-btn ct2-pill-btn--ghost' onClick={openTutorial}>
                                    ▶ Guide
                                </button>
                            </div>
                            {successMessage && <div className='ct2-success-banner'>{successMessage}</div>}
                        </div>
                    </div>
                </div>

                {/* ── Master Toggle ── */}
                <div className='ct2-master-toggle'>
                    <div className='ct2-master-toggle__left'>
                        <div className={`ct2-status-ring ${copyTradingActive ? 'ct2-status-ring--active' : ''}`}>
                            <div className='ct2-status-ring__inner' />
                        </div>
                        <div>
                            <div className='ct2-master-toggle__label'>Replication Engine</div>
                            <div className='ct2-master-toggle__sublabel'>
                                {copyTradingActive ? `Live — copying to ${clientsTotal} account(s)` : 'Standby — not copying'}
                            </div>
                        </div>
                    </div>
                    <button
                        className={`ct2-master-btn ${copyTradingActive ? 'ct2-master-btn--stop' : 'ct2-master-btn--start'}`}
                        onClick={handleStartCopyTrading}
                    >
                        <span className='ct2-master-btn__icon'>{copyTradingActive ? '⏹' : '▶'}</span>
                        {copyTradingActive ? 'PAUSE REPLICATION' : 'START COPY TRADING'}
                    </button>
                </div>
                {successMessage2 && <div className='ct2-success-banner ct2-success-banner--centered'>{successMessage2}</div>}

                {/* ── Tab Bar ── */}
                <div className='ct2-tabs'>
                    {(['dashboard', 'clients', 'logs', 'settings'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`ct2-tab ${activeTab === tab ? 'ct2-tab--active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'dashboard' && '📊'}
                            {tab === 'clients' && '👥'}
                            {tab === 'logs' && '📡'}
                            {tab === 'settings' && '⚙️'}
                            <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                            {tab === 'clients' && clientsTotal > 0 && (
                                <span className='ct2-tab__badge'>{clientsTotal}</span>
                            )}
                            {tab === 'logs' && tradeLogs.length > 0 && (
                                <span className='ct2-tab__badge ct2-tab__badge--pulse'>{tradeLogs.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Dashboard Tab ── */}
                {activeTab === 'dashboard' && (
                    <div className='ct2-tab-panel'>
                        <div className='ct2-stats-grid'>
                            <div className='ct2-stat-card'>
                                <div className='ct2-stat-card__icon'>👥</div>
                                <div className='ct2-stat-card__value'>{clientsTotal}</div>
                                <div className='ct2-stat-card__label'>Total Clients</div>
                            </div>
                            <div className='ct2-stat-card ct2-stat-card--green'>
                                <div className='ct2-stat-card__icon'>🔗</div>
                                <div className='ct2-stat-card__value'>{clientsConnected}</div>
                                <div className='ct2-stat-card__label'>Connected</div>
                            </div>
                            <div className='ct2-stat-card ct2-stat-card--blue'>
                                <div className='ct2-stat-card__icon'>📋</div>
                                <div className='ct2-stat-card__value'>{tradeLogs.length}</div>
                                <div className='ct2-stat-card__label'>Trade Events</div>
                            </div>
                            <div className={`ct2-stat-card ${copyTradingActive ? 'ct2-stat-card--green' : 'ct2-stat-card--dim'}`}>
                                <div className='ct2-stat-card__icon'>{copyTradingActive ? '🟢' : '⚪'}</div>
                                <div className='ct2-stat-card__value'>{copyTradingActive ? 'LIVE' : 'OFF'}</div>
                                <div className='ct2-stat-card__label'>Engine Status</div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className='ct2-quick-actions'>
                            <h3 className='ct2-section-title'>Quick Actions</h3>
                            <div className='ct2-action-cards'>
                                <div className='ct2-action-card' onClick={handleAutoImportTokens}>
                                    <div className='ct2-action-card__icon'>⚡</div>
                                    <div className='ct2-action-card__title'>Auto-Import Tokens</div>
                                    <div className='ct2-action-card__desc'>Sync all logged-in session accounts</div>
                                </div>
                                <div className='ct2-action-card' onClick={() => setActiveTab('clients')}>
                                    <div className='ct2-action-card__icon'>➕</div>
                                    <div className='ct2-action-card__title'>Add Client</div>
                                    <div className='ct2-action-card__desc'>Manually add a client auth token</div>
                                </div>
                                <div className='ct2-action-card' onClick={() => setActiveTab('logs')}>
                                    <div className='ct2-action-card__icon'>📡</div>
                                    <div className='ct2-action-card__title'>View Live Logs</div>
                                    <div className='ct2-action-card__desc'>Monitor real-time replication activity</div>
                                </div>
                                <div className='ct2-action-card' onClick={openTutorial}>
                                    <div className='ct2-action-card__icon'>▶</div>
                                    <div className='ct2-action-card__title'>Watch Tutorial</div>
                                    <div className='ct2-action-card__desc'>Learn how copy trading works</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Clients Tab ── */}
                {activeTab === 'clients' && (
                    <div className='ct2-tab-panel'>
                        <div className='ct2-clients-layout'>
                            {/* Add Token Form */}
                            <div className='ct2-glass-card'>
                                <h3 className='ct2-glass-card__title'>Add Client Token</h3>
                                <p className='ct2-glass-card__desc'>
                                    Enter the API authorization token of the account to replicate trades into.
                                </p>
                                <div className='ct2-input-row'>
                                    <input
                                        id='tokenInput'
                                        type='text'
                                        className='ct2-input'
                                        placeholder='Enter client auth token...'
                                        value={tokenInput}
                                        onChange={e => setTokenInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddToken()}
                                    />
                                    <button className='ct2-btn ct2-btn--primary' onClick={handleAddToken}>Add</button>
                                </div>
                                <div className='ct2-input-row ct2-input-row--mt'>
                                    <button className='ct2-btn ct2-btn--accent ct2-btn--full' onClick={handleAutoImportTokens}>
                                        ⚡ Auto-Import from Login Session
                                    </button>
                                    <button
                                        className='ct2-btn ct2-btn--ghost'
                                        onClick={handleSyncTokens}
                                        disabled={isSyncing}
                                    >
                                        {isSyncing ? '↻ Syncing…' : '↻ Sync'}
                                    </button>
                                </div>
                                {successMessage2 && <div className='ct2-success-banner ct2-success-banner--mt'>{successMessage2}</div>}
                            </div>

                            {/* Clients List */}
                            <div className='ct2-glass-card'>
                                <div className='ct2-clients-header'>
                                    <h3 className='ct2-glass-card__title'>Client Accounts</h3>
                                    <span className='ct2-clients-count'>{copierList.length} added</span>
                                </div>
                                {copierList.length === 0 ? (
                                    <div className='ct2-empty-state'>
                                        <div className='ct2-empty-state__icon'>👤</div>
                                        <div className='ct2-empty-state__text'>No client accounts configured yet.</div>
                                        <div className='ct2-empty-state__sub'>Add tokens above or use Auto-Import.</div>
                                    </div>
                                ) : (
                                    <ul className='ct2-client-list'>
                                        {copierList.map((token, i) => {
                                            const copier = managerRef.current?.copiers?.find(c => c.token === token);
                                            const isConnected = copier?.status === 'connected';
                                            return (
                                                <li key={i} className='ct2-client-item'>
                                                    <div className='ct2-client-item__left'>
                                                        <div className={`ct2-client-dot ${isConnected ? 'ct2-client-dot--green' : ''}`} />
                                                        <span className='ct2-client-idx'>#{i + 1}</span>
                                                        <span className='ct2-client-token'>{truncateToken(token)}</span>
                                                    </div>
                                                    <div className='ct2-client-item__right'>
                                                        <span className={`ct2-client-status ${isConnected ? 'ct2-client-status--connected' : ''}`}>
                                                            {isConnected ? 'Connected' : 'Idle'}
                                                        </span>
                                                        <button className='ct2-client-del' onClick={() => handleRemoveToken(i)} title='Remove'>
                                                            🗑
                                                        </button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Logs Tab ── */}
                {activeTab === 'logs' && (
                    <div className='ct2-tab-panel'>
                        <div className='ct2-terminal'>
                            <div className='ct2-terminal__header'>
                                <span className='ct2-terminal__title'>📡 Live Replication Activity</span>
                                <span className={`ct2-terminal__badge ${copyTradingActive ? 'ct2-terminal__badge--live' : ''}`}>
                                    {copyTradingActive ? '● LIVE' : '○ IDLE'}
                                </span>
                            </div>
                            <div className='ct2-terminal__body'>
                                {tradeLogs.length === 0 ? (
                                    <div className='ct2-terminal__placeholder'>
                                        <div className='ct2-terminal__placeholder-icon'>📡</div>
                                        <div>Awaiting replication events…</div>
                                        <div className='ct2-terminal__placeholder-sub'>Start copy trading to see activity logs here.</div>
                                    </div>
                                ) : (
                                    <div className='ct2-terminal__log-scroll'>
                                        {tradeLogs.slice().reverse().map((log, i) => (
                                            <div key={i} className={`ct2-log-line ${log.error ? 'ct2-log-line--error' : 'ct2-log-line--success'}`}>
                                                <span className='ct2-log-time'>[{new Date(log.time).toLocaleTimeString()}]</span>
                                                <span className='ct2-log-acct'>({log.accountId}):</span>
                                                <span className='ct2-log-msg'>
                                                    {log.error ? `❌ ${log.error}` : `✅ Bought ${log.payload?.contract_type || 'contract'}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Settings Tab ── */}
                {activeTab === 'settings' && (
                    <div className='ct2-tab-panel'>
                        <div className='ct2-settings-grid'>
                            <div className='ct2-glass-card'>
                                <h3 className='ct2-glass-card__title'>Replication Mode</h3>
                                <div className='ct2-setting-item'>
                                    <div>
                                        <div className='ct2-setting-item__name'>Demo → Real Sync</div>
                                        <div className='ct2-setting-item__desc'>
                                            Copy trades from your demo account to your real CR account
                                        </div>
                                    </div>
                                    <button
                                        className={`ct2-toggle ${demoToRealActive ? 'ct2-toggle--on' : ''}`}
                                        onClick={handleDemoToReal}
                                    >
                                        <span className='ct2-toggle__knob' />
                                    </button>
                                </div>
                                <div className='ct2-setting-item'>
                                    <div>
                                        <div className='ct2-setting-item__name'>Copy Trading Engine</div>
                                        <div className='ct2-setting-item__desc'>
                                            Broadcast all executed trades to all connected client accounts
                                        </div>
                                    </div>
                                    <button
                                        className={`ct2-toggle ${copyTradingActive ? 'ct2-toggle--on' : ''}`}
                                        onClick={handleStartCopyTrading}
                                    >
                                        <span className='ct2-toggle__knob' />
                                    </button>
                                </div>
                            </div>
                            <div className='ct2-glass-card'>
                                <h3 className='ct2-glass-card__title'>Token Management</h3>
                                <div className='ct2-setting-btns'>
                                    <button className='ct2-btn ct2-btn--accent ct2-btn--full' onClick={handleAutoImportTokens}>
                                        ⚡ Auto-Import Session Tokens
                                    </button>
                                    <button className='ct2-btn ct2-btn--ghost ct2-btn--full' onClick={handleSyncTokens}>
                                        ↻ Sync from Manager
                                    </button>
                                </div>
                                <p className='ct2-hint'>
                                    Auto-Import reads all account tokens from your current login session and adds them as copy targets automatically.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default CopyTrading;
