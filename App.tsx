
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Experiment } from './config';
import { db } from './be_db';
import { testApiKey, getSafeEnvApiKey } from './services';
import { useToast } from './toast';
import { ExperimentContext } from './context/ExperimentContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';

import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { LandingPage } from './components/landing/LandingPage';
import { Dashboard } from './components/dashboard/Dashboard';
import { ExperimentWorkspace } from './components/workspace/ExperimentWorkspace';
import { TestRunner } from './components/testing/TestRunner';
import { LabNotebook } from './components/workspace/LabNotebook';
import { ProjectDocumentation } from './components/documentation/ProjectDocumentation';
import { AuthView } from './components/auth/AuthView';
import { MifecoLanding } from './components/landing/MifecoLanding';

// --- MEMORY OPTIMIZATION HELPER ---
// Strips heavy data (CSVs, long markdown) from the dashboard list to prevent
// iOS/iPadOS browser crashes due to memory limits.
const lightenExperiment = (exp: Experiment): Experiment => {
    const lightExp = { ...exp };
    const lightStepData: { [key: number]: any } = {};

    if (exp.stepData) {
        Object.keys(exp.stepData).forEach(key => {
            const k = Number(key);
            const data = exp.stepData[k];
            lightStepData[k] = {
                ...data,
                // Truncate heavy fields for the list view
                input: data.input ? (data.input.length > 50 ? data.input.substring(0, 50) + '...' : data.input) : undefined,
                output: data.output ? (data.output.length > 50 ? data.output.substring(0, 50) + '...' : data.output) : undefined,
                // Keep summary and blockers as they are essential for UI badges
                summary: data.summary,
                blockers: data.blockers
            };
        });
    }
    lightExp.stepData = lightStepData;
    lightExp.labNotebook = ''; // Clear notebook text from list view
    return lightExp;
};

/**
 * @component App
 * The root component that manages the overall application state, routing, and global context.
 */
