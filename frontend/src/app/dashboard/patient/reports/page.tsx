"use client";

import { useState } from 'react';

export default function AIReportInterpreter() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setStatus('Scanning document & running Groq/Llama AI Pipeline...');
    setAnalysis(null);
    
    // Create FormData for the file upload
    try {
      const token = localStorage.getItem('token');
      
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch('http://localhost:8000/api/reports/analyze', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      if (res.ok) {
        setAnalysis(data.results);
        setStatus('Analysis complete.');
      } else {
        setStatus(`Error: ${data.detail}`);
      }
    } catch (err) {
      setStatus('Network Error');
    }
  };

  return (
    <div style={{ backgroundColor: '#f0f4f8', minHeight: '100vh', padding: '40px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ color: '#1a2b4a', marginBottom: '10px' }}>AI Lab Report Interpreter</h1>
        <p style={{ color: '#4a5568', marginBottom: '30px' }}>Upload your raw lab report PDF. Our AI will translate the complex medical jargon into a plain-language summary and flag any abnormal values for you.</p>

        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
          <form onSubmit={handleUpload} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <input 
              type="file" 
              accept=".pdf,.jpg,.png"
              onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
              style={{ flex: 1, padding: '10px', border: '1px dashed #cbd5e0', borderRadius: '8px' }}
            />
            <button type="submit" disabled={!file} style={{ padding: '12px 25px', backgroundColor: file ? '#3182ce' : '#a0aec0', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: file ? 'pointer' : 'not-allowed' }}>
              Analyze Report
            </button>
          </form>
          {status && <p style={{ color: '#718096', fontWeight: 'bold', marginTop: '15px' }}>{status}</p>}
        </div>

        {analysis && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            {/* Plain Language Summary */}
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h2 style={{ color: '#3182ce', margin: '0 0 15px 0' }}>Patient Summary</h2>
              <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#2d3748', backgroundColor: '#ebf8ff', padding: '20px', borderRadius: '8px' }}>
                {analysis.plain_language_summary}
              </p>
              
              <h2 style={{ color: '#4a5568', margin: '30px 0 15px 0', fontSize: '18px' }}>Doctor's Clinical View</h2>
              <p style={{ fontSize: '14px', color: '#718096', fontStyle: 'italic', borderLeft: '3px solid #cbd5e0', paddingLeft: '15px' }}>
                {analysis.doctor_clinical_summary}
              </p>
            </div>

            {/* Abnormal Flags */}
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h2 style={{ color: '#e53e3e', margin: '0 0 15px 0' }}>⚠️ Abnormal Flags</h2>
              {analysis.abnormal_flags.map((flag: any, idx: number) => (
                <div key={idx} style={{ backgroundColor: '#fff5f5', border: '1px solid #fed7d7', padding: '15px', borderRadius: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong style={{ color: '#c53030', fontSize: '18px' }}>{flag.marker}</strong>
                    <span style={{ backgroundColor: '#e53e3e', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {flag.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#4a5568' }}>
                    <span>Result: <strong>{flag.value}</strong></span>
                    <span>Normal: {flag.reference_range}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
