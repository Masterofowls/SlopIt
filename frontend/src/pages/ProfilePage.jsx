import React, { useEffect, useRef, useState } from 'react';
import { useUser, UserButton } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useProtectedApi } from '../hooks/useProtectedApi';
import FrogBackground from '../components/ToxicBackground';

const clean = (s) =>
  s && !/^(clerk_|k_)?user_[a-z0-9]{6,}/i.test(s) && !/^user\d+$/i.test(s) ? s : null;

const ProfilePage = () => {
  const { user, isLoaded } = useUser();
  const { get, patch } = useProtectedApi();
  const navigate = useNavigate();
  const previewUrlRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isLoaded) get('/me/').then(setProfile).catch(() => {}); }, [isLoaded, get]);
  useEffect(() => { if (profile?.username) get(`/users/${profile.username}/posts/`).then((d) => setPosts(Array.isArray(d) ? d : (d.results ?? []))).catch(() => {}); }, [profile?.username, get]);

  const displayName = profile?.display_name || clean(user?.fullName) || clean(profile?.username) || 'ANON';
  const avatarUrl = profile?.avatar_url || user?.imageUrl;
  const revoke = () => { if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; } };
  const openEdit = () => { setEditName(profile?.display_name || ''); setEditBio(profile?.bio || ''); setEditing(true); };
  const cancelEdit = () => { revoke(); setEditing(false); setEditAvatar(null); setAvatarPreview(null); };
  const onAvatarChange = (e) => { const f = e.target.files?.[0]; if (!f) return; revoke(); setEditAvatar(f); previewUrlRef.current = URL.createObjectURL(f); setAvatarPreview(previewUrlRef.current); };
  const saveProfile = async () => {
    setSaving(true);
    try {
      const isFile = Boolean(editAvatar);
      const d = isFile
        ? ((fd) => {
            fd.append("display_name", editName.trim());
            fd.append("bio", editBio.trim());
            fd.append("avatar", editAvatar);
            return fd;
          })(new FormData())
        : { display_name: editName.trim(), bio: editBio.trim() };
      // Let axios auto-detect multipart/form-data boundary for file uploads.
      // Passing Content-Type: undefined removes the default 'application/json'.
      const cfg = isFile ? { headers: { "Content-Type": undefined } } : {};
      setProfile(await patch("/me/", d, cfg));
      cancelEdit();
    } finally { setSaving(false); }
  };

  if (!isLoaded) return <div><FrogBackground /><p>Loading...</p></div>;

  return (
    <div>
      <FrogBackground />
      <div>
        <div>
          {avatarUrl ? <img src={avatarUrl} alt="avatar" /> : <div>{displayName[0].toUpperCase()}</div>}
          <h1>{displayName}</h1>
          {clean(profile?.username) && <p>@{clean(profile.username)}</p>}
          {profile?.bio && <p>{profile.bio}</p>}
          <p>{posts.length} posts</p>
          <UserButton afterSignOutUrl="/" />
          <button onClick={editing ? cancelEdit : openEdit}>{editing ? 'Close' : 'Edit'}</button>
        </div>
        {editing && (
          <div>
            <h2>Edit Profile</h2>
            <div>
              {(avatarPreview || avatarUrl) ? <img src={avatarPreview || avatarUrl} alt="avatar" /> : <div>{displayName[0].toUpperCase()}</div>}
              <label>Choose Avatar<input type="file" accept="image/*" onChange={onAvatarChange} style={{ display: 'none' }} /></label>
            </div>
            <div><label>Display Name</label><input maxLength={100} placeholder="Enter your display name" value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div><label>Bio</label><textarea maxLength={500} placeholder="Tell the world" value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} /></div>
            <div>
              <button onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button onClick={cancelEdit} disabled={saving}>Cancel</button>
            </div>
          </div>
        )}
        <div>
          {posts.map((p) => (
            <div key={p.id} onClick={() => p.slug && navigate(`/post/${p.slug}`)} style={{ cursor: p.slug ? 'pointer' : 'default' }}>
              {p.media?.[0]?.file && <img src={p.media[0].file} alt={p.title} />}
              <p>{p.kind} — {p.title}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
