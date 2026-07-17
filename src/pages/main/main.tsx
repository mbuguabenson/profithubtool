import React, { lazy, Suspense, useEffect, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useLocation, useNavigate } from 'react-router-dom';
import ChunkLoader from '@/components/loader/chunk-loader';
import { generateOAuthURL } from '@/components/shared';
import DesktopWrapper from '@/components/shared_ui/desktop-wrapper';
import Dialog from '@/components/shared_ui/dialog';
import MobileWrapper from '@/components/shared_ui/mobile-wrapper';
import Tabs from '@/components/shared_ui/tabs/tabs';
import TradingViewModal from '@/components/trading-view-chart/trading-view-modal';
import ProfihubModal from '@/components/profihub-analysis/profihub-modal';
import ProToolAiModal from '@/components/protool-ai/protool-ai-modal';
import { DBOT_TABS, TAB_IDS } from '@/constants/bot-contents';
import { api_base, updateWorkspaceName } from '@/external/bot-skeleton';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { isDbotRTL } from '@/external/bot-skeleton/utils/workspace';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { disableUrlParameterApplication, enableUrlParameterApplication, setupTradeTypeChangeListener } from '@/utils/blockly-url-param-handler';
import { checkAndShowTradeTypeModal, getModalState, handleTradeTypeCancel, handleTradeTypeConfirm, resetUrlParamProcessing, setModalStateChangeCallback } from '@/utils/trade-type-modal-handler';
import TradeTypeConfirmationModal from '@/components/trade-type-confirmation-modal';
import {
    LabelPairedChartLineCaptionRegularIcon,
    LabelPairedObjectsColumnCaptionRegularIcon,
    LabelPairedPuzzlePieceTwoCaptionBoldIcon,
    LabelPairedLightbulbCaptionRegularIcon,
    LabelPairedSignalCaptionRegularIcon,
} from '@deriv/quill-icons/LabelPaired';
import { LegacyChartsIcon, LegacyGuide1pxIcon, LegacyIndicatorsIcon } from '@deriv/quill-icons/Legacy';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import RunPanel from '../../components/run-panel';
import ChartModal from '../chart/chart-modal';
import Dashboard from '../dashboard';
import RunStrategy from '../dashboard/run-strategy';
import Scanner from '../bot-builder/scanner/scanner';
import Tutorials from '../tutorials';
import './main.scss';

const Quantum24hAutoTraderIcon = () => (
    <svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ marginRight: '8px' }}>
        <circle cx='12' cy='12' r='10' fill='url(#quantum-gradient1)' />
        <path d='M12 5V19M5 12H19' stroke='url(#quantum-gradient2)' strokeWidth='2' strokeLinecap='round' />
        <circle cx='12' cy='12' r='3' fill='url(#quantum-gradient3)' />
        <defs>
            <radialGradient id='quantum-gradient1'>
                <stop stopColor='#00ff88' offset='0%' />
                <stop stopColor='#00ccff' offset='100%' />
            </radialGradient>
            <linearGradient id='quantum-gradient2' x1='0%' y1='0%' x2='100%' y2='100%'>
                <stop stopColor='#ff00ff' offset='0%' />
                <stop stopColor='#00ffff' offset='100%' />
            </linearGradient>
            <radialGradient id='quantum-gradient3'>
                <stop stopColor='#ffff00' />
                <stop stopColor='#ff00ff' offset='100%' />
            </radialGradient>
        </defs>
    </svg>
);

const TradingEngineIcon = () => (
    <svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' style={{ marginRight: '8px' }}>
        <g fill='url(#engine-gradient1)'>
            <rect x='2' y='2' width='8' height='8' rx='2' />
        </g>
        <g fill='url(#engine-gradient2)'>
            <rect x='14' y='2' width='8' height='8' rx='2' />
        </g>
        <g fill='url(#engine-gradient3)'>
            <rect x='2' y='14' width='8' height='8' rx='2' />
        </g>
        <g fill='url(#engine-gradient4)'>
            <rect x='14' y='14' width='8' height='8' rx='2' />
        </g>
        <defs>
            <linearGradient id='engine-gradient1' x1='2' y1='2' x2='10' y2='10' gradientUnits='userSpaceOnUse'>
                <stop stopColor='#FF6B6B' />
                <stop offset='1' stopColor='#FF8E8E' />
            </linearGradient>
            <linearGradient id='engine-gradient2' x1='14' y1='2' x2='22' y2='10' gradientUnits='userSpaceOnUse'>
                <stop stopColor='#4ECDC4' />
                <stop offset='1' stopColor='#6EE7DF' />
            </linearGradient>
            <linearGradient id='engine-gradient3' x1='2' y1='14' x2='10' y2='22' gradientUnits='userSpaceOnUse'>
                <stop stopColor='#45B7D1' />
                <stop offset='1' stopColor='#6BC9E3' />
            </linearGradient>
            <linearGradient id='engine-gradient4' x1='14' y1='14' x2='22' y2='22' gradientUnits='userSpaceOnUse'>
                <stop stopColor='#F9CA24' />
                <stop offset='1' stopColor='#FDD835' />
            </linearGradient>
        </defs>
    </svg>
);

