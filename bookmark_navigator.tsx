import React, { useState, useEffect } from 'react';
import { Edit2, Plus, Trash2, Move, Download } from 'lucide-react';

// 默认书签数据
const defaultBookmarks = [
  { id: '1', name: 'GitHub', url: 'https://github.com', icon: '', iconType: 'auto' },
  { id: '2', name: 'Google', url: 'https://google.com', icon: '', iconType: 'auto' },
  { id: '3', name: 'YouTube', url: 'https://youtube.com', icon: '', iconType: 'auto' },
];

const BookmarkNavigator = () => {
  const [bookmarks, setBookmarks] = useState(defaultBookmarks);
  const [isEditing, setIsEditing] = useState(false);
  const [showEditButton, setShowEditButton] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // 从远程加载书签
  useEffect(() => {
    fetch('https://324893.xyz/bookmarks.json')
      .then(res => res.json())
      .then(data => setBookmarks(data))
      .catch(() => console.log('使用默认书签'));
  }, []);

  // 获取网站图标
  const getIconUrl = (url, icon, iconType) => {
    if (iconType === 'text') return null;
    if (iconType === 'custom' && icon) return icon;
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    } catch {
      return null;
    }
  };

  // 导出书签
  const exportBookmarks = () => {
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bookmarks.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  // 添加书签
  const addBookmark = (bookmark) => {
    setBookmarks([...bookmarks, { ...bookmark, id: Date.now().toString() }]);
    setShowAddModal(false);
  };

  // 更新书签
  const updateBookmark = (id, updatedData) => {
    setBookmarks(bookmarks.map(b => b.id === id ? { ...b, ...updatedData } : b));
    setEditingBookmark(null);
  };

  // 删除书签
  const deleteBookmark = (id) => {
    setBookmarks(bookmarks.filter(b => b.id !== id));
  };

  // 拖拽处理
  const handleDragStart = (e, bookmark) => {
    if (!isEditing) return;
    setDraggedItem(bookmark);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    if (!isEditing) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetBookmark) => {
    if (!isEditing || !draggedItem) return;
    e.preventDefault();
    
    const draggedIndex = bookmarks.findIndex(b => b.id === draggedItem.id);
    const targetIndex = bookmarks.findIndex(b => b.id === targetBookmark.id);
    
    const newBookmarks = [...bookmarks];
    newBookmarks.splice(draggedIndex, 1);
    newBookmarks.splice(targetIndex, 0, draggedItem);
    
    setBookmarks(newBookmarks);
    setDraggedItem(null);
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #fde0e8 0%, #e8d5f0 50%, #d5e3f0 100%)'
    }}>
      {/* 书签网格 */}
      <div className="container mx-auto px-8 py-20">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-8 max-w-7xl mx-auto">
          {bookmarks.map(bookmark => (
            <div
              key={bookmark.id}
              draggable={isEditing}
              onDragStart={(e) => handleDragStart(e, bookmark)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, bookmark)}
              className={`flex flex-col items-center gap-2 ${isEditing ? 'cursor-move' : 'cursor-pointer'} group relative`}
              onClick={() => !isEditing && window.open(bookmark.url, '_blank')}
            >
              {/* 图标容器 */}
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-semibold transition-all ${
                isEditing ? 'scale-90 opacity-80' : 'hover:scale-105'
              }`} style={{
                background: getIconUrl(bookmark.url, bookmark.icon, bookmark.iconType) ? 'transparent' : 'rgba(255, 255, 255, 0.5)',
                backdropFilter: 'blur(10px)',
              }}>
                {getIconUrl(bookmark.url, bookmark.icon, bookmark.iconType) ? (
                  <img 
                    src={getIconUrl(bookmark.url, bookmark.icon, bookmark.iconType)} 
                    alt={bookmark.name}
                    className="w-16 h-16 rounded-xl"
                  />
                ) : (
                  <span className="text-gray-700">{bookmark.icon || bookmark.name.charAt(0)}</span>
                )}
              </div>

              {/* 编辑按钮 */}
              {isEditing && (
                <div className="absolute -top-2 -right-2 flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingBookmark(bookmark);
                    }}
                    className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBookmark(bookmark.id);
                    }}
                    className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}

              {/* 标签 */}
              <span className="text-sm text-gray-700 text-center max-w-full truncate px-2">
                {bookmark.name}
              </span>
            </div>
          ))}

          {/* 添加按钮 */}
          {isEditing && (
            <div
              onClick={() => setShowAddModal(true)}
              className="flex flex-col items-center gap-2 cursor-pointer group"
            >
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center transition-all hover:scale-105" style={{
                background: 'rgba(255, 255, 255, 0.5)',
                backdropFilter: 'blur(10px)',
              }}>
                <Plus size={32} className="text-gray-600" />
              </div>
              <span className="text-sm text-gray-700">添加</span>
            </div>
          )}
        </div>
      </div>

      {/* 编辑按钮 */}
      <div
        className="fixed bottom-8 right-8"
        onMouseEnter={() => setShowEditButton(true)}
        onMouseLeave={() => setShowEditButton(false)}
      >
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
            isEditing ? 'bg-blue-500' : 'bg-white bg-opacity-80'
          } ${showEditButton || isEditing ? 'opacity-100' : 'opacity-0'}`}
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <Edit2 size={20} className={isEditing ? 'text-white' : 'text-gray-700'} />
        </button>

        {/* 导出按钮 */}
        {isEditing && (
          <button
            onClick={exportBookmarks}
            className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center transition-all shadow-lg mt-4"
          >
            <Download size={20} className="text-white" />
          </button>
        )}
      </div>

      {/* 添加/编辑模态框 */}
      {(showAddModal || editingBookmark) && (
        <BookmarkModal
          bookmark={editingBookmark}
          onSave={(data) => {
            if (editingBookmark) {
              updateBookmark(editingBookmark.id, data);
            } else {
              addBookmark(data);
            }
          }}
          onClose={() => {
            setShowAddModal(false);
            setEditingBookmark(null);
          }}
        />
      )}
    </div>
  );
};

