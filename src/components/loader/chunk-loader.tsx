import React from 'react';
import './chunk-loader.scss';

export default function ChunkLoader({ message }: { message: string }) {
    return (
        <div className='chunk-loader-overlay'>
            <div className='chunk-loader-center'>
                <div className='loader-circle'>
                    <span className='loading-circle sp1' />
                    <span className='loading-circle sp2' />
                    <span className='loading-circle sp3' />
                </div>
                {message && <div className='chunk-loader-text'>{message}</div>}
            </div>
        </div>
    );
}