const ChartWrapper = lazy(() => import('../chart/chart-wrapper'));

const TradingView = lazy(() => import('../tradingview'));
const AnalysisTools = lazy(() => import('../analysis-tool'));
const CopyTrading = lazy(() => import('../copy-trading'));
const Signals = lazy(() => import('../signals'));
const AutoTrades = lazy(() => import('../auto-trades/auto-trades'));
const ScannerPage = lazy(() => import('../scanner/scanner'));
import TradingBots from '../free-bots/trading-bots';

const AccountFlipper = lazy(() => import('../account-flipper'));
const SmartTrading = lazy(() => import('../smart-trading'));
const ManualTrading = lazy(() => import('../manual-trading'));
const CirclesAnalysis = lazy(() => import('../circles-analysis'));
const DigitCracker = lazy(() => import('../digit-cracker'));
const EasyTool = lazy(() => import('../easy-tool'));
const Marketkiller = lazy(() => import('../marketkiller'));
const MultiTrader = lazy(() => import('../multi-trader'));
const OverUnderAnalysisPage = lazy(() => import('../over-under'));
const Quantum24h = lazy(() => import('../quantum-24h'));
const SignalCentrePage = lazy(() => import('../smart-trading/components/signal-centre-tab'));
const Toolhub = lazy(() => import('../toolhub/toolhub'));
const TradingEngine = lazy(() => import('../trading-engine'));

