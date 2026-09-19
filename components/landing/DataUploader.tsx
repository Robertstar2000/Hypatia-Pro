
import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../toast';
import * as XLSX from 'xlsx';

export const DataUploader = ({ onComplete }) => {
    const [file, setFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState('');
    const { addToast } = useToast();
    
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    // Helper to safely access XLSX methods regardless of import structure
    const getXLSX = () => {
        // @ts-ignore
        return XLSX.default || XLSX;
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();

            if (selectedFile.name.endsWith('.csv')) {
                reader.onload = (event) => {
                    if (isMounted.current) {
                        const content = event.target?.result as string;
                        setFileContent(content);
                    }
                };
                reader.readAsText(selectedFile);
            } else if (selectedFile.name.endsWith('.xlsx')) {
                reader.onload = (event) => {
                    if (!isMounted.current) return;
                    try {
                        const Lib = getXLSX();
                        const data = event.target?.result;
                        const workbook = Lib.read(data, { type: 'array' });
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        const csvContent = Lib.utils.sheet_to_csv(worksheet);
                        setFileContent(csvContent);
                        addToast("Excel file parsed successfully.", 'success');
                    } catch (error) {
                        console.error("Error parsing XLSX file:", error);
                        addToast('Error parsing .xlsx file.', 'danger');
                        setFile(null);
                        setFileContent('');
                        e.target.value = '';
                    }
                };
                reader.readAsArrayBuffer(selectedFile);
            } else {
                addToast('Please upload a valid .csv or .xlsx file.', 'warning');
                e.target.value = ''; // Reset file input
                setFile(null);
                setFileContent('');
            }
        }
    };

    const handleSubmit = () => {
        if (!file || !fileContent) {
            addToast('Please select a file to upload.', 'warning');
            return;
        }
        const summary = `Data uploaded from file: ${file.name}`;
        onComplete(fileContent, summary);
    };

    return (
        <div>
            <h6 className="fw-bold">Upload Your Dataset</h6>
            <p className="text-white-50 small">Please select a CSV or Excel (.xlsx) file from your computer.</p>
            <div className="mb-3">
                <input type="file" className="form-control" accept=".csv,.xlsx" onChange={handleFileChange} />
            </div>
            {fileContent && (
                <div className="mb-3">
                    <label className="form-label small">File Preview (as CSV):</label>
                    <textarea className="form-control" readOnly rows={8} value={fileContent} />
                </div>
            )}
            <button className="btn btn-success" onClick={handleSubmit} disabled={!fileContent}>
                <i className="bi bi-check-circle-fill me-1"></i> Submit Uploaded Data
            </button>
        </div>
    );
};