export const App = () => {
    const [view, setView] = useState('auth'); 
    const [user, setUser] = useState<any>(null);
    const [experiments, setExperiments] = useState<Experiment[]>([]);
    const [activeExperiment, setActiveExperiment] = useState<Experiment | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLabNotebookOpen, setLabNotebookOpen] = useState(false);
    
    const { addToast } = useToast();
    const isInitialized = useRef(false);

    // Initial Data Load
    useEffect(() => {
        let mounted = true;
        
        const loadData = async () => {
            if (isInitialized.current) return;
            
            try {
                if (!db || !db.experiments) {
                    throw new Error("Database schema missing.");
                }

                // Load all experiments but strip heavy data immediately
                const storedExperiments = await db.experiments.orderBy('createdAt').reverse().toArray();
                
                if (mounted) {
                    setExperiments(storedExperiments ? storedExperiments.map(lightenExperiment) : []);
                }
                
                // Auto-detect environment key
                const envKey = getSafeEnvApiKey();
                if (envKey) {
                     if (mounted) setIsAuthenticated(true);
                }

                // Check for existing session
                const savedUser = localStorage.getItem('hmap-current-user');
                if (savedUser && mounted) {
                    setUser(JSON.parse(savedUser));
                    setView('mifeco-landing');
                }
            } catch (error) {
                console.warn("Data load warning:", error);
                if (mounted) addToast("Could not access local archives.", 'warning');
            } finally {
                if (mounted) {
                    setIsLoading(false);
                    isInitialized.current = true;
                }
            }
        };

        loadData();
        
        return () => { mounted = false; };
    }, [addToast]);
    
    // Scroll to top on view change and update auth status
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setIsAuthenticated(!!getSafeEnvApiKey());
    }, [view]);

    // Context Methods - Wrapped in useCallback for referential stability
    
    const handleAuthentication = useCallback(async (type: 'promo' | 'key' | 'demo', value: string) => {
       if (getSafeEnvApiKey()) {
            setIsAuthenticated(true);
       }
    }, []);

    const createNewExperiment = useCallback(async (title: string, description: string, field: string) => {
        const newId = `exp_${Date.now()}`;
        const newExperiment: Experiment = {
            id: newId,
            title,
            description,
            field,
            currentStep: 1,
            stepData: {
                1: {
                    input: `Title: ${title}\n\nDescription: ${description}`,
                    history: [],
                    provenance: [],
                }
            },
            fineTuneSettings: {},
            createdAt: new Date().toISOString(),
            labNotebook: '',
            automationMode: null,
            status: 'active',
        };

        try {
            await db.experiments.add(newExperiment);
            // Update list with lightweight version to save memory
            setExperiments(prev => [lightenExperiment(newExperiment), ...prev]);
            // Set active with full version
            setActiveExperiment(newExperiment);
            setView('experiment');
            addToast("Project initialized.", 'success');
        } catch (error) {
            console.error("Failed to save new experiment:", error);
            addToast("Failed to create project database entry.", 'danger');
        }
    }, [addToast]);

    const importExperiment = useCallback(async (experimentData: Experiment) => {
        try {
            if (!experimentData.id || !experimentData.title || !experimentData.createdAt) {
                throw new Error("Invalid experiment file format.");
            }
            
            // Check for duplicate ID
            const existing = await db.experiments.get(experimentData.id);
            if (existing) {
                experimentData.id = `exp_${Date.now()}_imported`;
                experimentData.title = `${experimentData.title} (Imported)`;
            }

            await db.experiments.add(experimentData);
            
            // Reload list with memory optimization
            const storedExperiments = await db.experiments.orderBy('createdAt').reverse().toArray();
            setExperiments(storedExperiments.map(lightenExperiment));
            
            addToast(`Project imported successfully.`, 'success');
        } catch(error) {
             console.error(error);
             addToast(`Failed to import project. File may be corrupted.`, 'danger');
        }
    }, [addToast]);

    const updateExperiment = useCallback(async (updatedExperiment: Experiment): Promise<Experiment> => {
        try {
            const experimentWithTimestamp = { ...updatedExperiment, updatedAt: new Date().toISOString() };
            
            // 1. Save FULL data to persistent storage (IndexedDB)
            await db.experiments.put(experimentWithTimestamp);
            
            // 2. Update the LIST state with LIGHTWEIGHT version (Memory Protection)
            setExperiments(prev => prev.map(e => e.id === experimentWithTimestamp.id ? lightenExperiment(experimentWithTimestamp) : e));
            
            // 3. Update the ACTIVE state with FULL version (so user sees their data)
            if (activeExperiment?.id === experimentWithTimestamp.id) {
                setActiveExperiment(experimentWithTimestamp);
            }
            return experimentWithTimestamp;
        } catch (error) {
            console.error("Failed to update experiment:", error);
            addToast("Failed to save changes.", "danger");
            throw error;
        }
    }, [activeExperiment, addToast]);

    const deleteExperiment = useCallback(async (id: string) => {
        if (window.confirm("Are you sure you want to delete this project? This cannot be undone.")) {
            try {
                await db.experiments.delete(id);
                setExperiments(prev => {
                    const updated = prev.filter(e => e.id !== id);
                    if (activeExperiment?.id === id) {
                        setActiveExperiment(null);
                        setView(updated.length > 0 ? 'dashboard' : 'landing');
                    }
                    return updated;
                });
                addToast("Project deleted.", 'success');
            } catch (error) {
                addToast("Failed to delete project.", 'danger');
            }
        }
    }, [activeExperiment, addToast]);

    const selectExperiment = useCallback(async (id: string) => {
        setIsLoading(true); // Show loading UI while fetching heavy data
        try {
            const fullExperiment = await db.experiments.get(id);
            if (fullExperiment) {
                setActiveExperiment(fullExperiment);
                setView('experiment');
            } else {
                addToast("Error: Experiment data not found.", 'danger');
            }
        } catch (error) {
            console.error("Fetch error:", error);
            addToast("Failed to retrieve project from database.", 'danger');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    const handleLogout = useCallback(() => {
        localStorage.removeItem('hmap-current-user');
        localStorage.removeItem('hmap-token');
        setUser(null);
        setView('auth');
    }, []);

    // Construct context value
    const contextValue = {
        experiments,
        activeExperiment,
        isAuthenticated,
        createNewExperiment,
        updateExperiment,
        deleteExperiment,
        selectExperiment,
        setActiveExperiment,
        importExperiment,
        handleAuthentication,
    };

    if (isLoading) {
        return (
            <div className="d-flex align-items-center justify-content-center vh-100 bg-[#0f172a] text-white">
                <div className="text-center">
                    <div className="spinner-border text-info mb-4" role="status" style={{width: '3rem', height: '3rem'}}></div>
                    <h5 className="fw-light ls-1 text-uppercase font-['Space_Grotesk']">Initializing MIFECO Hub...</h5>
                    <p className="text-white-50 small mt-2">Establishing secure archival link</p>
                </div>
            </div>
        );
    }

    if (view === 'auth') {
        return <AuthView onAuthSuccess={(u) => { setUser(u); setView('mifeco-landing'); }} />;
    }

    return (
        <ErrorBoundary>
            <ExperimentContext.Provider value={contextValue}>
                {view !== 'mifeco-landing' && <Header setView={setView} activeView={view} onToggleNotebook={() => setLabNotebookOpen(p => !p)} />}
                <main className={view === 'mifeco-landing' ? "" : "container-fluid mt-4"} style={{ minHeight: view === 'mifeco-landing' ? '100vh' : '80vh' }}>
                    {view === 'mifeco-landing' && (
                        <MifecoLanding 
                            user={user} 
                            onOpenDatabase={() => setView('dashboard')}
                            onInitiateProtocol={() => setView('landing')}
                            onLogout={handleLogout}
                            onKeyUpdate={() => setIsAuthenticated(!!getSafeEnvApiKey())}
                        />
                    )}
                    {view === 'landing' && <LandingPage setView={setView} />}
                    {view === 'dashboard' && <Dashboard setView={setView} />}
                    {view === 'experiment' && activeExperiment && <ExperimentWorkspace key={activeExperiment.id} />}
                    {view === 'documentation' && <ProjectDocumentation />}
                    {view === 'testing' && <TestRunner />}
                </main>
                {view !== 'mifeco-landing' && (
                    <>
                        {activeExperiment && isAuthenticated && (
                            <LabNotebook 
                                isOpen={isLabNotebookOpen} 
                                onClose={() => setLabNotebookOpen(false)}
                            />
                        )}
                        <Footer />
                    </>
                )}
            </ExperimentContext.Provider>
        </ErrorBoundary>
    );
};
