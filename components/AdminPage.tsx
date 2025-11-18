// components/AdminPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { getAllOrders, updateOrder } from '../services/orderService';
import { getAllParts, addPart, updatePart, deletePart, seedDatabase } from '../services/productService'; // Import mới
import type { Order, LegoPart } from '../types';

// Form để thêm/sửa sản phẩm
const ProductForm: React.FC<{ 
    initialData?: LegoPart | null; 
    onSave: (part: LegoPart) => void; 
    onCancel: () => void 
}> = ({ initialData, onSave, onCancel }) => {
    // Khởi tạo state từ dữ liệu cũ hoặc mặc định
    const [formData, setFormData] = useState<LegoPart>(initialData || {
        id: `part_${Date.now()}`, // Tự sinh ID nếu là mới
        name: '',
        price: 0,
        imageUrl: '',
        type: 'accessory', // Mặc định là phụ kiện
        widthCm: 1,
        heightCm: 1
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'price' || name === 'widthCm' || name === 'heightCm' ? Number(value) : value
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-96 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold mb-4">{initialData ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-700">Tên hiển thị</label>
                        <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Ví dụ: Tóc xoăn vàng" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700">Loại</label>
                        <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border rounded">
                            <option value="hair">Tóc</option>
                            <option value="face">Mặt</option>
                            <option value="shirt">Áo</option>
                            <option value="pants">Quần</option>
                            <option value="hat">Mũ</option>
                            <option value="accessory">Phụ kiện</option>
                            <option value="pet">Thú cưng</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700">Giá tiền (VNĐ)</label>
                        <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-full p-2 border rounded" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700">Link Ảnh (URL)</label>
                        <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} className="w-full p-2 border rounded" placeholder="https://..." />
                        {formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="mt-2 h-16 object-contain mx-auto border" />}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                             <label className="block text-xs font-bold text-gray-700">Rộng (cm)</label>
                             <input type="number" name="widthCm" value={formData.widthCm} onChange={handleChange} className="w-full p-2 border rounded" step="0.1" />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-gray-700">Cao (cm)</label>
                             <input type="number" name="heightCm" value={formData.heightCm} onChange={handleChange} className="w-full p-2 border rounded" step="0.1" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                    <button onClick={() => onSave(formData)} className="px-4 py-2 bg-luvin-pink text-white font-bold rounded hover:opacity-90">Lưu</button>
                </div>
            </div>
        </div>
    );
};

