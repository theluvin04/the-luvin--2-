// components/AdminPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { getAllOrders, updateOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase } from '../services/productService';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'; 
import type { Order, LegoPart, FrameConfig } from '../types';
import { LEGO_PARTS, FRAME_OPTIONS } from '../constants';

// --- HELPER GLOBALS ---
const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Đã giao hàng': return 'bg-green-50 text-green-700 border-green-100';
        case 'Đã xác nhận': case 'Đang xử lý': return 'bg-blue-50 text-blue-700 border-blue-100';
        case 'Đang giao hàng': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
        case 'Hủy đơn': return 'bg-red-50 text-red-700 border-red-100';
        default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
};

// --- CẤU HÌNH PHÂN QUYỀN ---
const USER_ROLES: Record<string, 'admin' | 'warehouse'> = {
    "theluvin.gifts@gmail.com": "admin",
    "jinbduong@gmail.com": "admin", 
    "kho1@gmail.com": "warehouse",
    "kho2@gmail.com": "warehouse",
};

// --- COMPONENT HIỂN THỊ CHI TIẾT SOẠN HÀNG (PICKING LIST) ---
const PickingList: React.FC<{ items: FrameConfig[]; allParts: LegoPart[] }> = ({ items, allParts }) => {
    // Hàm tìm tên sản phẩm theo ID
    const getPartName = (id?: string, type?: string) => {
        if (!id) return "---";
        if (type === 'charm') return "Charm (Ảnh riêng)";
        const part = allParts.find(p => p.id === id);
        return part ? part.name : id; // Nếu không tìm thấy thì hiện ID
    };

    const getFrameName = (id: string) => FRAME_OPTIONS.find(f => f.id === id)?.name || id;

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mt-4">
            <h4 className="font-bold text-black border-b border-gray-200 pb-2 mb-3 uppercase text-xs tracking-wider">
                📝 CHI TIẾT SOẠN HÀNG (KHO)
            </h4>
            <div className="space-y-4">
                {items.map((frame, idx) => (
                    <div key={idx} className="text-sm border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                        <p className="font-bold text-lg text-black mb-2">
                            🖼️ Khung: {getFrameName(frame.frameId)}
                        </p>
                        
                        {/* Danh sách nhân vật */}
                        {frame.characters.map((char, cIdx) => (
                            <div key={cIdx} className="mb-3 p-3 rounded bg-gray-50 border border-gray-100"> 
                                <p className="font-semibold text-gray-800 border-b border-gray-200 pb-1 mb-1">NV {cIdx + 1}:</p>
                                <ul className="text-xs text-gray-700 ml-2 grid grid-cols-2 gap-y-1"> 
                                    <li><span className="text-gray-500">Tóc/Mũ:</span> <span className="font-medium text-black">{getPartName(char.hair?.id || char.hat?.id)}</span></li>
                                    <li><span className="text-gray-500">Mặt:</span> <span className="font-medium text-black">{getPartName(char.face?.id)}</span></li>
                                    <li><span className="text-gray-500">Áo:</span> <span className="font-medium text-black">{getPartName(char.shirt?.id)}</span> {char.selectedShirtColor && <span className="text-xs text-gray-600">({char.selectedShirtColor.name})</span>}</li>
                                    <li><span className="text-gray-500">Quần:</span> <span className="font-medium text-black">{getPartName(char.pants?.id)}</span> {char.selectedPantsColor && <span className="text-xs text-gray-600">({char.selectedPantsColor.name})</span>}</li>
                                </ul>
                                {/* Add custom print info if available */}
                                {char.customPrintPrice && char.customPrintPrice > 0 && (
                                    <p className="text-xs font-bold text-red-600 mt-2 p-1 bg-red-100/50 rounded inline-block">
                                        ⚠️ In Yêu Cầu ({formatCurrency(char.customPrintPrice)})
                                    </p>
                                )}
                            </div>
                        ))}

                        {/* Phụ kiện rời */}
                        {frame.draggableItems.length > 0 && (
                            <div className="mt-4 p-3 rounded bg-gray-50 border border-gray-100">
                                <p className="font-semibold text-gray-800 border-b border-gray-200 pb-1 mb-1 text-sm">Phụ kiện & Thú cưng:</p>
                                <ul className="list-disc list-inside ml-4 text-sm text-black space-y-1">
                                    {frame.draggableItems.map((item, iIdx) => (
                                        <li key={iIdx}>{getPartName(item.partId, item.type)}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Form Sản phẩm (Giữ nguyên) ---
const ProductForm: React.FC<{ initialData?: LegoPart | null; onSave: (part: LegoPart) => void; onCancel: () => void }> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<LegoPart>(initialData || { id: `part_${Date.now()}`, name: '', price: 0, imageUrl: '', type: 'accessory', widthCm: 1, heightCm: 1 });
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: name === 'price' || name === 'widthCm' || name === 'heightCm' ? Number(value) : value })); };
    return ( <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"> <div className="bg-white p-6 rounded-lg shadow-xl w-96 max-h-[90vh] overflow-y-auto"> <h3 className="text-lg font-bold mb-4">{initialData ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3> <div className="space-y-3"> <div><label className="block text-xs font-bold text-gray-700">Tên hiển thị</label><input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Ví dụ: Tóc xoăn vàng" /></div> <div><label className="block text-xs font-bold text-gray-700">Loại</label> <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border rounded"> <option value="hair">Tóc</option><option value="face">Mặt</option><option value="shirt">Áo</option><option value="pants">Quần</option><option value="hat">Mũ</option><option value="accessory">Phụ kiện</option><option value="pet">Thú cưng</option> </select> </div> <div><label className="block text-xs font-bold text-gray-700">Giá tiền (VNĐ)</label><input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2 border rounded" /></div> <div><label className="block text-xs font-bold text-gray-700">Link Ảnh (URL)</label><input name="imageUrl" value={formData.imageUrl} onChange={handleChange} className="w-full p-2 border rounded" />{formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="mt-2 h-16 object-contain mx-auto border" />}</div> <div className="grid grid-cols-2 gap-2"> <div><label className="block text-xs font-bold text-gray-700">Rộng (cm)</label><input type="number" name="widthCm" value={formData.widthCm} onChange={handleChange} className="w-full p-2 border rounded" step="0.1" /></div> <div><label className="block text-xs font-bold text-gray-700">Cao (cm)</label><input type="number" name="heightCm" value={formData.heightCm} onChange={handleChange} className="w-full p-2 border rounded" step="0.1" /></div> </div> </div> <div className="flex justify-end gap-2 mt-6"><button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Hủy</button><button onClick={() => onSave(formData)} className="px-4 py-2 bg-luvin-pink text-white font-bold rounded hover:opacity-90">Lưu</button></div> </div> </div> );
};

const AdminPage: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<'admin' | 'warehouse' | null>(null);

    const [email, setEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [loginError, setLoginError] = useState('');

    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<LegoPart[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'products'>('dashboard');
    
    // Date Filter
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(thirtyDaysAgo); 
    const [endDate, setEndDate] = useState(today); 
    const [quickDateFilter, setQuickDateFilter] = useState('30days'); 

    // Order View Mode
    const [orderViewMode, setOrderViewMode] = useState<'active' | 'history'>('active'); 

    // State khác
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);
    const [noteInput, setNoteInput] = useState('');
    const [adminDeadlineInput, setAdminDeadlineInput] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [productCategory, setProductCategory] = useState('all');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && user.email) {
                const role = USER_ROLES[user.email];
                if (role) {
                    setCurrentUser(user);
                    setUserRole(role);
                    if (role === 'warehouse') setActiveTab('orders');
                    else setActiveTab('dashboard');
                    fetchOrders();
                    fetchProducts(); // Luôn tải sản phẩm để hiển thị tên trong Picking List
                } else {
                    alert("Tài khoản này chưa được cấp quyền truy cập!");
                    signOut(auth);
                    setCurrentUser(null);
                    setUserRole(null);
                }
            } else {
                setCurrentUser(null);
                setUserRole(null);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const now = new Date();
        const start = new Date();
        if (quickDateFilter === 'today') start.setHours(0, 0, 0, 0);
        else if (quickDateFilter === '7days') start.setDate(now.getDate() - 7);
        else if (quickDateFilter === '30days') start.setDate(now.getDate() - 30);
        else if (quickDateFilter === 'all') { setStartDate('2020-01-01'); setEndDate(today); return; }
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
    }, [quickDateFilter]);

    useEffect(() => {
        if (selectedOrder) {
            setNoteInput(selectedOrder.internalNotes || '');
            setAdminDeadlineInput(selectedOrder.adminDeadline || '');
        }
    }, [selectedOrder]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        try { await signInWithEmailAndPassword(auth, email, loginPass); } 
        catch (error: any) { setLoginError("Sai email hoặc mật khẩu!"); }
    };

    const handleLogout = async () => { await signOut(auth); };
    const fetchOrders = async () => { const data = await getAllOrders(); setOrders(data); };
    const fetchProducts = async () => { const data = await getAllParts(); setProducts(data); };
    const handleSeedData = async () => { if (confirm("Đồng bộ?")) { setLoading(true); await seedDatabase(); setLoading(false); fetchProducts(); } };
    const handleSaveProduct = async (part: LegoPart) => { setIsEditingProduct(false); if (editingPart) await updatePart(part.id, part); else await addPart(part); fetchProducts(); setEditingPart(null); };
    const handleDeleteProduct = async (id: string) => { if (confirm("Xóa?")) { await deletePart(id); fetchProducts(); } };
    
    const handleUpdate = async (orderId: string, updates: Partial<Order>, showMsg = true) => { 
        const success = await updateOrder(orderId, updates); 
        if (success) { 
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o)); 
            if (selectedOrder?.id === orderId) setSelectedOrder(prev => prev ? { ...prev, ...updates } : null); 
            if (showMsg) alert("Đã lưu!"); 
        } 
    };
    
    const handleSaveAdminInfo = () => { if (selectedOrder) { handleUpdate(selectedOrder.id, { internalNotes: noteInput, adminDeadline: adminDeadlineInput }); } };

    const handleConfirmPacked = () => {
        if (selectedOrder && currentUser) {
            if (confirm(`Xác nhận bạn (${currentUser.email}) đã bọc xong đơn ${selectedOrder.id}?`)) {
                handleUpdate(selectedOrder.id, {
                    status: 'Đã giao hàng', 
                    packerEmail: currentUser.email, 
                    packedAt: new Date().toISOString() 
                });
                setSelectedOrder(null);
            }
        }
    };

    const formatDate = (dateString: string) => (!dateString) ? '---' : new Date(dateString).toLocaleDateString('vi-VN');
    const formatDateTime = (dateString: string) => (!dateString) ? '---' : new Date(dateString).toLocaleString('vi-VN');

    const stats = useMemo(() => {
        const start = new Date(startDate); start.setHours(0,0,0,0);
        const end = new Date(endDate); end.setHours(23,59,59,999);

        const filteredOrders = orders.filter(order => {
            if (quickDateFilter === 'all') return true;
            let orderDate: Date;
            if (order.createdAt) orderDate = new Date(order.createdAt);
            else if (order.delivery && order.delivery.date) orderDate = new Date(order.delivery.date);
            else orderDate = new Date();
            return orderDate.getTime() >= start.getTime() && orderDate.getTime() <= end.getTime();
        });

        const totalRevenue = filteredOrders.reduce((acc, order) => acc + order.totalPrice, 0);
        const totalOrders = filteredOrders.length;
        const pendingOrders = filteredOrders.filter(o => o.status === 'Chờ thanh toán' || o.status === 'Đang xử lý').length;
        const urgentOrders = filteredOrders.filter(o => o.isUrgent).length;
        
        const packerStats = Object.values(filteredOrders.reduce((acc, order) => {
            if (order.packerEmail) {
                const email = order.packerEmail;
                if (!acc[email]) acc[email] = { email, count: 0, revenue: 0 };
                acc[email].count++;
                acc[email].revenue += order.totalPrice;
            }
            return acc;
        }, {} as Record<string, { email: string, count: number, revenue: number }>)).sort((a, b) => b.count - a.count);

        return { totalRevenue, totalOrders, pendingOrders, urgentOrders, packerStats };
    }, [orders, startDate, endDate, quickDateFilter]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
            const matchesCategory = productCategory === 'all' || p.type === productCategory;
            return matchesSearch && matchesCategory;
        });
    }, [products, productSearch, productCategory]);

    // Sắp xếp đơn hàng: Gấp lên đầu, sau đó đến Mới nhất
    const sortedOrders = useMemo(() => {
        return [...orders].sort((a, b) => {
            if (a.isUrgent && !b.isUrgent) return -1;
            if (!a.isUrgent && b.isUrgent) return 1;
            // Sắp xếp theo ID giảm dần (đơn mới nhất)
            return (b.id || '').localeCompare(a.id || ''); 
        });
    }, [orders]);
    
    const activeOrders = useMemo(() => sortedOrders.filter(o => o.status !== 'Đã giao hàng' && o.status !== 'Hủy đơn'), [sortedOrders]);
    const historyOrders = useMemo(() => sortedOrders.filter(o => o.status === 'Đã giao hàng' || o.status === 'Hủy đơn'), [sortedOrders]);
    
    const displayOrders = orderViewMode === 'active' ? activeOrders : historyOrders;

    if (!currentUser) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="w-80 text-center"><h1 className="text-2xl font-bold mb-4 text-gray-800">The Luvin Admin</h1><form onSubmit={handleLogin} className="space-y-4"><input type="email" placeholder="Email" className="w-full p-3 border border-gray-300 rounded" value={email} onChange={e => setEmail(e.target.value)} required /><input type="password" placeholder="Mật khẩu" className="w-full p-3 border border-gray-300 rounded" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />{loginError && <p className="text-red-500 text-sm">{loginError}</p>}<button type="submit" className="w-full bg-black text-white font-bold py-3 rounded hover:opacity-80">Đăng nhập</button></form></div></div>;

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
            <div className="max-w-screen-2xl mx-auto px-4 py-6">
                
                {/* NEW Admin Header/Navigation - Minimalist */}
                <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-200 pb-4 mb-6 sticky top-0 bg-gray-50 z-10">
                    <span className="font-bold text-2xl tracking-tight text-black mb-4 md:mb-0">THE LUVIN ADMIN</span>
                    <div className="flex items-center gap-6">
                        <div className="flex gap-2 p-1 border rounded-lg bg-white">
                            {userRole === 'admin' && <button onClick={() => setActiveTab('dashboard')} className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${activeTab === 'dashboard' ? 'bg-black text-white' : 'text-gray-500 hover:text-black'}`}>Thống kê</button>}
                            <button onClick={() => setActiveTab('orders')} className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${activeTab === 'orders' ? 'bg-black text-white' : 'text-gray-500 hover:text-black'}`}>Đơn hàng</button>
                            {userRole === 'admin' && <button onClick={() => setActiveTab('products')} className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${activeTab === 'products' ? 'bg-black text-white' : 'text-gray-500 hover:text-black'}`}>Sản phẩm</button>}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <span className="text-gray-600 font-medium hidden sm:inline">{currentUser.email}</span>
                            <button onClick={handleLogout} className="text-red-600 hover:bg-red-50 px-3 py-1 rounded">Thoát</button>
                        </div>
                    </div>
                </div>

                {/* --- DASHBOARD --- */}
                {activeTab === 'dashboard' && userRole === 'admin' && (
                    <div className="space-y-8">
                        {/* Date Filter */}
                        <div className="flex flex-wrap items-center gap-4 pb-6 border-b border-gray-100">
                             <div className="flex bg-gray-100 p-1 rounded-lg">
                                {['today', '7days', '30days', 'all'].map(key => (
                                    <button key={key} onClick={() => setQuickDateFilter(key)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${quickDateFilter === key ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-black'}`}>
                                        {key === 'today' ? 'Hôm nay' : key === '7days' ? '7 ngày' : key === '30days' ? '30 ngày' : 'Tất cả'}
                                    </button>
                                ))}
                             </div>
                             <div className="flex items-center gap-2 text-sm text-gray-600">
                                <input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setQuickDateFilter('')}} className="p-1 border rounded" />
                                <span>—</span>
                                <input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setQuickDateFilter('')}} className="p-1 border rounded" />
                             </div>
                        </div>
                        
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="p-4 border rounded-xl"><p className="text-gray-500 text-xs uppercase font-bold mb-1">Doanh thu</p><p className="text-2xl font-bold text-black">{formatCurrency(stats.totalRevenue)}</p></div>
                            <div className="p-4 border rounded-xl"><p className="text-gray-500 text-xs uppercase font-bold mb-1">Đơn hàng</p><p className="text-2xl font-bold text-black">{stats.totalOrders}</p></div>
                            <div className="p-4 border rounded-xl"><p className="text-gray-500 text-xs uppercase font-bold mb-1">Chờ xử lý</p><p className="text-2xl font-bold text-black">{stats.pendingOrders}</p></div>
                            <div className="p-4 border rounded-xl bg-red-50 border-red-100"><p className="text-red-600 text-xs uppercase font-bold mb-1">Gấp / Ưu tiên</p><p className="text-2xl font-bold text-red-600">{stats.urgentOrders}</p></div>
                        </div>

                        {/* Packer Stats */}
                        <div className="border rounded-xl p-6">
                            <h3 className="text-sm font-bold uppercase text-gray-500 mb-4">Hiệu suất nhân viên</h3>
                            <div className="space-y-3">
                                {stats.packerStats.map((packer, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                                            <span className="font-medium">{packer.email}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">{packer.count} đơn</p>
                                            <p className="text-xs text-gray-500">{formatCurrency(packer.revenue)}</p>
                                        </div>
                                    </div>
                                ))}
                                {stats.packerStats.length === 0 && <p className="text-gray-400 text-sm">Chưa có dữ liệu.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- ORDERS --- */}
                {activeTab === 'orders' && (
                     <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-100px)]">
                        {/* LEFT: Order List (Grid 4 cols) */}
                        <div className="lg:col-span-4 flex flex-col border-r border-gray-200 pr-6">
                            <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                                <button onClick={() => { setOrderViewMode('active'); setSelectedOrder(null); }} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${orderViewMode === 'active' ? 'bg-white text-black shadow' : 'text-gray-500'}`}>Cần làm ({activeOrders.length})</button>
                                <button onClick={() => { setOrderViewMode('history'); setSelectedOrder(null); }} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${orderViewMode === 'history' ? 'bg-white text-black shadow' : 'text-gray-500'}`}>Lịch sử ({historyOrders.length})</button>
                            </div>
                            
                            <div className="overflow-y-auto flex-grow pr-2 space-y-3">
                                {displayOrders.length > 0 ? displayOrders.map(order => (
                                    <div key={order.id} onClick={() => setSelectedOrder(order)} className={`p-4 border rounded-lg cursor-pointer transition-all bg-white ${selectedOrder?.id === order.id ? 'ring-2 ring-black border-transparent shadow-md' : 'hover:border-black'} ${order.isUrgent ? 'border-red-400 shadow-sm' : 'border-gray-200'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-sm">{order.id}</span>
                                            {order.isUrgent && <span className="text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-red-300">GẤP</span>}
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-gray-600">
                                            <span>{order.customer.name}</span>
                                            <span className={`px-2 py-0.5 rounded border ${getStatusColor(order.status)}`}>{order.status}</span>
                                        </div>
                                        <div className="mt-2 text-xs text-gray-400 flex justify-between">
                                            <span>{formatDate(order.createdAt)}</span>
                                            {userRole === 'admin' && <span className="text-black font-bold">{formatCurrency(order.totalPrice)}</span>}
                                        </div>
                                    </div>
                                )) : <div className="text-center py-10 text-gray-400 text-sm">Không có đơn hàng nào.</div>}
                            </div>
                        </div>
        
                        {/* RIGHT: Detail View (Grid 8 cols) */}
                        <div className="lg:col-span-8 overflow-y-auto pl-2">
                            {selectedOrder ? (
                                <div className="bg-white border rounded-xl p-6 shadow-sm">
                                    {/* Header Detail */}
                                    <div className="flex justify-between items-start border-b border-gray-100 pb-6 mb-6">
                                        <div>
                                            <h2 className="text-2xl font-bold mb-1">{selectedOrder.id}</h2>
                                            <p className="text-sm text-gray-500">
                                                Ngày tạo: {formatDateTime(selectedOrder.createdAt)} 
                                                {selectedOrder.adminDeadline && <span className="ml-3 text-red-600 font-bold">Deadline: {formatDate(selectedOrder.adminDeadline)}</span>}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            {userRole === 'admin' && (
                                                <label className="flex items-center gap-2 cursor-pointer bg-gray-100 px-3 py-2 rounded hover:bg-gray-200">
                                                    <input type="checkbox" checked={selectedOrder.isUrgent || false} onChange={(e) => handleUpdate(selectedOrder.id, { isUrgent: e.target.checked }, false)} />
                                                    <span className="text-xs font-bold">Đánh dấu Gấp</span>
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    {/* Nút Bọc Hàng (Kho) */}
                                    {userRole === 'warehouse' && !selectedOrder.packedAt && (
                                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-8 flex items-center justify-between">
                                            <div><h3 className="font-bold text-green-800">Sẵn sàng đóng gói?</h3><p className="text-xs text-green-600">Kiểm tra kỹ sản phẩm theo danh sách bên dưới.</p></div>
                                            <button onClick={handleConfirmPacked} className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold shadow-lg hover:bg-green-700 active:transform active:scale-95 transition-all">📦 XÁC NHẬN ĐÃ BỌC</button>
                                        </div>
                                    )}

                                    {/* Thông tin người bọc (Hiện cho cả 2) */}
                                    {selectedOrder.packedAt && (
                                        <div className="bg-gray-50 border border-gray-200 p-3 rounded mb-6 flex items-center gap-3">
                                            <span className="text-xl">✅</span>
                                            <div className="text-sm">
                                                <p className="font-bold text-gray-800">Đã đóng gói bởi: {selectedOrder.packerEmail}</p>
                                                <p className="text-gray-500">Thời gian: {formatDateTime(selectedOrder.packedAt)}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Ghi chú nội bộ (Admin) */}
                                    <div className="mb-6">
                                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">Ghi chú nội bộ & Deadline Admin</p>
                                        <div className="flex gap-2">
                                            <input type="text" className="flex-grow p-2 border rounded text-sm bg-yellow-50 border-yellow-200" placeholder="Ghi chú cho đơn này..." value={noteInput} onChange={(e) => setNoteInput(e.target.value)} disabled={userRole === 'warehouse'} />
                                            {userRole === 'admin' && (
                                                <>
                                                    <input type="date" className="p-2 border rounded text-sm" value={adminDeadlineInput} onChange={(e) => setAdminDeadlineInput(e.target.value)} />
                                                    <button onClick={handleSaveAdminInfo} className="bg-black text-white px-4 rounded text-sm font-bold">Lưu</button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Nội dung chính */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                        <div>
                                            <h3 className="font-bold border-b pb-2 mb-3">Thông tin khách hàng</h3>
                                            <div className="text-sm space-y-2">
                                                <p><span className="text-gray-500">Tên:</span> {selectedOrder.customer.name}</p>
                                                <p><span className="text-gray-500">SĐT:</span> {selectedOrder.customer.phone}</p>
                                                <p><span className="text-gray-500">Địa chỉ:</span> {selectedOrder.customer.address}</p>
                                                {selectedOrder.delivery.notes && <p className="text-red-600 bg-red-50 p-2 rounded mt-2">Note: {selectedOrder.delivery.notes}</p>}
                                            </div>
                                        </div>
                                        {/* ẢNH SẢN PHẨM */}
                                        <div>
                                            <h3 className="font-bold border-b pb-2 mb-3">Ảnh thiết kế</h3>
                                            <div className="bg-gray-100 rounded-lg p-2 flex items-center justify-center min-h-[150px]">
                                                {selectedOrder.items[0]?.previewImageUrl ? (
                                                    <img src={selectedOrder.items[0].previewImageUrl} alt="Design" className="max-h-48 object-contain shadow-sm bg-white" />
                                                ) : <span className="text-gray-400 text-sm">Không có ảnh</span>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* PICKING LIST - QUAN TRỌNG CHO KHO */}
                                    <PickingList items={selectedOrder.items} allParts={products} />

                                    {/* Admin Actions */}
                                    {userRole === 'admin' && (
                                        <div className="mt-8 pt-6 border-t border-gray-100">
                                            <p className="text-xs text-gray-400 mb-3 text-center">Thay đổi trạng thái thủ công</p>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {['Chờ thanh toán', 'Đã xác nhận', 'Đang xử lý', 'Đang giao hàng', 'Đã giao hàng', 'Hủy đơn'].map(st => (
                                                    <button key={st} onClick={() => handleUpdate(selectedOrder.id, { status: st })} className={`px-3 py-1.5 text-xs font-bold border rounded hover:bg-gray-50 ${selectedOrder.status === st ? 'bg-black text-white border-black hover:bg-gray-800' : 'text-gray-600'}`}>{st}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-200 rounded-xl">
                                    <p className="mt-4">Chọn một đơn hàng để xem chi tiết</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- PRODUCTS --- */}
                {activeTab === 'products' && userRole === 'admin' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex gap-4 w-full max-w-md">
                                <input type="text" placeholder="Tìm tên sản phẩm..." className="flex-grow p-2 border rounded text-sm" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                                <select className="p-2 border rounded text-sm" value={productCategory} onChange={e => setProductCategory(e.target.value)}><option value="all">Tất cả</option><option value="hair">Tóc</option><option value="face">Mặt</option><option value="shirt">Áo</option><option value="pants">Quần</option><option value="accessory">Phụ kiện</option><option value="pet">Thú cưng</option></select>
                            </div>
                            <button onClick={() => { setEditingPart(null); setIsEditingProduct(true); }} className="bg-black text-white px-4 py-2 rounded text-sm font-bold">+ Thêm mới</button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                            {filteredProducts.map(part => (
                                <div key={part.id} className="border rounded-lg p-3 flex flex-col items-center group hover:border-black transition-colors relative">
                                    <div className="w-full aspect-square bg-gray-50 mb-2 rounded"><img src={part.imageUrl} className="w-full h-full object-contain" /></div>
                                    <p className="font-bold text-xs text-center truncate w-full">{part.name}</p>
                                    <p className="text-[10px] text-gray-500 capitalize">{part.type}</p>
                                    <p className="text-xs font-bold mt-1">{formatCurrency(part.price)}</p>
                                    <div className="absolute inset-0 bg-white/90 hidden group-hover:flex items-center justify-center gap-2">
                                        <button onClick={() => { setEditingPart(part); setIsEditingProduct(true); }} className="text-blue-600 text-xs font-bold underline">Sửa</button>
                                        <button onClick={() => handleDeleteProduct(part.id)} className="text-red-600 text-xs font-bold underline">Xóa</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isEditingProduct && <ProductForm initialData={editingPart} onSave={handleSaveProduct} onCancel={() => setIsEditingProduct(false)} />}
                {loading && <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50"><div className="text-black font-bold animate-pulse">Đang xử lý...</div></div>}
            </div>
        </div>
    );
};

export default AdminPage;