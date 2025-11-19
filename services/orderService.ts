// services/orderService.ts
import { db, storage } from '../config/firebase';
import { collection, setDoc, doc, getDoc, getDocs, query, orderBy, updateDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { Order } from '../types';

// Hàm phụ: Upload ảnh (Để đó sau này dùng)
const uploadImageToStorage = async (dataUrl: string, orderId: string, timestamp: number) => {
    try {
        const storageRef = ref(storage, `orders/${orderId}/preview_${timestamp}.png`);
        await uploadString(storageRef, dataUrl, 'data_url');
        return await getDownloadURL(storageRef);
    } catch (error) {
        console.error("Lỗi upload ảnh:", error);
        return null;
    }
};

// 1. Hàm tạo đơn hàng mới (LƯU Ý: ĐÃ CẬP NHẬT ĐỂ LƯU createdAt)
export const createOrder = async (order: Omit<Order, 'status'>) => {
    try {
        // Tắt upload ảnh tạm thời để tránh lỗi treo
        const itemsWithImages = await Promise.all(order.items.map(async (item) => {
            if (item.previewImageUrl && item.previewImageUrl.startsWith('data:image')) {
                // Thay vì upload, trả về rỗng để đơn hàng đi qua luôn
                return { ...item, previewImageUrl: "" }; 
            }
            return item;
        }));

        const finalOrder = {
            ...order,
            items: itemsWithImages,
            status: "Chờ thanh toán",
            internalNotes: "",
            isUrgent: false,
            adminDeadline: "",
            // --- QUAN TRỌNG: Lưu thời gian tạo chuẩn để Dashboard lọc được ---
            createdAt: new Date().toISOString()
        };

        // Lưu đơn hàng vào Firestore
        // @ts-ignore
        await setDoc(doc(db, "orders", order.id), finalOrder);

        return { success: true, data: finalOrder as Order };
    } catch (error) {
        console.error("Lỗi tạo đơn hàng:", error);
        return { success: false, error };
    }
};

// 2. Hàm tra cứu đơn hàng
export const getOrderById = async (orderId: string): Promise<Order | null> => {
    try {
        const docRef = doc(db, "orders", orderId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as Order) : null;
    } catch (error) {
        console.error("Lỗi lấy đơn hàng:", error);
        return null;
    }
};

// 3. Hàm lấy toàn bộ danh sách đơn hàng
export const getAllOrders = async (): Promise<Order[]> => {
    try {
        const q = query(collection(db, "orders"), orderBy("id", "desc")); 
        const querySnapshot = await getDocs(q);
        
        const orders: Order[] = [];
        querySnapshot.forEach((doc) => {
            orders.push(doc.data() as Order);
        });
        return orders;
    } catch (error) {
        console.error("Lỗi lấy danh sách đơn:", error);
        return [];
    }
};

// 4. Hàm cập nhật thông tin đơn hàng
export const updateOrder = async (orderId: string, updates: Partial<Order>) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, updates);
        return true;
    } catch (error) {
        console.error("Lỗi cập nhật đơn hàng:", error);
        return false;
    }
};