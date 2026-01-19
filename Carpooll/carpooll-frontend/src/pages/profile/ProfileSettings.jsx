import React, { useEffect, useState } from 'react';
import { apiGet, apiPut } from '../../api/api';
import { useNavigate } from 'react-router-dom';

export default function ProfileSettings({ user, setUser }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        let mounted = true;
        apiGet('/api/users/me')
            .then(data => { if (mounted) setProfile(data); })
            .catch(err => console.error(err))
            .finally(() => { if (mounted) setLoading(false); });
        return () => mounted = false;
    }, []);

    function toBase64(file) {
        return new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });
    }

    async function handleImage(e){
        const f = e.target.files?.[0];
        if (!f) return;
        try {
            const b64 = await toBase64(f);
            setProfile(p => ({ ...p, profilePhotoUrl: b64 }));
        } catch (err) { console.error(err); }
    }

    async function save(){
        setSaving(true);
        try{
            const payload = {
                fullname: profile.fullname,
                phone: profile.phone,
                profilePhotoUrl: profile.profilePhotoUrl
            };
            const updated = await apiPut('/api/users/me', payload);
            // update local storage and parent
            localStorage.setItem('user', JSON.stringify(updated));
            if (setUser) setUser(updated);
            navigate('/profile'); // keep user on profile (or show toast)
        }catch(err){
            console.error(err);
            alert(err.message || 'Failed to update profile');
        }finally{ setSaving(false); }
    }

    if (loading) return <div className="p-6">Loading profile...</div>;
    if (!profile) return <div className="p-6">Not authenticated</div>;

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Profile Settings</h2>
                        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Manage your public profile</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: 12 }}>
                            {profile.profilePhotoUrl ? (
                                <img src={profile.profilePhotoUrl} alt="avatar" style={{ width:140, height:140, objectFit:'cover', borderRadius:999, boxShadow:'0 8px 30px rgba(0,0,0,0.6)' }} />
                            ) : (
                                <div style={{ width:140, height:140, borderRadius:999, background:'#1f2937', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, fontWeight:800 }}>
                                    {profile.fullname?.split(' ').map(s=>s[0]).slice(0,2).join('')}
                                </div>
                            )}
                        </div>
                        <label className="btn btn-secondary btn-md cursor-pointer inline-flex items-center gap-3">
                            Change Image
                            <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
                        </label>
                        <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 12 }}>Upload a clear portrait — JPEG/PNG. Max 2MB recommended.</div>
                    </div>

                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Full Name</div>
                                <input value={profile.fullname || ''} onChange={e => setProfile({ ...profile, fullname: e.target.value })} className="input" />
                            </div>

                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Email (cannot change)</div>
                                <input value={profile.email || ''} disabled className="input bg-gray-100" />
                            </div>
                        </div>

                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Phone</div>
                            <input value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} className="input" />
                        </div>

                        <div style={{ marginTop: 18, display: 'flex', gap: 12 }}>
                            <button onClick={() => navigate(-1)} className="btn btn-secondary btn-md" style={{flex:1}}>Cancel</button>
                            <button onClick={save} disabled={saving} className="btn btn-primary btn-md" style={{flex:1}}>{saving ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
