import { observer as globalObserver } from '@/external/bot-skeleton/utils/observer';
import CopyTradingManager from './copy-trading-manager';
import { getToken } from '@/external/bot-skeleton/services/api/appId';
import { isSpecialCRAccount, getDemoAccountIdForSpecialCR } from '@/utils/special-accounts-config';
import { getAppId, isProduction } from '@/components/shared/utils/config/config';
import DBot from '@/external/bot-skeleton/scratch/dbot';

// Simple duplicate guard by purchase_reference or timestamp
const recentKeys = new Set<string>();
const RECENT_TTL_MS = 15000;

// Status update function for UI - exported for use in copy-trading.tsx
export function updateReplicationStatus(
    status: 'disabled' | 'no_clients' | 'copying' | 'success' | 'error',
    message: string
) {
    const statusEl = document.getElementById('replication-status');
    const statusMsgEl = document.getElementById('replication-status-msg');

    if (statusEl) {
        statusEl.textContent =
            status === 'success' ? '✅' : status === 'error' ? '❌' : status === 'copying' ? '📤' : '⚠️';
        statusEl.style.color =
            status === 'success'
                ? '#10b981'
                : status === 'error'
                  ? '#ef4444'
                  : status === 'copying'
                    ? '#3b82f6'
                    : '#f59e0b';
    }

    if (statusMsgEl) {
        statusMsgEl.textContent = message;
        statusMsgEl.style.color =
            status === 'success'
                ? '#10b981'
                : status === 'error'
                  ? '#ef4444'
                  : status === 'copying'
                    ? '#3b82f6'
                    : '#f59e0b';
    }
}

type TradeLog = { id: string; accountId: string; payload: any; time: number; error?: string };
const tradeLogs: TradeLog[] = [];
export const getTradeLogs = () => tradeLogs.slice(-50).reverse();

function makeKey(payload: any) {
    const ref =
        payload?.request?.parameters?.passthrough?.purchase_reference ||
        payload?.request?.passthrough?.purchase_reference;
    return ref || `${payload?.contract_type}-${payload?.request?.buy || ''}-${Date.now()}`;
}

function cleanupKeys() {
    for (const k of Array.from(recentKeys)) {
        if (recentKeys.size > 1000) recentKeys.delete(k);
    }
}