const AdminPage: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [orders, setOrders] = useState<Order[]>([]);
    const [products, setProducts] = useState<LegoPart[]>([]); // State cho danh sách sản phẩm
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'products'>('dashboard'); // Thêm tab products
    
    // State cho edit sản phẩm
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editingPart, setEditingPart] = useState<LegoPart | null>(null);

    // State khác
    const [noteInput, setNoteInput] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'urgent'>('newest');

    const ADMIN_PASSWORD = "admin123"; 

    useEffect(() => {
        if (isAuthenticated) {
            fetchOrders();
            fetchProducts(); // Tự động tải sản phẩm khi đăng nhập
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (selectedOrder) {
            setNoteInput(selectedOrder.internalNotes || '');
        }
    }, [selectedOrder]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            setIsAuthenticated(true);
        } else {
            alert("Sai mật khẩu! Gợi ý: admin123");
        }
    };

    const fetchOrders = async () => {
        const data = await getAllOrders();
        setOrders(data);
    };

    // Hàm tải sản phẩm từ Firebase
    const fetchProducts = async () => {
        const data = await getAllParts();
        setProducts(data);
    };

    // Hàm đồng bộ dữ liệu mẫu lần đầu
    const handleSeedData = async () => {
        if (confirm("Bạn có chắc muốn tải lại toàn bộ dữ liệu mẫu từ Code lên Firebase? (Dữ liệu cũ trên Firebase có thể bị ghi đè)")) {
            setLoading(true);
            const count = await seedDatabase();
            setLoading(false);
            alert(`Đã đồng bộ ${count} sản phẩm!`);
            fetchProducts(); // Tải lại danh sách để hiển thị
        }
    };

    const handleSaveProduct = async (part: LegoPart) => {
        setIsEditingProduct(false);
        if (editingPart) {
            // Đang sửa
            const success = await updatePart(part.id, part);
            if (success) alert("Cập nhật thành công!");
        } else {
            // Đang thêm mới
            const success = await addPart(part);
            if (success) alert("Thêm mới thành công!");
        }
        fetchProducts(); // Refresh danh sách
        setEditingPart(null);
    };

    const handleDeleteProduct = async (id: string) => {
        if (confirm("Bạn chắc chắn muốn xóa món đồ này?")) {
            await deletePart(id);
            fetchProducts();
        }
    };

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        if (confirm(`Đổi trạng thái đơn ${orderId} sang "${newStatus}"?`)) {
            const success = await updateOrder(orderId, { status: newStatus });
            if (success) {
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
                if (selectedOrder?.id === orderId) {
                    setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
                }
                alert("Đã cập nhật!");
            }
        }
    };

    const handleUpdate = async (orderId: string, updates: Partial<Order>, showMsg = true) => {
        const success = await updateOrder(orderId, updates);
        if (success) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, ...updates } : null);
            }
            if (showMsg) alert("Đã lưu thay đổi!");
        }
    };

    const handleSaveNote = () => {
        if (selectedOrder) {
            handleUpdate(selectedOrder.id, { internalNotes: noteInput });
        }
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    
    const formatDate = (dateString: string) => {
        if (!dateString) return 'Không rõ';
        return new Date(dateString).toLocaleDateString('vi-VN');
    };

    const stats = useMemo(() => {
        const totalRevenue = orders.reduce((acc, order) => acc + order.totalPrice, 0);
        const totalOrders = orders.length;
        const pendingOrders = orders.filter(o => o.status === 'Chờ thanh toán' || o.status === 'Đang xử lý').length;
        const urgentOrders = orders.filter(o => o.isUrgent).length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        return { totalRevenue, totalOrders, pendingOrders, urgentOrders, avgOrderValue };
    }, [orders]);

    const sortedOrders = useMemo(() => {
        let result = [...orders];
        if (sortMode === 'urgent') {
            result.sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                if (!a.delivery.date) return 1;
                if (!b.delivery.date) return -1;
                return new Date(a.delivery.date).getTime() - new Date(b.delivery.date).getTime();
            });
        } else {
            result.sort((a, b) => (a.id < b.id ? 1 : -1));
        }
        return result;
    }, [orders, sortMode]);

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-lg w-96">
                    <h1 className="text-2xl font-bold mb-2 text-center text-luvin-pink font-heading">The Luvin Admin</h1>
                    <p className="text-center text-gray-500 mb-6 text-sm">Hệ thống quản lý đơn hàng</p>
                    <input type="password" placeholder="Mật khẩu truy cập" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-luvin-pink" />
                    <button type="submit" className="w-full bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg hover:opacity-90 transition-colors">Đăng nhập</button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* --- TOPBAR --- */}
            <div className="bg-white shadow-sm border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center text-2xl font-heading text-luvin-pink font-bold mr-8">Admin</div>
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                <button onClick={() => setActiveTab('dashboard')} className={`${activeTab === 'dashboard' ? 'border-luvin-pink text-gray-900' : 'border-transparent text-gray-500'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>Dashboard</button>
                                <button onClick={() => setActiveTab('orders')} className={`${activeTab === 'orders' ? 'border-luvin-pink text-gray-900' : 'border-transparent text-gray-500'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>Đơn hàng ({orders.length})</button>
                                <button onClick={() => setActiveTab('products')} className={`${activeTab === 'products' ? 'border-luvin-pink text-gray-900' : 'border-transparent text-gray-500'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>Sản phẩm ({products.length})</button>
                            </div>
                        </div>
                        <div className="flex items-center">
                             <button onClick={() => { fetchOrders(); fetchProducts(); }} className="p-2 text-gray-400 hover:text-gray-500">🔄</button>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* --- TAB DASHBOARD (Giữ nguyên logic, rút gọn hiển thị cho đỡ dài code) --- */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                         {/* Stats Grid */}
                         <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="bg-white overflow-hidden shadow rounded-lg p-5"><dl><dt className="text-sm font-medium text-gray-500">Tổng doanh thu</dt><dd className="text-lg font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</dd></dl></div>
                            <div className="bg-white overflow-hidden shadow rounded-lg p-5"><dl><dt className="text-sm font-medium text-gray-500">Tổng đơn hàng</dt><dd className="text-lg font-bold text-gray-900">{stats.totalOrders}</dd></dl></div>
                            <div className="bg-white overflow-hidden shadow rounded-lg p-5"><dl><dt className="text-sm font-medium text-gray-500">Đơn Gấp</dt><dd className="text-lg font-bold text-red-600">{stats.urgentOrders}</dd></dl></div>
                            <div className="bg-white overflow-hidden shadow rounded-lg p-5"><dl><dt className="text-sm font-medium text-gray-500">Chờ xử lý</dt><dd className="text-lg font-bold text-yellow-600">{stats.pendingOrders}</dd></dl></div>
                        </div>
                    </div>
                )}

                {/* --- TAB ORDERS (Giữ nguyên code cũ) --- */}
                {activeTab === 'orders' && (
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
                        {/* Cột trái: Danh sách */}
                        <div className="lg:col-span-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
                             <div className="p-3 border-b bg-gray-50 flex gap-2">
                                <button onClick={() => setSortMode('newest')} className={`flex-1 py-2 text-xs font-bold rounded ${sortMode === 'newest' ? 'bg-white border border-luvin-pink text-luvin-pink' : 'bg-gray-200'}`}>Mới nhất</button>
                                <button onClick={() => setSortMode('urgent')} className={`flex-1 py-2 text-xs font-bold rounded ${sortMode === 'urgent' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>GẤP 🔥</button>
                            </div>
                            <div className="overflow-y-auto flex-grow">
                                {sortedOrders.map(order => (
                                    <div key={order.id} onClick={() => setSelectedOrder(order)} className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedOrder?.id === order.id ? 'bg-pink-50 border-l-4 border-luvin-pink' : ''} ${order.isUrgent ? 'bg-red-50' : ''}`}>
                                        <div className="flex justify-between mb-1"><span className="font-bold text-gray-800 flex items-center gap-1">{order.isUrgent && <span>🔥</span>} {order.id}</span><span className="text-xs text-gray-500">{order.customer.name}</span></div>
                                        <div className="flex justify-between text-sm"><span className="text-xs bg-gray-100 px-2 py-1 rounded">📅 {formatDate(order.delivery.date)}</span><span className="font-bold text-luvin-pink">{formatCurrency(order.totalPrice)}</span></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Cột phải: Chi tiết */}
                        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6 overflow-y-auto">
                            {selectedOrder ? (
                                <div>
                                    <div className="flex justify-between items-center border-b pb-4 mb-4">
                                        <h2 className="text-xl font-bold">{selectedOrder.id} <span className="text-sm font-normal text-gray-500">({selectedOrder.status})</span></h2>
                                        <label className="flex items-center cursor-pointer bg-gray-100 px-3 py-2 rounded hover:bg-gray-200"><input type="checkbox" className="mr-2" checked={selectedOrder.isUrgent || false} onChange={(e) => handleUpdate(selectedOrder.id, { isUrgent: e.target.checked }, false)} /><span className="text-sm font-bold">Đánh dấu Gấp 🔥</span></label>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded border border-blue-100 mb-4 flex gap-2">
                                        <input type="text" className="flex-grow p-2 border rounded text-sm" placeholder="Ghi chú nội bộ..." value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
                                        <button onClick={handleSaveNote} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold">Lưu</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div><h3 className="font-bold border-b pb-1 mb-2">Khách hàng</h3><p>Tên: {selectedOrder.customer.name}</p><p>SĐT: {selectedOrder.customer.phone}</p><p>ĐC: {selectedOrder.customer.address}</p></div>
                                        <div><h3 className="font-bold border-b pb-1 mb-2">Thanh toán</h3><p>Tổng: <span className="text-luvin-pink font-bold">{formatCurrency(selectedOrder.totalPrice)}</span></p><p>Cần thu: <span className="text-red-600 font-bold">{formatCurrency(selectedOrder.amountToPay)}</span></p></div>
                                    </div>
                                </div>
                            ) : <div className="flex items-center justify-center h-full text-gray-400">Chọn đơn hàng để xem chi tiết</div>}
                        </div>
                    </div>
                )}

                {/* --- TAB PRODUCTS (MỚI) --- */}
                {activeTab === 'products' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-gray-800">Danh sách phụ kiện LEGO ({products.length})</h2>
                            <div className="flex gap-2">
                                {products.length === 0 && (
                                    <button onClick={handleSeedData} className="bg-yellow-500 text-white px-4 py-2 rounded font-bold text-sm hover:bg-yellow-600">
                                        🔄 Đồng bộ dữ liệu mẫu
                                    </button>
                                )}
                                <button onClick={() => { setEditingPart(null); setIsEditingProduct(true); }} className="bg-luvin-pink text-white px-4 py-2 rounded font-bold text-sm hover:opacity-90">
                                    + Thêm mới
                                </button>
                            </div>
                        </div>

                        {/* Bảng sản phẩm */}
                        <div className="bg-white shadow overflow-hidden rounded-lg">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4 max-h-[75vh] overflow-y-auto">
                                {products.map(part => (
                                    <div key={part.id} className="border rounded-lg p-3 flex flex-col items-center relative group hover:shadow-md transition-shadow">
                                        <div className="w-full aspect-square bg-gray-100 rounded mb-2 overflow-hidden">
                                            <img src={part.imageUrl} alt={part.name} className="w-full h-full object-contain" />
                                        </div>
                                        <h4 className="font-bold text-sm text-center truncate w-full">{part.name}</h4>
                                        <p className="text-xs text-gray-500">{part.type}</p>
                                        <p className="text-sm text-luvin-pink font-bold">{formatCurrency(part.price)}</p>
                                        
                                        {/* Nút sửa/xóa hiện khi hover */}
                                        <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center gap-2 rounded-lg backdrop-blur-sm transition-all">
                                            <button onClick={() => { setEditingPart(part); setIsEditingProduct(true); }} className="bg-white text-blue-600 p-2 rounded-full hover:bg-blue-50" title="Sửa">✏️</button>
                                            <button onClick={() => handleDeleteProduct(part.id)} className="bg-white text-red-600 p-2 rounded-full hover:bg-red-50" title="Xóa">🗑️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Form */}
                {isEditingProduct && (
                    <ProductForm 
                        initialData={editingPart} 
                        onSave={handleSaveProduct} 
                        onCancel={() => setIsEditingProduct(false)} 
                    />
                )}

                {loading && (
                    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
                        <div className="bg-white p-4 rounded shadow-lg font-bold">Đang xử lý...</div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminPage;