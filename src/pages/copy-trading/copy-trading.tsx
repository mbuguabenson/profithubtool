import { useEffect, useRef, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import CopyTradingManager from './copy-trading-manager';
import { getGlobalCopyTradingManager } from './copy-trading-manager-singleton';
import Dialog from '@/components/shared_ui/dialog';
import { useStore } from '@/hooks/useStore';
import { getAppId, isProduction } from '@/components/shared/utils/config/config';
import { api_base } from '@/external/bot-skeleton';
import { getTradeLogs } from './replicator';
import {
    requestFollowProvider,
    getCopyRequestStatus,
    deleteRequest,
} from '@/utils/supabase-copy';
import './copy-trading.scss';

// ─── Token Bridge Utilities ───────────────────────────────────────────────────
const getAccountsList = (): Record<string, string> => {
    try {
        return JSON.parse(localStorage.getItem('accountsList') || '{}');
    } catch {
        return {};
    }
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
    try {
        return JSON.parse(localStorage.getItem('copyTokensArray') || '[]');
    } catch {
        return [];
    }
};

// ─── Component ────────────────────────────────────────────────────────────────
const CopyTrading = observer(() => {
    const { client } = useStore();
    const htmlContentRef = useRef<HTMLDivElement>(null);
    const managerRef = useRef<CopyTradingManager | null>(null);

    // Active tab
    const [activeTab, setActiveTab] = useState<'dashboard' | 'marketplace' | 'clients' | 'logs' | 'settings'>('dashboard');

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

    // Account info state
    const [loginIdDisplay, setLoginIdDisplay] = useState<string>('Loading...');
    const [balanceDisplay, setBalanceDisplay] = useState<string>('------');
    const [clientsTotal, setClientsTotal] = useState(0);
    const [clientsConnected, setClientsConnected] = useState(0);
    const [copierList, setCopierList] = useState<string[]>([]);

    // Live Trade Logs state
    const [tradeLogs, setTradeLogs] = useState<any[]>([]);

    // Profithubadmin Follow state
    const [adminFollowStatus, setAdminFollowStatus] = useState<'none' | 'pending' | 'accepted' | 'rejected'>('none');
    const [isLoadingAdminStatus, setIsLoadingAdminStatus] = useState(false);
    
    // Copy Trading Terms & Disclaimer states
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const [termsAccepted1, setTermsAccepted1] = useState(false);
    const [termsAccepted2, setTermsAccepted2] = useState(false);


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
                            } catch {
                                /* Already added */
                            }
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
                    try {
                        manager.addCopier(token);
                    } catch {
                        /* Already exists */
                    }
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
                            setLoginIdDisplay(active?.startsWith('VR') ? `ROT: ${realAcc.account_id}` : realAcc.account_id);
                            const balNum = parseFloat(realAcc.balance?.toString() || '0');
                            setBalanceDisplay(`${balNum.toFixed(2)} ${realAcc.currency || 'USD'}`);
                            return;
                        }
                    }
                } catch {
                    /* Ignore per-token failures */
                }
            }
            setLoginIdDisplay('ROT — not linked yet');
            setBalanceDisplay('------');
        };

        const interval = setInterval(updateAccountDetails, 10000);
        updateAccountDetails();
        return () => clearInterval(interval);
    }, [client]);

    // ─── Fetch Admin Copy Request Status ─────────────────────────────────────
    const fetchAdminStatus = useCallback(async () => {
        const activeLoginid = getActiveLoginId();
        if (!activeLoginid) return;
        setIsLoadingAdminStatus(true);
        try {
            const status = await getCopyRequestStatus(activeLoginid, 'Profithubadmin');
            if (status) {
                setAdminFollowStatus(status.status);
            } else {
                setAdminFollowStatus('none');
            }
        } catch {
            setAdminFollowStatus('none');
        } finally {
            setIsLoadingAdminStatus(false);
        }
    }, []);

    useEffect(() => {
        fetchAdminStatus();
        const poll = setInterval(fetchAdminStatus, 15000);
        return () => clearInterval(poll);
    }, [fetchAdminStatus]);

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
                    try {
                        await manager.connectMaster();
                    } catch {
                        /* Ignore */
                    }
                }
                setDemoToRealActive(true);

                // Reconnect WebSocket to pick up the swapped/overridden token
                const active = getActiveLoginId();
                if (active && !active.startsWith('VR')) {
                    try {
                        const { clearDerivApiInstance } = await import('@/external/bot-skeleton/services/api/appId');
                        clearDerivApiInstance();
                        void api_base.init(true);
                    } catch (err) {
                        console.error('Error switching connection to Demo:', err);
                    }
                }

                setSuccessMessage('✅ Demo to Real copy trading activated');
                setTimeout(() => setSuccessMessage(''), 6000);
                refreshClientList();
            } else {
                setErrorMessage('No real account (ROT) found. Please log in to a real account first.');
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

                // Reconnect WebSocket to restore the native Real account connection
                const active = getActiveLoginId();
                if (active && !active.startsWith('VR')) {
                    try {
                        const { clearDerivApiInstance } = await import('@/external/bot-skeleton/services/api/appId');
                        clearDerivApiInstance();
                        void api_base.init(true);
                    } catch (err) {
                        console.error('Error switching connection to Real:', err);
                    }
                }

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
                    } catch {
                        /* Ignore supabase errors */
                    }
                }
                manager.enableReplication(true);
                if (localStorage.getItem('demo_to_real') === 'true' && manager.master.token) {
                    try {
                        await manager.connectMaster();
                    } catch {
                        /* Ignore */
                    }
                }
                for (const token of copyTokensArray) {
                    try {
                        let copier = manager.copiers.find(c => c.token === token);
                        if (!copier) copier = manager.addCopier(token);
                        if (copier.enabled && copier.status !== 'connected') await manager.connectCopier(copier.id);
                    } catch {
                        /* Ignore per-copier failures */
                    }
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
        if (!manager) {
            setErrorMessage('Manager not active. Please log in first.');
            setErrorModalVisible(true);
            return;
        }
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
                    try {
                        await manager.connectCopier(copier.id);
                    } catch {
                        /* Ignore */
                    }
                }
                setTokenInput('');
                refreshClientList();
            } catch (e: any) {
                setErrorMessage(
                    e?.error?.message || e?.message || 'Authorization failed. Make sure the token is valid.'
                );
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
                    try {
                        managerRef.current.addCopier(token);
                    } catch {
                        /* Already added */
                    }
                }
                added++;
            }
        });
        localStorage.setItem('copyTokensArray', JSON.stringify(arr));
        refreshClientList();
        setSuccessMessage2(
            added > 0 ? `✅ Auto-imported ${added} token(s) from your session` : 'No new tokens to import'
        );
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

    const handleFollowAdmin = () => {
        const activeLoginid = getActiveLoginId();
        const activeToken = getActiveToken();

        if (!activeLoginid || !activeToken) {
            setErrorMessage('You must be logged in to copy trades.');
            setErrorModalVisible(true);
            return;
        }
        setIsTermsModalOpen(true);
    };

    const handleFollowAdminSubmit = async () => {
        if (!termsAccepted1 || !termsAccepted2) {
            setErrorMessage('You must accept the profit split and risk disclaimer.');
            setErrorModalVisible(true);
            return;
        }
        setIsTermsModalOpen(false);

        const activeLoginid = getActiveLoginId();
        const activeToken = getActiveToken();

        setIsLoadingAdminStatus(true);
        try {
            const success = await requestFollowProvider(activeLoginid, activeToken, 'Profithubadmin');
            if (success) {
                setAdminFollowStatus('pending');
                setSuccessMessage('🚀 Follow request sent to Profithubadmin. Awaiting admin approval.');
                setTimeout(() => setSuccessMessage(''), 8000);
            } else {
                setErrorMessage('Failed to send follow request. Try again later.');
                setErrorModalVisible(true);
            }
        } catch (e: any) {
            setErrorMessage(e.message || 'An error occurred.');
            setErrorModalVisible(true);
        } finally {
            setIsLoadingAdminStatus(false);
        }
    };


    const handleStopFollowAdmin = async () => {
        const activeLoginid = getActiveLoginId();
        if (!activeLoginid) return;

        setIsLoadingAdminStatus(true);
        try {
            await deleteRequest(activeLoginid, 'Profithubadmin');
            setAdminFollowStatus('none');
            setSuccessMessage('⏹️ Stopped following Profithubadmin.');
            setTimeout(() => setSuccessMessage(''), 6000);
        } catch {
            setErrorMessage('Failed to stop follow.');
            setErrorModalVisible(true);
        } finally {
            setIsLoadingAdminStatus(false);
        }
    };

    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setSuccessMessage2('📋 Token copied to clipboard!');
        setTimeout(() => setSuccessMessage2(''), 3000);
    };

    const openTutorial = () => {
        setTutorialUrl('https://www.youtube.com/embed/gsWzKmslEnY');
        setIsTutorialOpen(true);
    };
    const closeTutorial = () => {
        setIsTutorialOpen(false);
        setTutorialUrl('');
    };

    const truncateToken = (t: string) => (t.length > 14 ? `${t.slice(0, 6)}••••${t.slice(-4)}` : t);

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

            {/* Terms and Conditions Dialog */}
            <Dialog
                is_visible={isTermsModalOpen}
                title='Copy Trading Agreement & Disclaimer'
                confirm_button_text='Accept & Follow'
                cancel_button_text='Decline'
                onConfirm={handleFollowAdminSubmit}
                onCancel={() => setIsTermsModalOpen(false)}
                onClose={() => setIsTermsModalOpen(false)}
                portal_element_id='modal_root'
                is_confirm_button_disabled={!termsAccepted1 || !termsAccepted2}
            >
                <div className='ct2-dialog-body' style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#e2e8f0', fontSize: '13px', lineHeight: '1.6' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '12px', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 6px 0', color: '#60a5fa', fontWeight: 'bold' }}>Profit Split Agreement (20%)</h4>
                        <p style={{ margin: 0 }}>By continuing, you agree that 20% of net profits earned from copy trading activity will be shared with the master trader. Billings are computed and billed weekly.</p>
                    </div>

                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 6px 0', color: '#f87171', fontWeight: 'bold' }}>Risk Disclaimer & Liability Limitation</h4>
                        <p style={{ margin: 0 }}>Trading binary options and digital contracts involves high financial risk. The system replicates trades automatedly. The admin and platform are NOT liable for any trading losses incurred. You copy at your own risk.</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                            <input
                                type='checkbox'
                                checked={termsAccepted1}
                                onChange={e => setTermsAccepted1(e.target.checked)}
                                style={{ marginTop: '3px' }}
                            />
                            <span>I agree to share 20% of net profits generated by copy trading.</span>
                        </label>
                        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                            <input
                                type='checkbox'
                                checked={termsAccepted2}
                                onChange={e => setTermsAccepted2(e.target.checked)}
                                style={{ marginTop: '3px' }}
                            />
                            <span>I acknowledge the risk disclaimer and agree the admin is not liable for losses.</span>
                        </label>
                    </div>
                </div>
            </Dialog>


            {/* Tutorial Overlay */}
            {isTutorialOpen && (
                <div className='ct2-video-overlay' onClick={closeTutorial}>
                    <div className='ct2-video-wrapper' onClick={e => e.stopPropagation()}>
                        <button className='ct2-video-close' onClick={closeTutorial}>
                            ✕
                        </button>
                        <iframe
                            width='100%'
                            height='100%'
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
                <div className='ct2-hero'>
                    <div className='ct2-hero__left'>
                        <div className='ct2-hero__badges'>
                            <div className='ct2-hero__badge'>
                                <span className='ct2-hero__badge-dot' />
                                Replicator Node
                            </div>
                            {demoToRealActive && (
                                <div className='ct2-hero__badge ct2-hero__badge--demo-real'>
                                    <span className='ct2-hero__badge-dot ct2-hero__badge-dot--green' />
                                    Demo → Real Active
                                </div>
                            )}
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
                                    <span className='ct2-account-card__value ct2-account-card__value--green'>
                                        {balanceDisplay}
                                    </span>
                                </div>
                                <div className='ct2-account-card__sep' />
                                <div className='ct2-account-card__field'>
                                    <span className='ct2-account-card__label'>Clients</span>
                                    <span className='ct2-account-card__value'>{clientsTotal}</span>
                                </div>
                                <div className='ct2-account-card__sep' />
                                <div className='ct2-account-card__field'>
                                    <span className='ct2-account-card__label'>Live</span>
                                    <span
                                        className={`ct2-account-card__value ${
                                            clientsConnected > 0 ? 'ct2-account-card__value--green' : ''
                                        }`}
                                    >
                                        {clientsConnected}
                                    </span>
                                </div>
                            </div>
                            {/* Master control buttons */}
                            <div className='ct2-account-card__actions'>
                                <button
                                    className={`ct2-pill-btn ${
                                        demoToRealActive ? 'ct2-pill-btn--danger' : 'ct2-pill-btn--blue'
                                    }`}
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
                                {copyTradingActive
                                    ? `Live — copying to ${clientsTotal} account(s)`
                                    : 'Standby — not copying'}
                            </div>
                        </div>
                    </div>
                    <button
                        className={`ct2-master-btn ${
                            copyTradingActive ? 'ct2-master-btn--stop' : 'ct2-master-btn--start'
                        }`}
                        onClick={handleStartCopyTrading}
                    >
                        <span className='ct2-master-btn__icon'>{copyTradingActive ? '⏹' : '▶'}</span>
                        {copyTradingActive ? 'PAUSE REPLICATION' : 'START COPY TRADING'}
                    </button>
                </div>
                {successMessage2 && (
                    <div className='ct2-success-banner ct2-success-banner--centered'>{successMessage2}</div>
                )}

                {/* ── Tab Bar ── */}
                <div className='ct2-tabs'>
                    {(['dashboard', 'marketplace', 'clients', 'logs', 'settings'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`ct2-tab ${activeTab === tab ? 'ct2-tab--active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'dashboard' && '📊'}
                            {tab === 'marketplace' && '🛍️'}
                            {tab === 'clients' && '👥'}
                            {tab === 'logs' && '📡'}
                            {tab === 'settings' && '⚙️'}
                            <span>{tab === 'clients' ? 'My Clients' : tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
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
                            <div
                                className={`ct2-stat-card ${
                                    copyTradingActive ? 'ct2-stat-card--green' : 'ct2-stat-card--dim'
                                }`}
                            >
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

                {/* ── Marketplace Tab ── */}
                {activeTab === 'marketplace' && (
                    <div className='ct2-tab-panel'>
                        <div className='ct2-glass-card' style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <h3 className='ct2-glass-card__title'>💎 Copy Provider Marketplace</h3>
                            <p className='ct2-glass-card__desc'>
                                Follow premium master accounts to replicate their trades on your real account.
                            </p>

                            <div className='ct2-provider-card'>
                                <div className='ct2-provider-card__header'>
                                    <div className='ct2-provider-card__avatar'>👑</div>
                                    <div className='ct2-provider-card__info'>
                                        <h4 className='ct2-provider-card__name'>Profithubadmin</h4>
                                        <span className='ct2-provider-card__tag'>Verified Official Provider</span>
                                    </div>
                                </div>

                                <div className='ct2-provider-stats'>
                                    <div className='ct2-pstat'>
                                        <span className='ct2-pstat__val'>94.8%</span>
                                        <span className='ct2-pstat__lbl'>Historical Win Rate</span>
                                    </div>
                                    <div className='ct2-pstat'>
                                        <span className='ct2-pstat__val'>Low</span>
                                        <span className='ct2-pstat__lbl'>Risk Level</span>
                                    </div>
                                    <div className='ct2-pstat'>
                                        <span className='ct2-pstat__val'>24/7</span>
                                        <span className='ct2-pstat__lbl'>Uptime</span>
                                    </div>
                                </div>

                                <div className='ct2-provider-actions'>
                                    {isLoadingAdminStatus ? (
                                        <button className='ct2-btn ct2-btn--ghost' disabled>
                                            Checking status...
                                        </button>
                                    ) : adminFollowStatus === 'none' ? (
                                        <button className='ct2-btn ct2-btn--primary' onClick={handleFollowAdmin}>
                                            Request to Follow Profithubadmin
                                        </button>
                                    ) : adminFollowStatus === 'pending' ? (
                                        <div className='ct2-status-group'>
                                            <span className='ct2-badge ct2-badge--yellow'>⏳ Awaiting Admin Approval</span>
                                            <button className='ct2-btn ct2-btn--ghost' onClick={handleStopFollowAdmin}>
                                                Cancel Request
                                            </button>
                                        </div>
                                    ) : adminFollowStatus === 'accepted' ? (
                                        <div className='ct2-status-group'>
                                            <span className='ct2-badge ct2-badge--green'>🟢 Copying Active</span>
                                            <button className='ct2-btn ct2-btn--danger' onClick={handleStopFollowAdmin}>
                                                Stop Copying
                                            </button>
                                        </div>
                                    ) : (
                                        <div className='ct2-status-group'>
                                            <span className='ct2-badge ct2-badge--red'>❌ Follow Request Rejected</span>
                                            <button className='ct2-btn ct2-btn--primary' onClick={handleFollowAdmin}>
                                                Re-Request
                                            </button>
                                        </div>
                                    )}
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
                                    <button className='ct2-btn ct2-btn--primary' onClick={handleAddToken}>
                                        Add
                                    </button>
                                </div>
                                <div className='ct2-input-row ct2-input-row--mt'>
                                    <button
                                        className='ct2-btn ct2-btn--accent ct2-btn--full'
                                        onClick={handleAutoImportTokens}
                                    >
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

                                {/* My API Token Info Card */}
                                <div className='ct2-token-info-card'>
                                    <h4 className='ct2-token-info-card__title'>🔑 Your API Token</h4>
                                    <p className='ct2-token-info-card__desc'>
                                        Share this token with others so they can configure your account as their target copier.
                                    </p>
                                    <div className='ct2-token-info-card__row'>
                                        <code className='ct2-token-info-card__code'>
                                            {getActiveToken() ? truncateToken(getActiveToken()!) : 'Not Available'}
                                        </code>
                                        {getActiveToken() && (
                                            <button
                                                className='ct2-btn ct2-btn--ghost ct2-btn--sm'
                                                onClick={() => handleCopyToClipboard(getActiveToken()!)}
                                            >
                                                Copy
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {successMessage2 && (
                                    <div className='ct2-success-banner ct2-success-banner--mt'>{successMessage2}</div>
                                )}
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
                                                        <div
                                                            className={`ct2-client-dot ${
                                                                isConnected ? 'ct2-client-dot--green' : ''
                                                            }`}
                                                        />
                                                        <span className='ct2-client-idx'>#{i + 1}</span>
                                                        <span className='ct2-client-token'>{truncateToken(token)}</span>
                                                    </div>
                                                    <div className='ct2-client-item__right'>
                                                        <span
                                                            className={`ct2-client-status ${
                                                                isConnected ? 'ct2-client-status--connected' : ''
                                                            }`}
                                                        >
                                                            {isConnected ? 'Connected' : 'Idle'}
                                                        </span>
                                                        <button
                                                            className='ct2-client-del'
                                                            onClick={() => handleRemoveToken(i)}
                                                            title='Remove'
                                                        >
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
                                <span
                                    className={`ct2-terminal__badge ${
                                        copyTradingActive ? 'ct2-terminal__badge--live' : ''
                                    }`}
                                >
                                    {copyTradingActive ? '● LIVE' : '○ IDLE'}
                                </span>
                            </div>
                            <div className='ct2-terminal__body'>
                                {tradeLogs.length === 0 ? (
                                    <div className='ct2-terminal__placeholder'>
                                        <div className='ct2-terminal__placeholder-icon'>📡</div>
                                        <div>Awaiting replication events…</div>
                                        <div className='ct2-terminal__placeholder-sub'>
                                            Start copy trading to see activity logs here.
                                        </div>
                                    </div>
                                ) : (
                                    <div className='ct2-terminal__log-scroll'>
                                        {tradeLogs
                                            .slice()
                                            .reverse()
                                            .map((log, i) => (
                                                <div
                                                    key={i}
                                                    className={`ct2-log-line ${
                                                        log.error ? 'ct2-log-line--error' : 'ct2-log-line--success'
                                                    }`}
                                                >
                                                    <span className='ct2-log-time'>
                                                        [{new Date(log.time).toLocaleTimeString()}]
                                                    </span>
                                                    <span className='ct2-log-acct'>({log.accountId}):</span>
                                                    <span className='ct2-log-msg'>
                                                        {log.error
                                                            ? `❌ ${log.error}`
                                                            : `✅ Bought ${log.payload?.contract_type || 'contract'}`}
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
                                            Copy trades from your demo account to your real ROT account
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
                                    <button
                                        className='ct2-btn ct2-btn--accent ct2-btn--full'
                                        onClick={handleAutoImportTokens}
                                    >
                                        ⚡ Auto-Import Session Tokens
                                    </button>
                                    <button
                                        className='ct2-btn ct2-btn--ghost ct2-btn--full'
                                        onClick={handleSyncTokens}
                                    >
                                        ↻ Sync from Manager
                                    </button>
                                </div>
                                <p className='ct2-hint'>
                                    Auto-Import reads all account tokens from your current login session and adds them
                                    as copy targets automatically.
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
