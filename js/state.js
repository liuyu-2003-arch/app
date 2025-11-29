export const state = {
    pages: [],
    visualPages: [],
    currentUser: null,
    isEditing: false,
    sortableInstances: [],
    currentPage: 0,
    // 编辑相关
    currentEditInfo: { pageIndex: -1, bookmarkIndex: -1 },
    selectedAvatarUrl: '',
    prefAvatarUrl: '',
    // 拖拽相关
    isDragging: false,
    hasDragged: false,
    startPos: 0,
    currentTranslate: 0,
    prevTranslate: 0,
    animationID: null,
    dotsTimer: null,
    wheelTimeout: null
};