const AppWrapper = observer(() => {
    const { connectionStatus } = useApiBase();
    const { dashboard, load_modal, run_panel, quick_strategy, summary_card, blockly_store } = useStore();
    const { is_loading } = blockly_store;
    const {
        active_tab,
        active_tour,
        is_chart_modal_visible,
        is_trading_view_modal_visible,
        setActiveTab,
        setWebSocketState,
        setActiveTour,
        setTourDialogVisibility,
    } = dashboard;
    const { dashboard_strategies } = load_modal;
    const {
        is_dialog_open,
        is_drawer_open,
        dialog_options,
        onCancelButtonClick,
        onCloseDialog,
        onOkButtonClick,
        stopBot,
    } = run_panel;
    const { is_open } = quick_strategy;
    const { cancel_button_text, ok_button_text, title, message, dismissable, is_closed_on_cancel } = dialog_options as {
        [key: string]: string;
    };
    const { clear } = summary_card;
    const { DASHBOARD, BOT_BUILDER } = DBOT_TABS;
    const init_render = React.useRef(true);
    const pollTimeoutId = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const hash = [
        'dashboard',
        'bot_builder',
        'chart',
        'trading_bots',
        'analysis_tool',
        'copy_trading',
        'tradingview',
        'tutorials',
        'signals',
        'auto_trades',
        'scanner',
        'smart_auto',
        'manual_trading',
        'easy_tool',
        'signal_centre',
        'marketkiller',
        'multi_trader',
    ];
    const { isDesktop } = useDevice();
    const location = useLocation();
    const navigate = useNavigate();



    const [tradeTypeModalState, setTradeTypeModalState] = useState(getModalState());

    const getTradeTypeModalProps = () => {
        const { tradeTypeData } = tradeTypeModalState;

        return {
            is_visible: tradeTypeModalState.isVisible,
            trade_type_display_name: tradeTypeData?.displayName || '',
            current_trade_type: tradeTypeData?.currentTradeType
                ? `${tradeTypeData.currentTradeType.tradeTypeCategory}/${tradeTypeData.currentTradeType.tradeType}`
                : 'N/A',
            current_trade_type_display_name: tradeTypeData?.currentTradeTypeDisplayName || 'N/A',
            onConfirm: handleTradeTypeConfirm,
            onCancel: handleTradeTypeCancel,
        };
    };

    let tab_value: number | string = active_tab;
    const GetHashedValue = (tab: number) => {
        tab_value = location.hash?.split('#')[1];
        if (!tab_value) return tab;
        return Number(hash.indexOf(String(tab_value)));
    };
    const active_hash_tab = GetHashedValue(active_tab);

    React.useEffect(() => {
        setModalStateChangeCallback(new_state => {
            setTradeTypeModalState(new_state);
        });
    }, [is_loading]);

    React.useEffect(() => {
        resetUrlParamProcessing();
    }, [location.search]);

    React.useEffect(() => {
        if (connectionStatus !== CONNECTION_STATUS.OPENED) {
            const is_bot_running = document.getElementById('db-animation__stop-button') !== null;
            if (is_bot_running) {
                clear();
                stopBot();
                api_base.setIsRunning(false);
                setWebSocketState(false);
            }
        }
    }, [clear, connectionStatus, setWebSocketState, stopBot]);

    React.useEffect(() => {
        if (active_tab === BOT_BUILDER) {
            requestAnimationFrame(() => {
                disableUrlParameterApplication();
                setupTradeTypeChangeListener();

                const handleTradeTypeModal = () => {
                    checkAndShowTradeTypeModal(
                        () => {
                            enableUrlParameterApplication();
                        },
                        () => {}
                    );
                };

                if (!blockly_store.is_loading) {
                    setTimeout(() => {
                        handleTradeTypeModal();
                    }, 500);
                } else {
                    let pollAttempts = 0;
                    const maxPollAttempts = 10;

                    const checkBlocklyLoaded = () => {
                        if (!blockly_store.is_loading) {
                            handleTradeTypeModal();
                            return;
                        }

                        if (pollAttempts < maxPollAttempts) {
                            pollAttempts++;
                            pollTimeoutId.current = setTimeout(checkBlocklyLoaded, 500);
                        }
                    };

                    checkBlocklyLoaded();
                }
            });
        }

        return () => {
            if (pollTimeoutId.current) {
                clearTimeout(pollTimeoutId.current);
                pollTimeoutId.current = null;
            }
        };
    }, [active_tab, is_loading, blockly_store.is_loading]);

    React.useEffect(() => {
        if (is_open) {
            setTourDialogVisibility(false);
        }
        if (init_render.current) {
            setActiveTab(Number(active_hash_tab));
            if (!isDesktop) handleTabChange(Number(active_hash_tab));
            init_render.current = false;
        } else {
            const currentSearch = window.location.search;
            navigate(`${currentSearch}#${hash[active_tab] || hash[0]}`);
        }
        if (active_tour !== '') {
            setActiveTour('');
        }

        const mainElement = document.querySelector('.main__container');
        if ((active_tab === DBOT_TABS.TUTORIAL || run_panel.is_drawer_open) && !isDesktop) {
            document.body.style.overflow = 'hidden';
            if (mainElement instanceof HTMLElement) {
                mainElement.classList.add('no-scroll');
            }
        } else {
            document.body.style.overflow = '';
            if (mainElement instanceof HTMLElement) {
                mainElement.classList.remove('no-scroll');
            }
        }
    }, [active_tab, run_panel.is_drawer_open]);

    React.useEffect(() => {
        const trashcan_init_id = setTimeout(() => {
            if (active_tab === BOT_BUILDER && (Blockly as any)?.derivWorkspace?.trashcan) {
                const trashcanY = window.innerHeight - 250;
                let trashcanX;
                if (is_drawer_open) {
                    trashcanX = isDbotRTL() ? 380 : window.innerWidth - 460;
                } else {
                    trashcanX = isDbotRTL() ? 20 : window.innerWidth - 100;
                }
                (Blockly as any)?.derivWorkspace?.trashcan?.setTrashcanPosition(trashcanX, trashcanY);
            }
        }, 100);

        return () => {
            clearTimeout(trashcan_init_id);
        };
    }, [active_tab, is_drawer_open]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (dashboard_strategies.length > 0) {
            timer = setTimeout(() => {
                updateWorkspaceName();
            });
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [dashboard_strategies, active_tab]);

    const handleTabChange = React.useCallback(
        (tab_index: number) => {
            setActiveTab(tab_index);
            const el_id = TAB_IDS[tab_index];
            if (el_id) {
                const el_tab = document.getElementById(el_id);
                setTimeout(() => {
                    el_tab?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }, 10);
            }
        },
        [active_tab]
    );

    const handleLoginGeneration = async () => {
        const oauthUrl = await generateOAuthURL();
        if (oauthUrl) {
            window.location.replace(oauthUrl);
        } else {
            console.error('Failed to generate OAuth URL');
        }
    };

    return (
        <React.Fragment>
            <div className='main'>
                <div
                    className={classNames('main__container', {
                        'main__container--active': active_tour && active_tab === DASHBOARD && !isDesktop,
                    })}
                >
                    <div>
                        <Tabs active_index={active_tab} className='main__tabs' onTabItemClick={handleTabChange} history={window.history as any} top>
                            <div
                                label={
                                    <>
                                        <LabelPairedObjectsColumnCaptionRegularIcon
                                            height='28px'
                                            width='28px'
                                            fill='#f5c542'
                                        />
                                        <Localize i18n_default_text='Dashboard' />
                                    </>
                                }
                                id='id-dbot-dashboard'
                            >
                                <Dashboard handleTabChange={handleTabChange} />
                            </div>

                            <div
                                label={
                                    <>
                                        <LabelPairedPuzzlePieceTwoCaptionBoldIcon
                                            height='28px'
                                            width='28px'
                                            fill='#f5c542'
                                        />
                                        <Localize i18n_default_text='Bot Builder' />
                                    </>
                                }
                                id='id-bot-builder'
                            />
                            <div
                                label={
                                    <>
                                        <LabelPairedChartLineCaptionRegularIcon
                                            height='28px'
                                            width='28px'
                                            fill='#f5c542'
                                        />
                                        <Localize i18n_default_text='Charts' />
                                    </>
                                }
                                id={
                                    is_chart_modal_visible || is_trading_view_modal_visible
                                        ? 'id-charts--disabled'
                                        : 'id-charts'
                                }
                            >
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading chart...')} />}
                                >
                                    <ChartWrapper show_digits_stats={true} />
                                </Suspense>
                            </div>
                            <div
                                label={
                                    <>
                                        <LabelPairedPuzzlePieceTwoCaptionBoldIcon
                                            height='28px'
                                            width='28px'
                                            fill='#f5c542'
                                        />
                                        <Localize i18n_default_text='Trading Bots' />
                                    </>
                                }
                                id='id-trading-bots'
                            >
                                <TradingBots />
                            </div>
                            <div
                                label={
                                    <>
                                        <LegacyIndicatorsIcon height='28px' width='28px' fill='#f5c542' />
                                        <Localize i18n_default_text='Analysis Tool' />
                                    </>
                                }
                                id='id-analysis-tool'
                            >
                                <Suspense
                                    fallback={
                                        <ChunkLoader message={localize('Please wait, loading Analysis Tool...')} />
                                    }
                                >
                                    <AnalysisTools />
                                </Suspense>
                            </div>

                            <div
                                label={
                                    <>
                                        <LabelPairedObjectsColumnCaptionRegularIcon
                                            height='28px'
                                            width='28px'
                                            fill='#f5c542'
                                        />
                                        <Localize i18n_default_text='Copy Trading' />
                                    </>
                                }
                                id='id-copy-trading'
                            >
                                <Suspense
                                    fallback={
                                        <ChunkLoader message={localize('Please wait, loading Copy Trading...')} />
                                    }
                                >
                                    <CopyTrading />
                                </Suspense>
                            </div>

                            <div
                                label={
                                    <>
                                        <LegacyChartsIcon height='28px' width='28px' fill='#f5c542' />
                                        <Localize i18n_default_text='TradingView' />
                                    </>
                                }
                                id='id-tradingview'
                            >
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading TradingView...')} />}
                                >
                                    <TradingView />
                                </Suspense>
                            </div>

                            <div
                                label={
                                    <>
                                        <LabelPairedPuzzlePieceTwoCaptionBoldIcon
                                            height='28px'
                                            width='28px'
                                            fill='#f5c542'
                                        />
                                        <Localize i18n_default_text='Tutorials' />
                                    </>
                                }
                                id='id-tutorials'
                            >
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading Tutorials...')} />}
                                >
                                    <Tutorials handleTabChange={handleTabChange} />
                                </Suspense>
                            </div>

                            <div
                                label={
                                    <>
                                        <LegacyGuide1pxIcon height='28px' width='28px' fill='#f5c542' />
                                        <Localize i18n_default_text='Signals' />
                                    </>
                                }
                                id='id-signals'
                            >
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading Signals...')} />}
                                >
                                    <Signals />
                                </Suspense>
                            </div>

                            <div
                                label={
                                    <>
                                        <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                                        <Localize i18n_default_text='Auto Trades' />
                                    </>
                                }
                                id='id-auto-trades'
                            >
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading Auto Trades...')} />}
                                >
                                    <AutoTrades />
                                </Suspense>
                            </div>



                            <div
                                label={
                                    <>
                                        <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                                        <Localize i18n_default_text='AI Strategy Scanner' />
                                    </>
                                }
                                id='id-scanner'
                            >
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading Scanner...')} />}
                                >
                                    <ScannerPage />
                                </Suspense>
                            </div>

                            <div
                                label={
                                    <>
                                        <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                                        <Localize i18n_default_text='SmartAuto' />
                                    </>
                                }
                                id='id-smart-auto'
                            >
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading SmartAuto...')} />}
                                >
                                    <SmartTrading />
                                </Suspense>
                            </div>

                            <div
                                label={
                                    <>
                                        <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                                        <Localize i18n_default_text='Manual Trading' />
                                    </>
                                }
                                id='id-manual-trading'
                            >
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading Manual Trading...')} />}
                                >
                                    <ManualTrading />
                                </Suspense>
                            </div>

                            <div
                                label={
                                    <>
                                        <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                                        <Localize i18n_default_text='Easy Tool' />
                                    </>
                                }
                                id='id-easy-tool'
                            >
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading Easy Tool...')} />}
                                >
                                    <EasyTool />
                                </Suspense>
                            </div>

                            <div
                                label={
                                    <>
                                        <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                                        <Localize i18n_default_text='Signal Centre' />
                                    </>
                                }
                                id='id-signal-centre'
                            >
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading Signal Centre...')} />}
                                >
                                    <SignalCentrePage />
                                </Suspense>
                            </div>

                            <div
                                label={
                                    <>
                                        <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                                        <Localize i18n_default_text='Marketkiller' />
                                    </>
                                }
                                id='id-marketkiller'
                            >
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading Marketkiller...')} />}
                                >
                                    <Marketkiller />
                                </Suspense>
                            </div>

                            <div
                                label={
                                    <>
                                        <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                                        <Localize i18n_default_text='Multi Trader' />
                                    </>
                                }
                                id='id-multi-trader'
                            >
                                <Suspense
                                    fallback={<ChunkLoader message={localize('Please wait, loading Multi Trader...')} />}
                                >
                                    <MultiTrader />
                                </Suspense>
                            </div>
                        </Tabs>
                    </div>
                </div>
            </div>
            <DesktopWrapper>
                <div className='main__run-strategy-wrapper'>
                    {active_tab !== DBOT_TABS.TRADING_BOTS && <RunStrategy />}
                    <RunPanel />
                </div>
                <ChartModal />
                <TradingViewModal />
                <ProfihubModal />
                <ProToolAiModal />
            </DesktopWrapper>
            <MobileWrapper>
                {!is_open && <RunPanel />}
            </MobileWrapper>

            <Dialog
                cancel_button_text={cancel_button_text || localize('Cancel')}
                className='dc-dialog__wrapper--fixed'
                confirm_button_text={ok_button_text || localize('Ok')}
                has_close_icon
                is_mobile_full_width={false}
                is_visible={is_dialog_open}
                onCancel={onCancelButtonClick || undefined}
                onClose={onCloseDialog}
                onConfirm={onOkButtonClick || onCloseDialog}
                portal_element_id='modal_root'
                title={title}
                login={handleLoginGeneration}
                dismissable={dismissable as unknown as boolean}
                is_closed_on_cancel={is_closed_on_cancel as unknown as boolean}
            >
                {message}
            </Dialog>
            <TradeTypeConfirmationModal
                is_visible={getTradeTypeModalProps().is_visible}
                trade_type_display_name={getTradeTypeModalProps().trade_type_display_name}
                current_trade_type={getTradeTypeModalProps().current_trade_type}
                current_trade_type_display_name={getTradeTypeModalProps().current_trade_type_display_name}
                onConfirm={getTradeTypeModalProps().onConfirm}
                onCancel={getTradeTypeModalProps().onCancel}
            />
            <Scanner />
        </React.Fragment>
    );
});

export default AppWrapper;
