import React from 'react';

const TradingView: React.FC = () => {
    return (
        <iframe
            id='trading-view-tab-iframe'
            style={{
                width: '100%',
                height: 'calc(100vh - 80px)',
                border: 'none',
                background: 'white',
            }}
            src='https://charts.deriv.com/deriv?hide-signup=true'
            title='TradingView Charts'
        />
    );
};

export default TradingView;