// 书签编辑模态框组件
const BookmarkModal = ({ bookmark, onSave, onClose }) => {
  const [name, setName] = useState(bookmark?.name || '');
  const [url, setUrl] = useState(bookmark?.url || '');
  const [iconType, setIconType] = useState(bookmark?.iconType || 'auto');
  const [icon, setIcon] = useState(bookmark?.icon || '');

  const getPreviewIcon = () => {
    if (iconType === 'text') return null;
    if (iconType === 'custom' && icon) return icon;
    if (url) {
      try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      } catch {
        return null;
      }
    }
    return null;
  };

  const handleSave = () => {
    if (!name || !url) return;
    onSave({ name, url, icon, iconType });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {bookmark ? '编辑书签' : '添加书签'}
        </h2>

        {/* 预览 */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-semibold" style={{
            background: getPreviewIcon() ? 'transparent' : 'rgba(0, 0, 0, 0.05)',
          }}>
            {getPreviewIcon() ? (
              <img src={getPreviewIcon()} alt="preview" className="w-16 h-16 rounded-xl" />
            ) : (
              <span className="text-gray-600">{icon || name.charAt(0) || '?'}</span>
            )}
          </div>
          <span className="text-sm text-gray-600 mt-2">实时预览</span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="书签名称"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">网址</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">图标类型</label>
            <select
              value={iconType}
              onChange={(e) => setIconType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="auto">自动获取</option>
              <option value="text">文字</option>
              <option value="custom">自定义图片</option>
            </select>
          </div>

          {iconType === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">显示文字</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="单个字符"
                maxLength={2}
              />
            </div>
          )}

          {iconType === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">图片链接</label>
              <input
                type="url"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://example.com/icon.png"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
          >
            保存
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookmarkNavigator;