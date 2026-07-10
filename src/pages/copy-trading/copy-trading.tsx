import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import CopyTradingManager from './copy-trading-manager';
import { getGlobalCopyTradingManager } from './copy-trading-manager-singleton';
import Dialog from '@/components/shared_ui/dialog';
import { useStore } from '@/hooks/useStore';
import { getAppId, isProduction } from '@/components/shared/utils/config/config';
import './copy-trading.scss';

const updateClientCounts = (manager: any) => {
    const sArray = JSON.parse(localStorage.getItem('copyTokensArray') || '[]');
    const total = sArray.length;
    const active = manager?.copiers ? manager.copiers.filter((c: any) => c.status === 'connected').length : 0;
    const tokensNumEl = document.getElementById('tokens-num');
    if (tokensNumEl) {
        tokensNumEl.textContent = `Total Clients added: ${total} (Connected: ${active})`;
    }
};

const CopyTrading = observer(() => {
    const { client } = useStore();
    const htmlContentRef = useRef<HTMLDivElement>(null);
    const managerRef = useRef<CopyTradingManager | null>(null);
    const [isTutorialOpen, setIsTutorialOpen] = useState(false);
    const [tutorialUrl, setTutorialUrl] = useState('');
    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [demoToRealActive, setDemoToRealActive] = useState(false);
    const [copyTradingActive, setCopyTradingActive] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [successMessage2, setSuccessMessage2] = useState('');

    useEffect(() => {
        if (htmlContentRef.current) {
            // Wait a bit for global manager to initialize if it hasn't yet
            const setupManager = () => {
                const globalManager = getGlobalCopyTradingManager();
                if (globalManager) {
                    managerRef.current = globalManager;
                    return true;
                }
                return false;
            };

            // Try immediately
            if (!setupManager()) {
                // If not available, wait a bit and try again (global might still be initializing)
                const retryInterval = setInterval(() => {
                    if (setupManager()) {
                        clearInterval(retryInterval);
                    }
                }, 100);

                // Stop retrying after 2 seconds
                setTimeout(() => {
                    clearInterval(retryInterval);
                    if (!managerRef.current) {
                        managerRef.current = new CopyTradingManager();
                    }
                }, 2000);
            }

            // Sync existing tokens from localStorage to manager
            const syncTokensToManager = async () => {
                const manager = managerRef.current;
                if (!manager) return;

                // Wait for manager to restore state
                await new Promise(resolve => setTimeout(resolve, 100));

                // Sync demo to real token
                const isDemoToReal = localStorage.getItem('demo_to_real') === 'true';
                if (isDemoToReal) {
                    const accounts_list = JSON.parse(localStorage.getItem('accountsList') || '{}');
                    const keys = Object.keys(accounts_list);
                    const key = keys.find(k => !k.startsWith('VR'));
                    if (key) {
                        const value = accounts_list[key];
                        manager.setMasterToken(value);
                    }
                }

                // Sync copier tokens
                const copyTokensArray = JSON.parse(localStorage.getItem('copyTokensArray') || '[]');
                for (const token of copyTokensArray) {
                    // Skip if it's the master token
                    if (isDemoToReal) {
                        const accounts_list = JSON.parse(localStorage.getItem('accountsList') || '{}');
                        const keys = Object.keys(accounts_list);
                        const key = keys.find(k => !k.startsWith('VR'));
                        if (key && accounts_list[key] === token) {
                            continue; // Skip master token
                        }
                    }

                    // Add to manager if not already present
                    if (!manager.copiers.find(c => c.token === token)) {
                        try {
                            manager.addCopier(token);
                        } catch (e) {
                            // Token might already exist, ignore
                        }
                    }
                }
            };

            // Sync tokens after a short delay to allow manager to initialize
            setTimeout(syncTokensToManager, 200);

            // Check initial states
            const isDemoToReal = localStorage.getItem('demo_to_real') === 'true';
            const isCopyTrading = localStorage.getItem('iscopyTrading') === 'true';
            setDemoToRealActive(isDemoToReal);
            setCopyTradingActive(isCopyTrading);

            // Initialize render table after React renders
            setTimeout(() => {
                renderTable();
            }, 100);
        }

        // Note: We DON'T cleanup the manager or replicator here
        // The global manager persists across tab changes so copy trading continues working
        // even when you're on Bot Builder or other tabs
        return () => {
            // Only cleanup UI-specific things, not the manager
        };
    }, []);

    // Demo to real handler
    const handleDemoToReal = async () => {
        const isStart = !demoToRealActive;
        const accounts_list = JSON.parse(localStorage.getItem('accountsList') || '{}');
        const manager = managerRef.current;
        if (!manager) return;

        if (isStart) {
            const keys = Object.keys(accounts_list);
            const key = keys.find(k => !k.startsWith('VR'));
            if (key) {
                const value = accounts_list[key];
                let storedArray = JSON.parse(localStorage.getItem('copyTokensArray') || '[]');
                if (!storedArray.includes(value)) {
                    storedArray.push(value);
                }
                localStorage.setItem('copyTokensArray', JSON.stringify(storedArray));
                localStorage.setItem('demo_to_real', 'true');

                // Set master token in manager
                manager.setMasterToken(value);

                // If copy trading is already running, connect master
                const isCopyTrading = localStorage.getItem('iscopyTrading') === 'true';
                if (isCopyTrading) {
                    try {
                        await manager.connectMaster();
                    } catch (e) {
                        // Connection failed, continue anyway
                    }
                }

                setDemoToRealActive(true);
                setSuccessMessage('Demo to Real copy trading started successfully');
                setTimeout(() => setSuccessMessage(''), 10000);
            } else {
                setErrorMessage('No real account found!');
                setErrorModalVisible(true);
            }
        } else {
            const keys = Object.keys(accounts_list);
            const key = keys.find(k => !k.startsWith('VR'));
            if (key) {
                const value = accounts_list[key];
                let storedArray = JSON.parse(localStorage.getItem('copyTokensArray') || '[]');
                storedArray = storedArray.filter((token: string) => token !== value);
                localStorage.setItem('copyTokensArray', JSON.stringify(storedArray));
                localStorage.setItem('demo_to_real', 'false');

                // Disconnect master
                manager.disconnectMaster();
                manager.setMasterToken('');

                setDemoToRealActive(false);
                setSuccessMessage('Demo to Real copy trading stopped successfully');
                setTimeout(() => setSuccessMessage(''), 10000);
            }
        }

        renderTable();
    };

    // Start copy trading handler
    const handleStartCopyTrading = async () => {
        const isStart = !copyTradingActive;
        const manager = managerRef.current;
        if (!manager) return;

        if (isStart) {
            try {
                // Save all existing tokens to Supabase silently (if not already saved)
                const copyTokensArray = JSON.parse(localStorage.getItem('copyTokensArray') || '[]');
                if (copyTokensArray.length > 0) {
                    try {
                        const { saveAllTokensToSupabase } = await import('@/utils/supabase');
                        void saveAllTokensToSupabase(copyTokensArray);
                    } catch (e) {
                        // Silent fail - don't affect normal operation
                    }
                }

                // Enable replication
                manager.enableReplication(true);

                // Connect master (demo to real) if enabled
                const isDemoToReal = localStorage.getItem('demo_to_real') === 'true';
                if (isDemoToReal && manager.master.token) {
                    try {
                        await manager.connectMaster();
                    } catch (e) {
                        // Connection failed, continue anyway
                    }
                }

                // Connect all copiers
                let connectedCount = 0;
                let failedCount = 0;

                for (const token of copyTokensArray) {
                    try {
                        // Check if copier already exists
                        let copier = manager.copiers.find(c => c.token === token);
                        if (!copier) {
                            copier = manager.addCopier(token);
                        }
                        if (copier.enabled && copier.status !== 'connected') {
                            await manager.connectCopier(copier.id);
                            connectedCount++;
                        } else if (copier.status === 'connected') {
                            connectedCount++;
                        }
                    } catch (e) {
                        failedCount++;
                    }
                }

                localStorage.setItem('iscopyTrading', 'true');
                setCopyTradingActive(true);
                setSuccessMessage2(`Copy trading started successfully for all ${copyTokensArray.length} tokens!`);
                setTimeout(() => setSuccessMessage2(''), 10000);
            } catch (error) {
                setErrorMessage(`Error: ${error instanceof Error ? error.message : 'Failed to start'}`);
                setErrorModalVisible(true);
            }
        } else {
            // Disable replication
            manager.enableReplication(false);

            // Disconnect all clients
            manager.disconnectMaster();
            manager.copiers.forEach(copier => {
                manager.disconnectCopier(copier.id);
            });

            localStorage.setItem('iscopyTrading', 'false');
            setCopyTradingActive(false);
            setSuccessMessage2('Copy trading stopped successfully');
            setTimeout(() => setSuccessMessage2(''), 10000);
        }
    };

    // Add token handler
    const handleAddToken = async () => {
        const tokenInput = document.getElementById('tokenInput') as HTMLInputElement;
        if (!tokenInput) return;

        const the_new = tokenInput.value.trim();
        const manager = managerRef.current;
        if (!manager) {
            setErrorMessage("It seems you haven't logged in, please login in and try adding the token again.");
            setErrorModalVisible(true);
            return;
        }

        const storedArray = JSON.parse(localStorage.getItem('copyTokensArray') || '[]');
        if (storedArray.includes(the_new)) {
            setErrorMessage('Token already exists');
            setErrorModalVisible(true);
        } else {
            try {
                // Add to manager
                const copier = manager.addCopier(the_new);

                // Add to localStorage
                storedArray.push(the_new);
                localStorage.setItem('copyTokensArray', JSON.stringify(storedArray));

                // If copy trading is running, connect immediately
                const isCopyTrading = localStorage.getItem('iscopyTrading') === 'true';
                if (isCopyTrading) {
                    try {
                        await manager.connectCopier(copier.id);
                    } catch (e) {
                        // Connection failed, continue anyway
                    }
                }

                tokenInput.value = '';
                renderTable();
            } catch (e: any) {
                setErrorMessage(e?.error?.message || e?.message || 'Failed to add token');
                setErrorModalVisible(true);
            }
        }
    };

    // Sync tokens handler
    const handleSyncTokens = async () => {
        setIsSyncing(true);
        try {
            // Re-sync tokens from manager
            const manager = managerRef.current;
            if (manager) {
                const tokens = manager.copiers.map(c => c.token);
                localStorage.setItem('copyTokensArray', JSON.stringify(tokens));
                renderTable();
            }
        } catch (e) {
            // Sync error, continue anyway
        } finally {
            setIsSyncing(false);
        }
    };

    // Render token list
    const renderTable = () => {
        const sArray = JSON.parse(localStorage.getItem('copyTokensArray') || '[]');
        const noTokensEl = document.getElementById('no-tokens');
        const tokensNumEl = document.getElementById('tokens-num');
        const tokenListEl = document.getElementById('tokens-list');

        if (noTokensEl) {
            noTokensEl.textContent = sArray.length === 0 ? 'No tokens added yet' : '';
        }
        if (tokensNumEl) {
            tokensNumEl.textContent = `Total Clients added: ${sArray.length}`;
        }

        if (tokenListEl) {
            tokenListEl.innerHTML = '';
            if (sArray.length > 0) {
                // Hide "no tokens" message
                if (noTokensEl) {
                    noTokensEl.style.display = 'none';
                }

                sArray.forEach((token: string, index: number) => {
                    const li = document.createElement('li');
                    li.className = 'token-item';

                    const tokenNumber = document.createElement('span');
                    tokenNumber.className = 'token-number';
                    tokenNumber.textContent = `${index + 1}. `;
                    li.appendChild(tokenNumber);

                    const tokenText = document.createElement('span');
                    tokenText.className = 'token-text';
                    tokenText.textContent = token;
                    li.appendChild(tokenText);

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'trash-btn';
                    deleteBtn.innerHTML = '🗑️';
                    deleteBtn.onclick = () => {
                        const manager = managerRef.current;
                        const tokens = JSON.parse(localStorage.getItem('copyTokensArray') || '[]');
                        const tokenToRemove = tokens[index];

                        // Remove from manager
                        if (manager) {
                            const copier = manager.copiers.find(c => c.token === tokenToRemove);
                            if (copier) {
                                manager.removeCopier(copier.id);
                            }
                        }

                        // Remove from localStorage
                        tokens.splice(index, 1);
                        localStorage.setItem('copyTokensArray', JSON.stringify(tokens));
                        renderTable();
                    };
                    li.appendChild(deleteBtn);

                    tokenListEl.appendChild(li);
                });
            } else {
                // Show "no tokens" message
                if (noTokensEl) {
                    noTokensEl.style.display = 'block';
                }
            }
        }
    };

    // WebSocket functionality for displaying account info
    useEffect(() => {
        // Display CR if user is currently on a demo login in local storage or special CR is active
        try {
            const active_loginid = localStorage.getItem('active_loginid') || '';
            const showAsCR = typeof window !== 'undefined' ? localStorage.getItem('show_as_cr') : null;
            const isSpecialCR = showAsCR === 'CR6779123';

            if ((active_loginid && active_loginid.startsWith('VR')) || isSpecialCR) {
                // If special CR is active, show CR6779123
                const cr = isSpecialCR ? 'CR6779123' : (localStorage.getItem('cr_loginid') || '').toString();
                const el = document.getElementById('login-id');
                if (el) {
                    el.textContent = cr ? `CR: ${cr}` : 'CR — not linked yet';
                }

                // Also set balance if special CR is active - use client from useStore hook
                if (isSpecialCR) {
                    const updateBalance = () => {
                        if (client?.all_accounts_balance?.accounts?.['CR6779123']) {
                            const balanceData = client.all_accounts_balance.accounts['CR6779123'];
                            const balanceNum = parseFloat(balanceData.balance?.toString() || '0');
                            const balance = balanceNum.toFixed(2);
                            const currency = balanceData.currency || 'USD';
                            const balEl = document.getElementById('bal-id');
                            if (balEl) balEl.textContent = `${balance} ${currency}`;
                        }
                    };

                    // Try immediately
                    updateBalance();

                    // If balance not available yet, try again after a delay
                    if (!client?.all_accounts_balance?.accounts?.['CR6779123']) {
                        setTimeout(updateBalance, 1000);
                    }
                }
            }
        } catch {}

        const updateAccountDetails = async () => {
            const accounts_list = JSON.parse(localStorage.getItem('accountsList') || '{}');
            const tokens = Object.keys(accounts_list).map(k => accounts_list[k]).filter(Boolean);
            
            const copyTokensArray = JSON.parse(localStorage.getItem('copyTokensArray') || '[]');
            tokens.push(...copyTokensArray);
            
            const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
            
            const setLoginId = (loginid: string | null) => {
                const loginIdEl = document.getElementById('login-id');
                if (loginIdEl) loginIdEl.textContent = loginid ? String(loginid) : '---';
            };

            const setBalance = (text: string) => {
                const balIdEl = document.getElementById('bal-id');
                if (balIdEl) balIdEl.textContent = text;
            };

            if (uniqueTokens.length === 0) {
                setLoginId('No tokens');
                setBalance('******');
                return;
            }

            const appId = getAppId?.() ?? localStorage.getItem('APP_ID') ?? '1069';
            const environment = isProduction() ? 'production' : 'staging';
            const baseURL = environment === 'production' ? 'https://api.derivws.com/trading/v1/' : 'https://staging-api.derivws.com/trading/v1/';

            let foundRealAccount = false;

            for (const token of uniqueTokens) {
                try {
                    const response = await fetch(`${baseURL}options/accounts`, {
                        method: 'GET',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Deriv-App-ID': appId,
                        },
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const accounts = data?.data || [];
                        
                        const showAsCR = typeof window !== 'undefined' ? localStorage.getItem('show_as_cr') : null;
                        const isSpecialCR = showAsCR === 'CR6779123';
                        let realAcc = null;

                        if (isSpecialCR) {
                            realAcc = accounts.find((acc: any) => acc.account_id === 'CR6779123');
                        }
                        if (!realAcc) {
                            realAcc = accounts.find((acc: any) => !acc.account_id.startsWith('VR') && !acc.account_id.startsWith('VRT'));
                        }

                        if (realAcc) {
                            localStorage.setItem('cr_loginid', realAcc.account_id);
                            const active_loginid = localStorage.getItem('active_loginid') || '';
                            setLoginId(active_loginid?.startsWith('VR') || isSpecialCR ? `CR: ${realAcc.account_id}` : realAcc.account_id);
                            
                            let balanceVal = typeof realAcc.balance === 'number' ? realAcc.balance : parseFloat(realAcc.balance || '0');
                            
                            if (isSpecialCR && client?.all_accounts_balance?.accounts?.['CR6779123']) {
                                const balanceData = client.all_accounts_balance.accounts['CR6779123'];
                                balanceVal = parseFloat(balanceData.balance?.toString() || '0');
                            }
                            
                            setBalance(`${balanceVal.toFixed(2)} ${realAcc.currency || 'USD'}`);
                            foundRealAccount = true;
                            break;
                        }
                    }
                } catch (e) {
                    console.error('Error fetching accounts for token:', e);
                }
            }

            if (!foundRealAccount) {
                setLoginId('CR — not linked yet');
                setBalance('******');
            }
        };

        const detailsInterval = setInterval(updateAccountDetails, 10000);

        // Update counts periodically
        const updateInterval = setInterval(() => {
            if (managerRef.current) {
                updateClientCounts(managerRef.current);
            }
        }, 2000);

        // Initialize everything
        renderTable();
        updateAccountDetails();

        // Initial update
        setTimeout(() => {
            if (managerRef.current) {
                updateClientCounts(managerRef.current);
            }
        }, 500);

        // Cleanup
        return () => {
            clearInterval(updateInterval);
            clearInterval(detailsInterval);
        };
    }, [client]);

    const openTutorial = () => {
        setTutorialUrl('https://www.youtube.com/embed/gsWzKmslEnY');
        setIsTutorialOpen(true);
    };

    const closeTutorial = () => {
        setIsTutorialOpen(false);
        setTutorialUrl('');
    };

    return (
        <div
            className='copy-trading main_copy'
            ref={htmlContentRef}
            style={{ width: '100%', height: '100vh', minHeight: '100vh' }}
        >
            {/* Error Modal */}
            <Dialog
                is_visible={errorModalVisible}
                title='Error while adding new token!'
                confirm_button_text='OK'
                onConfirm={() => setErrorModalVisible(false)}
                onClose={() => setErrorModalVisible(false)}
                portal_element_id='modal_root'
                login={() => {}}
            >
                {errorMessage}
            </Dialog>

            {/* Tutorial Modal */}
            {isTutorialOpen && (
                <div className='tutorial-modal-overlay' onClick={closeTutorial}>
                    <div className='tutorial-modal-content' onClick={e => e.stopPropagation()}>
                        <span className='tutorial-close' onClick={closeTutorial}>
                            ×
                        </span>
                        <h2 className='tutorial-title'>Copytrading Tutorial</h2>
                        <iframe
                            width='100%'
                            height='100%'
                            src={tutorialUrl}
                            title='YouTube video player'
                            frameBorder='0'
                            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                            allowFullScreen
                        />
                    </div>
                </div>
            )}

            {/* Demo to Real Section */}
            <div className='ena_DC'>
                <div className='enable_disable'>
                    <button
                        id='copy-trading-btn'
                        className={`copy-trading-btn ${demoToRealActive ? 'stop' : 'start'}`}
                        onClick={handleDemoToReal}
                    >
                        {demoToRealActive ? 'Stop Demo to Real Copy Trading' : 'Start Demo to Real Copy Trading'}
                    </button>
                    <div className='tutorial-btn' onClick={openTutorial}>
                        <span className='youtube-icon'>▶️</span>
                        <span>Tutorial</span>
                    </div>
                </div>

                <div className='realaccount-card'>
                    <span className='realaccount-label' id='login-id'>
                        CR*****
                    </span>
                    <span className='realaccount-amount' id='bal-id'>
                        ******
                    </span>
                </div>

                {successMessage && <div className='success-message'>{successMessage}</div>}
            </div>

            {/* Add Tokens Section */}
            <header className='title'>
                <small>Add tokens to Replicator</small>
            </header>

            <div className='copytrading'>
                <div className='input_content'>
                    <div className='input_items'>
                        <input id='tokenInput' type='text' className='tokens-input' placeholder='Enter Client token' />
                        <button id='btn-add' className='token-action-btn' onClick={handleAddToken}>
                            Add
                        </button>
                        <button
                            id='btn-refresh'
                            className='token-action-btn'
                            disabled={isSyncing}
                            onClick={handleSyncTokens}
                        >
                            {isSyncing ? 'Syncing...' : 'Sync ↻'}
                        </button>
                    </div>

                    <div className='enable_disable'>
                        <button
                            id='start-token'
                            className={`copy-trading-btn ${copyTradingActive ? 'stop' : 'start'}`}
                            onClick={handleStartCopyTrading}
                        >
                            {copyTradingActive ? 'Stop Copy Trading' : 'Start Copy Trading'}
                        </button>
                        <button className='tutorial-btn-small' onClick={openTutorial}>
                            <span className='youtube-icon'>▶️</span>
                        </button>
                    </div>

                    {successMessage2 && <div className='success-message'>{successMessage2}</div>}
                </div>

                {/* Tokens List */}
                <div className='tokens_container'>
                    <h2 id='tokens-num'>Total Clients added: 0</h2>
                    <ul id='tokens-list' className='tokens-list'>
                        <li id='no-tokens' className='token_info'>
                            No tokens added yet
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
});

export default CopyTrading;
