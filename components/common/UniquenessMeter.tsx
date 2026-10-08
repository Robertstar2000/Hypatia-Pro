
import React from 'react';

export const UniquenessMeter = ({ score, justification }) => {
    const percentage = (score * 100).toFixed(0);
    const color = score > 0.8 ? 'text-success' : score > 0.5 ? 'text-warning' : 'text-danger';

    return (
        <div className="card mt-3">
            <div className="card-body">
                <h6 className="card-title">Research Uniqueness Score</h6>
                <div className="d-flex align-items-center">
                    <div className="flex-grow-1">
                        <div className="progress" style={{ height: '20px' }}>
                            <div className={`progress-bar ${color.replace('text-', 'bg-')}`} style={{ width: `${percentage}%` }} role="progressbar">{percentage}%</div>
                        </div>
                    </div>
                    <div className={`fw-bold ms-3 ${color}`} style={{ fontSize: '1.2rem' }}>
                        {score > 0.8 ? 'Highly Unique' : score > 0.5 ? 'Moderately Unique' : 'Common Topic'}
                    </div>
                </div>
                <p className="small text-white-50 mt-2 mb-0">{justification}</p>
            </div>
        </div>
    );
};