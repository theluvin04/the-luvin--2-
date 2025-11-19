// components/AdminPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { getAllOrders, updateOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase } from '../services/productService';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'; 
import type { Order, LegoPart } from '../types';
import { LEGO_PARTS } from '../constants';

// --- CẤU HÌNH PHÂN QUYỀN ---
const USER_ROLES: Record<string, 'admin' | 'warehouse'> = {
    "theluvin.gifts@gmail.com": "admin",
    "jinbduong@gmail.com": "admin", // Thêm email của bạn vào đây
    "kho1@gmail.com": "warehouse",
    "kho2@gmail.com": "warehouse",
};

// --- Form Sản phẩm (Giữ nguyên) ---
const ProductForm: React.FC<{ initialData?: LegoPart | null; onSave: (part: LegoPart) => void; onCancel: () => void }> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<LegoPart>(initialData || { id: `part_${Date.now()}`, name: '', price: 0, imageUrl: '', type: 'accessory', widthCm: 1, heightCm: 1 });
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: name === 'price' || name === 'widthCm' || name === 'heightCm' ? Number(value) : value })); };
    return ( <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"> <div className="bg-white p-6 rounded-lg shadow-xl w-96 max-h-[90vh] overflow-y-auto"> <h3 className="text-lg font-bold mb-4">{initialData ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3> <div className="space-y-3"> <div><label className="block text-xs font-bold text-gray-700">Tên hiển thị</label><input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Ví dụ: Tóc xoăn vàng" /></div> <div><label className="block text-xs font-bold text-gray-700">Loại</label> <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border rounded"> <option value="hair">Tóc</option><option value="face">Mặt</option><option value="shirt">Áo</option><option value="pants">Quần</option><option value="hat">Mũ</option><option value="accessory">Phụ kiện</option><option value="pet">Thú cưng</option> </select> </div> <div><label className="block text-xs font-bold text-gray-700">Giá tiền (VNĐ)</label><input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2 border rounded" /></div> <div><label className="block text-xs font-bold text-gray-700">Link Ảnh (URL)</label><input name="imageUrl" value={formData.imageUrl} onChange={handleChange} className="w-full p-2 border rounded" />{formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="mt-2 h-16 object-contain mx-auto border" />}</div> <div className="grid grid-cols-2 gap-2"> <div><label className="block text-xs font-bold text-gray-700">Rộng (cm)</label><input type="number" name="widthCm" value={formData.widthCm} onChange={handleChange} className="w-full p-2 border rounded" step="0.1" /></div> <div><label className="block text-xs font-bold text-gray-700">Cao (cm)</label><input type="number" name="heightCm" value={formData.heightCm} onChange={handleChange} className="w-full p-2 border rounded" step="0.1" /></div> </div> </div> <div className="flex justify-end gap-2 mt-6"><button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Hủy</button><button onClick={() => onSave(formData)} className="px-4 py-2 bg-luvin-pink text-white font-bold rounded hover:opacity-90">Lưu</button></div> </div> </div> );
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Đã giao hàng': return 'bg-green-500 hover:bg-green-600';
        case 'Đã xác nhận': case 'Đang xử lý': return 'bg-blue-500 hover:bg-blue-600';
        case 'Đang giao hàng': return 'bg-orange-500 hover:bg-orange-600';
        case 'Hủy đơn': return 'bg-red-500 hover:bg-red-600';
        default: return 'bg-yellow-500 hover:bg-yellow-600';
    }
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
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(thirtyDaysAgo); 
    const [endDate, setEndDate] = useState(today); 
    const [comparisonEnabled, setComparisonEnabled] = useState(false);
    const [quickDateFilter, setQuickDateFilter] = useState('30days'); 

    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);
    const [noteInput, setNoteInput] = useState('');
    const [adminDeadlineInput, setAdminDeadlineInput] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'urgent'>('newest');
    const [productSearch, setProductSearch] = useState('');
    const [productCategory, setProductCategory] = useState('all');

    // --- THEO DÕI ĐĂNG NHẬP & PHÂN QUYỀN ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && user.email) {
                // Lấy quyền từ danh sách cứng
                const role = USER_ROLES[user.email];
                
                if (role) {
                    setCurrentUser(user);
                    setUserRole(role);
                    
                    // --- LOGIC CHẶN QUYỀN TẠI ĐÂY ---
                    if (role === 'warehouse') {
                        setActiveTab('orders'); // Kho vào thẳng đơn hàng
                    } else {
                        setActiveTab('dashboard'); // Admin vào dashboard
                    }

                    fetchOrders();
                    if (role === 'admin') fetchProducts();
                } else {
                    // Nếu email không có trong danh sách -> Đá ra
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

    // Chặn chuyển tab thủ công nếu là kho
    const handleSwitchTab = (tab: 'dashboard' | 'orders' | 'products') => {
        if (userRole === 'warehouse' && (tab === 'dashboard' || tab === 'products')) {
            alert("Bạn không có quyền truy cập mục này!");
            return;
        }
        setActiveTab(tab);
    }

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
            }
        }
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    const formatDate = (dateString: string) => (!dateString) ? '---' : new Date(dateString).toLocaleDateString('vi-VN');
    const formatDateTime = (dateString: string) => (!dateString) ? '---' : new Date(dateString).toLocaleString('vi-VN');

    const stats = useMemo(() => {
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime() + 86400000;
        const filteredOrders = orders.filter(order => {
            if (!order.id || order.id.length < 6) return false; 
            const ts = Number(order.id.slice(-6)) * 1000; 
            const finalTs = isNaN(ts) ? Date.now() : ts; 
            return finalTs >= start && finalTs <= end;
        });

        const totalRevenue = filteredOrders.reduce((acc, order) => acc + order.totalPrice, 0);
        const totalOrders = filteredOrders.length;
        const pendingOrders = filteredOrders.filter(o => o.status === 'Chờ thanh toán' || o.status === 'Đang xử lý').length;
        const urgentOrders = filteredOrders.filter(o => o.isUrgent).length;
        const totalRefund = filteredOrders.filter(o => o.status === 'Hủy đơn').reduce((acc, order) => acc + order.totalPrice, 0);
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        
        const topCharms = Object.values(filteredOrders.flatMap(order => order.items.flatMap(frame => frame.draggableItems.map(item => item.partId)))
            .reduce((acc, partId) => {
                const product = products.find(p => p.id === partId);
                const name = product ? product.name : partId;
                acc[partId] = (acc[partId] || { name, count: 0, type: product?.type || 'charm' });
                acc[partId].count++;
                return acc;
            }, {} as Record<string, { name: string, count: number, type: string }>))
            .sort((a, b) => b.count - a.count).slice(0, 5);
            
        const packerStats = Object.values(filteredOrders.reduce((acc, order) => {
            if (order.packerEmail) {
                const email = order.packerEmail;
                if (!acc[email]) acc[email] = { email, count: 0, revenue: 0 };
                acc[email].count++;
                acc[email].revenue += order.totalPrice;
            }
            return acc;
        }, {} as Record<string, { email: string, count: number, revenue: number }>))
        .sort((a, b) => b.count - a.count);

        return { totalRevenue, totalOrders, pendingOrders, urgentOrders, totalRefund, avgOrderValue, topCharms, packerStats };
    }, [orders, products, startDate, endDate]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
            const matchesCategory = productCategory === 'all' || p.type === productCategory;
            return matchesSearch && matchesCategory;
        });
    }, [products, productSearch, productCategory]);

    const sortedOrders = useMemo(() => {
        let result = [...orders];
        if (sortMode === 'urgent') {
            result.sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                if (a.adminDeadline && b.adminDeadline) return new Date(a.adminDeadline).getTime() - new Date(b.adminDeadline).getTime();
                if (!a.delivery.date) return 1;
                if (!b.delivery.date) return -1;
                return new Date(a.delivery.date).getTime() - new Date(b.delivery.date).getTime();
            });
        } else {
            result.sort((a, b) => (a.id < b.id ? 1 : -1));
        }
        return result;
    }, [orders, sortMode]);
    
    const activeOrders = useMemo(() => sortedOrders.filter(o => o.status !== 'Đã giao hàng' && o.status !== 'Hủy đơn'), [sortedOrders]);

    if (!currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-lg w-96 text-center">
                    <h1 className="text-3xl font-heading font-bold mb-2 text-luvin-pink">The Luvin</h1>
                    <p className="text-gray-400 mb-6 text-xs uppercase tracking-widest">Admin Portal</p>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input type="email" placeholder="Email nhân viên" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-luvin-pink outline-none" value={email} onChange={e => setEmail(e.target.value)} required />
                        <input type="password" placeholder="Mật khẩu" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-luvin-pink outline-none" value={loginPass} onChange={e => setLoginPass(e.target.value)} required />
                        {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
                        <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black transition-colors shadow-lg">Đăng nhập</button>
                    </form>
                    <p className="text-xs text-gray-400 mt-4">Liên hệ Admin để cấp tài khoản</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="bg-white shadow-sm border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
                    <div className="flex items-center">
                        <span className="text-2xl font-bold text-luvin-pink mr-8 font-heading">
                            {userRole === 'admin' ? 'Admin Pro' : 'Kho vận'}
                        </span>
                        <div className="hidden sm:flex space-x-6">
                            {/* LOGIC ẨN/HIỆN TAB THEO ROLE */}
                            {userRole === 'admin' && <button onClick={() => handleSwitchTab('dashboard')} className={`capitalize font-medium ${activeTab === 'dashboard' ? 'text-luvin-pink border-b-2 border-luvin-pink' : 'text-gray-500'}`}>Dashboard</button>}
                            
                            <button onClick={() => handleSwitchTab('orders')} className={`capitalize font-medium ${activeTab === 'orders' ? 'text-luvin-pink border-b-2 border-luvin-pink' : 'text-gray-500'}`}>Đơn hàng ({orders.length})</button>
                            
                            {userRole === 'admin' && <button onClick={() => handleSwitchTab('products')} className={`capitalize font-medium ${activeTab === 'products' ? 'text-luvin-pink border-b-2 border-luvin-pink' : 'text-gray-500'}`}>Sản phẩm ({products.length})</button>}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-bold text-gray-700 hidden sm:block">
                            {currentUser.email} <span className="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-600">{userRole}</span>
                        </span>
                        <button onClick={handleLogout} className="text-red-500 hover:bg-red-50 px-3 py-1 rounded border border-red-200 text-sm">Thoát</button>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* --- DASHBOARD (CHỈ ADMIN MỚI THẤY) --- */}
                {activeTab === 'dashboard' && userRole === 'admin' && (
                    <div className="space-y-6">
                        {/* ... (Nội dung Dashboard giữ nguyên, không thay đổi) ... */}
                        <div className="bg-white shadow rounded-lg p-4 flex flex-wrap items-center gap-4">
                             <h3 className="text-lg font-bold text-gray-800 mr-4">Phân tích:</h3>
                             <div className="flex gap-2">{['today', '7days', '30days', 'all'].map(key => (<button key={key} onClick={() => setQuickDateFilter(key)} className={`px-3 py-1 text-sm rounded-full font-medium ${quickDateFilter === key ? 'bg-luvin-pink text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{key === 'today' ? 'Hôm nay' : key === '7days' ? '7 ngày' : key === '30days' ? '30 ngày' : 'Toàn bộ'}</button>))}</div>
                             <div className="flex items-center gap-2 border-l pl-4 ml-4"><input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setQuickDateFilter('')}} className="p-2 border rounded text-sm focus:ring-luvin-pink" /><span>đến</span><input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setQuickDateFilter('')}} className="p-2 border rounded text-sm focus:ring-luvin-pink" /></div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            <div className="bg-white p-5 rounded-lg shadow border-l-4 border-green-500"><dt className="text-sm text-gray-500">Doanh thu</dt><dd className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</dd></div>
                            <div className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-500"><dt className="text-sm text-gray-500">Đơn hàng</dt><dd className="text-2xl font-bold">{stats.totalOrders}</dd></div>
                            <div className="bg-white p-5 rounded-lg shadow border-l-4 border-purple-500"><dt className="text-sm text-gray-500">TB/Đơn</dt><dd className="text-2xl font-bold">{formatCurrency(stats.avgOrderValue)}</dd></div>
                            <div className="bg-white p-5 rounded-lg shadow border-l-4 border-red-500"><dt className="text-sm text-gray-500">Cần xử lý gấp</dt><dd className="text-2xl font-bold text-red-600">{stats.urgentOrders}</dd></div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                             <div className="bg-white shadow rounded-lg p-6"><h3 className="text-lg font-bold text-gray-800 mb-4">🏆 Top 5 Phụ kiện</h3><div className="space-y-3">{stats.topCharms.length > 0 ? stats.topCharms.map((item, idx) => (<div key={idx} className="flex justify-between items-center border-b pb-2 last:border-0"><div className="flex items-center gap-3"><span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx === 0 ? 'bg-yellow-400 text-white' : 'bg-gray-200'}`}>{idx + 1}</span><span className="text-sm font-medium">{item.name}</span><span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500 capitalize">{item.type}</span></div><span className="font-bold text-luvin-pink">{item.count} lần</span></div>)) : <p className="text-gray-500">Chưa có dữ liệu thống kê.</p>}</div></div>
                             <div className="bg-white shadow rounded-lg p-6"><h3 className="text-lg font-bold text-gray-800 mb-4">👷 Hiệu suất bọc hàng</h3><div className="space-y-3">{stats.packerStats.length > 0 ? stats.packerStats.map((packer, idx) => (<div key={idx} className="flex justify-between items-center border-b pb-2 last:border-0"><div className="flex items-center gap-3"><span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">{idx + 1}</span><span className="text-sm font-medium">{packer.email}</span></div><div className="text-right"><p className="font-bold text-gray-800">{packer.count} đơn</p><p className="text-xs text-gray-500">{formatCurrency(packer.revenue)}</p></div></div>)) : <p className="text-gray-500">Chưa có đơn hàng nào được đánh dấu bọc.</p>}</div></div>
                        </div>
                    </div>
                )}

                {/* --- ORDERS (AI CŨNG THẤY) --- */}
                {activeTab === 'orders' && (
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
                        <div className="lg:col-span-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
                            <div className="p-3 border-b bg-gray-50 flex gap-2"><button onClick={() => setSortMode('newest')} className={`flex-1 py-2 text-xs font-bold rounded ${sortMode === 'newest' ? 'bg-white border-luvin-pink text-luvin-pink border' : 'bg-gray-200'}`}>Mới nhất</button><button onClick={() => setSortMode('urgent')} className={`flex-1 py-2 text-xs font-bold rounded ${sortMode === 'urgent' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>Cần làm gấp 🔥</button></div>
                            <div className="overflow-y-auto flex-grow">{activeOrders.map(order => (<div key={order.id} onClick={() => setSelectedOrder(order)} className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedOrder?.id === order.id ? 'bg-pink-50 border-l-4 border-luvin-pink' : ''} ${order.isUrgent ? 'bg-red-50' : ''}`}><div className="flex justify-between mb-1"><span className="font-bold text-gray-800 flex items-center gap-1">{order.isUrgent && <span>🔥</span>} {order.id}</span><span className={`text-xs px-2 rounded ${order.adminDeadline ? 'bg-red-100 text-red-800 font-bold' : 'bg-gray-100 text-gray-500'}`}>{order.adminDeadline ? `Hạn chốt: ${formatDate(order.adminDeadline)}` : `Khách hẹn: ${formatDate(order.delivery.date)}`}</span></div><div className="flex justify-between text-sm"><span className="text-gray-600">{order.customer.name}</span>{userRole === 'admin' && <span className="font-bold text-luvin-pink">{formatCurrency(order.totalPrice)}</span>}</div></div>))}</div>
                            <p className="p-2 text-center text-xs text-gray-500 border-t bg-gray-50">Đơn hoàn thành/hủy đã ẩn.</p>
                        </div>
                        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6 overflow-y-auto">
                            {selectedOrder ? (
                                <div>
                                    <div className="flex justify-between items-center border-b pb-4 mb-4"><h2 className="text-xl font-bold">{selectedOrder.id} <span className="text-sm font-normal text-gray-500">({selectedOrder.status})</span></h2><label className="flex items-center cursor-pointer bg-gray-100 px-3 py-2 rounded hover:bg-gray-200"><input type="checkbox" className="mr-2" checked={selectedOrder.isUrgent || false} onChange={(e) => handleUpdate(selectedOrder.id, { isUrgent: e.target.checked }, false)} /><span className="text-sm font-bold text-red-600">Đánh dấu Gấp 🔥</span></label></div>
                                    
                                    {/* NÚT BỌC HÀNG */}
                                    {!selectedOrder.packedAt ? (
                                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-6 flex items-center justify-between">
                                            <div><h3 className="font-bold text-green-800">Trạng thái: Chưa đóng gói</h3><p className="text-sm text-green-600">Hãy kiểm tra kỹ sản phẩm trước khi đóng.</p></div>
                                            <button onClick={handleConfirmPacked} className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold shadow hover:bg-green-700 transition-transform transform hover:scale-105">📦 Xác nhận ĐÃ BỌC XONG</button>
                                        </div>
                                    ) : (
                                        <div className="bg-gray-100 border border-gray-300 p-4 rounded-lg mb-6"><p className="text-gray-600 font-medium">✅ Đã bọc bởi: <span className="font-bold text-gray-800">{selectedOrder.packerEmail}</span></p><p className="text-xs text-gray-500">Vào lúc: {formatDateTime(selectedOrder.packedAt)}</p></div>
                                    )}

                                    <div className="bg-blue-50 p-4 rounded border border-blue-100 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-blue-800 mb-1">Ghi chú nội bộ</label><input type="text" className="w-full p-2 border rounded text-sm" placeholder="Ví dụ: Khách quen..." value={noteInput} onChange={(e) => setNoteInput(e.target.value)} /></div><div><label className="block text-xs font-bold text-blue-800 mb-1">Ngày CHỐT phải gửi (Admin)</label><input type="date" className="w-full p-2 border rounded text-sm" value={adminDeadlineInput} onChange={(e) => setAdminDeadlineInput(e.target.value)} /></div><div className="md:col-span-2 text-right"><button onClick={handleSaveAdminInfo} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700">Lưu thông tin Admin</button></div></div>
                                    <div className="grid grid-cols-2 gap-6 text-sm mb-6"><div><h3 className="font-bold border-b pb-1 mb-2">Khách hàng</h3><p>Tên: {selectedOrder.customer.name}</p><p>SĐT: {selectedOrder.customer.phone}</p><p>ĐC: {selectedOrder.customer.address}</p><p className="mt-2 bg-yellow-50 p-2 italic text-gray-600 border border-yellow-100">"{selectedOrder.delivery.notes || 'Không có ghi chú'}"</p></div><div><h3 className="font-bold border-b pb-1 mb-2">Thanh toán</h3><p>Tổng: <span className="text-luvin-pink font-bold">{userRole === 'admin' ? formatCurrency(selectedOrder.totalPrice) : '***'}</span></p><p>Cần thu (COD): <span className="text-red-600 font-bold">{formatCurrency(selectedOrder.amountToPay)}</span></p><p>Vận chuyển: {selectedOrder.shipping.method}</p></div></div>
                                    <div className="bg-gray-100 p-4 rounded flex justify-center">{selectedOrder.items[0]?.previewImageUrl ? <img src={selectedOrder.items[0].previewImageUrl} className="max-h-64 shadow-lg bg-white" /> : <span className="text-gray-400">Không có ảnh</span>}</div>
                                    
                                    {userRole === 'admin' && (
                                        <div className="mt-4 flex flex-wrap gap-2 justify-center">{['Chờ thanh toán', 'Đã xác nhận', 'Đang xử lý', 'Đang giao hàng', 'Đã giao hàng', 'Hủy đơn'].map(st => (<button key={st} onClick={() => handleUpdate(selectedOrder.id, { status: st })} className={`px-4 py-2 text-sm font-bold text-white rounded transition-colors ${getStatusColor(st)} ${selectedOrder.status === st ? 'opacity-100 ring-2 ring-offset-2 ring-luvin-pink' : 'opacity-80'}`}>{st}</button>))}</div>
                                    )}
                                </div>
                            ) : <div className="flex items-center justify-center h-full text-gray-400">Chọn đơn hàng</div>}
                        </div>
                    </div>
                )}

                {/* --- PRODUCTS (CHỈ ADMIN MỚI THẤY) --- */}
                {activeTab === 'products' && userRole === 'admin' && (
                    <div>
                        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                            <h2 className="text-lg font-bold text-gray-800">Kho Sản phẩm ({products.length})</h2>
                            <div className="flex flex-grow md:flex-grow-0 gap-2 w-full md:w-auto"><input type="text" placeholder="Tìm tên..." className="p-2 border rounded text-sm flex-grow" value={productSearch} onChange={e => setProductSearch(e.target.value)} /><select className="p-2 border rounded text-sm" value={productCategory} onChange={e => setProductCategory(e.target.value)}><option value="all">Tất cả loại</option><option value="hair">Tóc</option><option value="face">Mặt</option><option value="shirt">Áo</option><option value="pants">Quần</option><option value="accessory">Phụ kiện</option><option value="pet">Thú cưng</option></select></div>
                            <div className="flex gap-2">{products.length === 0 && <button onClick={handleSeedData} className="bg-yellow-500 text-white px-3 py-2 rounded text-sm font-bold">🔄 Đồng bộ</button>}<button onClick={() => { setEditingPart(null); setIsEditingProduct(true); }} className="bg-luvin-pink text-white px-3 py-2 rounded text-sm font-bold">+ Thêm</button></div>
                        </div>
                        <div className="bg-white shadow overflow-hidden rounded-lg"><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 p-4 max-h-[75vh] overflow-y-auto">{filteredProducts.map(part => (<div key={part.id} className="border rounded p-3 flex flex-col items-center group hover:shadow-md relative"><div className="w-full aspect-square bg-gray-50 mb-2"><img src={part.imageUrl} className="w-full h-full object-contain" /></div><h4 className="font-bold text-xs text-center truncate w-full" title={part.name}>{part.name}</h4><span className="text-[10px] bg-gray-100 px-1 rounded text-gray-500 mt-1">{part.type}</span><p className="text-sm text-luvin-pink font-bold mt-1">{formatCurrency(part.price)}</p><div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center gap-2 rounded transition-all"><button onClick={() => { setEditingPart(part); setIsEditingProduct(true); }} className="bg-white text-blue-600 p-2 rounded-full">✏️</button><button onClick={() => handleDeleteProduct(part.id)} className="bg-white text-red-600 p-2 rounded-full">🗑️</button></div></div>))}{filteredProducts.length === 0 && <p className="col-span-full text-center py-10 text-gray-400">Không tìm thấy sản phẩm nào.</p>}</div></div>
                    </div>
                )}

                {isEditingProduct && <ProductForm initialData={editingPart} onSave={handleSaveProduct} onCancel={() => setIsEditingProduct(false)} />}
                {loading && <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"><div className="bg-white p-4 rounded font-bold">Đang xử lý...</div></div>}
            </main>
        </div>
    );
};

export default AdminPage;