export function initReplicator(manager: CopyTradingManager) {
    const sub = async (payload: any) => {
        try {
            const key = makeKey(payload);
            if (recentKeys.has(key)) {
                return;
            }
            recentKeys.add(key);
            setTimeout(() => recentKeys.delete(key), RECENT_TTL_MS);

            const settings = manager.getSettings?.() ?? {
                replicationEnabled: true,
                stakeCap: null,
                stakeMultiplier: 1,
            };

            if (!settings.replicationEnabled) {
                updateReplicationStatus('disabled', 'Replication is disabled');
                return;
            }

            // Check if copy trading is active
            const isCopyTrading = localStorage.getItem('iscopyTrading') === 'true';
            const isDemoToReal = localStorage.getItem('demo_to_real') === 'true';

            if (!isCopyTrading && !isDemoToReal) {
                updateReplicationStatus('disabled', 'Copy trading not started');
                return;
            }

            // Get tokens array from localStorage (like the working code)
            let tokens: string[] = [];
            const copyTokensArray = JSON.parse(localStorage.getItem('copyTokensArray') || '[]');

            // Check if special CR account is active (SPECIAL CR LOGIC)
            const showAsCR = typeof window !== 'undefined' ? localStorage.getItem('show_as_cr') : null;
            const isSpecialCR = showAsCR && isSpecialCRAccount(showAsCR);

            // Get current user token
            // IMPORTANT: For normal CR accounts, getToken() works normally
            // For special CR (CR6779123), we need to use demo token since that's what API uses
            let currentToken: any = null;
            let masterToken: string | undefined = undefined;

            if (isSpecialCR && showAsCR) {
                // Special CR account mode: API uses demo token for trading
                // Use demo token as master for copy trading
                const demoAccountId = getDemoAccountIdForSpecialCR(showAsCR);
                if (demoAccountId) {
                    const accountsList = JSON.parse(localStorage.getItem('accountsList') || '{}');
                    const demoToken = accountsList[demoAccountId];
                    if (demoToken) {
                        masterToken = demoToken;
                        currentToken = { token: demoToken, account_id: demoAccountId };
                        console.log('[Replicator] 🎯 Special CR mode - using demo token as master:', demoAccountId);
                    } else {
                        currentToken = getToken();
                        masterToken = currentToken?.token;
                        console.log(
                            '[Replicator] ⚠️ Special CR mode but demo token not found, falling back to getToken()'
                        );
                    }
                } else {
                    currentToken = getToken();
                    masterToken = currentToken?.token;
                    console.log(
                        '[Replicator] ⚠️ Special CR mode but no demo account ID found, falling back to getToken()'
                    );
                }
            } else {
                // Normal CR accounts: use getToken() exactly like deriv insider
                currentToken = getToken();
                masterToken = currentToken?.token;
            }

            if (!masterToken) {
                updateReplicationStatus('error', 'No master token found');
                return;
            }

            if (isCopyTrading) {
                // Copy trading mode: include master token first, then copier tokens
                // The API needs the master token (source account) as the first token
                // Remove duplicates and filter out master token from copier list if it exists
                const uniqueCopierTokens = copyTokensArray.filter(
                    (token: string) => token && token.trim() && token !== masterToken
                );
                // Master token first, then copier tokens
                tokens = [masterToken, ...uniqueCopierTokens];
                // Remove any remaining duplicates (but keep master as first)
                const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)));
                // Ensure master is first
                tokens = uniqueTokens
                    .filter((t: string) => t === masterToken)
                    .concat(uniqueTokens.filter((t: string) => t !== masterToken));
            } else if (isDemoToReal) {
                // Demo to real mode: use current token (demo) + real account token
                // Like mkorean: tokens: [currentToken, realToken]
                // Current token is the demo account user is trading on
                // Real token is stored in manager.master.token
                const realToken = manager.master.token;
                if (realToken && realToken !== masterToken) {
                    // Current token (demo) first, then real token
                    tokens = [masterToken, realToken];
                } else {
                    // Fallback: try to find real account from accountsList
                    const accountsList = JSON.parse(localStorage.getItem('accountsList') || '{}');
                    const realLoginId = Object.keys(accountsList).find(k => !k.startsWith('VR') && (k.startsWith('CR') || k.startsWith('ROT')));
                    if (realLoginId) {
                        const realTokenFromList = accountsList[realLoginId];
                        if (realTokenFromList && realTokenFromList !== masterToken) {
                            tokens = [masterToken, realTokenFromList];
                        } else {
                            tokens = [masterToken];
                        }
                    } else {
                        tokens = [masterToken];
                    }
                }
                // Remove duplicates
                tokens = Array.from(new Set(tokens.filter(Boolean)));
            }

            if (tokens.length < 1) {
                updateReplicationStatus('no_clients', 'No tokens added - Add tokens first');
                return;
            }

            // Final validation: ensure all tokens are unique and valid
            tokens = Array.from(new Set(tokens.filter((t: string) => t && t.trim() && t.length > 0)));

            if (tokens.length < 1) {
                updateReplicationStatus('no_clients', 'No valid tokens - Add tokens first');
                return;
            }

            updateReplicationStatus('copying', `Copying to ${tokens.length} account(s)...`);

            // Build request contract parameters
            let contract_parameters: any = null;

            if (payload.mode === 'proposal_id') {
                const proposalId = payload.request?.buy || payload.request?.id;
                const proposals = (DBot as any).interpreter?.bot?.tradeEngine?.data?.proposals || [];
                const matchedProposal = proposals.find((p: any) => p.id === proposalId);

                if (matchedProposal) {
                    contract_parameters = {
                        contract_type: matchedProposal.contract_type,
                        underlying_symbol: matchedProposal.symbol || matchedProposal.underlying_symbol || matchedProposal.echo_req?.underlying_symbol,
                        currency: matchedProposal.currency || 'USD',
                        amount: matchedProposal.amount || matchedProposal.ask_price,
                        basis: matchedProposal.basis || 'stake',
                        duration: matchedProposal.duration,
                        duration_unit: matchedProposal.duration_unit,
                        ...(matchedProposal.barrier !== undefined && { barrier: matchedProposal.barrier }),
                        ...(matchedProposal.barrier2 !== undefined && { barrier2: matchedProposal.barrier2 }),
                        ...(matchedProposal.selected_tick !== undefined && { selected_tick: matchedProposal.selected_tick }),
                        ...(matchedProposal.prediction !== undefined && { prediction: matchedProposal.prediction }),
                    };
                }
            }

            if (!contract_parameters) {
                // Fallback to params
                const params = JSON.parse(JSON.stringify(payload.request?.parameters || payload.request || {}));
                const tradeEngine = (DBot as any).interpreter?.bot?.tradeEngine;
                const tradeOptions = tradeEngine?.tradeOptions || {};

                contract_parameters = {
                    contract_type: params.contract_type || payload.contract_type || tradeOptions.contract_type,
                    underlying_symbol: params.symbol || params.underlying_symbol || payload.request?.symbol || tradeOptions.symbol || tradeOptions.underlying_symbol,
                    currency: params.currency || tradeOptions.currency || 'USD',
                    amount: params.amount || params.price || payload.request?.price || tradeOptions.amount,
                    basis: params.basis || tradeOptions.basis || 'stake',
                    duration: params.duration || tradeOptions.duration,
                    duration_unit: params.duration_unit || tradeOptions.duration_unit,
                    ...((params.barrier !== undefined || tradeOptions.barrier !== undefined) && { barrier: params.barrier ?? tradeOptions.barrier }),
                    ...((params.barrier2 !== undefined || tradeOptions.barrier2 !== undefined) && { barrier2: params.barrier2 ?? tradeOptions.barrier2 }),
                    ...((params.selected_tick !== undefined || tradeOptions.selected_tick !== undefined) && { selected_tick: params.selected_tick ?? tradeOptions.selected_tick }),
                    ...((params.prediction !== undefined || tradeOptions.prediction !== undefined) && { prediction: params.prediction ?? tradeOptions.prediction }),
                };
            }

            // Apply multiplier/cap to amount
            if (contract_parameters.amount) {
                let amt = Number(contract_parameters.amount) * (settings.stakeMultiplier || 1);
                if (settings.stakeCap) amt = Math.min(amt, settings.stakeCap);
                contract_parameters.amount = Number(amt.toFixed(2));
            }

            // Separate accounts into demo/real groups
            const demoAccounts: Array<{ token: string; account_id: string }> = [];
            const realAccounts: Array<{ token: string; account_id: string }> = [];

            const getAccountIdForToken = (token: string, mgr: CopyTradingManager): string | null => {
                const copier = mgr.copiers.find(c => c.token === token);
                if (copier && copier.loginId) return copier.loginId;

                if (mgr.master.token === token && mgr.master.loginId) return mgr.master.loginId;

                try {
                    const accountsList = JSON.parse(localStorage.getItem('accountsList') || '{}');
                    for (const loginId of Object.keys(accountsList)) {
                        if (accountsList[loginId] === token) {
                            return loginId;
                        }
                    }
                } catch (e) {}

                return null;
            };

            for (const token of tokens) {
                const accountId = getAccountIdForToken(token, manager);
                if (accountId) {
                    const isDemo = accountId.startsWith('VR') || accountId.startsWith('VRT');
                    if (isDemo) {
                        demoAccounts.push({ token, account_id: accountId });
                    } else {
                        realAccounts.push({ token, account_id: accountId });
                    }
                }
            }

            const appId = getAppId?.() ?? localStorage.getItem('APP_ID') ?? '1069';
            const environment = isProduction() ? 'production' : 'staging';
            const baseURL = environment === 'production' ? 'https://api.derivws.com/trading/v1/' : 'https://staging-api.derivws.com/trading/v1/';

            const buyForGroup = async (groupAccounts: typeof demoAccounts, isDemo: boolean) => {
                if (groupAccounts.length === 0) return;

                const endpoint = `${baseURL}options/contracts/bulk-purchase/${isDemo ? 'demo' : 'real'}`;
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Deriv-App-ID': appId,
                    },
                    body: JSON.stringify({
                        contract_parameters,
                        accounts: groupAccounts,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                if (result.error) {
                    throw result.error;
                }
                return result;
            };

            try {
                if (demoAccounts.length > 0) {
                    await buyForGroup(demoAccounts, true);
                }
                if (realAccounts.length > 0) {
                    await buyForGroup(realAccounts, false);
                }

                updateReplicationStatus('success', `Copied to ${tokens.length} account(s) successfully`);
                tradeLogs.push({ id: 'all', accountId: 'multiple', payload: contract_parameters, time: Date.now() });
            } catch (e: any) {
                const errorMsg = e?.error?.message || e?.message || 'Unknown error';
                const errorCode = e?.error?.code || e?.code || 'Unknown';
                updateReplicationStatus('error', `Failed: ${errorMsg} (${errorCode})`);
                tradeLogs.push({
                    id: 'all',
                    accountId: 'multiple',
                    payload: contract_parameters,
                    time: Date.now(),
                    error: errorMsg,
                });
            }

            cleanupKeys();
        } catch (e) {
            updateReplicationStatus('error', `Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    };

    globalObserver.register('replicator.purchase', sub);

    return () => {
        try {
            globalObserver.unregister('replicator.purchase', sub);
        } catch {}
    };
}
