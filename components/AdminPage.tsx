// components/AdminPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { getAllOrders, updateOrderStatus } from '../services/orderService';
import type { Order } from '../types';

const AdminPage: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders'>('dashboard');

    const ADMIN_PASSWORD = "admin123"; 

    useEffect(() => {
        if (isAuthenticated) {
            fetchOrders();
        }
    }, [isAuthenticated]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            setIsAuthenticated(true);
        } else {
            alert("Sai mật khẩu! Gợi ý: admin123");
        }
    };

    const fetchOrders = async () => {
        setLoading(true);
        const data = await getAllOrders();
        setOrders(data);
        setLoading(false);
    };

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        if (confirm(`Đổi trạng thái đơn ${orderId} sang "${newStatus}"?`)) {
            const success = await updateOrderStatus(orderId, newStatus);
            if (success) {
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
                if (selectedOrder?.id === orderId) {
                    setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
                }
                alert("Đã cập nhật!");
            } else {
                alert("Lỗi cập nhật!");
            }
        }
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    
    // Hàm định dạng ngày tháng cho đẹp (VD: 20/11/2025)
    const formatDate = (dateString: string) => {
        if (!dateString) return 'Không rõ';
        return new Date(dateString).toLocaleDateString('vi-VN');
    };

    // --- TÍNH TOÁN THỐNG KÊ ---
    const stats = useMemo(() => {
        const totalRevenue = orders.reduce((acc, order) => acc + order.totalPrice, 0);
        const totalOrders = orders.length;
        const pendingOrders = orders.filter(o => o.status === 'Chờ thanh toán' || o.status === 'Đang xử lý').length;
        const completedOrders = orders.filter(o => o.status === 'Đã giao hàng').length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        return { totalRevenue, totalOrders, pendingOrders, completedOrders, avgOrderValue };
    }, [orders]);

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-lg w-96">
                    <h1 className="text-2xl font-bold mb-2 text-center text-luvin-pink font-heading">The Luvin Admin</h1>
                    <p className="text-center text-gray-500 mb-6 text-sm">Hệ thống quản lý đơn hàng</p>
                    <input 
                        type="password" 
                        placeholder="Mật khẩu truy cập" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-luvin-pink"
                    />
                    <button type="submit" className="w-full bg-luvin-pink text-gray-800 font-bold py-3 rounded-lg hover:opacity-90 transition-colors">
                        Đăng nhập
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="bg-white shadow-sm border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center text-2xl font-heading text-luvin-pink font-bold mr-8">
                                The Luvin Admin
                            </div>
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                <button 
                                    onClick={() => setActiveTab('dashboard')}
                                    className={`${activeTab === 'dashboard' ? 'border-luvin-pink text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                                >
                                    Dashboard
                                </button>
                                <button 
                                    onClick={() => setActiveTab('orders')}
                                    className={`${activeTab === 'orders' ? 'border-luvin-pink text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                                >
                                    Đơn hàng ({orders.length})
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center">
                             <button onClick={fetchOrders} className="p-2 text-gray-400 hover:text-gray-500" title="Làm mới dữ liệu">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                             </button>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="p-5">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                                            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <div className="ml-5 w-0 flex-1">
                                            <dl>
                                                <dt className="text-sm font-medium text-gray-500 truncate">Tổng doanh thu</dt>
                                                <dd className="text-lg font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</dd>
                                            </dl>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="p-5">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                                            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                        </div>
                                        <div className="ml-5 w-0 flex-1">
                                            <dl>
                                                <dt className="text-sm font-medium text-gray-500 truncate">Tổng đơn hàng</dt>
                                                <dd className="text-lg font-bold text-gray-900">{stats.totalOrders}</dd>
                                            </dl>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="p-5">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                                            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <div className="ml-5 w-0 flex-1">
                                            <dl>
                                                <dt className="text-sm font-medium text-gray-500 truncate">Chờ xử lý</dt>
                                                <dd className="text-lg font-bold text-gray-900">{stats.pendingOrders}</dd>
                                            </dl>
                                        </div>
                                    </div>
                                </div>
                            </div>
                             <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="p-5">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                                            <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                        </div>
                                        <div className="ml-5 w-0 flex-1">
                                            <dl>
                                                <dt className="text-sm font-medium text-gray-500 truncate">Giá trị TB/Đơn</dt>
                                                <dd className="text-lg font-bold text-gray-900">{formatCurrency(stats.avgOrderValue)}</dd>
                                            </dl>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Đơn hàng mới nhất</h3>
                        <div className="bg-white shadow overflow-hidden sm:rounded-md">
                            <ul className="divide-y divide-gray-200">
                                {orders.slice(0, 5).map((order) => (
                                    <li key={order.id} onClick={() => { setSelectedOrder(order); setActiveTab('orders'); }} className="cursor-pointer hover:bg-gray-50">
                                        <div className="px-4 py-4 sm:px-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <p className="text-sm font-medium text-luvin-pink truncate">{order.id}</p>
                                                    <p className="text-xs text-gray-400 mt-1">Ngày nhận: {formatDate(order.delivery.date)}</p>
                                                </div>
                                                <div className="ml-2 flex-shrink-0 flex">
                                                    <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                        order.status === 'Đã giao hàng' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                        {order.status}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-2 sm:flex sm:justify-between">
                                                <div className="sm:flex">
                                                    <p className="flex items-center text-sm text-gray-500">
                                                        {order.customer.name} - {order.customer.phone}
                                                    </p>
                                                </div>
                                                <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                                    <p>{formatCurrency(order.totalPrice)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === 'orders' && (
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
                        {/* Cột trái: Danh sách đơn hàng */}
                        <div className="lg:col-span-1 bg-white rounded-lg shadow overflow-hidden overflow-y-auto">
                            {orders.map(order => (
                                <div 
                                    key={order.id} 
                                    onClick={() => setSelectedOrder(order)}
                                    className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedOrder?.id === order.id ? 'bg-pink-50 border-l-4 border-luvin-pink' : ''}`}
                                >
                                    <div className="flex justify-between mb-1">
                                        <span className="font-bold text-gray-800">{order.id}</span>
                                        <span className="text-xs text-gray-500">Mới</span>
                                    </div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>{order.customer.name}</span>
                                        <span className={`font-semibold px-2 py-0.5 rounded text-xs ${
                                            order.status === 'Chờ thanh toán' ? 'bg-yellow-100 text-yellow-800' :
                                            order.status === 'Đã giao hàng' ? 'bg-green-100 text-green-800' :
                                            'bg-blue-100 text-blue-800'
                                        }`}>{order.status}</span>
                                    </div>
                                    {/* Hiển thị ngày nhận hàng ngay ở danh sách để dễ nhìn */}
                                    <div className="flex justify-between items-end mt-2">
                                        <span className="text-xs font-semibold bg-gray-100 px-2 py-1 rounded text-gray-600">
                                            📅 {formatDate(order.delivery.date)}
                                        </span>
                                        <div className="text-right font-bold text-luvin-pink">
                                            {formatCurrency(order.totalPrice)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
        
                        {/* Cột phải: Chi tiết đơn hàng */}
                        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6 overflow-y-auto">
                            {selectedOrder ? (
                                <div>
                                    <div className="flex justify-between items-start border-b pb-4 mb-4">
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-800">Chi tiết đơn: {selectedOrder.id}</h2>
                                            <p className="text-gray-500 text-sm mt-1">Trạng thái hiện tại: <span className="font-bold">{selectedOrder.status}</span></p>
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            {['Chờ thanh toán', 'Đã xác nhận', 'Đang xử lý', 'Đang giao hàng', 'Đã giao hàng', 'Hủy đơn'].map(st => (
                                                <button 
                                                    key={st} 
                                                    onClick={() => handleStatusChange(selectedOrder.id, st)}
                                                    className={`px-3 py-1 text-xs border rounded hover:opacity-80 transition-colors ${selectedOrder.status === st ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}
                                                >
                                                    {st}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
        
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Thông tin khách hàng */}
                                        <div>
                                            <h3 className="font-bold text-gray-700 mb-3 uppercase text-sm border-b pb-1">Thông tin khách hàng</h3>
                                            <div className="space-y-3 text-sm">
                                                <p><span className="font-semibold w-24 inline-block text-gray-500">Họ tên:</span> {selectedOrder.customer.name}</p>
                                                <p><span className="font-semibold w-24 inline-block text-gray-500">SĐT:</span> {selectedOrder.customer.phone}</p>
                                                <p><span className="font-semibold w-24 inline-block text-gray-500">Email:</span> {selectedOrder.customer.email}</p>
                                                <p><span className="font-semibold w-24 inline-block text-gray-500">Địa chỉ:</span> {selectedOrder.customer.address}</p>
                                                
                                                {/* LÀM NỔI BẬT NGÀY NHẬN HÀNG */}
                                                <div className="mt-4">
                                                     <p className="flex items-center gap-2">
                                                        <span className="font-semibold w-24 inline-block text-gray-500">Ngày nhận:</span> 
                                                        <span className="font-bold text-red-600 bg-red-50 px-3 py-1 rounded border border-red-200 text-base">
                                                            {formatDate(selectedOrder.delivery.date)}
                                                        </span>
                                                    </p>
                                                </div>

                                                <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mt-2">
                                                    <p className="font-semibold text-yellow-800 mb-1">Ghi chú của khách:</p>
                                                    <p className="italic text-gray-700">{selectedOrder.delivery.notes || 'Không có ghi chú'}</p>
                                                </div>
                                            </div>
                                        </div>
        
                                        {/* Thông tin thanh toán */}
                                        <div>
                                            <h3 className="font-bold text-gray-700 mb-3 uppercase text-sm border-b pb-1">Thanh toán & Vận chuyển</h3>
                                            <div className="space-y-2 text-sm">
                                                <p><span className="font-semibold w-24 inline-block text-gray-500">Hình thức:</span> {selectedOrder.payment.method === 'deposit' ? 'Chuyển khoản cọc 70%' : 'Chuyển khoản toàn bộ'}</p>
                                                <p><span className="font-semibold w-24 inline-block text-gray-500">Vận chuyển:</span> {selectedOrder.shipping.method === 'express' ? 'Hỏa tốc' : 'Tiêu chuẩn'}</p>
                                                <p><span className="font-semibold w-24 inline-block text-gray-500">Phí ship:</span> {formatCurrency(selectedOrder.shipping.fee)}</p>
                                                <div className="pt-2 border-t mt-2 bg-gray-50 p-3 rounded">
                                                    <p className="flex justify-between font-bold text-base mb-1">
                                                        <span>Tổng tiền:</span>
                                                        <span className="text-luvin-pink text-lg">{formatCurrency(selectedOrder.totalPrice)}</span>
                                                    </p>
                                                    <p className="flex justify-between text-red-600 font-semibold">
                                                        <span>Cần thu (COD):</span>
                                                        <span>{formatCurrency(selectedOrder.amountToPay)}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
        
                                    {/* Ảnh thiết kế */}
                                    <div className="mt-8">
                                        <h3 className="font-bold text-gray-700 mb-3 uppercase text-sm border-b pb-1">Sản phẩm thiết kế</h3>
                                        <div className="bg-gray-100 p-4 rounded-lg flex justify-center items-center min-h-[200px]">
                                            {selectedOrder.items[0]?.previewImageUrl ? (
                                                <img 
                                                    src={selectedOrder.items[0].previewImageUrl} 
                                                    alt="Design Preview" 
                                                    className="max-h-[400px] object-contain shadow-lg bg-white border-4 border-white" 
                                                />
                                            ) : (
                                                <div className="text-center text-gray-500">
                                                    <p>Không có ảnh xem trước.</p>
                                                    <p className="text-xs mt-1">(Có thể do lúc đặt hàng tính năng upload ảnh bị tắt)</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                    <p>Chọn một đơn hàng bên trái để xem chi tiết</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminPage;