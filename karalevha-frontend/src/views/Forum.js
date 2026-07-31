import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';

const Forum = () => {
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState('all');
    const [posts, setPosts] = useState([]);
    const [selectedPost, setSelectedPost] = useState(null);
    const [comments, setComments] = useState([]);

    // Form durumları
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [commentContent, setCommentContent] = useState('');
    const [replyToId, setReplyToId] = useState(null);
    const [replyContent, setReplyContent] = useState('');
    const [error, setError] = useState('');

    const storedUser = localStorage.getItem('user');
    const user = storedUser ? JSON.parse(storedUser) : null;

    useEffect(() => {
        fetch(`${API_URL}/api/forum/categories`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setCategories(data);
            })
            .catch(err => console.error("Kategoriler alınamadı:", err));

        loadAllPosts();
    }, []);

    const fetchCommentsForPosts = async (postsData) => {
        const postsWithComments = await Promise.all(
            postsData.map(async (post) => {
                try {
                    const res = await fetch(`${API_URL}/api/forum/posts/${post.id}/comments`);
                    const commentsData = await res.json();
                    const previewComments = Array.isArray(commentsData)
                        ? commentsData.filter(c => c.parent_id === null).slice(0, 3)
                        : [];
                    return { ...post, previewComments };
                } catch {
                    return { ...post, previewComments: [] };
                }
            })
        );
        setPosts(postsWithComments);
    };

    const loadAllPosts = () => {
        setActiveCategory('all');
        setSelectedPost(null);
        fetch(`${API_URL}/api/forum/posts/all`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) fetchCommentsForPosts(data);
            });
    };

    const handleCategorySelect = (categoryId) => {
        setActiveCategory(categoryId);
        setSelectedPost(null);
        fetch(`${API_URL}/api/forum/categories/${categoryId}/posts`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) fetchCommentsForPosts(data);
            });
    };

    const handlePostSelect = (post) => {
        setSelectedPost(post);
        setReplyToId(null);
        fetch(`${API_URL}/api/forum/posts/${post.id}/comments`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setComments(data);
            });
    };

    // Fotoğraflı Yeni Konu Açma Fonksiyonu
    const handleCreatePost = (e) => {
        e.preventDefault();
        if (!user || activeCategory === 'all') {
            setError('Lütfen önce bir kategori seçin.');
            return;
        }
        if (!title || !content) {
            setError('Başlık ve içerik alanlarını doldurun.');
            return;
        }

        const formData = new FormData();
        formData.append('category_id', activeCategory);
        formData.append('user_id', user.id);
        formData.append('title', title);
        formData.append('content', content);
        if (selectedFile) {
            formData.append('file', selectedFile);
        }

        fetch(`${API_URL}/api/forum/posts`, {
            method: 'POST',
            body: formData
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    setTitle('');
                    setContent('');
                    setSelectedFile(null);
                    setError('');
                    handleCategorySelect(activeCategory);
                }
            });
    };

    const handleCreateComment = (e, parentId = null) => {
        e.preventDefault();
        if (!user) return;
        const text = parentId ? replyContent : commentContent;
        if (!text.trim()) return;

        const newComment = {
            post_id: selectedPost.id,
            user_id: user.id,
            content: text,
            parent_id: parentId
        };

        fetch(`${API_URL}/api/forum/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newComment)
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    setCommentContent('');
                    setReplyContent('');
                    setReplyToId(null);
                    handlePostSelect(selectedPost);
                }
            });
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.mainTitle}>Forum Alanı</h1>

            <div style={styles.forumLayout}>
                <div style={styles.sidebar}>
                    <h3 style={styles.sidebarTitle}>Kategoriler</h3>
                    <button onClick={loadAllPosts} style={{ ...styles.categoryBtn, backgroundColor: activeCategory === 'all' ? '#780000' : '#1c1c1c' }}>🌐 Tüm Akış</button>
                    {categories.map(cat => (
                        <button key={cat.id} onClick={() => handleCategorySelect(cat.id)} style={{ ...styles.categoryBtn, backgroundColor: activeCategory === cat.id ? '#780000' : '#1c1c1c' }}>{cat.name}</button>
                    ))}
                </div>

                <div style={styles.mainContent}>
                    {!selectedPost ? (
                        <>
                            {user && activeCategory !== 'all' && (
                                <form onSubmit={handleCreatePost} style={styles.postForm}>
                                    <h3 style={{ marginBottom: '15px' }}>Yeni Konu Aç</h3>
                                    {error && <p style={styles.errorText}>{error}</p>}
                                    <input type="text" placeholder="Konu Başlığı" value={title} onChange={(e) => setTitle(e.target.value)} style={styles.input} />
                                    <textarea placeholder="Sorununuzu veya fikrinizi yazın..." value={content} onChange={(e) => setContent(e.target.value)} style={styles.textarea} />

                                    {/* Dosya Yükleme Elementi */}
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={styles.fileLabel}>🖼️ Fotoğraf Ekle: </label>
                                        <input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files[0])} style={{ color: '#ccc' }} />
                                    </div>

                                    <button type="submit" style={styles.submitBtn}>Yayınla</button>
                                </form>
                            )}

                            <h3 style={{ marginBottom: '15px' }}>Paylaşılanlar</h3>
                            {posts.map(post => (
                                <div key={post.id} style={styles.postCardContainer}>
                                    <div onClick={() => handlePostSelect(post)} style={styles.postCardClickableArea}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h4 style={styles.postTitle}>{post.title}</h4>
                                            {post.category_name && <span style={styles.tag}>{post.category_name}</span>}
                                        </div>
                                        <p style={styles.postSummary}>{post.content}</p>

                                        {/* Fotoğraf Önizlemesi */}
                                        {post.image_url && <img src={post.image_url} alt="Post" style={styles.previewPostImage} />}

                                        <div style={styles.postMeta}>
                                            <span>✍️ {post.display_name}</span>
                                            <span>📅 {new Date(post.tarih).toLocaleDateString('tr-TR')}</span>
                                        </div>
                                    </div>

                                    {post.previewComments && post.previewComments.length > 0 && (
                                        <div style={styles.previewCommentsSection}>
                                            <div style={styles.previewHeader}>Öne Çıkan Cevaplar</div>
                                            {post.previewComments.map(comment => (
                                                <div key={comment.id} style={styles.previewCommentItem}>
                                                    <span style={styles.previewCommentUser}>{comment.display_name}:</span>
                                                    <span style={styles.previewCommentText}>{comment.content}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    ) : (
                        <>
                            <button onClick={loadAllPosts} style={styles.backBtn}>← Ana Akışa Dön</button>

                            <div style={styles.openedPostCard}>
                                <h2 style={{ color: '#780000', marginBottom: '15px' }}>{selectedPost.title}</h2>
                                <p style={styles.openedPostContent}>{selectedPost.content}</p>

                                {/* Konu Detayındaki Tam Boyutlu Resim */}
                                {selectedPost.image_url && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <img src={selectedPost.image_url} alt="Büyük Görsel" style={styles.fullPostImage} />
                                    </div>
                                )}

                                <div style={styles.postMeta}>
                                    <span>✍️ {selectedPost.display_name}</span>
                                    <span>📅 {new Date(selectedPost.tarih).toLocaleDateString('tr-TR')}</span>
                                </div>
                            </div>

                            <h3 style={{ marginTop: '30px', marginBottom: '15px' }}>Cevaplar</h3>
                            {comments.filter(c => c.parent_id === null).map(mainComment => (
                                <div key={mainComment.id} style={styles.commentBox}>
                                    <div style={styles.mainCommentCard}>
                                        <p style={{ color: '#fff' }}>{mainComment.content}</p>
                                        <div style={styles.commentMeta}>
                                            <span>👤 {mainComment.display_name}</span>
                                            {user && <button onClick={() => setReplyToId(mainComment.id)} style={styles.replyBtn}>Cevap Ver</button>}
                                        </div>
                                    </div>
                                    {comments.filter(sub => sub.parent_id === mainComment.id).map(subComment => (
                                        <div key={subComment.id} style={styles.subCommentCard}>
                                            <p style={{ color: '#ccc', fontSize: '14px' }}>{subComment.content}</p>
                                            <div style={styles.commentMeta}><span>↳ 👤 {subComment.display_name}</span></div>
                                        </div>
                                    ))}
                                    {replyToId === mainComment.id && (
                                        <div style={{ marginTop: '10px', paddingLeft: '30px' }}>
                                            <input type="text" placeholder="Cevabınızı yazın..." value={replyContent} onChange={(e) => setReplyContent(e.target.value)} style={styles.input} />
                                            <button onClick={(e) => handleCreateComment(e, mainComment.id)} style={styles.submitBtn}>Gönder</button>
                                            <button onClick={() => setReplyToId(null)} style={{ ...styles.backBtn, marginLeft: '10px', padding: '5px 10px' }}>İptal</button>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {user ? (
                                <form onSubmit={(e) => handleCreateComment(e, null)} style={styles.commentForm}>
                                    <textarea placeholder="Konuya cevap yazın..." value={commentContent} onChange={(e) => setCommentContent(e.target.value)} style={styles.commentTextarea} />
                                    <button type="submit" style={styles.submitBtn}>Cevap Gönder</button>
                                </form>
                            ) : (
                                <p style={styles.infoText}>Fikrinizi belirtmek için giriş yapmalısınız.</p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: { padding: '40px 60px', backgroundColor: '#000000', minHeight: '90vh' },
    mainTitle: { fontSize: '32px', marginBottom: '30px', letterSpacing: '1px' },
    forumLayout: { display: 'flex', gap: '30px' },
    sidebar: { width: '300px', display: 'flex', flexDirection: 'column', gap: '10px' },
    sidebarTitle: { fontSize: '18px', marginBottom: '10px', color: '#bbb' },
    categoryBtn: { width: '100%', padding: '15px', border: 'none', borderRadius: '4px', color: '#fff', textAlign: 'left', cursor: 'pointer', transition: '0.2s', fontWeight: 'bold' },
    mainContent: { flex: 1, backgroundColor: '#111', padding: '30px', borderRadius: '4px', border: '1px solid #222' },
    tag: { backgroundColor: '#780000', padding: '4px 8px', borderRadius: '3px', fontSize: '12px', height: 'fit-content' },
    postForm: { backgroundColor: '#1c1c1c', padding: '20px', borderRadius: '4px', marginBottom: '20px' },
    input: { width: '100%', padding: '10px', backgroundColor: '#000', border: '1px solid #333', borderRadius: '4px', color: '#fff', marginBottom: '10px', outline: 'none' },
    textarea: { width: '100%', height: '100px', padding: '10px', backgroundColor: '#000', border: '1px solid #333', borderRadius: '4px', color: '#fff', marginBottom: '10px', outline: 'none', resize: 'none' },
    fileLabel: { color: '#bbb', fontSize: '14px', marginRight: '10px', fontWeight: 'bold' },
    submitBtn: { backgroundColor: '#2ecc71', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
    errorText: { color: '#e74c3c', marginBottom: '10px', fontSize: '14px' },
    infoText: { color: '#f1c40f', backgroundColor: '#1c1c1c', padding: '12px', borderRadius: '4px', fontSize: '14px' },
    postCardContainer: { backgroundColor: '#1c1c1c', borderRadius: '4px', marginBottom: '20px', border: '1px solid #2a2a2a', overflow: 'hidden' },
    postCardClickableArea: { padding: '20px', cursor: 'pointer' },
    postTitle: { fontSize: '18px', color: '#780000', marginBottom: '10px' },
    postSummary: { color: '#aaa', fontSize: '14px', marginBottom: '15px', lineHeight: '1.4' },
    previewPostImage: { maxWidth: '200px', maxHeight: '150px', borderRadius: '4px', marginBottom: '15px', display: 'block', objectFit: 'cover', border: '1px solid #333' },
    fullPostImage: { maxWidth: '100%', maxHeight: '450px', borderRadius: '4px', objectFit: 'contain', border: '1px solid #333' },
    postMeta: { display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '12px', borderTop: '1px solid #2a2a2a', paddingTop: '10px' },
    previewCommentsSection: { backgroundColor: '#141414', padding: '15px 20px', borderTop: '1px solid #252525' },
    previewHeader: { fontSize: '11px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' },
    previewCommentItem: { fontSize: '13px', marginBottom: '6px', lineHeight: '1.4' },
    previewCommentUser: { color: '#e67e22', fontWeight: 'bold', marginRight: '6px' },
    previewCommentText: { color: '#bbb' },
    backBtn: { backgroundColor: '#222', color: '#fff', border: '1px solid #444', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px', fontSize: '14px' },
    openedPostCard: { backgroundColor: '#1c1c1c', padding: '25px', borderRadius: '4px', border: '1px solid #333' },
    openedPostContent: { color: '#fff', fontSize: '16px', lineHeight: '1.6', marginBottom: '20px' },
    commentBox: { backgroundColor: '#151515', padding: '15px', borderRadius: '4px', marginBottom: '15px', borderLeft: '3px solid #780000' },
    mainCommentCard: { marginBottom: '10px' },
    subCommentCard: { backgroundColor: '#0d0d0d', padding: '10px', borderRadius: '4px', marginTop: '8px', marginLeft: '30px', borderLeft: '2px solid #2ecc71' },
    commentMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#555', fontSize: '11px', marginTop: '5px' },
    replyBtn: { background: 'none', border: 'none', color: '#780000', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
    commentForm: { marginTop: '25px' },
    commentTextarea: { width: '100%', height: '80px', padding: '10px', backgroundColor: '#1c1c1c', border: '1px solid #333', borderRadius: '4px', color: '#fff', marginBottom: '10px', outline: 'none', resize: 'none' }
};

export default Forum;