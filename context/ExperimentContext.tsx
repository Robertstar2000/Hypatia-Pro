
import { createContext, useContext } from 'react';
import { ExperimentContextType } from '../config';

export const ExperimentContext = createContext<ExperimentContextType | null>(null);

export const useExperiment = () => {
    const context = useContext(ExperimentContext);
    if (!context) {
        throw new Error('useExperiment must be used within an ExperimentProvider');
    }
    return context;
};