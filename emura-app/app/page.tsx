'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // App initializes via the script in layout
  }, []);

  return (
    <div id="app">
      <header>
        <h1>&#9883; Manufacturing Cost Estimator</h1>
        <div className="hdr-r">
          <span id="save-status">Saved</span>
          <button id="undo-btn" className="btn btn-undo btn-sm" onClick={() => (window as any).doUndo()} disabled>&#8630; Undo</button>
          <button className="btn btn-neu btn-sm" onClick={() => (window as any).newQuote()}>New</button>
          <button className="btn btn-neu btn-sm" onClick={() => (window as any).exportJSON()}>Export</button>
          <label className="btn btn-neu btn-sm" style={{cursor:'pointer',margin:0}}>Import
            <input type="file" accept=".json" onChange={(e) => (window as any).importJSON(e)} style={{display:'none'}} />
          </label>
        </div>
      </header>
      <nav id="tabs">
        <button className="tab-btn" data-tab="info">Quote Info</button>
        <button className="tab-btn" data-tab="fgs">Finished Goods</button>
        <button className="tab-btn" data-tab="bom">Bill of Materials</button>
        <button className="tab-btn" data-tab="matcost">Material Costs</button>
        <button className="tab-btn" data-tab="equip">Equipment</button>
        <button className="tab-btn" data-tab="ops">Operations</button>
        <button className="tab-btn" data-tab="summary">Summary</button>
      </nav>
      <main id="content"></main>
    </div>
  );
}
