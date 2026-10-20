import React, { useEffect, useRef, useState } from 'react';

async function readFoodResponse(response) {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Food management is unavailable. Restart the server, refresh this page, and try again.');
  }
  try { return await response.json(); }
  catch { throw new Error('Unable to read the response. Please try again.'); }
}

function FoodEditorDialog({ title, saving, onClose, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return <dialog ref={dialogRef} className="foodEditorDialog" aria-label={title} onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <button className="foodDialogClose" type="button" aria-label="Close popup" disabled={saving} onClick={onClose}>×</button>
    {children}
  </dialog>;
}

function DeleteAction({ vendor, saving, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) return <div className="foodDeleteArea"><button className="foodDeleteButton" type="button" disabled={saving} onClick={() => setConfirming(true)}>Delete {vendor ? 'vendor' : 'food'}</button></div>;
  return <div className="foodDeleteArea" role="group" aria-label="Confirm deletion">
    <p>{vendor ? 'Delete this vendor and all of its food?' : 'Delete this food item?'} This cannot be undone.</p>
    <div className="foodActions"><button className="foodDeleteButton" type="button" disabled={saving} onClick={onDelete}>{saving ? 'Deleting…' : `Yes, delete ${vendor ? 'vendor' : 'food'}`}</button><button type="button" disabled={saving} onClick={() => setConfirming(false)}>Keep {vendor ? 'vendor' : 'food'}</button></div>
  </div>;
}

export default function FoodPage({ vendorMode }) {
  const [items, setItems] = useState([]);
  const [vendorRecords, setVendorRecords] = useState([]);
  const [vendorEditing, setVendorEditing] = useState(null);
  const [editSession, setEditSession] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const pinDialog = useRef(null);
  const editMode = vendorMode && Boolean(editSession);
  const [vendorId, setVendorId] = useState(() => window.location.pathname.match(/^\/vendor\/(\d+)\/?$/)?.[1] || '');
  const selectedVendor = vendorRecords.find(vendor => String(vendor.id) === vendorId);
  const selected = selectedVendor?.vendor_name || '';
  const vendorDetail = vendorMode && Boolean(vendorId);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');
  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(vendorMode ? '/api/vendor' : '/api/rte-food');
      const data = await readFoodResponse(response);
      if (!response.ok) throw new Error(data.error);
      setItems(data.items);
      setVendorRecords(data.vendors || []);
      return data;
    } catch (err) { setError(err.message || 'Unable to load food.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [vendorMode]);
  useEffect(() => {
    if (vendorMode) return;
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [vendorMode]);
  useEffect(() => {
    const onPopState = () => {
      setVendorId(window.location.pathname.match(/^\/vendor\/(\d+)\/?$/)?.[1] || '');
      setEditing(null); setVendorEditing(null); setError(''); setMessage('');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  function openVendor(id = '', replace = false) {
    const path = id ? `/vendor/${id}` : '/vendor';
    if (window.location.pathname !== path) window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
    setVendorId(String(id)); setEditing(null); setVendorEditing(null); setError(''); setMessage('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function followVendor(event, id = '') {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); openVendor(id);
  }
  const vendors = [...new Set([...vendorRecords.map(v => v.vendor_name), ...items.map(item => item.vendor_name)])];
  const authHeaders = { 'Content-Type': 'application/json', ...(editSession ? { 'X-Vendor-Session': editSession.token } : {}) };
  function leaveEditMode() {
    if (editSession) fetch('/api/vendor/exit-edit-mode', { method: 'POST', headers: authHeaders }).catch(() => {});
    setEditSession(null); setEditing(null); setVendorEditing(null); setCode('');
  }
  function checkSession(response) {
    if (response.status === 401) {
      leaveEditMode();
      throw new Error('Edit mode expired. Enter your PIN again to continue.');
    }
  }
  useEffect(() => {
    if (pinOpen) pinDialog.current?.showModal();
    else pinDialog.current?.close();
  }, [pinOpen]);
  useEffect(() => {
    if (!editSession) return;
    const timer = setTimeout(() => {
      setEditSession(null); setEditing(null); setVendorEditing(null);
      setMessage('Edit mode expired. Enter your PIN again to continue.');
    }, Math.max(0, editSession.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [editSession]);
  async function unlock(event) {
    event.preventDefault(); setUnlocking(true); setPinError('');
    try {
      const response = await fetch('/api/vendor/edit-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
      });
      const data = await readFoodResponse(response);
      if (!response.ok) throw new Error(data.error);
      if (typeof data.token !== 'string' || !Number.isFinite(data.expiresAt)) throw new Error('Unable to unlock edit mode. Please restart the server and try again.');
      setEditSession(data); setPinOpen(false); setCode(''); setError('');
      setMessage('Edit mode is on. You can manage vendors and food.');
    } catch (err) { setPinError(err.message || 'Unable to unlock edit mode.'); }
    finally { setUnlocking(false); }
  }
  function edit(item) { setVendorEditing(null); setEditing(item); setCode(''); setError(''); setMessage(''); }
  async function save(event) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch(editing.id ? `/api/vendor/${editing.id}` : '/api/vendor', {
        method: editing.id ? 'PUT' : 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...editing, count: Number(editing.count) }),
      });
      const data = await readFoodResponse(response);
      checkSession(response);
      if (!response.ok) throw new Error(data.error);
      const name = editing.vendor_name.trim();
      setEditing(null); setCode('');
      const refreshed = await load();
      const vendor = refreshed?.vendors.find(v => v.vendor_name === name);
      if (vendor) openVendor(vendor.id);
      setMessage('Food availability updated.');
    } catch (err) { setError(err.message || 'Unable to save food.'); }
    finally { setSaving(false); }
  }
  function editVendor(vendor) {
    setEditing(null); setVendorEditing(vendor); setCode(''); setError(''); setMessage('');
  }
  async function saveVendor(event) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch(vendorEditing.id ? `/api/vendors/${vendorEditing.id}` : '/api/vendors', {
        method: vendorEditing.id ? 'PUT' : 'POST', headers: authHeaders,
        body: JSON.stringify({ vendor_name: vendorEditing.vendor_name }),
      });
      const data = await readFoodResponse(response);
      checkSession(response);
      if (!response.ok) throw new Error(data.error);
      const name = vendorEditing.vendor_name.trim();
      setVendorEditing(null); setCode('');
      const refreshed = await load();
      const vendor = refreshed?.vendors.find(v => v.vendor_name === name);
      if (vendor) openVendor(vendor.id);
      setMessage('Vendor saved. You can now add food for this vendor.');
    } catch (err) { setError(err.message || 'Unable to save vendor.'); }
    finally { setSaving(false); }
  }
  async function deleteEntry(vendor) {
    const entry = vendor ? vendorEditing : editing;
    if (!editMode || !entry?.id || saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch(vendor ? `/api/vendors/${entry.id}` : `/api/vendor/${entry.id}`, { method: 'DELETE', headers: authHeaders });
      const data = await readFoodResponse(response);
      checkSession(response);
      if (!response.ok) throw new Error(data.error);
      setVendorEditing(null); setEditing(null);
      if (vendor) openVendor();
      await load();
      setMessage(vendor ? 'Vendor and its food deleted.' : 'Food deleted.');
    } catch (err) { setError(err.message || 'Unable to delete. Please try again.'); }
    finally { setSaving(false); }
  }
  const query = search.trim().toLocaleLowerCase();
  const visible = vendorMode
    ? items.filter(item => item.vendor_name === selected)
    : items.filter(item => `${item.food_name} ${item.vendor_name}`.toLocaleLowerCase().includes(query));
  return <main className="foodPage">
    <header className="foodHeader"><a className="brand" href="/">Zelis</a><nav><a href="/">Back to shop</a>{vendorMode && <a href="/admin">Admin dashboard</a>}<a href={vendorMode ? '/rte-food' : '/vendor'}>{vendorMode ? 'Customer view' : 'Vendor stock'}</a></nav></header>
    <section className="foodContent">
      {vendorDetail && <a className="vendorBackLink" href="/vendor" onClick={event => followVendor(event)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10 5-7 7 7 7M3 12h18" /></svg><span>Back to vendors</span></a>}
      <span className="foodEyebrow">{vendorMode ? 'Vendor stock management' : 'Freshly prepared · Ready when you are'}</span>
      <h1>{vendorDetail ? (selected || (loading ? 'Loading vendor…' : 'Vendor not found')) : vendorMode ? 'Our vendors' : 'Ready To Eat Food'}</h1>
      <p>{vendorDetail ? 'Browse food and current stock from this vendor.' : vendorMode ? 'Choose a vendor to view their food and current stock.' : 'Explore what is available from our local vendors. Stock is refreshed every minute.'}</p>
      <div className="foodActions">{vendorMode && <button className={editMode ? '' : 'foodPrimaryButton'} disabled={saving} onClick={() => { if (editMode) { leaveEditMode(); setMessage('View mode is on.'); } else { setPinError(''); setCode(''); setPinOpen(true); } }}>{editMode ? 'Exit edit mode' : 'Enter edit mode'}</button>}{editMode && <>{!vendorDetail && <button className="foodPrimaryButton foodAddButton" onClick={() => editVendor({ vendor_name: '' })} disabled={saving}>Add vendor</button>}{selected && <><button className="foodPrimaryButton foodAddButton" onClick={() => edit({ vendor_name: selected, food_name: '', count: 0 })} disabled={saving}>Add food</button><button onClick={() => editVendor(vendorRecords.find(v => v.vendor_name === selected))} disabled={saving || !vendorRecords.some(v => v.vendor_name === selected)}>Edit vendor</button></>}</>}</div>
      {!vendorMode && <div className="foodSearch">
        <label htmlFor="food-search">Find your next meal</label>
        <div className="foodSearchField">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input id="food-search" type="search" placeholder="Search food or vendor name…" value={search} onChange={event => setSearch(event.target.value)} aria-controls="food-results" />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear food search">Clear</button>}
        </div>
        {!loading && !error && items.length > 0 && <p role="status">{visible.length} {visible.length === 1 ? 'food item' : 'food items'}{query ? ' found' : ' available'}</p>}
      </div>}
      {!vendorMode && !loading && !error && items.length > 0 && !visible.length && <p>No food matches “{search.trim()}”. Try another food or vendor name.</p>}
      {error && !(editMode && (vendorEditing || editing)) && <p role="alert" className="foodError">{error}</p>}
      {message && <p role="status">{message}</p>}
      {loading && <p role="status">Loading availability…</p>}
      {!loading && !error && !(vendorMode ? vendors.length : items.length) && !vendorDetail && <p>{vendorMode ? (editMode ? 'No vendors yet. Choose Add vendor to get started.' : 'No vendors yet. Enter edit mode to add a vendor.') : 'No ready-to-eat food is available right now. Please check again soon.'}</p>}
      {vendorMode && !vendorDetail && <div className="vendorGrid">{vendorRecords.map(vendor => <a key={vendor.id} className="vendorTile" href={`/vendor/${vendor.id}`} onClick={event => followVendor(event, vendor.id)}><span aria-hidden="true">🍽</span><strong>{vendor.vendor_name}</strong><small>{items.filter(item => item.vendor_name === vendor.vendor_name).length} food items</small><span className="vendorViewLabel">View food</span></a>)}</div>}
      {vendorDetail && !loading && !error && !selectedVendor && <p>This vendor could not be found. Return to all vendors to choose another.</p>}
      {editMode && vendorEditing && <FoodEditorDialog title={vendorEditing.id ? 'Edit vendor' : 'Add vendor'} saving={saving} onClose={() => { setVendorEditing(null); setError(''); }}><form className="foodForm" onSubmit={saveVendor}>
        <h2>{vendorEditing.id ? 'Edit vendor' : 'Add vendor'}</h2>
        <label>Vendor name<input autoFocus required maxLength={191} value={vendorEditing.vendor_name} disabled={saving} onChange={e => setVendorEditing({ ...vendorEditing, vendor_name: e.target.value })} /></label>
        {error && <p className="foodError" role="alert">{error}</p>}
        <div className="foodActions"><button className="foodPrimaryButton" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save vendor'}</button><button type="button" disabled={saving} onClick={() => { setVendorEditing(null); setCode(''); setError(''); }}>Cancel</button></div>
        {vendorEditing.id && <DeleteAction vendor saving={saving} onDelete={() => deleteEntry(true)} />}
      </form></FoodEditorDialog>}
      {editMode && editing && <FoodEditorDialog title={editing.id ? 'Update food' : 'Add food'} saving={saving} onClose={() => { setEditing(null); setError(''); }}><form className="foodForm" onSubmit={save}>
        <h2>{editing.id ? 'Update food' : 'Add food'}</h2>
        <label>Vendor<select required value={editing.vendor_name} disabled={saving} onChange={e => setEditing({ ...editing, vendor_name: e.target.value })}>{vendors.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
        <label>Food name<input autoFocus required maxLength={191} value={editing.food_name} disabled={saving} onChange={e => setEditing({ ...editing, food_name: e.target.value })} /></label>
        <label>Count<input type="number" required min="0" max="4294967295" step="1" value={editing.count} disabled={saving} onChange={e => setEditing({ ...editing, count: e.target.value })} /></label>
        {error && <p className="foodError" role="alert">{error}</p>}
        <div className="foodActions"><button className="foodPrimaryButton" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save update'}</button><button type="button" disabled={saving} onClick={() => { setEditing(null); setCode(''); setError(''); }}>Cancel</button></div>
      {editing.id && <DeleteAction saving={saving} onDelete={() => deleteEntry(false)} />}
      </form></FoodEditorDialog>}
      {vendorDetail && selected && <>
        <div className="vendorFoodSummary"><h2>Food menu</h2><span>{visible.length} food items · {visible.reduce((total, item) => total + Number(item.count), 0)} in stock</span></div>
        {!loading && !visible.length && <p>No food added for this vendor yet.{editMode && ' Choose Add food to get started.'}</p>}
        <div className="vendorFoodGrid">{visible.map(item => <article className="vendorFoodCard" key={item.id}>
          <span className={`vendorFoodStatus ${item.count === 0 ? 'soldOut' : ''}`}>{item.count === 0 ? 'Sold out' : 'Available'}</span>
          <h3>{item.food_name}</h3>
          <div className="vendorFoodCount"><strong>{item.count}</strong><span>in stock</span></div>
          <p>Updated <time dateTime={item.updated_time}>{new Date(item.updated_time).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</time></p>
          {editMode && <div className="foodActions"><button type="button" onClick={() => edit(item)} disabled={saving}>Update food</button></div>}
        </article>)}</div>
      </>}
      {!vendorMode && visible.length > 0 && <div className="foodTableWrap"><table id="food-results" className="foodTable"><thead><tr><th>Food name</th><th>Vendor</th><th>Updated time</th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td>{item.food_name}</td><td>{item.vendor_name}</td><td><time dateTime={item.updated_time}>{new Date(item.updated_time).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</time></td></tr>)}</tbody></table></div>}
    </section>
    {vendorMode && <dialog ref={pinDialog} className="pinDialog" onCancel={event => { event.preventDefault(); if (!unlocking) { setPinOpen(false); setCode(''); } }}>
      <form onSubmit={unlock}>
        <span className="pinBadge" aria-hidden="true">✦</span>
        <h2>Enter edit mode</h2>
        <p>Enter your four-digit admin PIN to manage vendors and food.</p>
        <label htmlFor="vendor-pin">Admin PIN</label>
        <input id="vendor-pin" className="pinInput" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} minLength={4} autoComplete="off" required autoFocus value={code} disabled={unlocking} onChange={event => { setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 4)); setPinError(''); }} aria-describedby={pinError ? 'pin-error' : undefined} aria-invalid={Boolean(pinError)} />
        <div className="pinNumpad" role="group" aria-label="PIN number pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => <button key={digit} type="button" disabled={unlocking || code.length >= 4} onClick={() => { setCode(value => (value + digit).slice(0, 4)); setPinError(''); }}>{digit}</button>)}
          <button type="button" className="pinUtility" disabled={unlocking || !code} onClick={() => { setCode(''); setPinError(''); }}>Clear</button>
          <button type="button" disabled={unlocking || code.length >= 4} onClick={() => { setCode(value => (value + '0').slice(0, 4)); setPinError(''); }}>0</button>
          <button type="button" className="pinUtility" aria-label="Delete last PIN digit" disabled={unlocking || !code} onClick={() => { setCode(value => value.slice(0, -1)); setPinError(''); }}>⌫</button>
        </div>
        {pinError && <p id="pin-error" className="foodError" role="alert">{pinError}</p>}
        <div className="foodActions"><button className="foodPrimaryButton" type="submit" disabled={unlocking || code.length !== 4}>{unlocking ? 'Checking…' : 'Unlock edit mode'}</button><button type="button" disabled={unlocking} onClick={() => { setPinOpen(false); setCode(''); }}>Cancel</button></div>
      </form>
    </dialog>}
  </main>;
}
