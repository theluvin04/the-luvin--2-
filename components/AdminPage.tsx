// components/AdminPage.tsx
import React, { useState, useEffect } from 'react';
import { getAllOrders, updateOrderStatus } from '../services/orderService';
import type { Order } from '../types';

const AdminPage: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(false);

    // Mật khẩu đăng nhập Admin (Bạn có thể sửa lại tùy ý)
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
            alert("Sai mật khẩu!");
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
                // Cập nhật lại giao diện sau khi lưu thành công
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
                if (selectedOrder?.id === orderId) {
                    setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
                }
                alert("Cập nhật thành công!");
            } else {
                alert("Lỗi cập nhật!");
            }
        }
    };

    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    // Màn hình đăng nhập
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-md w-80">
                    <h2 className="text-xl font-bold mb-4 text-center text-gray-800">Admin Login</h2>
                    <input 
                        type="password" 
                        placeholder="Nhập mật khẩu..." 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full p-2 border rounded mb-4"
                    />
                    <button type="submit" className="w-full bg-luvin-pink text-gray-800 font-bold py-2 rounded hover:opacity-90">Đăng nhập</button>
                </form>
            </div>
        );
    }

    // Màn hình quản lý chính
    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Quản lý đơn hàng</h1>
                <button onClick={fetchOrders} className="bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-100">
                    {loading ? 'Đang tải...' : 'Làm mới'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cột trái: Danh sách đơn hàng */}
                <div className="lg:col-span-1 bg-white rounded-lg shadow overflow-hidden h-[80vh] overflow-y-auto">
                    {orders.map(order => (
                        <div 
                            key={order.id} 
                            onClick={() => setSelectedOrder(order)}
                            className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedOrder?.id === order.id ? 'bg-pink-50 border-l-4 border-luvin-pink' : ''}`}
                        >
                            <div className="flex justify-between mb-1">
                                <span className="font-bold text-gray-800">{order.id}</span>
                                {/* Hiển thị ngày tạo nếu có, hoặc ẩn đi */}
                                <span className="text-xs text-gray-500">Đơn mới</span>
                            </div>
                            <div className="flex justify-between text-sm mb-1">
                                <span>{order.customer.name}</span>
                                <span className={`font-semibold px-2 py-0.5 rounded text-xs ${
                                    order.status === 'Chờ thanh toán' ? 'bg-yellow-100 text-yellow-800' :
                                    order.status === 'Đã giao hàng' ? 'bg-green-100 text-green-800' :
                                    'bg-blue-100 text-blue-800'
                                }`}>{order.status}</span>
                            </div>
                            <div className="text-right font-bold text-luvin-pink">
                                {formatCurrency(order.totalPrice)}
                            </div>
                        </div>
                    ))}
                    {orders.length === 0 && !loading && <p className="p-4 text-center text-gray-500">Chưa có đơn hàng nào.</p>}
                </div>

                {/* Cột phải: Chi tiết đơn hàng */}
                <div className="lg:col-span-2 bg-white rounded-lg shadow p-6 h-[80vh] overflow-y-auto">
                    {selectedOrder ? (
                        <div>
                            <div className="flex justify-between items-start border-b pb-4 mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">Chi tiết đơn: {selectedOrder.id}</h2>
                                    <p className="text-gray-500 text-sm mt-1">Trạng thái hiện tại: <span className="font-bold">{selectedOrder.status}</span></p>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {['Chờ thanh toán', 'Đã xác nhận', 'Đang giao hàng', 'Đã giao hàng', 'Hủy đơn'].map(st => (
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
                                    <h3 className="font-bold text-gray-700 mb-3 uppercase text-sm">Thông tin khách hàng</h3>
                                    <div className="space-y-2 text-sm">
                                        <p><span className="font-semibold">Họ tên:</span> {selectedOrder.customer.name}</p>
                                        <p><span className="font-semibold">SĐT:</span> {selectedOrder.customer.phone}</p>
                                        <p><span className="font-semibold">Email:</span> {selectedOrder.customer.email}</p>
                                        <p><span className="font-semibold">Địa chỉ:</span> {selectedOrder.customer.address}</p>
                                        <p><span className="font-semibold">Ghi chú:</span> {selectedOrder.delivery.notes || 'Không'}</p>
                                    </div>
                                </div>

                                {/* Thông tin thanh toán */}
                                <div>
                                    <h3 className="font-bold text-gray-700 mb-3 uppercase text-sm">Thanh toán & Vận chuyển</h3>
                                    <div className="space-y-2 text-sm">
                                        <p><span className="font-semibold">Hình thức TT:</span> {selectedOrder.payment.method === 'deposit' ? 'Cọc 70%' : 'Toàn bộ'}</p>
                                        <p><span className="font-semibold">Vận chuyển:</span> {selectedOrder.shipping.method}</p>
                                        <p><span className="font-semibold">Phí ship:</span> {formatCurrency(selectedOrder.shipping.fee)}</p>
                                        <div className="pt-2 border-t mt-2">
                                            <p className="flex justify-between font-bold text-base">
                                                <span>Tổng tiền:</span>
                                                <span className="text-luvin-pink">{formatCurrency(selectedOrder.totalPrice)}</span>
                                            </p>
                                            <p className="flex justify-between text-red-600 font-semibold">
                                                <span>Cần thu:</span>
                                                <span>{formatCurrency(selectedOrder.amountToPay)}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Ảnh thiết kế */}
                            <div className="mt-8">
                                <h3 className="font-bold text-gray-700 mb-3 uppercase text-sm">Sản phẩm thiết kế</h3>
                                <div className="bg-gray-100 p-4 rounded-lg flex justify-center items-center min-h-[200px]">
                                    {selectedOrder.items[0]?.previewImageUrl ? (
                                        <img 
                                            src={selectedOrder.items[0].previewImageUrl} 
                                            alt="Design Preview" 
                                            className="max-h-[400px] object-contain shadow-lg bg-white" 
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
                        <div className="flex items-center justify-center h-full text-gray-400">
                            Chọn một đơn hàng để xem chi tiết
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPage;