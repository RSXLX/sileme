/**
 * Twitter 好友列表组件
 * 显示互关好友信息，支持绑定钱包地址
 */

import React, { useState, useEffect, useCallback } from 'react';

// 好友数据接口
interface Friend {
  id?: number;
  user_id: string;
  screen_name: string;
  name: string;
  description: string;
  profile_image: string;
  statuses_count: number;
  followers_count: number;
  friends_count: number;
  media_count: number;
  wallet_address: string | null;
  owner_wallet: string;
  created_at: number;
  updated_at: number;
}

interface FriendsListProps {
  ownerWallet: string;
  onFriendSelect?: (friend: Friend) => void;
  onFriendsLoaded?: (friends: { screen_name: string; name: string; wallet_address: string | null }[]) => void;
}

// 格式化大数字 (如 4677703 -> 4.68M)
function formatCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(2) + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K';
  }
  return count.toString();
}

export function FriendsList({ ownerWallet, onFriendSelect, onFriendsLoaded }: FriendsListProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWallet, setEditWallet] = useState('');

  // 获取好友列表
  const fetchFriends = useCallback(async () => {
    if (!ownerWallet) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:3001/api/friends/${ownerWallet}`);
      const data = await response.json();
      
      if (data.success) {
        setFriends(data.friends);
        // 回调由单独的 useEffect 处理，避免无限循环
        console.log(`✅ Loaded ${data.count} friends (cached: ${data.cached})`);
      } else {
        setError(data.error || 'Failed to load friends');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [ownerWallet]); // 🔧 移除 onFriendsLoaded 防止无限循环

  // 单独处理 friends 变化时的回调
  useEffect(() => {
    if (friends.length > 0 && onFriendsLoaded) {
      onFriendsLoaded(friends.map(f => ({
        screen_name: f.screen_name,
        name: f.name,
        wallet_address: f.wallet_address,
      })));
    }
  }, [friends, onFriendsLoaded]);

  // 刷新好友列表
  const refreshFriends = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/friends/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerWallet }),
      });
      const data = await response.json();
      
      if (data.success) {
        setFriends(data.friends);
        // 回调由单独的 useEffect 处理
        console.log(`✅ Refreshed ${data.count} friends`);
      } else {
        setError(data.error || 'Failed to refresh friends');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // 更新好友钱包地址
  const updateFriendWallet = async (userId: string, walletAddress: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/friends/${userId}/wallet`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: walletAddress }),
      });
      const data = await response.json();
      
      if (data.success) {
        // 更新本地状态
        const updatedFriends = friends.map(f => 
          f.user_id === userId ? { ...f, wallet_address: walletAddress } : f
        );
        setFriends(updatedFriends);
        
        // 回调父组件，同步好友数据
        onFriendsLoaded?.(updatedFriends.map(f => ({
          screen_name: f.screen_name,
          name: f.name,
          wallet_address: f.wallet_address,
        })));
        
        setEditingId(null);
        setEditWallet('');
        console.log(`✅ Updated wallet for ${userId}, synced to parent`);
      } else {
        alert(data.error || 'Failed to update wallet');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    }
  };

  // 初始加载
  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // 开始编辑
  const startEdit = (friend: Friend) => {
    setEditingId(friend.user_id);
    setEditWallet(friend.wallet_address || '');
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setEditWallet('');
  };

  // 保存编辑
  const saveEdit = (userId: string) => {
    if (editWallet.trim()) {
      updateFriendWallet(userId, editWallet.trim());
    } else {
      cancelEdit();
    }
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '20px',
      marginBottom: '20px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: collapsed ? 0 : '16px',
      }}>
        <div 
          onClick={() => setCollapsed(!collapsed)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '20px' }}>🤝</span>
          <h3 style={{ 
            margin: 0, 
            fontSize: '16px', 
            fontWeight: 600,
            color: '#fff',
          }}>
            Twitter 好友
          </h3>
          <span style={{
            background: 'rgba(59, 130, 246, 0.3)',
            color: '#60a5fa',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 600,
          }}>
            {friends.length}
          </span>
          <span style={{ 
            fontSize: '12px', 
            color: 'rgba(255,255,255,0.5)',
            marginLeft: '4px',
          }}>
            {collapsed ? '▶' : '▼'}
          </span>
        </div>
        
        {!collapsed && (
          <button
            onClick={refreshFriends}
            disabled={loading}
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              color: '#60a5fa',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {loading ? '⏳' : '🔄'} 刷新
          </button>
        )}
      </div>

      {/* Content */}
      {!collapsed && (
        <>
          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              color: '#fca5a5',
              fontSize: '14px',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Loading */}
          {loading && friends.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'rgba(255, 255, 255, 0.6)',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
              <div>正在获取 Twitter 好友...</div>
            </div>
          )}

          {/* Empty */}
          {!loading && friends.length === 0 && !error && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'rgba(255, 255, 255, 0.5)',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤷</div>
              <div>暂无互关好友</div>
            </div>
          )}

          {/* Friends Grid */}
          {friends.length > 0 && (
            <div style={{
              display: 'grid',
              gap: '12px',
              maxHeight: '400px',
              overflowY: 'auto',
            }}>
              {friends.map(friend => (
                <div
                  key={friend.user_id}
                  onClick={() => onFriendSelect?.(friend)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: onFriendSelect ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  }}
                >
                  {/* Top Row: Avatar + Info */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    {/* Avatar */}
                    <img
                      src={friend.profile_image.replace('_normal', '_bigger')}
                      alt={friend.name}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid rgba(255, 255, 255, 0.1)',
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
                      }}
                    />
                    
                    {/* Name & Handle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: '15px',
                        color: '#fff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {friend.name}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: 'rgba(255, 255, 255, 0.5)',
                      }}>
                        @{friend.screen_name}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {friend.description && (
                    <div style={{
                      fontSize: '13px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      lineHeight: 1.4,
                      marginBottom: '12px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {friend.description}
                    </div>
                  )}

                  {/* Stats */}
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginBottom: '12px',
                  }}>
                    <span title="推文数">📝 {formatCount(friend.statuses_count)}</span>
                    <span title="粉丝数">👥 {formatCount(friend.followers_count)}</span>
                    <span title="关注数">➡️ {formatCount(friend.friends_count)}</span>
                    <span title="媒体数">🖼️ {formatCount(friend.media_count)}</span>
                  </div>

                  {/* Wallet Address */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                      💰 钱包:
                    </span>
                    
                    {editingId === friend.user_id ? (
                      <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                        <input
                          type="text"
                          value={editWallet}
                          onChange={(e) => setEditWallet(e.target.value)}
                          placeholder="0x..."
                          style={{
                            flex: 1,
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '12px',
                            color: '#fff',
                            outline: 'none',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); saveEdit(friend.user_id); }}
                          style={{
                            background: 'rgba(34, 197, 94, 0.3)',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: '#4ade80',
                            cursor: 'pointer',
                          }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.3)',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: '#f87171',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={(e) => { e.stopPropagation(); startEdit(friend); }}
                        style={{
                          flex: 1,
                          fontSize: '12px',
                          color: friend.wallet_address ? '#4ade80' : 'rgba(255, 255, 255, 0.3)',
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '6px',
                          border: '1px dashed rgba(255, 255, 255, 0.2)',
                        }}
                      >
                        {friend.wallet_address 
                          ? `${friend.wallet_address.slice(0, 10)}...${friend.wallet_address.slice(-8)}`
                          : '点击添加钱包地址'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default FriendsList;
