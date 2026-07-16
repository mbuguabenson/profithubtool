import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import { api_base } from '@/external/bot-skeleton';
import classNames from 'classnames';
import './scanner.scss';

const Scanner = observer(() => {
  const { scanner } = useStore();
  const {
    is_open,
    is_scanning,
    selected_symbols,
    current_signal,
    setScannerVisibility,
    setSelectedSymbols,
    startScanning,
    stopScanning,
    loadBotWithStrategy,
    loadBotAndRun,

    // New states / actions
    selected_strategies,
    scan_market_mode,
    single_market_symbol,
    ticks_counter,
    toggleStrategy,
    setScanMarketMode,
    setSingleMarketSymbol,
  } = scanner;

  const [available_symbols, setAvailableSymbols] = useState<any[]>([]);

  useEffect(() => {
    if (api_base.active_symbols && api_base.active_symbols.length > 0) {
      // Filter out symbols to keep only synthetic indices or desired volatilities
      const symbols = api_base.active_symbols.filter((s: any) => 
        (s.symbol || s.underlying_symbol || '').includes('1HZ') || 
        (s.symbol || s.underlying_symbol || '').includes('R_') ||
        (s.symbol || s.underlying_symbol || '').includes('BOOM') ||
        (s.symbol || s.underlying_symbol || '').includes('CRASH')
      );
      setAvailableSymbols(symbols.length > 0 ? symbols : api_base.active_symbols);

      if (selected_symbols.length === 0) {
        const allSyms = (symbols.length > 0 ? symbols : api_base.active_symbols).map((s: any) => s.symbol || s.underlying_symbol);
        setSelectedSymbols(allSyms);
      }
    }
  }, []);

  const strategyOptions: { value: string; label: string }[] = [
    { value: 'even_odd', label: 'Even/Odd' },
    { value: 'over_under', label: 'Over/Under' },
    { value: 'matches', label: 'Matches' },
    { value: 'differs', label: 'Differs' },
    { value: 'rise_fall', label: 'Rise/Fall' },
    { value: 'pro_even_odd', label: 'Pro E/O' },
    { value: 'pro_over_under', label: 'Pro O/U' },
    { value: 'pro_differs', label: 'Pro Diff' },
    { value: 'under_7', label: 'Under 7' },
    { value: 'over_2', label: 'Over 2' },
    { value: 'super', label: 'Super Signals' },
  ];

  return (
    <React.Fragment>
      {is_open && (
        <DraggableResizeWrapper
          boundary=".main"
          header={localize('AI Market Scanner')}
          onClose={setScannerVisibility}
          modalWidth={526}
          modalHeight={595}
          minWidth={526}
          minHeight={524}
          enableResizing
        >
          <div className="scanner-container minimal-scanner" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '16px' }}>
            <div className="scanner-scroll-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px', marginBottom: '12px' }}>
              {/* Market Selection Section */}
              <div className="section-card">
                <div className="section-header">
                  <span className="section-title">{localize('Markets')}</span>
                  <div className="mode-toggle">
                    <button
                      className={classNames('mode-btn', { active: scan_market_mode === 'multi' })}
                      onClick={() => setScanMarketMode('multi')}
                    >
                      {localize('All Markets')}
                    </button>
                    <button
                      className={classNames('mode-btn', { active: scan_market_mode === 'single' })}
                      onClick={() => setScanMarketMode('single')}
                    >
                      {localize('Single')}
                    </button>
                  </div>
                </div>

                {scan_market_mode === 'single' ? (
                  <div className="market-select-wrapper">
                    <select
                      className="market-select"
                      value={single_market_symbol}
                      onChange={(e) => setSingleMarketSymbol(e.target.value)}
                    >
                      {available_symbols.map((sym: any) => (
                        <option key={sym.symbol || sym.underlying_symbol} value={sym.symbol || sym.underlying_symbol}>
                          {sym.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="scan-info-text">
                    {localize('Scanning all volatility indices and boom/crash markets')}
                  </p>
                )}
              </div>

              {/* Strategies Selection Section */}
              <div className="section-card">
                <span className="section-title" style={{ marginBottom: '8px', display: 'block' }}>
                  {localize('Select Strategies')}
                </span>
                <div className="strategy-grid">
                  {strategyOptions.map(opt => {
                    const isSelected = selected_strategies.includes(opt.value as any);
                    return (
                      <button
                        key={opt.value}
                        className={classNames('strategy-checkbox', { active: isSelected })}
                        onClick={() => toggleStrategy(opt.value as any)}
                      >
                        <span className="check-indicator">{isSelected ? '✓' : ''}</span>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scanning Progress */}
              <div className="section-card scanning-status">
                <div className="scanning-info">
                  <span className={classNames('status-dot', { scanning: is_scanning })}></span>
                  <span className="status-message">
                    {is_scanning 
                      ? `${localize('Evaluating tick patterns')}... (${ticks_counter}/25)`
                      : localize('Ready to scan')}
                  </span>
                </div>
                <div className="progress-bar-bg">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: is_scanning ? `${(ticks_counter / 25) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              {/* Live Signals Scrollable Area */}
              <div className="section-card signals-area">
                <span className="section-title" style={{ marginBottom: '8px', display: 'block' }}>
                  {localize('Active Signals')}
                </span>
                {scanner.signals.length === 0 ? (
                  <p className="no-signals-text">
                    {is_scanning ? localize('Scanning for opportunities...') : localize('Click scan to search setups')}
                  </p>
                ) : (
                  <div className="signals-scroll-list">
                    {scanner.signals.map((sig, idx) => {
                      const isSelected = current_signal && current_signal.symbol === sig.symbol && current_signal.strategy === sig.strategy;
                      const isStrong = sig.confidence >= 0.9;
                      return (
                        <div
                          key={idx}
                          className={classNames('signal-row-item', { active: isSelected, strong: isStrong })}
                          onClick={() => {
                            scanner.current_signal = sig;
                            scanner.is_manual_selection = true;
                          }}
                        >
                          <div className="row-header">
                            <span className="row-symbol">{sig.symbol}</span>
                            <span className="row-strategy">{sig.strategy.replace('_', ' ').toUpperCase()}</span>
                            <span className="row-pct">{(sig.confidence * 100).toFixed(0)}%</span>
                          </div>
                          <p className="row-rec">{sig.details.recommendation}</p>
                          <p className="row-entry">Entry: {sig.details.entryCondition}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="footer-actions" style={{ flexShrink: 0, marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-normal-1, rgba(255,255,255,0.08))' }}>
              <button
                className="action-btn scan-btn"
                onClick={is_scanning ? stopScanning : startScanning}
              >
                {is_scanning ? localize('Stop') : localize('Scan Again')}
              </button>
              <button
                className="action-btn load-btn"
                onClick={loadBotWithStrategy}
                disabled={!current_signal}
              >
                {localize('Load Bot')}
              </button>
              <button
                className="action-btn run-btn"
                onClick={loadBotAndRun}
                disabled={!current_signal}
              >
                {localize('Load and Run')}
              </button>
            </div>
          </div>
        </DraggableResizeWrapper>
      )}
    </React.Fragment>
  );
});

export default Scanner;
